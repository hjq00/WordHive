#!/usr/bin/env python3
"""解析资料库「六级核心词 1-7 天」PDF，生成词书。

用法：python design/build-cet6-days.py <pdf_dir> <ecdict.csv>
"""
import csv, json, os, re, sys
from pypdf import PdfReader

PDF_DIR = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\ADMINI~1\AppData\Local\Temp\days'
CSV = sys.argv[2] if len(sys.argv) > 2 else r'C:\Users\ADMINI~1\AppData\Local\Temp\ecdict.csv'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'words', 'cet6-days.js')

POS_RE = re.compile(r'(?<![A-Za-z])(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.\s*')
LINE_RE = re.compile(r'^(\d{1,3})\s+(.+?)\s+((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.\s*.*)$')

FIX_WORD = {
    'center/-tre': 'center', 'hono(u)r': 'honor', 'favo(u)r': 'favor',
    'neighbo(u)r': 'neighbor', 'endeavo(u)r': 'endeavor', 'fulfil(l)': 'fulfil',
    'instal(l)': 'install', 'maximize/-ise': 'maximize', 'organize/-ise': 'organize',
    'criticize/--ise': 'criticize', 'criticize/-ise': 'criticize', 'semble': 'subtle',
    'sea': 'seal', 'por tray': 'portray', 'civilise': 'civilize',
}


def clean_cn(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '', text)
    text = text.replace(' ,', '，').replace(', ', '；').replace(',', '；').replace(';', '；')
    text = re.sub(r'\s+([；;，。])', r'\1', text)
    text = re.sub(r'(?<=[；，。])\s+', '', text)
    return text.strip('； ')


def split_defs(raw):
    raw = clean_cn(raw)
    parts = []
    marks = list(POS_RE.finditer(raw))
    if not marks:
        return [['·', raw]]
    for i, m in enumerate(marks):
        pos = m.group(1).lower()
        pos = 'v.' if pos in ('v', 'vt', 'vi') else f'{pos}.'
        start = m.end()
        end = marks[i + 1].start() if i + 1 < len(marks) else len(raw)
        cn = raw[start:end].strip('； ;')
        if cn:
            item = [pos, cn[:60]]
            if item not in parts:
                parts.append(item)
    return parts[:4] or [['·', raw[:60]]]


def load_dict(csv_path):
    csv.field_size_limit(10 ** 7)
    data = {}
    with open(csv_path, encoding='utf-8', newline='') as f:
        for row in csv.DictReader(f):
            w = (row.get('word') or '').strip().lower()
            if w and w not in data:
                data[w] = row
    return data


def phone(p):
    p = (p or '').strip().strip('/')
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


def main():
    dic = load_dict(CSV)
    words, seen = [], set()
    for day in range(1, 8):
        path = os.path.join(PDF_DIR, f'day{day}.pdf')
        reader = PdfReader(path)
        lines = []
        for page in reader.pages:
            lines += (page.extract_text() or '').split('\n')
        entries = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('序号') or line.startswith('第') and '天' in line[:6]:
                continue
            m = LINE_RE.match(line)
            if m:
                entries.append([int(m.group(1)), m.group(2).strip(), m.group(3).strip()])
            elif entries and not re.match(r'^\d{1,3}\s', line):
                entries[-1][2] += ' ' + line
        print(f'day {day}: {len(entries)} rows, range {entries[0][0] if entries else "-"}..{entries[-1][0] if entries else "-"}')
        start_section = (day - 1) * 3 + 1
        for idx, head, definition in entries:
            w = FIX_WORD.get(head.lower(), head)
            w = re.sub(r'\(u\)', 'u', w)
            w = re.sub(r'\(l\)', 'l', w)
            w = re.sub(r'\(ue\)', '', w)
            if '/' in w:
                w = w.split('/')[0]
            w = re.sub(r'\s+', ' ', w).strip(" .'")
            if not w or w.lower() in seen:
                continue
            if not re.fullmatch(r"[A-Za-z][A-Za-z '()./-]{1,40}", w):
                continue
            row = dic.get(w.lower().replace('(u)', 'u').replace('(l)', 'l'))
            defs = split_defs(definition)
            section = start_section + min(2, (idx - 1) // 60)
            item = {
                'w': w,
                'ph': phone(row.get('phonetic')) if row else '',
                'defs': defs,
                'note': f'六级核心 · 第{day}天 · 第{section}节',
                'basic': True,
                'src': '资料库 · 六级核心词 1–7 天',
                'day': day,
                'section': section
            }
            f = forms(row.get('exchange')) if row else []
            if f:
                item['forms'] = f
            words.append(item)
            seen.add(w.lower())
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('/** 由资料库「六级核心词 1-7 天」PDF 解析生成。 */\n')
        fh.write('export const CET6_DAYS = ')
        fh.write(json.dumps(words, ensure_ascii=False, separators=(',', ':')))
        fh.write(';\n')
    print('total', len(words), f'{os.path.getsize(OUT)/1024:.0f} KB')


if __name__ == '__main__':
    main()
