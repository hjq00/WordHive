/**
 * 素材补编 2（v2.8）：在原有 22 条基础上补充真题风格篇目。
 * 真题语境改写，用于教学演示；题材覆盖考研一 / 考研二 / 六级。
 */

export const READINGS_EXTRA = [
  {
    id: 'r9',
    title: 'The Cost of Convenience',
    titleZh: '便利的代价',
    source: '考研英语一 · 阅读（改写）',
    minutes: 6,
    tags: ['城市', '环境'],
    words: ['efficient', 'consume', 'visible'],
    paras: [
      {
        en: 'A delivery van that brings dinner to your door in twenty minutes looks like pure efficiency. Multiply it by a million orders a night and the arithmetic changes. Each short trip is driven by a vehicle that idles at the curb, circles a block for a parking spot, and returns empty. The convenience is real, and so is the congestion it leaves behind, but only one of the two shows up in the price.',
        zh: '一辆二十分钟把晚餐送到门口的配送车，看上去是纯粹的效率。可当它一晚被复制一百万次，算术就变了：每一段短途都由一辆在路边怠速、绕街区找车位、再空车返回的车辆完成。便利是真的，它留下的拥堵也是真的——只是这两者之中，只有一样被算进了价格。'
      },
      {
        en: 'Economists call this an externality: a cost that the buyer and seller never negotiate. The word makes it sound technical, almost neutral. In practice it means someone else pays, and that someone is usually the resident who lives beside the loading bay, or the commuter stuck behind the third van in a row. Because the cost is spread thin and arrives late, no individual order feels responsible for it.',
        zh: '经济学家把这类东西叫外部性：买卖双方从不谈判的那部分成本。这个词听起来很技术、甚至很中性，但在现实中它意味着由别人付账——通常是住在卸货区旁边的居民，或者被第三辆货车堵在路上的通勤者。因为这笔成本既分散又迟到，没有哪一笔订单会觉得自己该负责。'
      },
      {
        en: 'The usual remedy is to put a price on the hidden part, through congestion charges or loading zones that are actually enforced. Such measures are unpopular precisely because they make the invisible visible: the fee at checkout is small, but it forces a comparison that the twenty-minute promise was designed to prevent. Efficiency, it turns out, is easier to sell when nobody has to count what it costs.',
        zh: '常见的补救办法是给那部分隐藏成本标价——拥堵费，或真正被执行的卸货区管理。这类措施之所以不受欢迎，恰恰因为它们让看不见的变得可见：结账时多出的那笔钱很少，却逼人做一次比较，而“二十分钟送达”这个承诺本来就是用来阻止这次比较的。所谓效率，原来在没人需要计算代价的时候，才最好卖。'
      }
    ],
    question: {
      q: 'Why does the author say the convenience "shows up in the price" only partly?',
      options: [
        'Because delivery fees are too low to cover the service.',
        'Because the congestion cost is paid by others, not by the buyer.',
        'Because most orders are placed late at night.',
        'Because residents refuse to pay for loading zones.'
      ],
      answer: 1,
      explain: '第一段明确“便利是真的，拥堵也是真的，但只有一样进了价格”，第二段把这种由第三方承担的成本定义为外部性，因此选 B。'
    }
  },
  {
    id: 'r10',
    title: 'When a Machine Guesses Right',
    titleZh: '当机器猜对了',
    source: '考研英语一 · 阅读（改写）',
    minutes: 7,
    tags: ['科技', '教育'],
    words: ['accurate', 'evidence', 'predict'],
    paras: [
      {
        en: 'A model that predicts which students will struggle can be remarkably accurate. That accuracy is exactly what makes it dangerous to trust. The prediction is built from patterns in past data, and past data carries past decisions: who was encouraged, who was overlooked, whose essay was read twice. A system trained on those decisions will reproduce them, and it will do so with the confidence of arithmetic.',
        zh: '一个能预测哪些学生会掉队的模型，可能准确得惊人。而正是这种准确，让信任它变得危险。预测建立在过往数据的规律之上，而过往数据携带着过往的决定：谁被鼓励过，谁被忽略过，谁的作文被多读了一遍。用这些决定训练出来的系统，会把它们原样复制，而且带着算术般的自信。'
      },
      {
        en: 'The trouble is that accuracy is easy to measure and fairness is not. A model can be tested against what actually happened, because that record exists. It cannot be tested against what would have happened if a different decision had been made, because that record never existed. So the number on the dashboard is real, while the question it appears to answer is not.',
        zh: '麻烦在于：准确率容易衡量，公平却不容易。模型可以拿真实发生过的事情来检验，因为那份记录存在；它却无法拿“如果当初做另一个决定会怎样”来检验，因为那份记录从未存在过。于是仪表盘上的那个数字是真的，而它看上去在回答的那个问题不是。'
      },
      {
        en: 'None of this argues for abandoning such tools. It argues for using them where the cost of a wrong guess is small and reversible — flagging a student for a conversation, not closing a door. The useful question is not whether the model is accurate, but what happens to the person on the other side when it is wrong.',
        zh: '这一切并不是主张放弃这类工具，而是主张把它们用在猜错代价小、且可挽回的地方——标记一个学生去谈一次话，而不是关上一扇门。真正有用的问题不是“模型准不准”，而是“当它出错时，另一头那个人会怎样”。'
      }
    ],
    question: {
      q: 'What does the author identify as the core limitation of such models?',
      options: [
        'They are not accurate enough for practical use.',
        'They cannot be checked against outcomes that never happened.',
        'They require too much historical data to train.',
        'They are too expensive for most schools.'
      ],
      answer: 1,
      explain: '第二段指出模型只能用已发生的记录检验，无法用“未发生的另一种结果”检验，B 项与之对应。'
    }
  },
  {
    id: 'r11',
    title: 'Remote Work and the Shape of Cities',
    titleZh: '远程办公与城市的形状',
    source: '考研英语二 · 阅读（改写）',
    minutes: 6,
    tags: ['城市', '工作'],
    words: ['decline', 'shift', 'resident'],
    paras: [
      {
        en: 'When offices emptied in 2020, many predicted the end of the city centre. Five years on, the picture is less dramatic and more interesting. Footfall in business districts fell, but it did not disappear; it redistributed. The coffee shop near the office lost its morning queue and gained a quieter afternoon trade from people who live upstairs but no longer commute.',
        zh: '2020 年写字楼空下来时，很多人预言市中心要终结。五年过去，情况没那么戏剧化，却更有意思：商务区的人流下降了，但没有消失，而是重新分布。写字楼旁的咖啡馆失去了早晨的长队，却因为那些住在楼上、不再通勤的人，多了一段更安静的下午生意。'
      },
      {
        en: 'What changed most is the meaning of distance. A commute of forty minutes was once the price of a good job; now it is often the reason to refuse one. Workers who can do their job from anywhere begin to ask why they should pay city rents for the privilege of sitting in traffic. Employers, in turn, discover that the pool of candidates no longer ends at the last train station.',
        zh: '变化最大的是距离的含义。四十分钟的通勤曾是获得一份好工作的代价，如今常常成了拒绝一份工作的理由。能随时随地完成工作的人开始追问：为什么要为了堵在路上的“特权”，付市中心的房租？而雇主也发现，候选人的范围不再止于最后一站地铁。'
      },
      {
        en: 'Cities are responding slowly, as cities do. Some convert empty office floors into housing, which sounds simple until the plumbing and the daylight are considered. Others invest in the things remote workers cannot download: parks, libraries, safe streets at night. The competition, it turns out, is not for commuters but for residents — and residents stay for reasons that a salary cannot supply.',
        zh: '城市的反应很慢，城市一向如此。有的把空置的写字楼楼层改成住宅，听起来简单，直到你考虑管线和采光；有的则投资那些远程工作者无法下载的东西：公园、图书馆、夜里安全的街道。原来这场竞争争夺的不是通勤者，而是居民——而居民留下来的理由，薪水给不了。'
      }
    ],
    question: {
      q: 'According to the passage, what are cities now competing for?',
      options: [
        'More office tenants in business districts.',
        'Commuters who use public transport daily.',
        'Residents, by offering what cannot be downloaded.',
        'Employers willing to fund infrastructure.'
      ],
      answer: 2,
      explain: '末段明确指出“竞争的不是通勤者而是居民”，且靠公园、图书馆、安全街道等无法下载的东西留住人，故选 C。'
    }
  },
  {
    id: 'r12',
    title: 'Reading the Label',
    titleZh: '读懂标签',
    source: '考研英语二 · 阅读（改写）',
    minutes: 5,
    tags: ['消费', '健康'],
    words: ['evidence', 'persuade', 'specific'],
    paras: [
      {
        en: 'A supermarket shelf is an argument. Every package makes a claim — low fat, high fibre, naturally sweetened — and every claim is technically true in a way that is designed to be misread. “No added sugar” says nothing about the sugar already inside. “Source of protein” says nothing about how much. The label is not lying; it is answering a question nobody asked.',
        zh: '超市货架就是一场辩论。每件包装都在主张：低脂、高纤维、天然甜味——每一条在技术上都成立，而成立的方式恰好是为了被误读。“无添加糖”对里面原本就有的糖只字不提；“蛋白质来源”则对含量多少闭口不言。标签没有说谎，它只是回答了一个没人问过的问题。'
      },
      {
        en: 'Regulators have tried to fix this by standardising the front of the pack: traffic lights, star ratings, warning octagons. The evidence on whether they work is mixed but not discouraging. Shoppers do notice them, and the least healthy products do lose sales. What the labels cannot do is make a decision for someone who is shopping in a hurry with two children and a budget.',
        zh: '监管者试图用统一的正面对标来解决：红绿灯、星级、警示八边形。关于它们是否有效的证据褒贬不一，但并不令人沮丧——消费者确实会注意到，最不健康的产品销量确实会下滑。标签做不到的，是替一个带着两个孩子、算着预算、匆匆购物的人做决定。'
      },
      {
        en: 'Perhaps that is the honest limit of the whole exercise. A label informs; it does not persuade, and it should not be asked to. The shoppers who benefit most are those with the time to compare, which is precisely the group that needs the least help. For everyone else, the useful reforms are duller: smaller packages, honest serving sizes, and fewer claims to decode in the first place.',
        zh: '这也许就是整套做法诚实的边界：标签只提供信息，不做说服，也不该被要求去说服。受益最多的，是那些有时间逐项比较的人——而这恰恰是最不需要帮助的一群人。对其他人来说，真正有用的改革要乏味得多：更小的包装、诚实的份量标注，以及从一开始就少一些需要解读的宣称。'
      }
    ],
    question: {
      q: 'What is the author\'s view of front-of-pack labels?',
      options: [
        'They are misleading and should be banned.',
        'They help, but cannot replace a shopper\'s own judgement.',
        'They are effective mainly for high-income shoppers.',
        'They work better than smaller package sizes.'
      ],
      answer: 1,
      explain: '第二段承认标签“确实被注意到、不健康产品销量确实下降”，第三段又指出它无法替匆忙的人做决定，因此是“有用但不能取代判断”，选 B。'
    }
  },
  {
    id: 'r13',
    title: 'The Long Life of a Paper Textbook',
    titleZh: '一本纸质教材的漫长一生',
    source: '六级 · 阅读（改写）',
    minutes: 5,
    tags: ['教育', '环境'],
    words: ['sustain', 'replace', 'burden'],
    paras: [
      {
        en: 'The case against paper textbooks seems obvious: they are heavy, they go out of date, and printing them consumes trees and fuel. Digital versions promise to fix all three at once. Yet a careful comparison finds the arithmetic less one-sided than it looks. A tablet is not free to make, and its cost is paid upfront in mining and manufacturing rather than annually in paper.',
        zh: '反对纸质教材的理由似乎显而易见：沉、容易过时，印刷还消耗木材和燃料。电子版承诺一次解决这三点。然而仔细比较会发现，这笔账并没有看上去那么一边倒——平板不是免费造出来的，它的代价以采矿和制造的形式一次性付出，而不是每年以纸张的形式付出。'
      },
      {
        en: 'The decisive variable is how long the device lasts and how often it is used. A tablet replaced every two years, used for an hour a day, carries a heavier burden than a textbook printed once and handed down through three classes of students. The textbook\'s advantage is not that paper is clean; it is that a well-made object can be reused without losing anything.',
        zh: '决定性的变量是设备能用多久、被用得多频繁。一台两年一换、每天只用一小时的平板，其负担比一本印一次、传过三届学生的教材更重。纸质教材的优势不在于纸更环保，而在于一件做得好的东西可以被反复使用而毫发无损。'
      },
      {
        en: 'None of this settles the question, and it is not meant to. It suggests only that “digital” is not a synonym for “better”, and that the environmental case depends on habits we rarely examine: how often we upgrade, how carefully we keep things, and whether a shared copy can survive a semester in a backpack.',
        zh: '这并不能给问题下定论，也不打算下定论。它只说明：“电子”并不是“更好”的同义词，而环保与否取决于我们很少检视的习惯——多久换一次设备、多爱惜东西，以及一本共享的教材能不能在一个书包里撑过一学期。'
      }
    ],
    question: {
      q: 'What determines whether digital textbooks are the greener choice?',
      options: [
        'The price of the tablet compared with the book.',
        'How long the device lasts and how intensively it is used.',
        'Whether students prefer reading on screens.',
        'The number of trees saved by each print run.'
      ],
      answer: 1,
      explain: '第二段开头即指出“决定性变量是设备能用多久、被用得多频繁”，故选 B。'
    }
  }
];

