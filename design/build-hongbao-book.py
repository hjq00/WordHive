#!/usr/bin/env python3
"""把 OCR 结果整理成词书：去重、校验、用 ECDICT 补音标与词形。"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'hongbao-ocr.json')
OUT = os.path.join(ROOT, 'src', 'data', 'words', 'hongbao.js')
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


def fallback_cn(row):
    text = (row.get('translation') or '').replace('\\n', '\n').split('\n')[0]
    text = re.sub(r'^[a-z]+\.\s*', '', text, flags=re.I)
    text = re.sub(r'\s+', ' ', text).replace(', ', '；').replace(',', '；')
    return text.strip('； ')[:60]


def main():
    raw = json.load(open(SRC, encoding='utf-8'))
    words, seen = [], set()
    for item in raw:
        w = re.sub(r'\s+', '', item.get('w') or '').strip('.,;:')
        w = w.lower()
        if not w or w in seen or not re.fullmatch(r"[a-z][a-z'-]{2,}", w):
            continue
        row = dic.get(w)
        if not row:
            continue
        cn = re.sub(r'\s+', ' ', item.get('cn') or '').strip()
        cn = cn.replace(';', '；')
        cn = re.sub(r'^(adi|adj|adv|ad|vt|vi|v|n|a|ot|u|y|prep|conj)\.\s*', '', cn, flags=re.I)
        cn = re.sub(r'^[①-⑤口□○●•·√\s]+', '', cn)
        cn = re.sub(r'^(.{2,5})\1', r'\1', cn)
        cn = re.sub(r'(?<=[；，。])\s+', '', cn).strip('； ')
        if len(cn) < 5 or not re.search(r'[\u4e00-\u9fff]', cn):
            cn = fallback_cn(row)
        if not cn:
            continue
        entry = {
            'w': w,
            'ph': phone(row.get('phonetic')),
            'defs': [['·', cn[:90]]],
            'note': '红宝书 · 考研必考词（OCR）',
            'basic': True,
            'src': '红宝书精缩版 · 离线 OCR'
        }
        f = forms(row.get('exchange'))
        if f:
            entry['forms'] = f
        words.append(entry)
        seen.add(w)
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('/** 由红宝书精缩版扫描件 OCR 生成，建议抽查。 */\n')
        fh.write('export const HONGBAO_OCR = ')
        fh.write(json.dumps(words, ensure_ascii=False, separators=(',', ':')))
        fh.write(';\n')
    print('raw', len(raw), 'kept', len(words), 'kb', round(os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
