from pathlib import Path
import subprocess

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd

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

EVENT_COLORS = {
    "start": (255, 255, 0),
    "top": (255, 0, 0),
    "impact": (0, 0, 255),
    "finish": (0, 255, 255),
    None: (0, 255, 0),
}


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

                wx, wy = lm[16].x, lm[16].y
                cx, cy = (lm[15].x + lm[16].x) / 2, (lm[15].y + lm[16].y) / 2

                data.append([idx, sh, hip, el, wx, wy, cx, cy])
                idx += 1

        cap.release()
        return pd.DataFrame(
            data,
            columns=[
                "frame",
                "shoulder_angle",
                "hip_angle",
                "elbow_angle",
                "wrist_x",
                "wrist_y",
                "club_x",
                "club_y",
            ],
        )

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

    def render_hud(self, video_path, df, out_path, progress_cb=None):
        out_path = Path(out_path)
        tmp_path = out_path.with_suffix(".raw.mp4")

        if progress_cb:
            progress_cb(5)

        # ===== イベント検出（元動画基準） =====
        s, t, im, e = self.detect_events(df)

        # ===== 書き出し範囲 =====
        start_idx = max(t - 50, 0)
        end_idx = min(e + 50, len(df) - 1)
        span = end_idx - start_idx + 1

        if progress_cb:
            progress_cb(15)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Failed to open input video")

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30

        # ★ ここが超重要（Top-50 にジャンプ）
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

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = pose.process(rgb)

                # ===== イベント判定（絶対フレームで比較） =====
                event = None
                if frame_idx == s:
                    event = "start"
                elif frame_idx == t:
                    event = "top"
                elif frame_idx == im:
                    event = "impact"
                elif frame_idx == e:
                    event = "finish"

                color = EVENT_COLORS[event]

                if res.pose_landmarks:
                    self.draw_pose(frame, res.pose_landmarks.landmark, color)

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
