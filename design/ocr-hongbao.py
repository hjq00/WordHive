#!/usr/bin/env python3
"""离线 OCR 红宝书扫描版：按双栏重建行序，抽取词头与释义。

用法：python design/ocr-hongbao.py <pdf> <out.json> [start] [end] [dpi]
依赖：pymupdf、rapidocr-onnxruntime（pip 安装，均免费）
"""
import sys, re, json, time, csv
import fitz
from rapidocr_onnxruntime import RapidOCR

PDF = sys.argv[1]
OUT = sys.argv[2]
START = int(sys.argv[3]) if len(sys.argv) > 3 else 0
END = int(sys.argv[4]) if len(sys.argv) > 4 else None
DPI = int(sys.argv[5]) if len(sys.argv) > 5 else 200
DICT = r'C:/Users/ADMINI~1/AppData/Local/Temp/ecdict.csv'

csv.field_size_limit(10 ** 7)
headwords = set()
with open(DICT, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w:
            headwords.add(w)

WORD = re.compile(r"^[A-Za-z][A-Za-z'’-]{2,}$")
POS = re.compile(r'\b(n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|aux)\.')
CJK = re.compile(r'[\u4e00-\u9fff]')
MNEMO = re.compile(r'[词根缀]|→|十')


def norm_word(raw):
    w = raw.strip().strip('.,;:!?()[]{}')
    w = re.sub(r'^[O0Q]', '', w) if len(w) > 4 else w
    return w.lower()


def group_lines(res, width):
    cols = {'L': [], 'R': []}
    for box, text, score in res:
        cx = (box[0][0] + box[1][0]) / 2
        (cols['L'] if cx < width / 2 else cols['R']).append((box[0][1], box[0][0], text))
    lines = []
    for items in (cols['L'], cols['R']):
        items.sort()
        cur, last = [], None
        for y, x, t in items:
            if last is not None and abs(y - last) < 18:
                cur[-1].append((x, t))
            else:
                cur.append([(x, t)])
                last = y
        for ln in cur:
            ln.sort()
            lines.append(ln)
    return lines


def clean_def(text):
    s = text.strip().lstrip('√ ').strip()
    s = re.sub(r'^[①②③④⑤]\s*', '', s)
    s = re.sub(r'^[.．、,，;；:：\s]+', '', s)
    s = re.sub(r'^(ut|vt|vi|v|n|adj|adv|a|ad|prep|conj|pron|num|art|int|aux)\.\s*', '', s, flags=re.I)
    s = s.replace(', ', '；').replace(',', '；')
    s = re.sub(r'\s+', ' ', s)
    return s.strip('； ')[:80]


def parse_page(page, engine):
    pix = page.get_pixmap(dpi=DPI)
    res, _ = engine(pix.tobytes('png'))
    width = page.rect.width / 72 * DPI
    lines = group_lines(res or [], width)
    entries = []
    cur = None
    for ln in lines:
        text = ' '.join(t for _, t in ln).strip()
        first = ln[0][1].strip()
        rest = text[len(first):]
        is_head = False
        if WORD.match(first):
            w = norm_word(first)
            if w in headwords and ('[' in rest or ']' in rest or POS.search(rest)):
                is_head = True
        if is_head:
            if cur and cur['raw']:
                entries.append(cur)
            cur = {'w': first.strip(), 'defs': [], 'raw': []}
        elif cur is not None and CJK.search(text):
            cur['raw'].append(text)
    if cur and cur['raw']:
        entries.append(cur)

    out = []
    for e in entries:
        lines_def = e['raw']
        cands = []
        for t in lines_def:
            if MNEMO.search(t) and not t.startswith('√'):
                continue
            if e['w'].lower() in t.lower() and not t.startswith('√'):
                continue
            cands.append(t)
        chosen_i = next((i for i, t in enumerate(cands) if t.startswith('√')), 0 if cands else -1)
        if chosen_i < 0:
            continue
        cn = clean_def(cands[chosen_i])
        for nxt in cands[chosen_i + 1:chosen_i + 3]:
            if nxt.startswith('√') or re.match(r'^[①②③④⑤]', nxt) or re.match(r'^(n|v|vt|vi|adj|adv|a|ad)\.', nxt, re.I):
                break
            cn += clean_def(nxt)
            if len(cn) > 90:
                break
        parts2 = cn.split('②')
        if len(parts2) > 1:
            cn = parts2[0].strip('； ') + '；' + clean_def(parts2[1])
        if not cn:
            continue
        out.append({'w': e['w'], 'cn': cn[:90], 'src': '红宝书 · OCR'})
    return out


def main():
    engine = RapidOCR()
    doc = fitz.open(PDF)
    end = END if END is not None else len(doc) - 1
    all_entries = []
    t0 = time.time()
    for pno in range(START, min(end, len(doc) - 1) + 1):
        try:
            items = parse_page(doc[pno], engine)
        except Exception as err:
            print('page', pno, 'ERR', err, flush=True)
            continue
        all_entries.extend(items)
        if pno % 10 == 0:
            print('page', pno, 'entries', len(all_entries), 'elapsed', round(time.time() - t0), flush=True)
            with open(OUT, 'w', encoding='utf-8') as f:
                json.dump(all_entries, f, ensure_ascii=False)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False)
    print('DONE', len(all_entries), 'sec', round(time.time() - t0))


if __name__ == '__main__':
    main()
