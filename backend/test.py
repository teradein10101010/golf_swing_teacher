from pathlib import Path

from app.services.swing_analyzer import SwingAnalyzer
from app.utils.ffmpeg import ffmpeg_to_cfr


src_dir = "../data/input/"
dst_dir = "../data/output/"
data_dir = "./data/"

videos = [
    # "IMG_7170.MOV",
    # "IMG_7181.MOV",
    "pro.mp4",
    # "swing.mp4",
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
