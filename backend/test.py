from pathlib import Path
import subprocess
from swing_analyzer import SwingAnalyzer


def ffmpeg_to_cfr(
    input_path,
    output_path,
    fps=30,
    overwrite=True,
):
    """
    ffmpeg で動画を CFR（固定フレームレート）に変換する

    Parameters
    ----------
    input_path : str or Path
        入力動画
    output_path : str or Path
        出力動画
    fps : int or float
        固定フレームレート
    overwrite : bool
        Trueなら -y を付ける
    """

    input_path = str(input_path)
    output_path = str(output_path)

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",  # ← 重要：エラーだけ表示
    ]

    if overwrite:
        cmd.append("-y")

    cmd += [
        "-i",
        input_path,
        "-vsync",
        "cfr",  # ★ 超重要
        "-r",
        str(fps),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output_path,
    ]

    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            "ffmpeg failed\n"
            f"command: {' '.join(cmd)}\n"
            f"stderr:\n{e.stderr.decode(errors='ignore')}"
        )


src_dir = "../data/input/"
dst_dir = "../data/output/"
data_dir = "./data/"

videos = [
    #     "IMG_7170.MOV",
    #     "IMG_7181.MOV",
    "pro.mp4",
    #     "swing.mp4",
]


analyzer = SwingAnalyzer()

for f in videos:
    base = Path(f).stem
    input_path = src_dir + f
    src_path = dst_dir + base + "_src.mp4"
    data_path = data_dir + base + ".csv"
    hud_path = dst_dir + base + ".mp4"
    tmp_path = dst_dir + base + "_tmp.mp4"

    ffmpeg_to_cfr(
        input_path=input_path,
        output_path=src_path,
        fps=30,
    )

    df = analyzer.extract_metrics(src_path)
    df.to_csv(data_path)

    analyzer.export_with_frame_index(src_path, tmp_path)

    events, fps = analyzer.render_hud(
        src_path,
        df,
        str(hud_path),
    )

    print(events)
