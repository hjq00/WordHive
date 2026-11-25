/**
 * 生成引擎
 * 1) 本地引擎：离线可用，把目标词的真题例句串成可读的短文（标注为“本地引擎”）
 * 2) 大模型：填入任意 OpenAI 兼容接口后启用，失败自动回退本地
 */

export const TOPICS = [
  { id: 'exam', name: '考试与学习', en: 'exam pressure and learning' },
  { id: 'tech', name: '科技', en: 'technology and attention' },
  { id: 'edu', name: '教育', en: 'education and opportunity' },
  { id: 'env', name: '环境', en: 'environment and everyday choices' },
  { id: 'econ', name: '经济', en: 'work, money and time' },
  { id: 'campus', name: '校园生活', en: 'campus life and friendship' }
];

const TOPIC_INTRO = {
  exam: {
    en: 'Every winter, millions of students sit down to a reading passage they have never seen before. The words are familiar; the argument is not.',
    zh: '每年冬天，数百万学生坐下来面对一篇从未见过的阅读。词都认识，论证却读不懂。'
  },
  tech: {
    en: 'New tools arrive faster than the habits they require. Most of the difficulty lives in that gap, not in the tools themselves.',
    zh: '新工具到来的速度，快过它所需的新习惯。多数困难就藏在这道缝隙里，而不在工具本身。'
  },
  edu: {
    en: 'Education is one of those subjects on which everyone has an opinion and almost no one has fresh evidence.',
    zh: '教育是那种人人都有一肚子看法、却几乎没人拿得出新证据的话题。'
  },
  env: {
    en: 'Environmental debates rarely fail for lack of facts. They fail because the facts arrive without a frame.',
    zh: '环境争论很少因为缺少事实而失败，而是因为事实来了，却没有一个框架。'
  },
  econ: {
    en: 'Economics has a way of making simple things sound complicated, and complicated things sound simple.',
    zh: '经济学擅长把简单的事说得复杂，又把复杂的事说得简单。'
  },
  campus: {
    en: 'Campus life is a long series of small decisions that nobody grades and everybody remembers.',
    zh: '校园生活是一长串没人打分、却人人记得的小决定。'
  }
};

const CLOSERS = [
  {
    en: 'None of this makes the passage easy. But it makes it navigable, and that is usually enough.',
    zh: '这些并不会让文章变简单，但会让它有路可走——通常这就够了。'
  },
  {
    en: 'The point is not to memorise the sentences, but to notice what the words are doing inside them.',
    zh: '重点不是背下这些句子，而是注意词在句子里到底在做什么。'
  },
  {
    en: 'Read the words in context once, and they stop being entries on a list.',
    zh: '把词放回语境里读一遍，它们就不再是清单上的条目。'
  }
];

const STORY_OPEN = [
  'On Sunday night, Lin wrote {n} words on the last page of her notebook. None of them felt like hers yet.',
  'The list was short, which was the point. {n} words, one week, no excuses.'
];
const STORY_OPEN_ZH = [
  '周日晚上，林在笔记本最后一页写下了 {n} 个单词。它们还都不像是她的。',
  '清单很短，这正是关键：{n} 个词，一周，没有借口。'
];
const STORY_BEAT = [
  ['The first was', '第一个是'],
  ['Next came', '接下来是'],
  ['Then', '然后是'],
  ['She added', '她又写下'],
  ['After that,', '在那之后是'],
  ['The last one was', '最后一个是']
];
const STORY_MID = [
  'She met it again two days later, in a sentence about something else entirely:',
  'On Wednesday it appeared in a listening clip, inside a sentence she almost understood:',
  'It turned up again that evening, in the middle of a paragraph she had skipped:'
];
const STORY_MID_ZH = [
  '两天后她又遇见了它，出现在一句完全讲别的事的句子里：',
  '周三，它出现在一段听力里，句子她几乎听懂了：',
  '那天晚上它又冒出来，夹在一段她原本跳过的文字中间：'
];
const STORY_TAIL = [
  'She copied the sentence, read it aloud twice, and drew a box around the word.',
  'She said it under her breath, then wrote her own sentence underneath.',
  'She marked the sentence with a star, the way she marked everything she did not want to lose.'
];
const STORY_TAIL_ZH = [
  '她抄下句子，朗读了两遍，给那个词画了个框。',
  '她低声念了一遍，然后在下面写了自己的句子。',
  '她在那句话旁画了颗星——凡是舍不得丢的东西，她都这么标。'
];
const STORY_END = {
  en: 'By Friday the list had turned into a story, and the story was easier to remember than the list. That, in the end, is what a mnemonic really is: a road someone built for you to walk back on.',
  zh: '到周五，清单变成了一段故事，而故事比清单好记得多。说到底，所谓记忆法，不过是有人替你修了一条可以走回去的路。'
};

