#!/usr/bin/env python3
"""从《真题词汇注释》文字层提取同义、反义与真题例句。"""
import json, os, re
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '【红宝书】考研英语10年真题词汇注释（电子书）.pdf')
OUT = os.path.join(ROOT, 'design', 'zhenti-extra.json')

reader = PdfReader(PDF)
lines = []
for page in reader.pages:
    lines += [l.strip() for l in (page.extract_text() or '').split('\n') if l.strip()]

HEAD = re.compile(r'([A-Za-z][A-Za-z-]{2,})\s*\[\s*[^\]]{2,}\]')
MARK = re.compile(r'([同反义]+|真题例句|助记|词性|词义|派生|词组)')
blocks, cur, buf = [], None, []
for line in lines:
    m = HEAD.search(line)
    if m and not line.startswith('www.'):
        if cur:
            blocks.append((cur, buf))
        cur, buf = m.group(1).lower(), []
    elif cur:
        buf.append(line)
if cur:
    blocks.append((cur, buf))


def english_words(text, limit=6):
    words = re.findall(r'\b[A-Za-z][A-Za-z-]{2,}\b', text)
    out = []
    for w in words:
        w = w.lower()
        if w not in out and w not in ('adj', 'adv', 'n', 'v', 'vt', 'vi', 'the', 'and'):
            out.append(w)
        if len(out) >= limit:
            break
    return out


def parse_section(buf, marker):
    text = []
    active = False
    for line in buf:
        if marker in line:
            active = True
            text.append(line.split(marker, 1)[1])
            continue
        if active and MARK.search(line):
            break
        if active:
            text.append(line)
    return ' '.join(text)


def clean_sentence(text):
    text = text.replace('鄄', '').replace('袁', '，').replace('揖', '').replace('铱', '')
    text = re.sub(r'\s+', ' ', text).strip()
    m = re.search(r'[\u4e00-\u9fff]', text)
    if not m:
        return re.sub(r'[^A-Za-z0-9\s,.;:!?()\-]', '', text).strip(), ''
    en = text[:m.start()]
    zh = text[m.start():]
    en = re.sub(r'[^A-Za-z0-9\s,.;:!?()\-]', '', en).strip()
    zh = re.sub(r'\s+', '', zh)
    zh = re.sub(r'[^\u4e00-\u9fff，。；、：！？“”（）a-zA-Z0-9\-]', '', zh)
    return en, zh[:160]


out = {}
for word, buf in blocks:
    item = {}
    syn = parse_section(buf, '同义')
    ant = parse_section(buf, '反义')
    ex = parse_section(buf, '真题例句')
    s = english_words(syn)
    a = english_words(ant)
    if s:
        item['syn'] = s
    if a:
        item['ant'] = a
    en, zh = clean_sentence(ex)
    if len(en) >= 25:
        item['ex'] = {'en': en, 'zh': zh}
        item['real'] = {'en': en, 'zh': zh, 'src': '真题词汇注释（你提供的 PDF）'}
    if item:
        out[word] = item

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print('entries with extra', len(out))
for field in ('syn', 'ant', 'ex'):
    print(field, sum(1 for v in out.values() if field in v))
for w in ('representative', 'commerce', 'upright'):
    print(w, out.get(w))
