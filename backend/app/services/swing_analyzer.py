from pathlib import Path
import subprocess

import time
import os
import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from google import genai

try:
    from google.api_core import exceptions as google_exceptions
except Exception:  # pragma: no cover - optional dependency in some envs
    google_exceptions = None

VISIBLE_POINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
POSE_CONNECTIONS = [
    (11, 13),
    (13, 15),
    (12, 14),
    (14, 16),
    (11, 23),
    (23, 25),
    (25, 27),
    (12, 24),
    (24, 26),
    (26, 28),
    (11, 12),
    (23, 24),
]


class SwingAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose

    # =========================
    # 数学ユーティリティ
    # =========================
    @staticmethod
    def calc_angle(a, b, c):
        a, b, c = np.array(a), np.array(b), np.array(c)
        ba, bc = a - b, c - b
        cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9)
        return np.degrees(np.arccos(np.clip(cos, -1, 1)))

    @staticmethod
    def compute_velocity(df, x, y, vx, vy):
        df[vx] = df[x].diff().fillna(0)
        df[vy] = df[y].diff().fillna(0)
        return df

    # =========================
    # 特徴量抽出
    # =========================
    def extract_metrics(self, video_path):
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        data, idx = [], 0

        with self.mp_pose.Pose() as pose:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = pose.process(rgb)

                if not res.pose_landmarks:
                    idx += 1
                    continue

                lm = res.pose_landmarks.landmark

                sh = self.calc_angle(
                    (lm[11].x, lm[11].y), (lm[23].x, lm[23].y), (lm[12].x, lm[12].y)
                )
                hip = self.calc_angle(
                    (lm[23].x, lm[23].y), (lm[25].x, lm[25].y), (lm[27].x, lm[27].y)
                )
                el = self.calc_angle(
                    (lm[13].x, lm[13].y), (lm[11].x, lm[11].y), (lm[23].x, lm[23].y)
                )
                el_r = self.calc_angle(
                    (lm[14].x, lm[14].y), (lm[12].x, lm[12].y), (lm[24].x, lm[24].y)
                )
                knee_l = self.calc_angle(
                    (lm[23].x, lm[23].y), (lm[25].x, lm[25].y), (lm[27].x, lm[27].y)
                )
                knee_r = self.calc_angle(
                    (lm[24].x, lm[24].y), (lm[26].x, lm[26].y), (lm[28].x, lm[28].y)
                )

                wx, wy = lm[16].x, lm[16].y
                cx, cy = (lm[15].x + lm[16].x) / 2, (lm[15].y + lm[16].y) / 2
                sh_mid_x, sh_mid_y = (lm[11].x + lm[12].x) / 2, (
                    lm[11].y + lm[12].y
                ) / 2
                hip_mid_x, hip_mid_y = (lm[23].x + lm[24].x) / 2, (
                    lm[23].y + lm[24].y
                ) / 2

                sh_vec_x, sh_vec_y = lm[12].x - lm[11].x, lm[12].y - lm[11].y
                hip_vec_x, hip_vec_y = lm[24].x - lm[23].x, lm[24].y - lm[23].y
                shoulder_line_angle = np.degrees(np.arctan2(sh_vec_y, sh_vec_x))
                hip_line_angle = np.degrees(np.arctan2(hip_vec_y, hip_vec_x))

                spine_vec_x = sh_mid_x - hip_mid_x
                spine_vec_y = sh_mid_y - hip_mid_y
                spine_angle = np.degrees(np.arctan2(spine_vec_x, -spine_vec_y))

                separation = shoulder_line_angle - hip_line_angle

                data.append(
                    [
                        idx,
                        sh,
                        hip,
                        el,
                        el_r,
                        knee_l,
                        knee_r,
                        shoulder_line_angle,
                        hip_line_angle,
                        spine_angle,
                        separation,
                        wx,
                        wy,
                        cx,
                        cy,
                        sh_mid_x,
                        sh_mid_y,
                        hip_mid_x,
                        hip_mid_y,
                    ]
                )
                idx += 1

        cap.release()
        df = pd.DataFrame(
            data,
            columns=[
                "frame",
                "shoulder_angle",
                "hip_angle",
                "elbow_angle",
                "elbow_angle_r",
                "knee_angle_l",
                "knee_angle_r",
                "shoulder_line_angle",
                "hip_line_angle",
                "spine_angle",
                "shoulder_hip_separation",
                "wrist_x",
                "wrist_y",
                "club_x",
                "club_y",
                "shoulder_mid_x",
                "shoulder_mid_y",
                "hip_mid_x",
                "hip_mid_y",
            ],
        )

        # 速度・加速度（1秒あたり）
        df["wrist_vx"] = df["wrist_x"].diff().fillna(0) * fps
        df["wrist_vy"] = df["wrist_y"].diff().fillna(0) * fps
        df["wrist_speed"] = np.hypot(df["wrist_vx"], df["wrist_vy"])
        df["wrist_accel"] = df["wrist_speed"].diff().fillna(0) * fps

        df["club_vx"] = df["club_x"].diff().fillna(0) * fps
        df["club_vy"] = df["club_y"].diff().fillna(0) * fps
        df["club_speed"] = np.hypot(df["club_vx"], df["club_vy"])
        df["club_accel"] = df["club_speed"].diff().fillna(0) * fps

        # 角速度（deg/s）
        df["shoulder_ang_vel"] = df["shoulder_angle"].diff().fillna(0) * fps
        df["hip_ang_vel"] = df["hip_angle"].diff().fillna(0) * fps
        df["elbow_ang_vel"] = df["elbow_angle"].diff().fillna(0) * fps
        df["elbow_ang_vel_r"] = df["elbow_angle_r"].diff().fillna(0) * fps
        df["spine_ang_vel"] = df["spine_angle"].diff().fillna(0) * fps

        return df

    # =========================
    # スイングイベント検出
    # =========================
    def detect_events(self, df):
        for x, y, vx, vy in [
            ("wrist_x", "wrist_y", "wrist_vx", "wrist_vy"),
            ("club_x", "club_y", "club_vx", "club_vy"),
        ]:
            df = self.compute_velocity(df, x, y, vx, vy)

        s = self.detect_start(df)
        t = self.detect_top(df, s)
        e = self.detect_finish(df, t)
        im = self.detect_impact(df, t, e)

        return s, t, im, e

    def detect_start(self, df, win=10, thr=-0.003, min_count=5):
        dy = df["wrist_y"].diff().fillna(0)
        for i in range(len(dy) - win):
            if (dy.iloc[i : i + win] < thr).sum() >= min_count:
                return i
        return 0

    def detect_top(self, df, start, win=3):
        diff = df["wrist_y"].diff().iloc[start:]
        for i in range(len(diff) - win):
            if diff.iloc[i : i + win].mean() > 0.005:
                return i + start
        return start + 10

    def detect_finish(self, df, top, win=10):
        diff = df["shoulder_angle"].diff().abs().iloc[top:]
        for i in range(len(diff) - win):
            if diff.iloc[i : i + win].mean() < 1:
                return i + top
        return len(df) - 1

    def detect_impact(self, df, top, end):
        return df["wrist_y"].iloc[top:end].idxmax()

    # =========================
    # 描画
    # =========================
    def draw_pose(self, frame, lm, color):
        h, w = frame.shape[:2]
        for i in VISIBLE_POINTS:
            if lm[i].visibility < 0.3:
                continue
            x, y = int(lm[i].x * w), int(lm[i].y * h)
            cv2.circle(frame, (x, y), 6, color, -1)

        for i, j in POSE_CONNECTIONS:
            if lm[i].visibility < 0.3 or lm[j].visibility < 0.3:
                continue
            x1, y1 = int(lm[i].x * w), int(lm[i].y * h)
            x2, y2 = int(lm[j].x * w), int(lm[j].y * h)
            cv2.line(frame, (x1, y1), (x2, y2), color, 4)

    def export_with_frame_index(self, video_path, out_path, progress_cb=None):

        out_path = Path(out_path)
        tmp_path = out_path.with_suffix(".raw.mp4")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Failed to open input video")

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        out = cv2.VideoWriter(
            str(tmp_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (w, h),
        )
        if not out.isOpened():
            cap.release()
            raise RuntimeError("VideoWriter failed")

        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # ★ 実フレーム番号（元動画基準）
            frame_idx = int(cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1

            # フレーム番号描画
            cv2.putText(
                frame,
                f"Frame: {frame_idx}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )

            out.write(frame)
            idx += 1

        cap.release()
        out.release()

        # ブラウザ再生向けに再エンコード
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(tmp_path),
                "-vcodec",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(out_path),
            ],
            check=True,
        )

        tmp_path.unlink()

    def render_hud(self, video_path, df, out_path, progress_cb=None):
        out_path = Path(out_path)
        tmp_path = out_path.with_suffix(".raw.mp4")

        if progress_cb:
            progress_cb(5)

        # ===== イベント検出（元動画基準） =====
        s, t, im, e = self.detect_events(df)

        # ===== 書き出し範囲 =====
        start_idx = max(s - 5, 0)
        end_idx = min(e + 5, len(df) - 1)
        span = end_idx - start_idx + 1

        if progress_cb:
            progress_cb(15)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Failed to open input video")

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        print(
            f"start_idx: {start_idx}. start: {s}, top: {t}, impact: {im}, finish: {e}, fps: {fps}"
        )

        # ★ ここが超重要（start-5 にジャンプ）
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_idx)

        out = cv2.VideoWriter(
            tmp_path,
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (w, h),
        )
        if not out.isOpened():
            cap.release()
            raise RuntimeError("VideoWriter failed")

        if progress_cb:
            progress_cb(30)

        # ===== 描画ループ =====
        with self.mp_pose.Pose() as pose:
            idx = 0
            while idx < span:
                ret, frame = cap.read()
                if not ret:
                    break

                # ★ 元動画の正しいフレーム番号
                frame_idx = start_idx + idx

                cv2.putText(
                    frame,
                    f"Frame: {frame_idx}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (0, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = pose.process(rgb)

                if res.pose_landmarks:
                    self.draw_pose(frame, res.pose_landmarks.landmark, (0, 255, 0))

                out.write(frame)

                if progress_cb:
                    progress = 30 + int(idx / span * 50)
                    progress_cb(progress)

                idx += 1

        cap.release()
        out.release()

        if progress_cb:
            progress_cb(85)

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(tmp_path),
                "-vcodec",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(out_path),
            ],
            check=True,
        )

        tmp_path.unlink()

        if progress_cb:
            progress_cb(100)

        return {
            "Start": s - start_idx,
            "Top": t - start_idx,
            "Impact": im - start_idx,
            "Finish": e - start_idx,
        }, fps

    def analyze_video(self, video_path: Path, csv_path: Path | None = None) -> str:
        # 1. 動画アップロード
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY が設定されていません")
        self.client = genai.Client(api_key=api_key)
        video_file = self.client.files.upload(file=str(video_path))
        csv_file = None
        if csv_path and csv_path.exists():
            # SDKによってはmime_type未対応のためフォールバック付きでアップロード
            try:
                csv_file = self.client.files.upload(
                    file=str(csv_path),
                    mime_type="text/plain",
                )
            except TypeError:
                csv_file = self.client.files.upload(file=str(csv_path))

        # 2. 処理完了待ち
        while video_file.state.name == "PROCESSING":
            time.sleep(3)
            video_file = self.client.files.get(name=video_file.name)

        if video_file.state.name == "FAILED":
            raise RuntimeError("AI動画処理に失敗しました")

        # 3. AIに質問
        try:
            contents = [video_file]
            if csv_file:
                contents.append(csv_file)
            contents.append(
                """
    あなたはプロゴルフコーチです。入力された動画・データは参考にして構いません。
    ただし出力には、入力データの形式や内部項目が推定できる情報を一切含めないでください。
    具体的には、フレーム番号、数値の引用、カラム名（例: elbow_angle など）、
    HUD/CSV/解析データといった言及を禁止します。観察に基づく一般的な表現で述べてください。

    以下を日本語で答えてください。
    1. このスイングの良い点
    2. 改善すべきポイント（最大3つ）
    3. それぞれに対する具体的な練習方法

    専門的だが初心者にも分かる説明にしてください。
    """
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
            )

            return response.text
        except Exception as e:
            if google_exceptions and isinstance(e, google_exceptions.GoogleAPIError):
                return "ただいま混雑しています。しばらく経ってから再度お試しください。"
            raise
