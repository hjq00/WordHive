#!/usr/bin/env python3
"""为拼装例句抓取真实词典例句，并缓存结果。"""
import json, os, re, subprocess, time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'data', 'enrichment.js')
OUT = os.path.join(ROOT, 'design', 'dict-examples.json')

s = open(SRC, encoding='utf-8').read()
data = json.loads(s.split('export const ENRICHMENT = ', 1)[1].rsplit(';', 1)[0])
words = [w for w, v in data.items() if v.get('ex', {}).get('src') == '自动拼装']

cache = {}
if os.path.exists(OUT):
    cache = json.load(open(OUT, encoding='utf-8'))
words = [w for w in words if w not in cache]
print('need', len(words), flush=True)


def fetch(word):
    for attempt in range(2):
        try:
            p = subprocess.run(
                ['curl', '-sS', '--max-time', '12', '-A', 'Mozilla/5.0',
                 'https://api.dictionaryapi.dev/api/v2/entries/en/' + word],
                capture_output=True, text=True, timeout=15)
            d = json.loads(p.stdout)
            examples = []
            for m in d[0].get('meanings', []):
                for item in m.get('definitions', []):
                    ex = (item.get('example') or '').strip()
                    if ex and 15 <= len(ex) <= 90 and re.search(r'\b' + re.escape(word) + r'\b', ex, re.I):
                        examples.append(re.sub(r'\s+', ' ', ex))
                    if len(examples) >= 3:
                        break
                if len(examples) >= 3:
                    break
            return word, {'examples': examples}
        except Exception:
            time.sleep(0.5 + attempt)
    return word, {'examples': []}


done = 0
with ThreadPoolExecutor(max_workers=6) as pool:
    for word, result in pool.map(fetch, words):
        cache[word] = result
        done += 1
        if done % 100 == 0:
            print('done', done, '/', len(words), flush=True)
            json.dump(cache, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)

json.dump(cache, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('DONE', len(cache), 'with examples', sum(1 for v in cache.values() if v.get('examples')), flush=True)
