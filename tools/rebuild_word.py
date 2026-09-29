#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从标准记录 JSON 重建「机械产品介绍AI学习评分记录.docx」（按主题整理 + 趋势图 + 雷达图）。"""
import argparse, json, math, os, datetime

DIMS = ["流利度", "准确性", "语言复杂度", "信息完整性", "逻辑结构", "自信度"]
TOPIC_NAMES = {"gripper": "瓶盖夹爪", "jack": "液压千斤顶"}
TOPIC_SHORT = {"gripper": "夹爪", "jack": "千斤顶"}
TOPIC_RGB = {"gripper": (37, 99, 235), "jack": (217, 119, 6)}
DIM_RGB = [(37,99,235),(220,38,38),(5,150,105),(217,119,6),(124,58,237),(8,145,178)]
LEVER = [
    "你刚才在哪里卡顿最多？那一处是不是你还没想清楚的因果链？",
    "哪个术语你最没把握？它对应的物理含义是什么？",
    "把最长的一句话拆成两个因果短句，你会拆在哪一步？",
    "评审只听一遍，能复述出“名称、原理、用途、优势、安全”五样吗？缺哪样？",
    "如果把这段重排成“问题→方案→机制→数据→收尾”，哪一句该提前？",
    "哪一句你最不敢放慢语速？为什么？",
]
FONT_CANDIDATES = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"]
DIM_NOTE = {
    "流利度": "语速 / 停顿控制（录音声学特征）",
    "准确性": "术语、拼写与用词是否准确",
    "语言复杂度": "连接词与专业术语密度",
    "信息完整性": "名称/构成/原理/用途/优势/安全要点 6 格",
    "逻辑结构": "问题→方案→机制→数据/证据→收尾",
    "自信度": "响度/收尾/填充词/语速/语调",
}

def load_font(size):
    from PIL import ImageFont
    for f in FONT_CANDIDATES:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()

def fmt_ts(ts):
    try:
        dt = datetime.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        dt = dt.astimezone(datetime.timezone(datetime.timedelta(hours=8)))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(ts)

def make_radar(path, scores):
    from PIL import Image, ImageDraw
    W = H = 720
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_l = load_font(20); f_s = load_font(15)
    cx, cy, Rmax, n = 360, 370, 210, 6
    angles = [-90 + i * 60 for i in range(n)]
    def pt(i, v):
        r = (v - 1) / 4 * Rmax
        a = math.radians(angles[i])
        return (cx + r * math.cos(a), cy + r * math.sin(a))
    for v in range(1, 6):
        poly = [pt(i, v) for i in range(n)]
        if v > 1:
            d.line(poly + [poly[0]], fill=(214, 214, 214), width=1)
        x, y = pt(0, v)
        d.text((x - 20, y - 11), str(v), font=f_s, fill=(150, 150, 150))
    for i in range(n):
        d.line([(cx, cy), pt(i, 5)], fill=(220, 220, 220), width=1)
    for i, name in enumerate(DIMS):
        x, y = pt(i, 5)
        dx, dy = math.cos(math.radians(angles[i])), math.sin(math.radians(angles[i]))
        d.text((x + dx * 52, y + dy * 34 - 12), name, font=f_l, fill=(30, 30, 30), anchor="mm")
    poly = [pt(i, v) for i, v in enumerate(scores)]
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.polygon(poly, fill=(47, 107, 178, 70))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)
    d.line(poly + [poly[0]], fill=(47, 107, 178), width=4)
    for i, v in enumerate(scores):
        x, y = pt(i, v)
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(47, 107, 178))
        dx, dy = math.cos(math.radians(angles[i])), math.sin(math.radians(angles[i]))
        d.text((x + dx * 22, y + dy * 22 - 11), str(v), font=f_s, fill=(47, 107, 178), anchor="mm")
    img.save(path)
    return path

