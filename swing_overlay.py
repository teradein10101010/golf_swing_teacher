# Refactored pose swing analysis (modular, cleaner structure)
import cv2
import mediapipe as mp
import pandas as pd
import numpy as np
import os

VISIBLE_POINTS = [11,12,13,14,15,16,23,24,25,26,27,28]
POSE_CONNECTIONS = [
    (11,13),(13,15),(12,14),(14,16),
    (11,23),(23,25),(25,27),
    (12,24),(24,26),(26,28),
    (11,12),(23,24)
]

# ------------------------------------------------------------------
# Utility functions
# ------------------------------------------------------------------
def calc_angle(a,b,c):
    a,b,c = np.array(a),np.array(b),np.array(c)
    ba, bc = a-b, c-b
    cos = np.dot(ba,bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-9)
    return np.degrees(np.arccos(np.clip(cos,-1,1)))


def compute_velocity(df,x,y,vx,vy):
    df[vx] = df[x].diff().fillna(0)
    df[vy] = df[y].diff().fillna(0)
    return df


# ------------------------------------------------------------------
# Drawing functions
# ------------------------------------------------------------------
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


# ------------------------------------------------------------------
# Event Detection
# ------------------------------------------------------------------
def detect_swing_start(df, win=10, thr=-0.003, min_count=5):
    """
    ダウンスイング開始検知（wrist_y の下降開始）

    Parameters:
        win:      判定ウィンドウ長
        thr:      下降の閾値（diff が thr 以下を下降とみなす）
        min_count: win 内で閾値以下のフレーム数（多数決）

    """
    dy = df["wrist_y"].diff().fillna(0)

    for i in range(len(dy) - win):
        seg = dy.iloc[i:i+win]
        # 下降が一定割合を超える（例：半分以上）
        if (seg < thr).sum() >= min_count:
            return i

    return None


def detect_swing_top(df,start,win=3):
    diff = df["wrist_y"].diff().iloc[start:]
    for i in range(len(diff)-win):
        if diff.iloc[i:i+win].mean()>0.005: return i+start
    return None


def detect_swing_end(df,top,win=10):
    diff = df["shoulder_angle"].diff().abs().iloc[top:]
    for i in range(len(diff)-win):
        if diff.iloc[i:i+win].mean()<1: return i+top
    return i+top


def detect_swing_impact(df,top,end):
    return df["wrist_y"].iloc[top:end].idxmax()


def detect_events(df):
    for (x,y,vx,vy) in [("wrist_x","wrist_y","wrist_vx","wrist_vy"),("club_x","club_y","club_vx","club_vy")]:
        df = compute_velocity(df,x,y,vx,vy)
    df["club_speed"] = np.sqrt(df["club_vx"]**2+df["club_vy"]**2).fillna(0)

    s = detect_swing_start(df)
    t = detect_swing_top(df,s)
    e = detect_swing_end(df,t)
    im = detect_swing_impact(df,t,e)

    if not (s<t<im<e): return s,t,im,e,df
    return s,t,im,e,df


# ------------------------------------------------------------------
# Main processing
# ------------------------------------------------------------------
def extract_metrics(pose,cap):
    data,idx=[],0
    while True:
        r,f=cap.read(),None
        ret,frame=r
        if not ret: break
        rgb=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)
        res=pose.process(rgb)
        if not res.pose_landmarks: idx+=1; continue
        lm=res.pose_landmarks.landmark
        sh=calc_angle((lm[11].x,lm[11].y),(lm[23].x,lm[23].y),(lm[12].x,lm[12].y))
        hip=calc_angle((lm[23].x,lm[23].y),(lm[25].x,lm[25].y),(lm[27].x,lm[27].y))
        el=calc_angle((lm[13].x,lm[13].y),(lm[11].x,lm[11].y),(lm[23].x,lm[23].y))
        wx,wy=lm[16].x,lm[16].y
        cx,cy=(lm[15].x+lm[16].x)/2,(lm[15].y+lm[16].y)/2
        data.append([idx,sh,hip,el,wx,wy,cx,cy])
        idx+=1
    return pd.DataFrame(data,columns=["frame","shoulder_angle","hip_angle","elbow_angle","wrist_x","wrist_y","club_x","club_y"])


def main(video,out_dir):
    mp_pose=mp.solutions.pose
    pose=mp_pose.Pose(static_image_mode=False,model_complexity=1,min_tracking_confidence=0.5,min_detection_confidence=0.5)

    cap=cv2.VideoCapture(video)
    df=extract_metrics(pose,cap)
    cap.release()

    df["club_plane_score"] = 1-np.abs(df["shoulder_angle"]-90)/90
    s,t,im,e,df=detect_events(df)

    os.makedirs(out_dir,exist_ok=True)
    df.to_csv(f"{out_dir}/swing_metrics.csv",index=False)

    cap=cv2.VideoCapture(video)
    h,w=int(cap.get(4)),int(cap.get(3))
    out=cv2.VideoWriter(f"{out_dir}/swing_overlay.mp4",cv2.VideoWriter_fourcc(*"mp4v"),30,(w,h))

    idx=0
    while True:
        ret,frame=cap.read()
        if not ret or idx>=len(df): break
        rgb=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)
        res=pose.process(rgb)

        flag=None
        if idx==s: flag="start"; color=(255,255,0)
        elif idx==t: flag="top"; color=(255,0,0)
        elif idx==im: flag="impact"; color=(0,0,255)
        elif idx==e: flag="finish"; color=(0,255,255)
        else: color=(0,255,0)

        if res.pose_landmarks:
            draw_pose(frame,res.pose_landmarks.landmark,color=color,thickness=7)

        draw_hud(frame,df.iloc[idx],flag)
        out.write(frame)
        idx+=1

    out.release();cap.release()


if __name__=="__main__":
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument("--video",required=True)
    p.add_argument("--out",required=True)
    a=p.parse_args()
    main(a.video,a.out)
