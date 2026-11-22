# 通用词根词缀表（语言学常识，自行整理）
PREFIX = {
    'a': '不，无', 'ab': '离开', 'ad': '朝向', 'anti': '反对', 'auto': '自我', 'bi': '二',
    'circum': '周围', 'com': '共同', 'con': '共同', 'contra': '相反', 'counter': '反对',
    'de': '向下；去除', 'dis': '不；分开', 'e': '向外', 'em': '使进入', 'en': '使进入',
    'epi': '在上面', 'ex': '向外；前任', 'fore': '在前', 'in': '不；向内', 'im': '不；向内',
    'inter': '之间', 'intra': '在内', 'intro': '向内', 'mal': '坏', 'micro': '微小',
    'mid': '中间', 'mis': '错误', 'mono': '单一', 'multi': '多', 'neo': '新', 'non': '不',
    'ob': '朝向；反对', 'out': '超出', 'over': '过度', 'para': '旁边', 'per': '贯穿',
    'peri': '周围', 'post': '之后', 'pre': '之前', 'pro': '向前', 're': '再；回',
    'retro': '向后', 'semi': '半', 'sub': '在下', 'super': '在上', 'sur': '在上',
    'sym': '共同', 'syn': '共同', 'tele': '远', 'trans': '跨越', 'tri': '三', 'ultra': '超',
    'un': '不', 'under': '在下', 'uni': '单一', 'vice': '副'
}

ROOT = {
    'act': '做', 'ag': '做', 'audi': '听', 'bio': '生命', 'cap': '抓取', 'ced': '走',
    'cess': '走', 'cept': '抓取', 'cid': '切', 'cit': '召唤', 'clud': '关闭', 'cogn': '知道',
    'cor': '心', 'cred': '相信', 'cur': '跑；关心', 'dic': '说', 'dict': '说',
    'duc': '引导', 'duct': '引导', 'equ': '相等', 'fac': '做', 'fer': '带来',
    'fid': '信任', 'fin': '结束', 'form': '形状', 'fort': '强', 'gen': '产生',
    'geo': '地', 'graph': '写', 'gress': '走', 'habit': '居住', 'it': '走',
    'ject': '扔', 'jud': '判断', 'lect': '选；读', 'leg': '法律', 'log': '说',
    'man': '手', 'mand': '命令', 'mar': '海', 'mem': '记忆', 'ment': '心',
    'mit': '送', 'miss': '送', 'mob': '移动', 'morph': '形状', 'nat': '出生',
    'nom': '名字', 'nov': '新', 'opt': '选择', 'or': '说', 'ped': '脚',
    'pel': '推', 'pend': '挂', 'phon': '声音', 'phys': '自然', 'pict': '画',
    'plac': '取悦', 'ple': '填满', 'plic': '折叠', 'ply': '折', 'port': '搬运',
    'pos': '放置', 'pon': '放置', 'prehend': '抓住', 'prim': '第一', 'prob': '测试',
    'put': '放；想', 'quest': '寻求', 'quir': '寻求', 'rect': '直', 'reg': '统治',
    'rupt': '断裂', 'sat': '满足', 'sci': '知道', 'scrib': '写', 'script': '写',
    'sect': '切', 'sens': '感觉', 'sent': '感觉', 'sequ': '跟随', 'serv': '保持',
    'sol': '太阳；独自', 'son': '声音', 'spect': '看', 'spic': '看', 'spir': '呼吸',
    'stand': '站', 'stat': '站', 'stit': '站', 'strict': '捆绑', 'struct': '建造',
    'sum': '拿', 'tect': '覆盖', 'tempor': '时间', 'tend': '伸展', 'tens': '伸展',
    'term': '结束', 'terr': '地', 'test': '证明', 'text': '编织', 'tract': '拉',
    'trib': '给', 'val': '价值', 'ven': '来', 'vent': '来', 'vert': '转',
    'vers': '转', 'vid': '看', 'vis': '看', 'vit': '生命', 'voc': '声音',
    'vol': '意愿', 'volv': '转',
    'ann': '年', 'art': '技巧', 'aster': '星', 'brev': '短', 'cand': '白', 'card': '心',
    'carn': '肉', 'cip': '抓', 'clar': '清楚', 'commod': '便利', 'comput': '计算',
    'corpor': '身体', 'cosm': '宇宙', 'curr': '跑', 'dem': '人民', 'dent': '牙',
    'digit': '手指', 'domin': '主人', 'dur': '持久', 'dynam': '力量', 'ego': '自我',
    'fact': '做', 'fect': '做', 'fend': '打击', 'fest': '节日', 'fict': '虚构',
    'fig': '塑造', 'fil': '线', 'firm': '坚固', 'flex': '弯曲', 'flor': '花',
    'flu': '流', 'foc': '焦点', 'fract': '碎', 'fug': '逃', 'fund': '基础',
    'gestic': '手势', 'gnor': '知道', 'grad': '步', 'gram': '写', 'grat': '感谢',
    'greg': '群体', 'gymn': '运动', 'hal': '呼吸', 'helic': '螺旋', 'hier': '神圣',
    'hom': '人', 'hor': '怕', 'hum': '人；土', 'hydr': '水', 'hyp': '下',
    'icon': '图像', 'ide': '思想', 'ign': '火', 'integr': '完整', 'jac': '投',
    'jung': '连接', 'juven': '年轻', 'lab': '劳动', 'laps': '滑', 'larg': '大',
    'lat': '搬运', 'len': '柔', 'lev': '轻', 'liber': '自由', 'liter': '文字',
    'lith': '石', 'loc': '地方', 'locut': '说话', 'long': '长', 'luc': '光',
    'lumin': '光', 'lun': '月', 'magn': '大', 'maj': '大', 'mater': '母',
    'mechan': '机械', 'medic': '医', 'med': '中间', 'mend': '修补', 'merc': '交易',
    'merg': '沉', 'migr': '迁移', 'mil': '千', 'milit': '军事', 'min': '小；突出',
    'mir': '惊奇', 'mod': '模式', 'mol': '软', 'mon': '警告；单一', 'mort': '死',
    'mot': '移动', 'mut': '改变', 'nat': '出生', 'nav': '船', 'neg': '否定',
    'nerv': '神经', 'norm': '规范', 'nutri': '营养', 'oblig': '绑', 'od': '路',
    'optim': '最好', 'orn': '装饰', 'pac': '和平', 'pact': '约定', 'pan': '全部',
    'par': '生；辅助', 'part': '部分', 'pass': '走', 'path': '路；疾病', 'patr': '父',
    'pen': '惩罚', 'phen': '显示', 'phil': '爱', 'phob': '怕', 'phot': '光',
    'pict': '画', 'plain': '平', 'plaud': '鼓掌', 'plor': '哭', 'poly': '多',
    'pont': '桥', 'pop': '人民', 'poss': '能够', 'pot': '能力', 'prec': '祈祷',
    'preci': '价值', 'pred': '预先', 'prem': '取', 'press': '压', 'prin': '第一',
    'pris': '抓', 'priv': '私人', 'proch': '近', 'punct': '刺', 'pur': '纯净',
    'qual': '性质', 'quant': '量', 'quer': '问', 'qui': '静', 'quot': '引用',
    'rad': '根', 'radi': '光线', 'rap': '抢', 'rat': '计算', 'reas': '推理',
    'relat': '联系', 'relig': '宗教', 'rem': '剩余', 'rig': '僵硬', 'riv': '河',
    'rog': '问', 'rud': '粗', 'rus': '乡村', 'sacr': '神圣', 'sag': '预见',
    'sal': '盐', 'scan': '爬', 'scend': '爬', 'schem': '计划', 'scrut': '检查',
    'secur': '安全', 'sed': '坐', 'sess': '坐', 'seg': '切', 'sep': '分开',
    'ser': '连接', 'sess': '坐', 'simil': '相似', 'simul': '同时', 'sin': '罪',
    'soci': '同伴', 'solid': '坚固', 'solv': '松开', 'som': '睡眠', 'soph': '智慧',
    'sort': '种类', 'spac': '空间', 'sper': '希望', 'spond': '承诺', 'stell': '星',
    'stim': '刺激', 'stud': '学习', 'suad': '说服', 'suav': '甜', 'sum': '拿',
    'sup': '在下', 'syl': '一起', 'tact': '触', 'tang': '触', 'tard': '慢',
    'temper': '混合', 'ten': '持', 'the': '神', 'theo': '神', 'therm': '热',
    'tim': '怕', 'tit': '标题', 'toler': '忍受', 'ton': '音', 'tort': '扭',
    'tot': '全', 'tribut': '给', 'trop': '转', 'trud': '推', 'tut': '保护',
    'typ': '类型', 'ultim': '最后', 'umbr': '阴影', 'und': '波浪', 'urb': '城市',
    'ut': '使用', 'vac': '空', 'vad': '走', 'vag': '游走', 'vari': '变化',
    'vas': '容器', 'ver': '真实', 'vest': '衣服', 'vi': '路', 'vig': '活力',
    'vin': '酒', 'viol': '暴力', 'virt': '美德', 'volu': '卷', 'vor': '吃',
    'vulg': '大众', 'wend': '走', 'werg': '工作', 'zo': '动物'

}

