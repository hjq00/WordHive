#!/usr/bin/env python3
"""用 MyMemory 批量翻译全部例句，结果缓存到 design/example-translations.json。"""
import json, os, re, time, urllib.parse, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'data', 'enrichment.js')
OUT = os.path.join(ROOT, 'design', 'example-translations.json')

s = open(SRC, encoding='utf-8').read()
data = json.loads(s.split('export const ENRICHMENT = ', 1)[1].rsplit(';', 1)[0])
items = [(w, v['ex']['en']) for w, v in data.items() if v.get('ex', {}).get('en')]
cache = {}
if os.path.exists(OUT):
    cache = json.load(open(OUT, encoding='utf-8'))
items = [(w, en) for w, en in items if not cache.get(w)]
print('to translate', len(items), flush=True)

BATCH = 30
batch_no = 0
for start in range(0, len(items), BATCH):
    batch = items[start:start + BATCH]
    q = '\n'.join(en for _, en in batch)
    while len(q) > 1500 and len(batch) > 5:
        batch = batch[:-3]
        q = '\n'.join(en for _, en in batch)
    batch_no += 1
    api = 'https://api.mymemory.translated.net/get?' + urllib.parse.urlencode({
        'q': q, 'langpair': 'en|zh-CN', 'de': f'qingci.app+{batch_no % 40}@example.com'
    })
    url = 'https://api.allorigins.win/raw?url=' + urllib.parse.quote(api, safe='')
    ok = False
    for attempt in range(4):
        try:
            p = subprocess.run(
                ['curl', '-sS', '--retry', '4', '--retry-all-errors', '--retry-delay', '1',
                 '--max-time', '70', '-A', 'Mozilla/5.0', url],
                capture_output=True, text=True, timeout=75)
            d = json.loads(p.stdout)
            out = d['responseData']['translatedText'].split('\n')
            if d.get('quotaFinished'):
                raise RuntimeError('quota finished')
            if len(out) != len(batch):
                raise ValueError(f'line count {len(out)} != {len(batch)}')
            for (w, _), zh in zip(batch, out):
                zh = re.sub(r'\s+', '', zh).strip('。；; ')
                cache[w] = zh[:100]
            ok = True
            break
        except Exception as err:
            print('retry', start, attempt, str(err)[:80], flush=True)
            time.sleep(1.5 * (attempt + 1))
    if not ok:
        print('FAILED batch', start, flush=True)
    if start % 120 == 0:
        json.dump(cache, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
        print('progress', start + len(batch), '/', len(items), flush=True)
    time.sleep(0.25)

json.dump(cache, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('DONE', len(cache), 'empty', sum(1 for v in cache.values() if not v), flush=True)
