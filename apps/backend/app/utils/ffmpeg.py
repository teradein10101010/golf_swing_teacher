import json
import subprocess
from fractions import Fraction
from typing import Optional


def _probe_video_stream(input_path: str) -> dict:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=avg_frame_rate,r_frame_rate,color_space,color_transfer,color_primaries",
            "-of",
            "json",
            input_path,
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    if not streams:
        raise RuntimeError("ffprobe failed to detect a video stream")
    return streams[0]


def _parse_frame_rate(rate: Optional[str]) -> Optional[float]:
    if not rate or rate in {"0/0", "N/A"}:
        return None
    try:
        value = float(Fraction(rate))
    except (ValueError, ZeroDivisionError):
        return None
    if value <= 0:
        return None
    return value


def _is_hdr_stream(stream: dict) -> bool:
    color_transfer = (stream.get("color_transfer") or "").lower()
    color_space = (stream.get("color_space") or "").lower()
    color_primaries = (stream.get("color_primaries") or "").lower()
    hdr_transfers = {"arib-std-b67", "smpte2084"}
    return (
        color_transfer in hdr_transfers
        or color_space.startswith("bt2020")
        or color_primaries.startswith("bt2020")
    )


def ffmpeg_to_cfr(
    input_path,
    output_path,
    fps=None,
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
    fps : int or float | None
        固定フレームレート。None のときは入力動画のフレームレートを維持する
    overwrite : bool
        Trueなら -y を付ける
    """

    input_path = str(input_path)
    output_path = str(output_path)
    stream = _probe_video_stream(input_path)
    target_fps = fps or _parse_frame_rate(stream.get("avg_frame_rate"))
    if target_fps is None:
        target_fps = _parse_frame_rate(stream.get("r_frame_rate")) or 30.0

    vf_parts = []
    if _is_hdr_stream(stream):
        # iPhone HDR(HLG/PQ) を SDR(bt709) にトーンマップして白飛びを防ぐ。
        vf_parts.append(
            "zscale=t=linear:npl=100,tonemap=mobius:desat=0,"
            "zscale=p=bt709:t=bt709:m=bt709:r=tv"
        )
    vf_parts.append("format=yuv420p")

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
        f"{target_fps:.6f}",
        "-vf",
        ",".join(vf_parts),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
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
