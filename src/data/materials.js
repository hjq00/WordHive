import { READINGS_MORE, LISTENINGS_MORE, LONG_MORE } from './materials-more.js';
import { READINGS_EXTRA, LISTENINGS_EXTRA, LONG_EXTRA } from './materials-extra.js';

/**
 * 语境素材：真题阅读 / 听力 / 长难句
 * 说明：真题例句与篇目据真题语境改写，用于教学演示。
 */

export const READINGS = [
  {
    id: 'r1',
    title: 'Why We Forget What We Learn',
    titleZh: '我们为什么会忘掉学过的东西',
    source: '考研英语一 · 阅读（改写）',
    minutes: 6,
    tags: ['教育', '认知'],
    words: ['diminish', 'crucial', 'empirical'],
    paras: [
      {
        en: 'Most students blame a bad memory when a word disappears a week after they learned it. The problem is rarely storage. It is retrieval: the path back to the word has simply grown over, like a trail nobody walks on. Memory does not diminish evenly; it fades fastest right after learning, then more slowly, which is why a review on the second day is crucial — and a review on the twentieth matters far less.',
        zh: '大多数学生把一周后忘词归咎于记性差。问题很少出在储存，而出在提取：回到那个词的路被荒草盖住了，像一条没人走的小径。记忆并不是匀速衰退的——它在学习后立刻掉得最快，之后才变慢。这正是第二天复习比第二十天复习更重要的原因。'
      },
      {
        en: 'This is where most vocabulary apps go wrong. They reward coverage: five hundred words this week, a thousand the next. But coverage is not learning. A word that is met once and never retrieved leaves almost no trace, while a word retrieved four times at widening intervals becomes cheap to recall. The difference is not effort but timing.',
        zh: '多数背词软件在这里走偏了：它们奖励“覆盖量”——这周五百词，下周一千词。但覆盖不等于学会。只见过一次、从未被提取的词几乎不留痕迹；而在逐渐拉长的间隔里被提取四次的词，回忆起来会变得毫不费力。差别不在努力，而在时机。'
      },
      {
        en: 'The practical conclusion is unglamorous. This is not a matter of opinion; it is one of the more robust empirical findings in the field. Learn fewer words, and let the app decide when they come back. Trust the spacing more than the streak. A learner who reviews twenty words at the right moment will outperform one who skims two hundred at the wrong one — and will feel far less tired doing it.',
        zh: '实用的结论并不光鲜：这不是观点之争，而是该领域最稳健的实证发现之一。少学一点，把“什么时候再来”交给算法。相信间隔，而不是连续打卡的天数。在正确时机复习二十个词的人，会胜过在错误时机扫过两百个词的人，而且后者往往更累。'
      }
    ],
    question: {
      q: 'According to the passage, why do learners forget words they have "covered"?',
      options: [
        'Their memory capacity is limited.',
        'The words were never retrieved after the first encounter.',
        'They learned too few words at a time.',
        'The app sent reminders too often.'
      ],
      answer: 1,
      explain: '第二段指出：只见过一次、从未被提取的词几乎不留痕迹。问题在提取（retrieval），不在储存容量。'
    }
  },
  {
    id: 'r2',
    title: 'The Cost of Constant Connection',
    titleZh: '随时在线的代价',
    source: '六级 · 阅读（改写）',
    minutes: 5,
    tags: ['科技', '社会'],
    words: ['deteriorate', 'dominate', 'compensate'],
    paras: [
      {
        en: 'A decade ago, being unreachable for an afternoon was unremarkable. Today it produces a mild anxiety that many people describe as guilt. Messaging apps now dominate the way we read response times: slow replies read as coldness, silence as disapproval. The result is a low, constant hum of obligation that follows workers into dinner and students into bed.',
        zh: '十年前，一个下午联系不上一个人并不稀奇。今天，这会制造一种被很多人描述为“愧疚”的轻微焦虑。即时通讯如今主导了我们解读回复速度的方式：回得慢就是冷淡，不回复就是不满。结果是持续的低强度义务感，跟着上班族进餐桌，也跟着学生上床。'
      },
      {
        en: 'Researchers who study attention note that what deteriorates is not mainly the minutes spent replying, but the background process that never shuts down: the part of the mind that keeps checking whether something has arrived. Even when no message comes, that vigilance consumes resources that would otherwise go to reading, writing or simply thinking.',
        zh: '研究注意力的学者指出，恶化的主要不是回复花掉的那几分钟，而是一个永不关闭的后台进程：心里总有一部分在检查“是不是来了消息”。即使没有消息，这种警觉也在消耗本可用于阅读、写作或干脆发呆的资源。'
      },
      {
        en: 'The obvious fix — switching everything off — rarely survives a week. A more durable arrangement is to make response times explicit: tell colleagues when you read messages, and let the rest wait. No app can compensate for the loss of an unhurried hour, but announced boundaries are easier to keep than boundaries that are merely hoped for.',
        zh: '最直观的解法——全部关掉——通常撑不过一周。更可持续的安排是把回复时间说清楚：告诉同事你什么时候看消息，其余的先等着。没有任何应用能补偿“一个不慌不忙的小时”的损失，但说出口的边界，比心里默默期待的边界更容易守住。'
      }
    ],
    question: {
      q: 'What does the author identify as the main cost of constant connection?',
      options: [
        'The time spent typing replies.',
        'The continuous background vigilance it creates.',
        'The money spent on messaging apps.',
        'The decline of face-to-face meetings.'
      ],
      answer: 1,
      explain: '第二段明确：损害不在回复的几分钟，而在永不关闭的后台警觉过程。'
    }
  },
  {
    id: 'r3',
    title: 'Rethinking the Value of Failure',
    titleZh: '重新理解失败的价值',
    source: '考研英语二 · 阅读（改写）',
    minutes: 7,
    tags: ['教育', '心理'],
    words: ['conventional', 'contradict', 'enhance'],
    paras: [
      {
        en: 'Schools praise effort in principle and reward correctness in practice. A student who tries an unusual method and fails loses points; one who memorises the standard route gains them. Over twelve years, this teaches a quiet lesson: the safe answer is the good answer. Conventional wisdom calls it discipline. Critics call it a slow strangulation of curiosity.',
        zh: '学校在口头上赞美努力，实际上奖励正确。用非常规方法尝试并失败的学生会丢分，背下标准解法的学生会得分。十二年下来，这悄悄教会了一件事：安全的答案才是好答案。主流看法把这叫自律，批评者说这是对好奇心的慢性扼杀。'
      },
      {
        en: 'The evidence does not contradict the value of practice; it contradicts the assumption that practice must always succeed. Studies of productive failure find that students who struggle with a problem before being taught the method remember the method better. The struggle is not wasted time. It is the hook that the explanation later hangs on, and used well it can enhance the quality of the attempt without inflating the score.',
        zh: '证据并不否定练习的价值，而是否定“练习必须次次成功”的假设。对“有效失败”的研究发现：在被告知方法之前先挣扎过的学生，之后对方法的记忆更好。挣扎不是浪费的时间，它是后来挂上解释的那个钩子；用得好，它能提升尝试的质量，而不会抬高分数。'
      },
      {
        en: 'None of this argues for lowering standards. It argues for separating two things schools tend to fuse: the quality of the final answer and the quality of the attempt. A classroom that grades only the first will keep producing students who are competent at avoiding error, and afraid of anything new.',
        zh: '这绝不是主张降低标准，而是主张把学校常常混为一谈的两件事分开：最终答案的质量，与尝试过程的质量。只给前者打分的课堂，会持续产出“善于回避错误、却害怕任何新东西”的学生。'
      }
    ],
    question: {
      q: 'The author’s attitude towards "productive failure" is best described as',
      options: ['sceptical', 'supportive', 'indifferent', 'ambiguous'],
      answer: 1,
      explain: '作者引用研究说明“挣扎过的学生记得更牢”，并主张把尝试质量与答案质量分开评价，态度是支持。'
    }
  },
  {
    id: 'r4',
    title: 'What Makes a City Livable',
    titleZh: '什么让一座城市宜居',
    source: '六级 · 阅读（改写）',
    minutes: 6,
    tags: ['城市', '社会'],
    words: ['comprehensive', 'constrain', 'facilitate'],
    paras: [
      {
        en: 'Ask residents what makes a city livable and few mention landmarks. They mention the walk to the bus stop, the queue at the clinic, the noise at eleven at night. Livability is built from small, repeated experiences, which is why a single index struggles to capture it and why tight budgets so often constrain exactly the wrong things.',
        zh: '问居民什么让城市宜居，很少有人提地标。他们说的是走到公交站的那段路、诊所门口的队、夜里十一点的噪音。宜居感由大量重复的小体验构成，所以它很难用一个指数概括，也因此，紧张的预算常常恰好卡在最不该省的地方。'
      },
      {
        en: 'The most effective improvements are rarely the most visible. A bench in the shade, a crossing that gives pedestrians ten extra seconds, a shop that stays open late — these change daily life more than a new monument. They also cost less, which makes them politically unattractive: there is no ribbon to cut.',
        zh: '最有效的改善往往最不显眼：树荫下的一张长椅、多给行人十秒的过街灯、开到很晚的一家小店——它们比一座新纪念碑更能改变日常生活。它们也更便宜，而这在政治上不讨喜：没有剪彩的机会。'
      },
      {
        en: 'A comprehensive plan therefore has to protect the small stuff. That means budgeting for maintenance, not only construction, and asking residents what they already value before asking what they want added. Small, well-kept spaces facilitate the casual contact that no master plan can design; cities that protect them tend to keep the people who make them worth living in.',
        zh: '因此，一份全面的规划必须保护这些小事：不只给建设做预算，也给维护做预算；在问居民“想加什么”之前，先问他们“已经在珍惜什么”。维护良好的小空间，会促成任何总体规划都设计不出的随缘接触；保护这些空间的城市，往往留得住那些让城市值得生活的人。'
      }
    ],
    question: {
      q: 'Why are the most effective improvements politically unattractive?',
      options: [
        'They benefit only a small group.',
        'They are expensive and slow to build.',
        'They are cheap and invisible, offering no ribbon-cutting moment.',
        'They require changing existing laws.'
      ],
      answer: 2,
      explain: '第三段前一句：这些改善更便宜、不显眼，因此“没有剪彩的机会”，政治收益低。'
    }
  }
];

