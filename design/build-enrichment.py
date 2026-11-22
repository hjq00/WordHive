#!/usr/bin/env python3
"""为全部单词生成详情补全数据：释义/注释/联想/例句/真题语境/词根/派生/近反义。"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from affixes import analyze

DICT = r'C:\Users\ADMINI~1\AppData\Local\Temp\ecdict.csv'
DATA = os.path.join(ROOT, 'design', 'materials.json')
OUT = os.path.join(ROOT, 'src', 'data', 'enrichment.js')

csv.field_size_limit(10 ** 7)
dic = {}
with open(DICT, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        w = (row.get('word') or '').strip().lower()
        if w and w not in dic:
            dic[w] = row

data = json.load(open(DATA, encoding='utf-8'))
WORDS, SENTENCES = data['words'], data['sentences']
EXTRA_PATH = os.path.join(ROOT, 'design', 'zhenti-extra.json')
EXTRA = json.load(open(EXTRA_PATH, encoding='utf-8')) if os.path.exists(EXTRA_PATH) else {}
DICT_EXAMPLES_PATH = os.path.join(ROOT, 'design', 'dict-examples.json')
DICT_EXAMPLES = json.load(open(DICT_EXAMPLES_PATH, encoding='utf-8')) if os.path.exists(DICT_EXAMPLES_PATH) else {}
TRANSLATIONS_PATH = os.path.join(ROOT, 'design', 'example-translations.json')
TRANSLATIONS = json.load(open(TRANSLATIONS_PATH, encoding='utf-8')) if os.path.exists(TRANSLATIONS_PATH) else {}

# 同义：中文释义首义完全相同的词互为近义词
sense_map = {}
for w in WORDS:
    cn = cn_defs(dic.get(w, {})) if False else []
for w in WORDS:
    row = dic.get(w, {})
    lines = (row.get('translation') or '').replace('\\n', '\n').split('\n')
    if not lines:
        continue
    first = re.sub(r'^[a-z]+\.\s*', '', lines[0], flags=re.I)
    key = re.sub(r'[^\u4e00-\u9fff]', '', first)[:8]
    if len(key) >= 2:
        sense_map.setdefault(key, []).append(w)

ANT_PAIRS = [
    ('increase','decrease'), ('rise','fall'), ('improve','worsen'), ('strengthen','weaken'),
    ('expand','shrink'), ('enlarge','reduce'), ('accept','reject'), ('approve','deny'),
    ('admit','deny'), ('agree','disagree'), ('arrive','depart'), ('attack','defend'),
    ('advantage','disadvantage'), ('abundant','scarce'), ('ancient','modern'), ('common','rare'),
    ('complex','simple'), ('clear','vague'), ('certain','uncertain'), ('dangerous','safe'),
    ('decrease','increase'), ('definite','indefinite'), ('deliberate','accidental'),
    ('different','same'), ('difficult','easy'), ('direct','indirect'), ('doubt','trust'),
    ('early','late'), ('effective','ineffective'), ('efficient','inefficient'),
    ('enable','disable'), ('encourage','discourage'), ('enormous','tiny'),
    ('essential','unnecessary'), ('evident','unclear'), ('excellent','poor'),
    ('expensive','cheap'), ('explicit','implicit'), ('familiar','unfamiliar'),
    ('fast','slow'), ('favorable','unfavorable'), ('flexible','rigid'), ('formal','informal'),
    ('former','latter'), ('frequent','rare'), ('general','specific'), ('generous','selfish'),
    ('genuine','false'), ('gradual','sudden'), ('great','small'), ('happy','sad'),
    ('hard','easy'), ('harmful','harmless'), ('honest','dishonest'), ('hopeful','hopeless'),
    ('important','trivial'), ('increase','decrease'), ('independent','dependent'),
    ('inevitable','avoidable'), ('innocent','guilty'), ('intentional','accidental'),
    ('internal','external'), ('join','separate'), ('junior','senior'), ('kind','cruel'),
    ('known','unknown'), ('large','small'), ('likely','unlikely'), ('logical','illogical'),
    ('long','short'), ('major','minor'), ('mature','immature'), ('maximum','minimum'),
    ('meaningful','meaningless'), ('necessary','unnecessary'), ('negative','positive'),
    ('normal','abnormal'), ('obvious','subtle'), ('official','unofficial'), ('optimistic','pessimistic'),
    ('ordinary','extraordinary'), ('organic','synthetic'), ('patient','impatient'),
    ('permanent','temporary'), ('personal','public'), ('positive','negative'), ('possible','impossible'),
    ('powerful','weak'), ('precise','vague'), ('present','absent'), ('previous','following'),
    ('primary','secondary'), ('private','public'), ('probable','impossible'), ('profit','loss'),
    ('proper','improper'), ('quick','slow'), ('rational','irrational'), ('real','false'),
    ('reasonable','unreasonable'), ('regular','irregular'), ('relevant','irrelevant'),
    ('reliable','unreliable'), ('respect','disrespect'), ('responsible','irresponsible'),
    ('restrict','free'), ('reveal','conceal'), ('rich','poor'), ('rival','ally'),
    ('sacred','secular'), ('satisfy','dissatisfy'), ('scarce','abundant'), ('secure','insecure'),
    ('sensible','silly'), ('serious','trivial'), ('severe','mild'), ('similar','different'),
    ('simple','complex'), ('sincere','insincere'), ('slight','considerable'), ('smooth','rough'),
    ('sophisticated','simple'), ('specific','general'), ('stable','unstable'), ('steady','unsteady'),
    ('strong','weak'), ('sufficient','insufficient'), ('superior','inferior'), ('sure','uncertain'),
    ('sustainable','unsustainable'), ('temporary','permanent'), ('thrive','decline'),
    ('tolerant','intolerant'), ('tough','gentle'), ('traditional','modern'), ('trust','distrust'),
    ('true','false'), ('typical','atypical'), ('ultimate','initial'), ('uncommon','common'),
    ('understand','misunderstand'), ('unfair','fair'), ('unique','common'), ('universal','local'),
    ('urban','rural'), ('useful','useless'), ('usual','unusual'), ('valid','invalid'),
    ('valuable','worthless'), ('varied','uniform'), ('vast','tiny'), ('victory','defeat'),
    ('virtue','vice'), ('visible','invisible'), ('vital','trivial'), ('wealthy','poor'),
    ('wide','narrow'), ('wise','foolish'), ('withdraw','advance'), ('worse','better'),
    ('yield','resist')
]
STOP = {'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'with', 'being', 'that', 'this',
        'one', 'something', 'somebody', 'not', 'without', 'into', 'from', 'as', 'at', 'by',
        'or', 'and', 'is', 'are', 'was', 'were', 'been', 'have', 'has', 'had'}

ANT_MAP = {}
for a, b in ANT_PAIRS:
    ANT_MAP.setdefault(a, []).append(b)
    ANT_MAP.setdefault(b, []).append(a)

def negations(word):
    out = []
    for p in ('un', 'in', 'im', 'dis', 'non'):
        if word.startswith(p):
            root = word[len(p):]
            if root in dic:
                out.append(root)
        else:
            neg = p + word
            if neg in dic:
                out.append(neg)
    return out[:4]

TAGS = {'ky': '考研', 'cet6': '六级', 'cet4': '四级', 'ielts': '雅思', 'toefl': '托福',
        'gk': '高考', 'zk': '中考', 'gre': 'GRE'}
FORM_LABEL = {'p': '过去式', 'd': '过去分词', 'i': '现在分词', '3': '第三人称单数', 's': '复数', 'r': '比较级', 't': '最高级'}

# WordNet（可选，装好后会重跑）
WN = None
try:
    import nltk
    nltk.data.path.append(r'C:\Users\ADMINI~1\AppData\Local\Temp\nltk_data')
    from nltk.corpus import wordnet as WN
except Exception:
    WN = None
print('wordnet', bool(WN))


def cn_defs(row):
    out = []
    for line in (row.get('translation') or '').replace('\\n', '\n').split('\n'):
        line = re.sub(r'^[a-z]+\.\s*', '', line, flags=re.I)
        line = line.replace(', ', '；').replace(',', '；')
        line = re.sub(r'\[[^\]]{1,4}\]', '', line)
        line = re.sub(r'\s+', '', line).strip('； ')
        if line:
            out.append(line)
    return out[:3]


def note_of(row):
    tags = [TAGS.get(t) for t in (row.get('tag') or '').split() if t in TAGS]
    bits = ['／'.join(dict.fromkeys(tags))] if tags else []
    if row.get('frq', '').isdigit() and int(row['frq']) > 0:
        bits.append(f"COCA 第{row['frq']}")
    if row.get('collins', '').isdigit() and int(row['collins']) > 0:
        bits.append(f"柯林斯 {row['collins']} 星")
    if row.get('oxford', '').isdigit() and int(row['oxford']) > 0:
        bits.append('牛津核心')
    en = (row.get('definition') or '').replace('\\n', '\n').split('\n')[0]
    en = re.sub(r'^[a-z]+\.\s*', '', en, flags=re.I)
    if en and len(en) < 70:
        bits.append(en)
    return ' · '.join(bits)[:90]


def forms_of(row):
    out, seen = [], set()
    for part in (row.get('exchange') or '').split('/'):
        if ':' in part:
            k, v = part.split(':', 1)
            if k in FORM_LABEL and v and v not in seen and v.lower() != row.get('word', '').lower():
                out.append([v, FORM_LABEL[k]])
                seen.add(v)
    return out[:5]


def contains_word(sentence, word):
    forms = {word, word + 's', word + 'es', word + 'd', word + 'ed', word + 'ing'}
    if len(word) > 4 and word.endswith('e'):
        forms.add(word[:-1] + 'ing')
    return bool(re.search(r'\b(?:' + '|'.join(re.escape(f) for f in forms) + r')\b', sentence, re.I))


def shorten_example(text, word):
    text = re.sub(r'\s+', ' ', text or '').strip()
    if len(text) <= 90:
        return text
    parts = re.split(r'(?<=[.!?])\s+', text)
    hit = [p for p in parts if contains_word(p, word) and len(p) <= 90]
    if hit:
        return sorted(hit, key=len)[0]
    return ''


def matched_sentence(word):
    variants = {word, word + 's', word + 'es', word + 'd', word + 'ed'}
    if len(word) > 4 and word.endswith('e'):
        variants.add(word[:-1] + 'ing')
    else:
        variants.add(word + 'ing')
    for item in SENTENCES:
        if re.search(r'\b(?:' + '|'.join(re.escape(v) for v in variants) + r')\b', item['en'], re.I):
            short = shorten_example(item['en'], word)
            if short:
                return {'en': short, 'zh': item['zh'][:90], 'src': '精读材料 · 真题改写'}
    return None


def wordnet_info(word):
    if not WN:
        return [], [], None
    syns, ants, ex = [], [], None
    try:
        for ss in WN.synsets(word):
            for lemma in ss.lemmas():
                name = lemma.name().replace('_', '').lower()
                if name == word:
                    for a in lemma.antonyms():
                        an = a.name().replace('_', '').lower()
                        if an.isalpha() and an not in ants:
                            ants.append(an)
                elif name.isalpha() and len(name) > 2 and name not in syns:
                    syns.append(name)
            if not ex:
                fits = [p for p in ss.examples() if contains_word(p, word) and len(re.sub(r'\s+', ' ', p).strip()) <= 90]
                if fits:
                    ex = sorted(fits, key=len)[0]
    except Exception:
        pass
    if not ex:
        lemma = WN.morphy(word)
        if lemma and lemma != word:
            for ss in WN.synsets(lemma):
                fits = [p for p in ss.examples()
                        if (contains_word(p, word) or contains_word(p, lemma))
                        and len(re.sub(r'\s+', ' ', p).strip()) <= 90]
                if fits:
                    ex = sorted(fits, key=len)[0]
                    break
    return syns[:5], ants[:4], ex


out = {}
for i, w in enumerate(WORDS):
    row = dic.get(w, {})
    cn = cn_defs(row)
    first = cn[0] if cn else w
    item = {}
    if cn:
        item['defs'] = [[('v.' if any(x in (row.get('translation') or '') for x in ('vt.', 'vi.')) else '·'), d] for d in cn]
    note = note_of(row)
    if note:
        item['annot'] = note
    parts = analyze(w)
    if parts:
        item['root'] = {'parts': parts, 'tip': ' + '.join(f'{p}（{m}）' for p, m in parts) + f' → {first}'}
        item['mnes'] = [{'t': '拆分', 'x': ' + '.join(f'{p}（{m}）' for p, m in parts) + f'：{first}。词块记住，再用例句把词义固定住。'}]
    else:
        en_def = (row.get('definition') or '').replace('\\n', '\n').split('\n')[0]
        en_def = re.sub(r'^[a-z]+\.\s*', '', en_def, flags=re.I)
        if en_def and len(en_def) < 80:
            item['mnes'] = [{'t': '英释', 'x': f'{en_def} → {first}。先用英释锁定词义，再放进例句里读一遍。'}]
    forms = forms_of(row)
    if forms:
        item['der'] = forms
    syns, ants, ex = wordnet_info(w)
    ext = EXTRA.get(w, {})
    for s2 in ext.get('syn', []):
        if s2 not in syns:
            syns.append(s2)
    if not syns:
        for line in (row.get('definition') or '').replace('\\n', '\n').split('\n'):
            line = re.sub(r'^[a-z]+\.\s*', '', line)
            for tok in re.findall(r'[A-Za-z][a-z-]{2,}', line)[:4]:
                t = tok.lower()
                if t != w and t not in STOP and t in dic and t not in syns:
                    syns.append(t)
                    break
            if len(syns) >= 5:
                break
    if not syns:
        for s2 in sense_map.get(re.sub(r'[^\u4e00-\u9fff]', '', cn[0])[:8] if cn else '', []):
            if s2 != w and s2 not in syns:
                syns.append(s2)
    for a2 in ext.get('ant', []):
        if a2 not in ants:
            ants.append(a2)
    for a2 in ANT_MAP.get(w, []) + negations(w):
        if a2 in dic and a2 not in ants:
            ants.append(a2)
    if not ex:
        ex = ext.get('ex')
    if not ex:
        ex = matched_sentence(w)
    if not ex:
        # 词典真实例句（Free Dictionary API）优先，避免无意义拼装句
        for sample in DICT_EXAMPLES.get(w, {}).get('examples', []):
            sample = re.sub(r'\s+', ' ', sample).strip()
            if len(sample) <= 90 and contains_word(sample, w):
                ex = {'en': sample, 'zh': TRANSLATIONS.get(w, ''), 'src': '词典例句'}
                break
    if not ex:
        # 用 ECDICT 英释短语作为简短语境，配同一条的中文释义
        en_def = (row.get('definition') or '').replace('\\n', '\n').split('\n')[0]
        en_def = re.sub(r'^[a-z]+\.\s*', '', en_def, flags=re.I)
        en_def = re.sub(r'\s+', ' ', en_def).strip(' .;')
        if 6 <= len(en_def) <= 80 and re.search(r'[A-Za-z]', en_def):
            ex = {'en': en_def[:90], 'zh': first, 'src': '英释语境'}
        else:
            ex = {'en': f'He is a well-known {w}.', 'zh': first, 'src': '词条'}
    if syns:
        item['syn'] = syns
    if ants:
        item['ant'] = ants
    if isinstance(ex, dict):
        before = ex.get('en', '')
        ex['en'] = shorten_example(before, w)
        if not ex['en']:
            # 长英释截不出短句时，用一个稳定短句兜底，保证每词都有例句
            ex = {'en': f'We discussed the word “{w}”.', 'zh': first, 'src': '短句语境'}
    elif ex and len(ex) > 90:
        ex = None
    if isinstance(ex, dict):
        zh = re.sub(r'^（拼装练习句）', '', TRANSLATIONS.get(w, '') or '').strip()
        ex['zh'] = zh or first
    if ex:
        item['ex'] = ex if isinstance(ex, dict) else {'en': ex, 'zh': TRANSLATIONS.get(w, '') or first}
    real = ext.get('real') or matched_sentence(w)
    if real:
        real['en'] = shorten_example(real.get('en', ''), w)
        if real['en']:
            item['real'] = real
    if item:
        out[w] = item

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('/** 由 ECDICT + WordNet + 精读语料自动补全，供所有词书共用。 */\n')
    fh.write('export const ENRICHMENT = ')
    fh.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    fh.write(';\n')
print('words', len(WORDS), 'enriched', len(out), 'kb', round(os.path.getsize(OUT) / 1024))
for field in ('defs', 'annot', 'mnes', 'ex', 'real', 'root', 'der', 'syn', 'ant'):
    print(field, sum(1 for v in out.values() if field in v))
