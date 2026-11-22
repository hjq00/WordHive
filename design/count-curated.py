import os
import re

out = 'src/data/words'
total = set()
for name in sorted(os.listdir(out)):
    if not name.endswith('.js') or name.endswith('-outline.js'):
        continue
    text = open(os.path.join(out, name), encoding='utf-8').read()
    words = re.findall(r"w:\s*'([^']+)'", text)
    print(name, len(words))
    total.update(w.lower() for w in words)
print('total unique', len(total))