export const LISTENINGS = [
  {
    id: 'l1',
    title: 'A Radio Interview on Study Habits',
    titleZh: '电台访谈：学习习惯',
    source: '六级听力 · 长对话（改写）',
    accent: '美音',
    seconds: 78,
    tags: ['校园', '方法'],
    words: ['accumulate', 'adequate', 'sustain'],
    lines: [
      { en: 'So, professor, is there a right number of words to learn each day?', zh: '那么教授，每天背多少个词才算合适？' },
      { en: 'There is no magic number, but there is a wrong number — and that is the one that makes you quit.', zh: '没有神奇的数字，但有一个错误的数字——就是那个让你放弃的数字。' },
      { en: 'Most learners try to accumulate too much in the first week, and then they cannot sustain it.', zh: '多数学习者在第一周想积累太多，然后就维持不下去。' },
      { en: 'If twenty words a day is adequate for your schedule, stay at twenty for a month before you raise it.', zh: '如果每天二十个词对你的日程来说够用，那就先保持一个月再增加。' },
      { en: 'The habit is worth more than the extra ten words.', zh: '这个习惯比多出来的十个词更值钱。' }
    ]
  },
  {
    id: 'l2',
    title: 'Why Cities Are Getting Quieter',
    titleZh: '城市为什么变安静了',
    source: '六级听力 · 短文（改写）',
    accent: '英音',
    seconds: 64,
    tags: ['城市', '环境'],
    words: ['deteriorate', 'dominate', 'comprehensive'],
    lines: [
      { en: 'For most of the last century, traffic noise dominated the sound of the city.', zh: '在上个世纪的大部分时间里，交通噪音主导着城市的声音。' },
      { en: 'Then electric buses arrived, and the background level began to fall — the first time it had improved rather than continued to deteriorate.', zh: '后来电动公交投入使用，背景噪音开始下降——这是它第一次改善，而不是继续恶化。' },
      { en: 'But quiet has a cost: residents now notice sounds they used to ignore.', zh: '但安静是有代价的：居民开始注意到过去被忽略的声音。' },
      { en: 'Planners say a comprehensive noise policy must cover nightlife as well as traffic.', zh: '规划者表示，全面的噪音政策必须同时涵盖夜生活与交通。' }
    ]
  },
  {
    id: 'l3',
    title: 'The Two-Minute Rule',
    titleZh: '两分钟法则',
    source: '考研复试 · 口语素材（改写）',
    accent: '美音',
    seconds: 52,
    tags: ['方法', '心理'],
    words: ['arbitrary', 'commit', 'figure'],
    lines: [
      { en: 'The two-minute rule sounds arbitrary, but it works for a simple reason.', zh: '两分钟法则听起来很随意，但它有效的原因很简单。' },
      { en: 'You commit to two minutes, and starting becomes cheaper than avoiding.', zh: '你承诺只做两分钟，于是“开始”比“逃避”更划算。' },
      { en: 'Once you have started, you can figure out the rest as you go.', zh: '一旦开始，剩下的可以边做边想清楚。' }
    ]
  }
];

