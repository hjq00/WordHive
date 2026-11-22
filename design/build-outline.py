#!/usr/bin/env python3
"""从 ECDICT（MIT）生成主流考纲词书。

用法：python design/build-outline.py <ecdict.csv>
输出：src/data/words/{kaoyan,cet6,ielts,toefl}-outline.js
"""
import csv, json, os, re, sys

CSV = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ADMINI~1\AppData\Local\Temp\ecdict.csv"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'words')

POS_MAP = {
    'n.': 'n.', 'vt.': 'v.', 'vi.': 'v.', 'v.': 'v.', 'aux.': 'aux.',
    'a.': 'adj.', 'adj.': 'adj.', 'ad.': 'adv.', 'adv.': 'adv.',
    'prep.': 'prep.', 'conj.': 'conj.', 'pron.': 'pron.', 'num.': 'num.', 'int.': 'int.'
}
FORM_LABEL = {'p': '过去式', 'd': '过去分词', 'i': '现在分词', '3': '第三人称单数', 's': '复数', 'r': '比较级', 't': '最高级'}


def curated_words():
    words = set()
    base = open(os.path.join(ROOT, 'src', 'data', 'books.js'), encoding='utf-8').read()
    words.update(w.lower() for w in re.findall(r"w:\s*'([^']+)'", base))
    for name in os.listdir(OUT):
        if not name.endswith('.js'):
            continue
        text = open(os.path.join(OUT, name), encoding='utf-8').read()
        words.update(w.lower() for w in re.findall(r"w:\s*'([^']+)'", text))
    return words


def norm_phone(p):
    p = (p or '').strip().strip('/')
    if not p:
        return ''
    p = (p.replace('ә', 'ə').replace('ɑ:', 'ɑː').replace('ɔ:', 'ɔː')
         .replace('i:', 'iː').replace('u:', 'uː').replace("'", 'ˈ').replace(':', 'ː'))
    return f'/{p}/'


def parse_defs(translation):
    translation = (translation or '').replace(chr(92) + 'n', '\n').replace(chr(92) + 'r', '')
    lines = [l.strip() for l in translation.split('\n') if l.strip()]
    out = []
    for line in lines:
        if line.startswith('[') or line.startswith('【'):
            continue
        m = re.match(r'^([a-z]+\.)\s*(.+)$', line, re.I)
        if m and m.group(1).lower() in POS_MAP:
            pos = POS_MAP[m.group(1).lower()]
            cn = m.group(2)
        else:
            pos = '·'
            cn = line
        cn = re.sub(r'\s+', ' ', cn).replace(', ', '；').replace(',', '；').strip('； ')
        if not cn:
            continue
        if len(cn) > 42:
            cn = cn[:41] + '…'
        item = [pos, cn]
        if item not in out:
            out.append(item)
        if len(out) >= 3:
            break
    return out


def parse_forms(exchange):
    forms = []
    for part in (exchange or '').split('/'):
        if ':' not in part:
            continue
        k, v = part.split(':', 1)
        if k in FORM_LABEL and v:
            forms.append([v, FORM_LABEL[k]])
    return forms[:6]


def usable(row):
    w = (row.get('word') or '').strip()
    if not re.fullmatch(r"[a-zA-Z][a-zA-Z'-]{2,}", w):
        return False
    if not (row.get('translation') or '').strip():
        return False
    if not norm_phone(row.get('phonetic')):
        return False
    if not row.get('frq', '').isdigit() or int(row['frq']) <= 0:
        return False
    return True


def build(rows, tag, limit, used, priority_tags):
    pool = []
    for row in rows:
        tags = set((row.get('tag') or '').split())
        if tag not in tags or 'cet4' in tags or tags & {'zk', 'gk'}:
            continue
        if any(t in tags for t in priority_tags):
            continue
        if not usable(row):
            continue
        w = row['word'].strip().lower()
        if w in used:
            continue
        defs = parse_defs(row['translation'])
        if not defs:
            continue
        pool.append((int(row['frq']), w, row, defs))
    pool.sort(key=lambda x: x[0])
    out = []
    for freq, w, row, defs in pool[:limit]:
        out.append({
            'w': w,
            'ph': norm_phone(row['phonetic']),
            'defs': defs,
            'note': f"大纲词 · 词频 #{freq}",
            'basic': True,
            'forms': parse_forms(row.get('exchange')),
            'src': 'ECDICT · MIT'
        })
        used.add(w)
    return out


def main():
    csv.field_size_limit(10 ** 7)
    rows = list(csv.DictReader(open(CSV, encoding='utf-8', newline='')))
    used = curated_words()
    print('curated', len(used))

    books = [
        ('KAOYAN_OUTLINE', 'kaoyan-outline', 'ky', 1000, []),
        ('CET6_OUTLINE', 'cet6-outline', 'cet6', 900, ['ky']),
        ('IELTS_OUTLINE', 'ielts-outline', 'ielts', 700, ['ky', 'cet6']),
        ('TOEFL_OUTLINE', 'toefl-outline', 'toefl', 800, ['ky', 'cet6', 'ielts']),
    ]
    for const, fname, tag, limit, prio in books:
        data = build(rows, tag, limit, used, prio)
        path = os.path.join(OUT, f'{fname}.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('/** 由 ECDICT（MIT）生成的主流考纲词表。请勿手工编辑。 */\n')
            f.write(f'export const {const} = ')
            f.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
            f.write(';\n')
        print(fname, len(data), f'{os.path.getsize(path)/1024:.0f} KB')


if __name__ == '__main__':
    main()
