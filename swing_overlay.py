# app.py
import streamlit as st
import tempfile
import os
import cv2
import mediapipe as mp
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, Optional

# ---------------------------
# 設定
# ---------------------------
VISIBLE_POINTS = [11,12,13,14,15,16,23,24,25,26,27,28]
POSE_CONNECTIONS = [
    (11,13),(13,15),(12,14),(14,16),
    (11,23),(23,25),(25,27),
    (12,24),(24,26),(26,28),
    (11,12),(23,24)
]

# ---------------------------
# ユーティリティ
# ---------------------------
def calc_angle(a,b,c):
    a,b,c = np.array(a),np.array(b),np.array(c)
    ba, bc = a-b, c-b
    cos = np.dot(ba,bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-9)
    return np.degrees(np.arccos(np.clip(cos,-1,1)))

def compute_velocity(df,x,y,vx,vy):
    df[vx] = df[x].diff().fillna(0)
    df[vy] = df[y].diff().fillna(0)
    return df

# ---------------------------
# 描画
# ---------------------------
def draw_pose(frame,lm,color=(0,255,0),thickness=6):
    h,w = frame.shape[:2]
    for idx in VISIBLE_POINTS:
        p = lm[idx]
        if p.visibility<0.3: continue
        x,y = int(p.x*w),int(p.y*h)
        cv2.circle(frame,(x,y),8,color,-1)
    for i,j in POSE_CONNECTIONS:
        p1,p2 = lm[i],lm[j]
        if p1.visibility<0.3 or p2.visibility<0.3: continue
        x1,y1 = int(p1.x*w),int(p1.y*h)
        x2,y2 = int(p2.x*w),int(p2.y*h)
        cv2.line(frame,(x1,y1),(x2,y2),color,thickness)

def draw_hud(frame,row,event):
    h,w = frame.shape[:2]
    x1,y1,x2,y2 = w-360,10,w-10,180
    overlay = frame.copy()
    cv2.rectangle(overlay,(x1,y1),(x2,y2),(0,0,0),-1)
    frame[:] = cv2.addWeighted(overlay,0.45,frame,0.55,0)

    tags = {"start":"START","top":"TOP","impact":"IMPACT","finish":"FINISH"}
    lines = [tags.get(event,"")]*1 if event else []
    lines += [
        f"Speed:   {row['club_speed']:.1f}",
        f"Shoulder:{row['shoulder_angle']:.1f}",
        f"Hip:     {row['hip_angle']:.1f}",
        f"Elbow:   {row['elbow_angle']:.1f}",
        f"Plane:   {row['club_plane_score']:.2f}",
    ]

    y = y1+30
    for t in lines:
        if not t: continue
        cv2.putText(frame,t,(x1+10,y),cv2.FONT_HERSHEY_SIMPLEX,0.7,(255,255,255),2)
        y+=28

# ---------------------------
# イベント検出ロジック
# ---------------------------
def detect_swing_start(df, win=10, thr=-0.003, min_count=5):
    dy = df["wrist_y"].diff().fillna(0)
    for i in range(len(dy) - win):
        seg = dy.iloc[i:i+win]
        if (seg < thr).sum() >= min_count:
            return i
    return None

def detect_swing_top(df,start,win=3):
    if start is None: return None
    diff = df["wrist_y"].diff().iloc[start:]
    for i in range(len(diff)-win):
        if diff.iloc[i:i+win].mean()>0.005: return i+start
    return None

def detect_swing_end(df,top,win=10):
    if top is None: return None
    diff = df["shoulder_angle"].diff().abs().iloc[top:]
    for i in range(len(diff)-win):
        if diff.iloc[i:i+win].mean()<1: return i+top
    return i+top

def detect_swing_impact(df,top,end):
    if top is None or end is None: return None
    slice_idx = df["wrist_y"].iloc[top:end]
    if len(slice_idx)==0: return None
    return slice_idx.idxmax()

def detect_events(df):
    for (x,y,vx,vy) in [("wrist_x","wrist_y","wrist_vx","wrist_vy"),("club_x","club_y","club_vx","club_vy")]:
        df = compute_velocity(df,x,y,vx,vy)
    df["club_speed"] = np.sqrt(df["club_vx"]**2+df["club_vy"]**2).fillna(0)

    s = detect_swing_start(df)
    t = detect_swing_top(df,s)
    e = detect_swing_end(df,t)
    im = detect_swing_impact(df,t,e)

    # 安全チェック
    try:
        if s is None or t is None or im is None or e is None:
            return s,t,im,e,df
        if not (s < t < im < e):
            return s,t,im,e,df
    except Exception:
        return s,t,im,e,df
    return s,t,im,e,df

