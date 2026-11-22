#!/usr/bin/env python3
"""把两本 OCR 结果整理成词书；释义不干净时回退 ECDICT。"""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT = r'C:\Users\ADMINI~1\AppData\Local\Temp\ecdict.csv'
csv.field_size_limit(10 ** 7)

dic = {}
with open(DICT, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w and w not in dic:
            dic[w] = row


def phone(p):
    p = (p or '').strip().strip('/').lstrip('.').strip()
    if not p:
        return ''
    p = (p.replace('ә', 'ə').replace('є', 'e').replace('ɒː', 'ɔː')
          .replace('ɡ', 'g').replace("'", 'ˈ').replace(':', 'ː'))
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


def fallback(row):
    lines = (row.get('translation') or '').replace('\\n', '\n').split('\n')
    out = []
    for line in lines[:2]:
        line = re.sub(r'^[a-z]+\.\s*', '', line, flags=re.I)
        line = line.replace(', ', '；').replace(',', '；')
        line = re.sub(r'\[[^\]]{1,4}\]', '', line)
        line = re.sub(r'\s+', '', line).strip('； ')
        if line:
            out.append(line)
    return '；'.join(out)[:90]


def clean_cn(cn, mode):
    s = re.sub(r'\s+', '', cn or '')
    s = re.sub(r'^[A-Za-z][.．]?', '', s)
    s = s.replace(',', '；')
    s = re.sub(r'[（(][^）)]*[A-Za-z][^）)]*[）)]', '', s)
    s = re.split(r'[：:]', s)[0]
    s = re.split(r'[A-Za-zαβ]{2,}', s)[0]
    s = re.sub(r'^[；;，。、】\]]+', '', s)
    return s.strip('； ')[:90]


def usable(s):
    return bool(s) and len(s) >= 5 and not re.search(r'[A-Za-z]{2,}', s) and not re.search(r'[→【】]|记单词|词根|派生|真题|例句', s)


def build(src, out_const, out_file, mode, note, src_label):
    raw = json.load(open(src, encoding='utf-8'))
    words, seen = [], set()
    for item in raw:
        w = re.sub(r'\s+', '', item.get('w') or '').strip('.,;:').lower()
        if not w or w in seen or not re.fullmatch(r"[a-z][a-z'-]{2,}", w):
            continue
        row = dic.get(w)
        if not row:
            continue
        cn = clean_cn(item.get('cn'), mode)
        if mode == '5500' or not usable(cn):
            cn = fallback(row)
        if not cn:
            continue
        entry = {
            'w': w,
            'ph': phone(row.get('phonetic')),
            'defs': [['·', cn]],
            'note': note,
            'basic': True,
            'src': src_label
        }
        f = forms(row.get('exchange'))
        if f:
            entry['forms'] = f
        words.append(entry)
        seen.add(w)
    path = os.path.join(ROOT, 'src', 'data', 'words', out_file)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('/** OCR 生成，建议抽查。 */\n')
        fh.write(f'export const {out_const} = ')
        fh.write(json.dumps(words, ensure_ascii=False, separators=(',', ':')))
        fh.write(';\n')
    print(out_file, 'raw', len(raw), 'kept', len(words), 'kb', round(os.path.getsize(path) / 1024))


build(os.path.join(ROOT, 'design', 'ocr-5500.json'), 'KAOYAN_5500', 'kaoyan-5500.js', '5500',
      '考研 5500 · OCR', '《27考研英语5500词汇》OCR')
# 真题词表改由 build-zhenti-text.py 从文字层生成