SUFFIX = {
    'able': '能…的', 'ible': '可…的', 'al': '…的', 'ar': '…的', 'ate': '使…',
    'ation': '行为；状态', 'cy': '性质', 'dom': '领域', 'en': '使…', 'ence': '性质',
    'ent': '有…的', 'er': '做…的人', 'ful': '充满…的', 'hood': '状态',
    'ial': '…的', 'ian': '…的人', 'ic': '…的', 'ical': '…的', 'ify': '使…化',
    'ion': '行为；状态', 'ism': '主义', 'ist': '…者', 'ity': '性质',
    'ive': '有…倾向的', 'ize': '使…化', 'less': '无…的', 'logy': '…学',
    'ment': '行为；状态', 'ness': '性质', 'ous': '具有…的', 'ship': '状态',
    'sion': '行为；状态', 'some': '具有…的', 'tion': '行为；状态', 'ty': '性质'
}


def analyze(word):
    """拆出最长词根 + 前缀 + 后缀，返回 [(词块, 含义)] 或 []"""
    w = word.lower()
    if len(w) < 4:
        return []
    best = None
    for root in sorted(ROOT, key=len, reverse=True):
        if len(root) < 3:
            continue
        start = w.find(root)
        if start < 0:
            continue
        score = len(root) * 10 - start
        if best is None or score > best[0]:
            best = (score, start, root)
    if not best:
        return []
    _, start, root = best
    prefix, suffix = w[:start], w[start + len(root):]
    parts = []
    for p in sorted(PREFIX, key=len, reverse=True):
        if prefix == p:
            parts.append([p + '-', PREFIX[p]])
            break
    parts.append([root, ROOT[root]])
    for s in sorted(SUFFIX, key=len, reverse=True):
        if suffix == s:
            parts.append(['-' + s, SUFFIX[s]])
            break
    if len(parts) == 1 and word not in ('action',):
        return parts
    return parts if len(parts) >= 2 else []