def make_total_trend(path, recs):
    from PIL import Image, ImageDraw
    W, H = 980, 460
    L, Rm, T, B = 70, 40, 60, 78
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_l = load_font(18); f_s = load_font(14); f_t = load_font(13)
    d.text((W/2, 16), "总分趋势（30 分制）", font=f_l, fill=(20, 20, 20), anchor="mm")
    for v in range(0, 31, 10):
        y = T + (H - T - B) * (1 - v / 30)
        d.line([(L, y), (W - Rm, y)], fill=(232, 236, 242), width=1)
        d.text((L - 12, y - 8), str(v), font=f_s, fill=(150, 150, 150), anchor="mm")
    recs = sorted(recs, key=lambda r: int(r.get("attempt") or 0))
    if len(recs) >= 1:
        mn = min(int(r["attempt"]) for r in recs); mx = max(int(r["attempt"]) for r in recs)
        span = max(1, mx - mn)
        def x(r):
            t = 0.5 if span == 0 else (int(r["attempt"]) - mn) / span
            return L + (W - L - Rm) * t
        def y(r):
            return T + (H - T - B) * (1 - (int(r.get("total") or 0)) / 30)
        pts = [(x(r), y(r), r) for r in recs]
        for i in range(1, len(pts)):
            col = TOPIC_RGB.get(pts[i][2].get("topic") or "gripper", (120,120,120))
            d.line([(pts[i-1][0], pts[i-1][1]), (pts[i][0], pts[i][1])], fill=col, width=3)
        for (px, py, r) in pts:
            col = TOPIC_RGB.get(r.get("topic") or "gripper", (120,120,120))
            d.ellipse([px-6, py-6, px+6, py+6], fill=col)
            d.text((px, py - 14), str(r.get("total") or 0), font=f_s, fill=col, anchor="mm")
            label = "第%d次·%s" % (r["attempt"], TOPIC_SHORT.get(r.get("topic") or "gripper", "?"))
            d.text((px, H - 52), label, font=f_t, fill=(30, 30, 30), anchor="mm")
    d.ellipse([L+8, 26, L+18, 36], fill=TOPIC_RGB["gripper"])
    d.text((L+26, 22), "瓶盖夹爪", font=f_s, fill=(40, 40, 40))
    d.ellipse([L+118, 26, L+128, 36], fill=TOPIC_RGB["jack"])
    d.text((L+136, 22), "液压千斤顶", font=f_s, fill=(40, 40, 40))
    img.save(path)
    return path

