#!/usr/bin/env python3
"""从《红宝书 10 年真题词汇注释》文字层抽取词表，释义用 ECDICT 补齐。"""
import csv, json, os, re
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '【红宝书】考研英语10年真题词汇注释（电子书）.pdf')
OUT = os.path.join(ROOT, 'src', 'data', 'words', 'zhenti-words.js')
DICT = r'C:/Users/ADMINI~1/AppData/Local/Temp/ecdict.csv'
csv.field_size_limit(10 ** 7)

dic = {}
with open(DICT, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w and w not in dic:
            dic[w] = row

reader = PdfReader(PDF)
text = '\n'.join((p.extract_text() or '') for p in reader.pages)
raw = re.findall(r'([A-Za-z][A-Za-z-]{2,})\s*\[\s*[^\]]{2,}\]', text)
print('headwords raw', len(raw), 'unique', len(set(w.lower() for w in raw)))


def phone(p):
    p = (p or '').strip().strip('/').lstrip('.').strip()
    if not p:
        return ''
    p = p.replace('ә', 'ə').replace('є', 'e').replace('ɒː', 'ɔː').replace('ɡ', 'g').replace("'", 'ˈ').replace(':', 'ː')
    return f'/{p}/'


def forms(exchange):
    label = {'p': '过去式', 'd': '过去分词', 'i': '现在分词', '3': '第三人称单数', 's': '复数', 'r': '比较级', 't': '最高级'}
    out, seen = [], set()
    for part in (exchange or '').split('/'):
        if ':' in part:
            k, v = part.split(':', 1)
            if k in label and v and v not in seen:
                out.append([v, label[k]])
                seen.add(v)
    return out[:4]


def defs(row):
    lines = (row.get('translation') or '').replace('\\n', '\n').split('\n')
    out = []
    for line in lines[:2]:
        line = re.sub(r'^[a-z]+\.\s*', '', line, flags=re.I)
        line = re.sub(r'\s+', '', line).replace(',', '；')
        if line:
            out.append(line)
    return '；'.join(out)[:90]


words, seen = [], set()
for w in raw:
    w = w.lower()
    if w in seen or w not in dic:
        continue
    cn = defs(dic[w])
    if not cn:
        continue
    entry = {'w': w, 'ph': phone(dic[w].get('phonetic')), 'defs': [['·', cn]],
             'note': '红宝书 · 十年真题词汇', 'basic': True, 'src': '《考研英语10年真题词汇注释》'}
    f = forms(dic[w].get('exchange'))
    if f:
        entry['forms'] = f
    words.append(entry)
    seen.add(w)

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('/** 从真题词汇注释文字层抽取词表，释义由 ECDICT 补齐。 */\n')
    fh.write('export const ZHENTI_WORDS = ')
    fh.write(json.dumps(words, ensure_ascii=False, separators=(',', ':')))
    fh.write(';\n')
print('kept', len(words), 'kb', round(os.path.getsize(OUT) / 1024))
