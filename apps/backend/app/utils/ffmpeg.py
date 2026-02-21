import subprocess


def ffmpeg_to_cfr(
    input_path,
    output_path,
    fps=45,
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
        "-preset",
        "veryfast",
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