const READ_FRAMES = [
  {
    en: (w) => `The first word worth marking is “${w.w}”. It turns up in a sentence about something quite ordinary: ${w.ex.en}`,
    zh: (w) => `第一个值得标记的词是“${w.w}”（${zhOf(w)}）。它出现在一句很日常的话里：${w.ex.zh}`
  },
  {
    en: (w) => `A second word, “${w.w}”, arrives with a little more weight. ${w.ex.en}`,
    zh: (w) => `第二个词“${w.w}”（${zhOf(w)}）分量更重一些。${w.ex.zh}`
  },
  {
    en: (w) => `Then there is “${w.w}”. Notice how much the sentence does for the word: ${w.ex.en}`,
    zh: (w) => `接着是“${w.w}”（${zhOf(w)}）。注意这句话替这个词做了多少事：${w.ex.zh}`
  },
  {
    en: (w) => `Later in the same passage we meet “${w.w}”, this time in a more practical setting. ${w.ex.en}`,
    zh: (w) => `同一篇文章稍后出现了“${w.w}”（${zhOf(w)}），场景更实际一些。${w.ex.zh}`
  },
  {
    en: (w) => `One more word repays attention: “${w.w}”. ${w.ex.en}`,
    zh: (w) => `还有一个值得留意的词：“${w.w}”（${zhOf(w)}）。${w.ex.zh}`
  },
  {
    en: (w) => `The last word on the list is “${w.w}”, and it is the easiest to misuse. ${w.ex.en}`,
    zh: (w) => `清单上最后一个词是“${w.w}”（${zhOf(w)}），也是最容易被用错的。${w.ex.zh}`
  }
];

const TOPIC_TITLE = {
  exam: 'Words for the Exam Season',
  tech: 'Words for a Distracted Age',
  edu: 'Words About Learning',
  env: 'Words for a Smaller Footprint',
  econ: 'Words About Work and Money',
  campus: 'Words From Campus'
};

const TOPIC_TITLE_ZH = {
  exam: '考试季的词',
  tech: '分心时代的词',
  edu: '关于学习的词',
  env: '关于环境的词',
  econ: '关于工作与钱的词',
  campus: '校园里的词'
};

const zhOf = (word) => word.defs?.[0]?.[1]?.replace(/（.*?）/g, '') || '';

function pick(arr, i) {
  return arr[i % arr.length];
}

/* ---------------- 本地引擎 ---------------- */

export function localReading({ topic = 'exam', words = [] }) {
  const intro = TOPIC_INTRO[topic] || TOPIC_INTRO.exam;
  const list = words.filter((w) => w.ex?.en).slice(0, 6);
  if (!list.length) {
    return {
      engine: 'local',
      title: 'Not Enough Examples',
      titleZh: '暂时没有可用例句',
      warning: '所选词都是大纲速刷词，暂无例句。换几个精讲词，或接入大模型生成。',
      paras: [{ en: 'Choose a few words from the curated books to generate a passage.', zh: '请从精讲词书中选几个带例句的词，再生成短文。', words: [] }]
    };
  }
  const paras = [{ en: intro.en, zh: intro.zh, words: [] }];

  list.forEach((word, i) => {
    const frame = READ_FRAMES[i % READ_FRAMES.length];
    paras.push({
      en: frame.en(word),
      zh: frame.zh(word),
      words: [word.w]
    });
  });

  const closer = pick(CLOSERS, list.length % CLOSERS.length);
  paras.push({ en: closer.en, zh: closer.zh, words: [] });

  const topicName = TOPICS.find((t) => t.id === topic) || TOPICS[0];
  return {
    engine: 'local',
    title: `${list.length} ${TOPIC_TITLE[topicName.id] || 'Words'}`.replace('1 Words', 'One Word'),
    titleZh: `${TOPIC_TITLE_ZH[topicName.id] || topicName.name} · ${list.length} 个`,
    paras
  };
}

export function localStory({ words = [] }) {
  const list = words.filter((w) => w.ex?.en).slice(0, 8);
  if (!list.length) {
    return {
      engine: 'local',
      title: 'Not Enough Examples',
      titleZh: '暂时没有可用例句',
      warning: '所选词都是大纲速刷词，暂无例句。换几个精讲词，或接入大模型生成。',
      paras: [{ en: 'Choose a few words from the curated books to build a story.', zh: '请从精讲词书中选几个带例句的词，再生成故事。', words: [] }]
    };
  }
  const n = list.length;
  const open = pick(STORY_OPEN, n);
  const openZh = pick(STORY_OPEN_ZH, n);
  const paras = [{ en: open.replace('{n}', String(n)), zh: openZh.replace('{n}', String(n)), words: [] }];

  list.forEach((word, i) => {
    const beat = pick(STORY_BEAT, i);
    const mid = pick(STORY_MID, i);
    const midZh = pick(STORY_MID_ZH, i);
    const tail = pick(STORY_TAIL, i);
    const tailZh = pick(STORY_TAIL_ZH, i);
    paras.push({
      en: `${beat[0]} “${word.w}”. ${mid} ${word.ex.en} ${tail}`,
      zh: `${beat[1]}“${word.w}”。${midZh}${word.ex.zh}${tailZh}`,
      words: [word.w]
    });
  });

  paras.push({ en: STORY_END.en, zh: STORY_END.zh, words: [] });

  return {
    engine: 'local',
    title: n <= 4 ? 'Four Words, One Week' : `${n} Words, One Week`,
    titleZh: `${n} 个词，一周`,
    paras
  };
}

