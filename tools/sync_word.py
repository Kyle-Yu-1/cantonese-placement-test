#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 Word 中的「语音练习」记录整体重建为网站记录（唯一来源），实现 Word 与网站同步。
用法: python tools/sync_word.py --payload <json路径>
payload: {records:[{attempt,label?,ts,duration,transcript,scores,total,pct,level,flags,missing,weak,lever,dims}], docx?}
"""
import argparse, json, os, sys

DEFAULT_DOCX = r"C:\Users\19461\OneDrive\Desktop\机械产品介绍AI学习评分记录.docx"
FALLBACK_DOCX = r"C:\Users\19461\OneDrive\Desktop\机械产品介绍AI学习评分记录-含语音.docx"

def _import_update_word():
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)
    return __import__("update_word")

def clear_voice_sections(docx_path):
    from docx import Document
    from docx.oxml.ns import qn
    doc = Document(docx_path)
    body = doc.element.body
    start = None
    for idx, child in enumerate(body):
        texts = [t.text or "" for t in child.iter(qn("w:t"))]
        joined = "".join(texts)
        if "语音练习" in joined:
            start = idx
            break
    if start is not None:
        for child in list(body)[start:]:
            if child.tag == qn("w:sectPr"):
                continue
            body.remove(child)
    doc.save(docx_path)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    args = ap.parse_args()
    with open(args.payload, "r", encoding="utf-8") as f:
        data = json.load(f)
    records = data.get("records") or []
    docx = data.get("docx") or DEFAULT_DOCX
    if not os.path.exists(docx) and os.path.exists(FALLBACK_DOCX):
        docx = FALLBACK_DOCX
    if not os.path.exists(docx):
        print(json.dumps({"ok": False, "error": "找不到 Word 文件"}, ensure_ascii=False)); return
    try:
        clear_voice_sections(docx)
        uw = _import_update_word()
        recs = sorted(records, key=lambda r: int(r.get("attempt") or 0))
        saved = []
        for r in recs:
            p = dict(r)
            p["docx"] = docx
            res = uw.append_record(p)
            if res.get("ok"):
                saved.append(res.get("attempt"))
        print(json.dumps({"ok": True, "path": docx, "records": saved}, ensure_ascii=False))
    except PermissionError:
        print(json.dumps({"ok": False, "error": "Word 文件被占用，请先关闭 WPS/Word 后再试"}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:200]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
