#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本机 Whisper 转写兜底：接收音频文件路径，返回转写文本。
需要已安装 faster-whisper；未安装时返回明确错误。
"""
import argparse, json, os, sys

MODEL_DIR = r"C:\Users\19461\OneDrive\文档\ChatGPT\大学学习 3\.whisper_models"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    args = ap.parse_args()
    if not os.path.exists(args.audio):
        print(json.dumps({"ok": False, "error": "音频文件不存在"}, ensure_ascii=False)); return
    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        print(json.dumps({"ok": False, "error": "本机未安装 faster-whisper（pip install faster-whisper）。可改用浏览器识别或手动粘贴转写。"}, ensure_ascii=False)); return
    try:
        model = WhisperModel("small", device="cpu", compute_type="int8", download_root=MODEL_DIR)
        segments, info = model.transcribe(args.audio, language=None, beam_size=5, vad_filter=True)
        text = "".join(s.text for s in segments).strip()
        if not text:
            print(json.dumps({"ok": False, "error": "没有识别到语音内容"}, ensure_ascii=False)); return
        print(json.dumps({"ok": True, "text": text, "language": getattr(info, "language", None)}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": "转写失败：" + str(e)[:200]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