export const LISTENINGS_EXTRA = [
  {
    id: 'l7',
    title: 'A Talk About Library Hours',
    titleZh: '关于图书馆开放时间的对话',
    source: '考研英语一 · 听力（改写）',
    accent: '美音',
    seconds: 62,
    tags: ['校园', '服务'],
    words: ['extend', 'staff', 'committee'],
    lines: [
      { en: 'Excuse me, is the library really closing at nine this term?', zh: '打扰一下，这学期图书馆真的九点就关门吗？' },
      { en: 'It is, and we have had a lot of requests to extend it.', zh: '是的，我们也收到很多延长开放时间的请求。' },
      { en: 'So what is stopping you? It cannot be the building.', zh: '那是什么阻碍了你们？总不会是楼的问题吧。' },
      { en: 'It is staff. Keeping one floor open sounds simple, but someone has to be there, and we cannot ask the same three people to work every night.', zh: '是人手。只开一层楼听起来简单，但总得有人在，而我们没法让同样的三个人每晚都值班。' },
      { en: 'Could students help? I would volunteer for two evenings a week.', zh: '学生能帮忙吗？我愿意每周值两个晚上。' },
      { en: 'That is a generous offer, and honestly it is the only version of this plan that could work. Let me take it to the committee.', zh: '这个提议很大方，说实话，这也是这个方案唯一可行的形式。我把它提交给委员会。' }
    ]
  },
  {
    id: 'l8',
    title: 'Internships and the Timetable',
    titleZh: '实习与课表',
    source: '考研英语二 · 听力（改写）',
    accent: '英音',
    seconds: 58,
    tags: ['就业', '学业'],
    words: ['balance', 'require', 'benefit'],
    lines: [
      { en: 'Almost everyone in my year is doing an internship this term.', zh: '我们这届几乎每个人这学期都在实习。' },
      { en: 'And how is that working out with the timetable?', zh: '那和课表怎么协调呢？' },
      { en: 'Badly. Two of my classes are in the afternoon, which is exactly when the office needs me.', zh: '很糟。我有两门课在下午，而那正是办公室需要我的时候。' },
      { en: 'Have you asked whether the seminars could be recorded?', zh: '你问过研讨课能不能录像吗？' },
      { en: 'I have, but the department says attendance is part of the grade.', zh: '问了，但系里说出勤算进成绩。' },
      { en: 'Then the honest answer may be that you cannot do both well, and it is better to know that in week three than in week twelve.', zh: '那么诚实的答案也许是：你没法把两件事都做好。第三周知道这一点，总比第十二周才知道要好。' }
    ]
  }
];

