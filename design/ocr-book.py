#!/usr/bin/env python3
"""并行 OCR 扫描词书（300 DPI）。

用法：python design/ocr-book.py <pdf> <out.json> <mode:5500|zhenti> [start] [end] [workers]
"""
import csv, json, os, re, sys, time
os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('ORT_NUM_THREADS', '2')
import multiprocessing as mp
import fitz
from rapidocr_onnxruntime import RapidOCR

PDF = sys.argv[1]
OUT = sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else '5500'
START = int(sys.argv[4]) if len(sys.argv) > 4 else 0
END = int(sys.argv[5]) if len(sys.argv) > 5 else None
WORKERS = int(sys.argv[6]) if len(sys.argv) > 6 else 3
DPI = 200
DICT = r'C:\Users\ADMINI~1\AppData\Local\Temp\ecdict.csv'

csv.field_size_limit(10 ** 7)
HEADWORDS = set()
with open(DICT, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w:
            HEADWORDS.add(w)

WORD = re.compile(r"^[A-Za-z][A-Za-z'’-]{2,}$")
POS = re.compile(r'\b(n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|aux)\.')
CJK = re.compile(r'[\u4e00-\u9fff]')
SKIP = re.compile(r'助记|记单词|词根|词缀|派生|真题例句|【例】|例句|词组|同义|反义|词性')
DOC = None
ENGINE = None


def init_worker(path):
    global DOC, ENGINE
    DOC = fitz.open(path)
    ENGINE = RapidOCR()


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
            if last is not None and abs(y - last) < 22:
                cur[-1].append((x, t))
            else:
                cur.append([(x, t)])
                last = y
        for ln in cur:
            ln.sort()
            lines.append(ln)
    return lines


def strip_no(t):
    return re.sub(r'^\s*[\dOQo]{1,3}\s*[.,、，]?\s*', '', t).strip()


def head_of(line):
    texts = [t for _, t in line]
    joined = ' '.join(texts)
    for t in texts:
        cand = strip_no(t)
        if WORD.fullmatch(cand) and cand.lower() in HEADWORDS and ('[' in joined or ']' in joined or POS.search(joined)):
            return cand
    m = re.match(r'^\s*(?:\d{1,3}\s*[.、]\s*)?([A-Za-z][A-Za-z-]{2,})\s*[\[/]', joined)
    if m and m.group(1).lower() in HEADWORDS:
        return m.group(1)
    return None


def clean_cn(text):
    s = text
    s = re.sub(r'^[【\[\(]?\s*(词义|释义)\s*[】\]\)]?\s*[:：]?\s*', '', s)
    s = re.sub(r'^[√①②③④⑤】\]口□○●•·\s.、,，;；:：]+', '', s)
    s = re.sub(r'^(adi|adj|adv|ad|vt|vi|v|n|a|ot|u|y|prep|conj)\.\s*', '', s, flags=re.I)
    s = s.replace(';', '；').replace(', ', '；').replace(',', '；')
    s = re.sub(r'(?<=[；，。])\s+', '', s)
    s = re.sub(r'\s+', '', s)
    s = re.sub(r'^(.{2,5})\1', r'\1', s)
    return s.strip('； ')[:90]


def defs_from(raw):
    cands = []
    for t in raw:
        if SKIP.search(t) and not t.startswith('【词义'):
            continue
        if MODE == 'zhenti':
            if '词义' in t:
                cands.append(t.split('词义', 1)[1])
        else:
            if CJK.search(t):
                cands.append(t)
    out = []
    for c in cands:
        cn = clean_cn(c)
        if len(cn) >= 4:
            out.append(cn)
        if len(out) >= 2:
            break
    return '；'.join(out)[:120]


def parse_page(pno):
    page = DOC[pno]
    pix = page.get_pixmap(dpi=DPI)
    res, _ = ENGINE(pix.tobytes('png'))
    width = page.rect.width / 72 * DPI
    lines = group_lines(res or [], width)
    entries, cur = [], None
    for i, ln in enumerate(lines):
        w = head_of(ln)
        if not w and len(ln) == 1:
            cand = strip_no(ln[0][1])
            if WORD.fullmatch(cand) and cand.lower() in HEADWORDS and i + 1 < len(lines):
                nxt = ' '.join(t for _, t in lines[i + 1])
                if '[' in nxt or ']' in nxt or POS.search(nxt) or (CJK.search(nxt) and len(nxt) < 30):
                    w = cand
        if w:
            if cur and cur['raw']:
                entries.append(cur)
            cur = {'w': w, 'raw': []}
        elif cur is not None and CJK.search(' '.join(t for _, t in ln)):
            cur['raw'].append(' '.join(t for _, t in ln).strip())
    if cur and cur['raw']:
        entries.append(cur)
    out = []
    for e in entries:
        cn = defs_from(e['raw'])
        if cn:
            out.append({'w': e['w'].lower(), 'cn': cn})
    return pno, out


def main():
    doc = fitz.open(PDF)
    end = END if END is not None else len(doc) - 1
    end = min(end, len(doc) - 1)
    pages = list(range(START, end + 1))
    by_page = {}
    done = 0
    t0 = time.time()
    ctx = mp.get_context('spawn')
    with ctx.Pool(WORKERS, initializer=init_worker, initargs=(PDF,)) as pool:
        for pno, items in pool.imap_unordered(parse_page, pages):
            by_page[pno] = items
            done += 1
            if done % 20 == 0:
                merged = [x for p in sorted(by_page) for x in by_page[p]]
                print('pages', done, '/', len(pages), 'entries', len(merged), 'sec', round(time.time() - t0), flush=True)
                with open(OUT, 'w', encoding='utf-8') as f:
                    json.dump(merged, f, ensure_ascii=False)
    results = [x for p in sorted(by_page) for x in by_page[p]]
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False)
    print('DONE', len(results), 'sec', round(time.time() - t0))


if __name__ == '__main__':
    main()