def make_dim_trend(path, recs):
    from PIL import Image, ImageDraw
    W, H = 980, 500
    L, Rm, T, B = 70, 40, 70, 84
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_l = load_font(18); f_s = load_font(13); f_t = load_font(12)
    d.text((W/2, 16), "六维趋势（1–5 分）", font=f_l, fill=(20, 20, 20), anchor="mm")
    for v in range(1, 6):
        y = T + (H - T - B) * (1 - (v - 1) / 4)
        d.line([(L, y), (W - Rm, y)], fill=(232, 236, 242), width=1)
        d.text((L - 12, y - 7), str(v), font=f_s, fill=(150, 150, 150), anchor="mm")
    recs = sorted(recs, key=lambda r: int(r.get("attempt") or 0))
    if recs:
        mn = min(int(r["attempt"]) for r in recs); mx = max(int(r["attempt"]) for r in recs)
        span = max(1, mx - mn)
        def x(r):
            t = 0.5 if span == 0 else (int(r["attempt"]) - mn) / span
            return L + (W - L - Rm) * t
        def y(v):
            return T + (H - T - B) * (1 - (v - 1) / 4)
        for di in range(6):
            col = DIM_RGB[di]
            pts = [(x(r), y(int((r.get("scores") or [3]*6)[di])), r) for r in recs]
            if len(pts) > 1:
                for i in range(1, len(pts)):
                    d.line([(pts[i-1][0], pts[i-1][1]), (pts[i][0], pts[i][1])], fill=col, width=2)
            for (px, py, r) in pts:
                d.ellipse([px-3.5, py-3.5, px+3.5, py+3.5], fill=col)
        for r in recs:
            px = x(r)
            d.text((px, H - 56), "第%d次·%s" % (r["attempt"], TOPIC_SHORT.get(r.get("topic") or "gripper", "?")), font=f_t, fill=(30,30,30), anchor="mm")
    for di in range(6):
        lx = L + 10 + (di % 3) * 150
        ly = 34 + (di // 3) * 22
        d.ellipse([lx, ly, lx+10, ly+10], fill=DIM_RGB[di])
        d.text((lx+16, ly-3), DIMS[di], font=f_t, fill=(40,40,40))
    img.save(path)
    return path

def set_font(run, size=None, bold=None, name="微软雅黑"):
    from docx.shared import Pt
    from docx.oxml.ns import qn
    run.font.name = name
    rPr = run._element.get_or_add_rPr()
    rf = rPr.get_or_add_rFonts()
    rf.set(qn("w:ascii"), name); rf.set(qn("w:hAnsi"), name); rf.set(qn("w:eastAsia"), name)
    if size: run.font.size = Pt(size)
    if bold is not None: run.font.bold = bold

def para(doc, text, size=11, bold=False, align=None, space_after=6, space_before=0):
    from docx.shared import Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    p = doc.add_paragraph()
    r = p.add_run(text); set_font(r, size=size, bold=bold)
    if align is not None: p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    return p

def heading(doc, text, level=1):
    from docx.shared import Pt
    p = doc.add_paragraph()
    r = p.add_run(text); set_font(r, size=15 if level == 1 else 12, bold=True)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    return p

def table_cell(cell, val, bold=False, size=10, center=False):
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    p = cell.paragraphs[0]
    r = p.add_run(str(val)); set_font(r, size=size, bold=bold)
    if center: p.alignment = WD_ALIGN_PARAGRAPH.CENTER

def build(records, out_path, tmpdir):
    from docx import Document
    from docx.shared import Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    doc = Document()
    para(doc, "机械产品介绍 AI 学习评分记录", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "练习主题：瓶盖夹爪（第 1–4 次）+ 液压千斤顶（新主题首测）", size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "评分口径：课程 6 维度 ×（1–5 分）= 30 分；等级：卓越 ≥90 · 熟练 ≥80 · 达标 ≥60 · 发展中 ≥40 · 起步 <40", size=10, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "姓名：__________    学号：__________    整理日期：2026-09-29", size=10, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

    recs = sorted(records, key=lambda r: int(r.get("attempt") or 0))

    # 一、成绩总览
    heading(doc, "一、成绩总览", 1)
    tbl = doc.add_table(rows=0, cols=9)
    tbl.style = "Table Grid"
    heads = ["练习", "主题", "主题内", "时间", "时长(秒)", "总分/30", "百分制", "等级", "较上次"]
    widths = [0.6, 1.0, 0.7, 1.5, 0.8, 0.8, 0.7, 0.7, 0.7]
    hrow = tbl.add_row().cells
    for ci, htxt in enumerate(heads):
        table_cell(hrow[ci], htxt, bold=True, center=True)
    prev = None
    for r in recs:
        delta = "" if prev is None else ("+%d" % (r["total"] - prev) if r["total"] >= prev else "%d" % (r["total"] - prev))
        cells = tbl.add_row().cells
        vals = ["第 %d 次" % r["attempt"], r.get("topicName") or TOPIC_NAMES.get(r.get("topic") or "gripper", "?"), "第 %s 次" % (r.get("topicAttempt") or "—"), fmt_ts(r.get("ts")), "%d" % int(float(r.get("duration") or 0)), "%d/30" % r.get("total"), "%.1f" % r.get("pct"), r.get("level"), delta]
        for ci, v in enumerate(vals):
            table_cell(cells[ci], v, center=(ci in (0,1,2,3,4,5,6,7,8)))
        prev = r["total"]
    # 小结
    grip = [r["total"] for r in recs if (r.get("topic") or "gripper") == "gripper"]
    jack = [r["total"] for r in recs if r.get("topic") == "jack"]
    para(doc, "小结：夹爪总分 %s；千斤顶首测 %d 分。同主题看进步：夹爪第 1→4 次 %d→%d（+%d）；跨主题看迁移：应按“首测对首测”比较（夹爪首测 %d 分 vs 千斤顶首测 %d 分）。" % (
        " → ".join(map(str, grip)), jack[0] if jack else 0,
        grip[0], grip[-1], grip[-1] - grip[0],
        grip[0], jack[0] if jack else 0), size=10, bold=True, space_after=4)

    # 二、趋势图
    heading(doc, "二、趋势图", 1)
    p1 = os.path.join(tmpdir, "trend_total.png")
    p2 = os.path.join(tmpdir, "trend_dims.png")
    make_total_trend(p1, recs)
    make_dim_trend(p2, recs)
    doc.add_picture(p1, width=Inches(6.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_picture(p2, width=Inches(6.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 三、历次练习明细
    heading(doc, "三、历次练习明细", 1)
    for r in recs:
        topic = r.get("topic") or "gripper"
        tn = r.get("topicName") or TOPIC_NAMES.get(topic, "?")
        weak = min(range(6), key=lambda i: (r.get("scores") or [3]*6)[i])
        heading(doc, "第 %d 次练习 · %s · 该主题第 %s 次 · %s" % (r["attempt"], tn, r.get("topicAttempt") or "—", fmt_ts(r.get("ts"))), 2)
        para(doc, "时长 %d 秒 · 总分 %d/30 · 百分制 %.1f · 等级 %s" % (int(float(r.get("duration") or 0)), r.get("total"), r.get("pct"), r.get("level")), size=10, bold=True, space_after=2)
        para(doc, "转写文本：", size=10, bold=True, space_after=2)
        para(doc, str(r.get("transcript") or "（无）"), size=10, space_after=8)
        dims = r.get("dims") or []
        rows = [("评价维度", "得分", "评语")]
        for i in range(6):
            score = (r.get("scores") or [3]*6)[i]
            note = dims[i].get("note", "") if i < len(dims) and isinstance(dims[i], dict) else ""
            rows.append((DIMS[i], str(score), note))
        rows.append(("练习主题", tn, "该主题第 %s 次" % (r.get("topicAttempt") or "—")))
        rows.append(("合计（满分 30）", str(r.get("total")), ""))
        rows.append(("百分制得分", "%.1f" % r.get("pct"), ""))
        rows.append(("等级判定", str(r.get("level")), ""))
        tt = doc.add_table(rows=0, cols=3)
        tt.style = "Table Grid"
        for row in rows:
            cells = tt.add_row().cells
            table_cell(cells[0], row[0], bold=(row[0] in ("评价维度", "合计（满分 30）", "百分制得分", "等级判定", "练习主题")))
            table_cell(cells[1], row[1], center=True)
            table_cell(cells[2], row[2])
        rp = os.path.join(tmpdir, "radar_%d.png" % r["attempt"])
        make_radar(rp, (r.get("scores") or [3]*6))
        doc.add_picture(rp, width=Inches(2.6))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        flags = r.get("flags") or []
        if flags:
            para(doc, "需纠正：", size=10, bold=True, space_after=2)
            for f in flags:
                pp = doc.add_paragraph(style="List Bullet")
                rr = pp.add_run(str(f)); set_font(rr, size=10)
        para(doc, "阿基米德杠杆问题：%s" % LEVER[weak], size=10, space_after=4)
        para(doc, "（本记录由「机械产品介绍·语音训练」系统生成）", size=9, space_after=10)

    # 四、评分方法与横向对比规则
    heading(doc, "四、评分方法与横向对比规则", 1)
    mt = doc.add_table(rows=0, cols=3)
    mt.style = "Table Grid"
    cells = mt.add_row().cells
    for ci, htxt in enumerate(["维度", "考查内容", "计分要点"]):
        table_cell(cells[ci], htxt, bold=True, center=True)
    for di, dn in enumerate(DIMS):
        cells = mt.add_row().cells
        table_cell(cells[0], dn, bold=True)
        table_cell(cells[1], DIM_NOTE[dn])
        table_cell(cells[2], "1–5 分，总分 30 分")
    para(doc, "横向对比规则：", size=10, bold=True, space_after=2, space_before=6)
    rules = [
        "1. 同一把尺：两个主题共用 6 维 ×（1–5）量表，分数可画在同一张雷达图/折线图上直接比较；",
        "2. 难度校准：双基准稿验证（夹爪与千斤顶满分稿同为 25/30、残缺稿同为 15/30），词表已配平；",
        "3. 同主题看进步：夹爪第 1→4 次总分逐次对比；",
        "4. 跨主题看迁移：必须“首测对首测”（夹爪首测 vs 千斤顶首测），不能拿练习过 3 次的分数与新主题首测比。",
    ]
    for rule in rules:
        pp = doc.add_paragraph(style="List Bullet")
        rr = pp.add_run(rule); set_font(rr, size=10)

    doc.save(out_path)
    return out_path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--records", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    with open(args.records, "r", encoding="utf-8") as f:
        records = json.load(f)
    tmpdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_rebuild_tmp")
    os.makedirs(tmpdir, exist_ok=True)
    out = build(records, args.out, tmpdir)
    print(json.dumps({"ok": True, "path": out}, ensure_ascii=False))

if __name__ == "__main__":
    main()