export const LONG_EXTRA = [
  {
    id: 'ls9',
    en: 'It is not that cities have stopped growing, but that the way they grow — outward rather than upward, and by car rather than by foot — has made the very density that once made them efficient into something residents now pay to escape.',
    zh: '并不是城市停止了扩张，而是它们扩张的方式——向外而非向上、靠汽车而非靠步行——把曾经让城市高效的“密度”，变成了居民如今花钱去逃离的东西。',
    trunk: 'It is not that cities have stopped growing, but that the way they grow… has made…',
    mods: [
      ['强调句框架', 'It is not that…, but that…'],
      ['插入语（方式状语）', 'outward rather than upward, and by car rather than by foot'],
      ['定语从句', 'that once made them efficient'],
      ['不定式作定语', 'to escape']
    ],
    source: '考研英语一 · 长难句（改写）'
  },
  {
    id: 'ls10',
    en: 'What the survey could not capture, and what no questionnaire easily can, is the quiet decision that thousands of workers make each month — to stop looking for a better job, not because they are satisfied, but because looking has become too expensive.',
    zh: '这份调查无法捕捉、任何问卷也很难捕捉的，是成千上万名劳动者每个月悄悄做出的决定——不再寻找更好的工作，不是因为他们满意，而是因为“寻找”本身变得太昂贵。',
    trunk: 'What the survey could not capture… is the quiet decision…',
    mods: [
      ['主语从句', 'What the survey could not capture'],
      ['并列主语从句', 'what no questionnaire easily can'],
      ['同位语（破折号补充）', 'to stop looking for a better job'],
      ['原因状语从句（not because… but because…）', 'not because they are satisfied, but because looking has become too expensive'],
      ['比较结构', 'too expensive']
    ],
    source: '考研英语二 · 长难句（改写）'
  },
  {
    id: 'ls11',
    en: 'Had the researchers controlled for the size of the schools, the gap they reported would almost certainly have shrunk, which is why the study is best read as a question rather than a verdict.',
    zh: '如果研究者控制了学校规模这一变量，他们报告的差距几乎肯定会缩小——正因如此，这项研究最好被当作一个问题来读，而不是一个判决。',
    trunk: 'Had the researchers controlled…, the gap… would have shrunk…',
    mods: [
      ['虚拟条件句（省略 if 的倒装）', 'Had the researchers controlled for the size of the schools'],
      ['定语从句（省略 that）', 'they reported'],
      ['非限定性定语从句（which 指代整句）', 'which is why the study is best read as a question rather than a verdict'],
      ['比较结构', 'rather than a verdict']
    ],
    source: '六级 · 长难句（改写）'
  },
  {
    id: 'ls12',
    en: 'The argument that technology will simply create new jobs, as it has always done, assumes that the workers whose jobs disappear can wait — and that the places where the new jobs appear are the same places where the old ones vanished.',
    zh: '“技术终将创造新的岗位，一如它历来所做”这一论点，默认了两件事：失去岗位的工人等得起，以及新岗位出现的地方就是旧岗位消失的地方。',
    trunk: 'The argument that… assumes that… and that…',
    mods: [
      ['同位语从句', 'that technology will simply create new jobs'],
      ['方式状语从句', 'as it has always done'],
      ['宾语从句 1', 'that the workers whose jobs disappear can wait'],
      ['定语从句（whose 引导）', 'whose jobs disappear'],
      ['宾语从句 2（并列）', 'that the places where the new jobs appear are the same places where the old ones vanished'],
      ['定语从句 ×2（where 引导）', 'where the new jobs appear / where the old ones vanished']
    ],
    source: '六级 · 长难句（改写）'
  }
];