/* ---------------- 大模型 ---------------- */

export const hasLLM = (settings) => !!(settings?.api?.base && settings?.api?.key);

async function chat(settings, system, user) {
  const api = settings.api;
  const base = String(api.base).trim().replace(/\/+$/, '');
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api.key}`
      },
      body: JSON.stringify({
        model: api.model || 'gpt-4o-mini',
        temperature: 0.85,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`接口返回 ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

function parseJSON(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('模型没有返回 JSON');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(obj.paras) || !obj.paras.length) throw new Error('返回结构不完整');
  return {
    engine: 'llm',
    title: obj.title || 'Untitled',
    titleZh: obj.titleZh || '',
    paras: obj.paras
      .filter((p) => p && p.en)
      .map((p) => ({ en: String(p.en), zh: String(p.zh || ''), words: p.words || [] }))
  };
}

/**
 * 在线词典兜底：让大模型按固定 JSON 结构查一个英文词。
 * 与 generate() 共用 chat()，但不复用 parseJSON()（后者强制要求 paras 字段）。
 *
 * @param {string} word 用户输入的英文单词
 * @param {object} settings store.getState().settings
 * @returns {Promise<{ok:boolean, reason?:string, data?:object, message?:string}>}
 */
export async function lookupWord(word, settings) {
  if (!hasLLM(settings)) return { ok: false, reason: 'no_llm' };
  const target = String(word || '').trim();
  const system = '你是英语词典助手。只输出严格 JSON，不要解释或 Markdown。';
  const user = `请查询英文词 "${target}" 的中文释义。要求：
1) 若它不是有效英文单词，只返回 {"error":"not_a_word"}；
2) 否则返回严格 JSON：{"word":"","phonetic":"","meanings":[{"pos":"","zh":""}],"example":{"en":"","zh":""},"notes":""}；
3) meanings 最多 5 项，pos 写词性（如 n. / v. / adj.），zh 写自然中文释义；example 给 1 个英文例句及其中文翻译；notes 写常用搭配，没有则留空；
4) 不要输出任何解释、注释或 Markdown 代码块。`;
  try {
    const raw = await chat(settings, system, user);
    const cleaned = String(raw).replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < 0) throw new Error('模型没有返回 JSON');
    return { ok: true, data: JSON.parse(cleaned.slice(start, end + 1)) };
  } catch (err) {
    return { ok: false, reason: 'error', message: err?.message };
  }
}

export async function generate({ mode = 'reading', topic = 'exam', level = 'medium', words = [], settings }) {
  const list = words.slice(0, 10);
  const wordLine = list.map((w) => `${w.w} (${w.defs?.[0]?.[0] || ''} ${zhOf(w)})`).join('; ');

  if (!hasLLM(settings)) {
    return mode === 'story' ? localStory({ words: list }) : localReading({ topic, words: list });
  }

  const levelText = { basic: '基础（句子短、语法清晰，约 220 词）', medium: '进阶（接近考研阅读难度，约 320 词）', hard: '冲刺（长难句多、抽象，约 380 词）' }[level] || '进阶';
  const system =
    '你是中国考研英语与六级的阅读教师。输出必须是严格的 JSON 对象，不要任何解释或 Markdown。';
  const user =
    mode === 'story'
      ? `请写一个连贯、有画面感的英文小故事，自然使用下面每一个目标词（每个至少出现一次，形态可变化）：${wordLine}。
要求：长度 260-320 词，分 3-4 段；故事要有具体人物与场景，不要写成单词表；难度 ${levelText}。
返回 JSON：{"title":"英文标题","titleZh":"中文标题","paras":[{"en":"英文段落","zh":"对应的自然中文翻译","words":["本段出现的英文原形词"]}]}`
      : `请围绕主题「${(TOPICS.find((t) => t.id === topic) || TOPICS[0]).name}」写一篇英文短文，自然使用下面每一个目标词（每个至少出现一次，形态可变化）：${wordLine}。
要求：长度 300-380 词，分 3-4 段，有清晰论点与例证，适合考研/六级精读；难度 ${levelText}。
返回 JSON：{"title":"英文标题","titleZh":"中文标题","paras":[{"en":"英文段落","zh":"对应的自然中文翻译","words":["本段出现的英文原形词"]}]}`;

  try {
    const raw = await chat(settings, system, user);
    return parseJSON(raw);
  } catch (err) {
    const fallback = mode === 'story' ? localStory({ words: list }) : localReading({ topic, words: list });
    fallback.warning = err?.name === 'AbortError' ? '大模型响应超时，已用本地引擎生成' : '大模型调用失败，已回退本地引擎';
    return fallback;
  }
}