export const LONG_SENTENCES = [
  {
    id: 'ls1',
    en: 'What makes the debate so difficult is not that either side is ignorant of the evidence, but that they read the same evidence through different assumptions about what a good life looks like.',
    zh: '这场争论之所以难解，不是因为任何一方不了解证据，而是因为他们带着“好生活应该是什么样”的不同预设，去读同一批证据。',
    trunk: 'What makes the debate so difficult is not that…, but that…',
    mods: [
      ['主语从句', 'What makes the debate so difficult'],
      ['表语从句 1', 'that either side is ignorant of the evidence'],
      ['表语从句 2', 'that they read the same evidence'],
      ['方式状语', 'through different assumptions about what a good life looks like']
    ],
    tip: 'not that A, but that B 是考研阅读里极高频的对比结构，重心永远在 but 之后。翻译时先立“不是A”，再落“而是B”。',
    source: '考研英语一 · Text 3 语境（改写）'
  },
  {
    id: 'ls2',
    en: 'It is not the amount of time we spend online that determines how much we learn, but whether the time is spent in a state in which we are willing to be persuaded by something we did not expect.',
    zh: '决定我们学到多少的，不是上网时间的长短，而是这些时间是否花在这样一种状态里：我们愿意被某些意料之外的东西说服。',
    trunk: 'It is not A that…, but whether B',
    mods: [
      ['强调句框架', 'It is not … that …'],
      ['真正主语', 'whether the time is spent in a state'],
      ['定语从句', 'in which we are willing to be persuaded'],
      ['宾语', 'something we did not expect']
    ],
    tip: '强调句 It is … that … 中间塞了 not A but B，容易读断。先把框架抽掉，剩下 “not the amount… but whether…” 就清楚了。',
    source: '考研英语二 · Text 2 语境（改写）'
  },
  {
    id: 'ls3',
    en: 'The assumption that longer working hours necessarily produce more output, which has shaped labour policy for decades, collapses as soon as the work requires judgment rather than repetition.',
    zh: '“工时越长产出越多”这一塑造了数十年劳动政策的假设，一旦工作要求的是判断而非重复，就立刻站不住脚了。',
    trunk: 'The assumption … collapses as soon as …',
    mods: [
      ['主语', 'The assumption'],
      ['同位语从句', 'that longer working hours necessarily produce more output'],
      ['非限制性定语从句', 'which has shaped labour policy for decades'],
      ['时间状语从句', 'as soon as the work requires judgment rather than repetition']
    ],
    tip: '主语和谓语被一个同位语从句 + 一个定语从句隔开了 20 多个词。找主干时先跳过两个 that/which 从句，直接抓 “The assumption collapses”。',
    source: '考研英语一 · Text 1 语境（改写）'
  },
  {
    id: 'ls4',
    en: 'Only when the cost of forgetting becomes visible — a missed deadline, a lost client, a repeated mistake — do organisations begin to treat memory as infrastructure rather than as a personal virtue.',
    zh: '只有当遗忘的代价变得可见——错过截止日期、丢掉客户、重复犯错——组织才开始把记忆当作基础设施，而不是个人美德。',
    trunk: 'Only when … do organisations begin to treat A as B',
    mods: [
      ['时间状语从句', 'Only when the cost of forgetting becomes visible'],
      ['插入语', 'a missed deadline, a lost client, a repeated mistake'],
      ['倒装主句', 'do organisations begin to treat …'],
      ['宾补结构', 'treat memory as infrastructure rather than as a personal virtue']
    ],
    tip: 'Only + 状语置于句首，主句要部分倒装：do organisations begin。破折号里是三个同位语，先略过不影响主干。',
    source: '六级 · 阅读语境（改写）'
  }
];

READINGS.push(...READINGS_MORE);
LISTENINGS.push(...LISTENINGS_MORE);
LONG_SENTENCES.push(...LONG_MORE);

READINGS.push(...READINGS_EXTRA);
LISTENINGS.push(...LISTENINGS_EXTRA);
LONG_SENTENCES.push(...LONG_EXTRA);

export const READINGS_MAP = new Map(READINGS.map((r) => [r.id, r]));