# ---------------------------
# フレームから数値抽出
# ---------------------------
def extract_metrics_from_video(video_path: str, mp_pose) -> pd.DataFrame:
    cap = cv2.VideoCapture(video_path)
    data = []
    idx = 0
    with mp_pose.Pose(static_image_mode=False,
                      model_complexity=1,
                      min_tracking_confidence=0.5,
                      min_detection_confidence=0.5) as pose:
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
            sh = calc_angle((lm[11].x,lm[11].y),(lm[23].x,lm[23].y),(lm[12].x,lm[12].y))
            hip = calc_angle((lm[23].x,lm[23].y),(lm[25].x,lm[25].y),(lm[27].x,lm[27].y))
            el = calc_angle((lm[13].x,lm[13].y),(lm[11].x,lm[11].y),(lm[23].x,lm[23].y))
            wx,wy = lm[16].x,lm[16].y
            cx,cy = (lm[15].x+lm[16].x)/2,(lm[15].y+lm[16].y)/2
            data.append([idx,sh,hip,el,wx,wy,cx,cy])
            idx += 1
    cap.release()
    df = pd.DataFrame(data,columns=["frame","shoulder_angle","hip_angle","elbow_angle","wrist_x","wrist_y","club_x","club_y"])
    return df

# ---------------------------
# HUD付き動画書き出し
# ---------------------------
def render_hud_video(input_video:str, df:pd.DataFrame, out_path:str, mp_pose) -> Tuple[Optional[int],Optional[int],Optional[int],Optional[int]]:
    # events を再計算して取得
    df["club_plane_score"] = 1 - np.abs(df["shoulder_angle"] - 90) / 90
    s,t,im,e,df = detect_events(df)

    cap = cv2.VideoCapture(input_video)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    out = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w,h))

    idx = 0
    with mp_pose.Pose(static_image_mode=False,
                      model_complexity=1,
                      min_tracking_confidence=0.5,
                      min_detection_confidence=0.5) as pose:
        while True:
            ret, frame = cap.read()
            if not ret or idx>=len(df):
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = pose.process(rgb)

            flag = None
            color = (0,255,0)
            if idx == s:
                flag="start"; color=(255,255,0)
            elif idx == t:
                flag="top"; color=(255,0,0)
            elif idx == im:
                flag="impact"; color=(0,0,255)
            elif idx == e:
                flag="finish"; color=(0,255,255)

            if res.pose_landmarks:
                draw_pose(frame, res.pose_landmarks.landmark, color=color, thickness=7)

            draw_hud(frame, df.iloc[idx], flag)
            out.write(frame)
            idx += 1

    out.release()
    cap.release()
    # CSV 保存は呼び出し側で行う
    return s,t,im,e,df

# ---------------------------
# サイドバイサイド生成
# ---------------------------
def render_side_by_side(my_video, pro_video, my_start, pro_start, out_path):
    cap1 = cv2.VideoCapture(my_video)
    cap2 = cv2.VideoCapture(pro_video)

    cap1.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(my_start or 0)))
    cap2.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(pro_start or 0)))

    w1, h1 = int(cap1.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap1.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w2, h2 = int(cap2.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap2.get(cv2.CAP_PROP_FRAME_HEIGHT))

    height = max(h1, h2)
    width = w1 + w2
    fps = cap1.get(cv2.CAP_PROP_FPS) or 30

    out = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))

    while True:
        r1, f1 = cap1.read()
        r2, f2 = cap2.read()
        if not r1 or not r2:
            break

        if f1.shape[0] != height:
            f1 = cv2.resize(f1, (w1, height))
        if f2.shape[0] != height:
            f2 = cv2.resize(f2, (w2, height))

        combined = np.hstack([f1, f2])
        out.write(combined)

    cap1.release()
    cap2.release()
    out.release()

if "result" not in st.session_state:
    st.session_state.result = None

# ---------------------------
# Streamlit UI
# ---------------------------
st.set_page_config(page_title="Golf Swing Analyzer", layout="wide")
st.title("⛳ Golf Swing Analyzer (Streamlit)")

st.markdown("""
アップロードした動画を MediaPipe で解析して HUD を付けた動画を出力します。
（処理は CPU で行われるため動画長に応じて時間がかかります）
""")

col1, col2 = st.columns(2)
with col1:
    my_file = st.file_uploader("あなたのスイング動画（my）", type=["mp4","mov","avi","mkv"])
with col2:
    pro_file = st.file_uploader("比較用プロ動画（pro）", type=["mp4","mov","avi","mkv"])

process_btn = st.button("解析開始")

if process_btn:
    if not my_file:
        st.error("あなたのスイング動画をアップロードしてください。")
    elif not pro_file:
        st.error("比較用プロ動画をアップロードしてください。")
    else:
        # 一時保存
        tmpdir = Path(tempfile.mkdtemp(prefix="swing_app_"))
        my_path = tmpdir / "my_input.mp4"
        pro_path = tmpdir / "pro_input.mp4"
        my_path.write_bytes(my_file.read())
        pro_path.write_bytes(pro_file.read())

        st.info("解析中... (CPU 処理です。動画長により時間がかかります)")
        progress = st.progress(0)

        mp_pose = mp.solutions.pose

        # --- my ---
        progress.progress(5)
        st.write("① あなたの動画から特徴量抽出...")
        df_my = extract_metrics_from_video(str(my_path), mp_pose)
        progress.progress(20)

        hud_my_out = str(tmpdir / "swing_overlay_my.mp4")
        s_my,t_my,im_my,e_my,df_my_processed = render_hud_video(str(my_path), df_my, hud_my_out, mp_pose)
        progress.progress(60)

        csv_my = str(tmpdir / "swing_metrics_my.csv")
        df_my_processed.to_csv(csv_my, index=False)

        # --- pro ---
        st.write("② プロ動画から特徴量抽出...")
        df_pro = extract_metrics_from_video(str(pro_path), mp_pose)
        progress.progress(65)

        hud_pro_out = str(tmpdir / "swing_overlay_pro.mp4")
        s_pro,t_pro,im_pro,e_pro,df_pro_processed = render_hud_video(str(pro_path), df_pro, hud_pro_out, mp_pose)
        progress.progress(85)

        csv_pro = str(tmpdir / "swing_metrics_pro.csv")
        df_pro_processed.to_csv(csv_pro, index=False)

        # --- side by side ---
        st.write("③ サイドバイサイド動画生成...")
        side_out = str(tmpdir / "swing_compare_side_by_side.mp4")
        render_side_by_side(hud_my_out, hud_pro_out, s_my or 0, s_pro or 0, side_out)
        progress.progress(98)

        st.session_state.result = {
            "hud_my": hud_my_out,
            "hud_pro": hud_pro_out,
            "side": side_out,
            "csv_my": csv_my,
            "csv_pro": csv_pro,
            "df_my": df_my_processed,
            "df_pro": df_pro_processed,
        }
        st.success("解析完了！")
        progress.progress(100)

if st.session_state.result:
    r = st.session_state.result

    st.subheader("あなたのHUD動画")
    st.video(r["hud_my"])
    with open(r["hud_my"], "rb") as f:
        st.download_button(
            "ダウンロード（HUD: あなた）",
            f.read(),
            file_name="swing_overlay_my.mp4",
            mime="video/mp4"
        )

    st.subheader("プロのHUD動画")
    st.video(r["hud_pro"])
    with open(r["hud_pro"], "rb") as f:
        st.download_button(
            "ダウンロード（HUD: プロ）",
            f.read(),
            file_name="swing_overlay_pro.mp4",
            mime="video/mp4"
        )

    st.subheader("サイドバイサイド比較")
    st.video(r["side"])
    with open(r["side"], "rb") as f:
        st.download_button(
            "ダウンロード（比較）",
            f.read(),
            file_name="swing_compare_side_by_side.mp4",
            mime="video/mp4"
        )

    st.subheader("CSV 出力")
    st.write("あなたの解析結果（先頭）")
    st.dataframe(r["df_my"].head())

    with open(r["csv_my"], "rb") as f:
        st.download_button(
            "CSV ダウンロード（あなた）",
            f.read(),
            file_name="swing_metrics_my.csv",
            mime="text/csv"
        )

    with open(r["csv_pro"], "rb") as f:
        st.download_button(
            "CSV ダウンロード（プロ）",
            f.read(),
            file_name="swing_metrics_pro.csv",
            mime="text/csv"
        )
