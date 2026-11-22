/**
 * 音节拆分（零依赖纯函数）
 * ============================================================
 * 目标不是出版物级连字符拆分，而是给背单词界面提供一行「看得懂、读得顺」的
 * 音节提示（pol·i·cy），帮助用户把长词切成可以朗读的块。
 *
 * 规则按优先级：
 *   1. 只处理纯字母词（连字符先按连字符切开），长度 < 3 或没有元音 → 原样返回
 *   2. 先切常见后缀（-tion / -sion / -ment / -able / -ing ...）
 *   3. 再切常见前缀（un- / re- / pre- / dis- / over- ...，且剩余长度 ≥ 3）
 *   4. 剩下的词干按「元音组 + 其后辅音」切
 *   5. 词尾不发音的 e 不单独成音节（make / hope / schedule 的 ule）
 *   6. 任何一步异常（片段为空、拼不回原词）→ 原样返回，永不抛错
 *   7. 大小写与连字符原样保留
 *
 * 所有函数都是纯函数，不读写全局状态，可以安全地在渲染期调用。
 */

const VOWEL_SET = new Set(['a', 'e', 'i', 'o', 'u']);
/** 允许出现在输入里的字符：字母与连字符（连字符视为硬分段） */
const PLAIN_WORD = /^[A-Za-z-]+$/;

/**
 * 常见后缀，按长度从长到短尝试（长的优先，避免 -al 抢走 -tial 的位置）。
 * 前 18 个是产品明确要求覆盖的基础后缀；后面的 -ful / -less / -fully / -fulness
 * 用来处理 beautiful→beau·ti·ful、carefully→care·ful·ly 这类高频词。
 */
const SUFFIXES = [
  'fulness', 'fully', 'cious', 'tious', 'ation', 'ition',
  'tion', 'sion', 'tial', 'cial', 'ment', 'ness', 'able', 'ible', 'less',
  'ing', 'ed', 'ly', 'er', 'est', 'ous', 'al', 'ic', 'ful'
];

/**
 * 常见前缀，按长度从长到短尝试（under-/inter- 优先于 un-/in-）。
 * 前缀切完剩余部分不足 3 个字母时放弃（rest 的 re-、into 的 in-）。
 */
const PREFIXES = [
  'under', 'inter', 'over', 'pre', 'dis', 'mis', 'non', 'sub', 'un', 're', 'in', 'im'
];

/** 后缀按长度倒序去重，保证长后缀先匹配 */
const SUFFIXES_SORTED = [...new Set(SUFFIXES)].sort((a, b) => b.length - a.length);
/** 前缀按长度倒序去重 */
const PREFIXES_SORTED = [...new Set(PREFIXES)].sort((a, b) => b.length - a.length);

/**
 * 判断某个位置上的字符是否算元音。
 * a/e/i/o/u 恒为元音；y 在词首当辅音（yes / yield），其余位置当元音（policy / rhythm）。
 *
 * @param {string} ch 单个字符
 * @param {number} idx 在所属片段中的下标
 * @param {number} len 片段长度
 * @returns {boolean}
 */
function isVowelAt(ch, idx) {
  const c = ch.toLowerCase();
  if (VOWEL_SET.has(c)) return true;
  /* y 在词首读辅音（yes / yield），其余位置一律当元音（policy / rhythm / play） */
  if (c === 'y') return idx > 0;
  return false;
}

/**
 * 片段内是否含元音（含 y 作元音的情况）。
 * @param {string} seg
 * @returns {boolean}
 */
function hasVowel(seg) {
  for (let i = 0; i < seg.length; i += 1) {
    if (isVowelAt(seg[i], i)) return true;
  }
  return false;
}

/**
 * 找出片段内所有「元音组」区间（连续元音字母算一组）。
 *
 * @param {string} seg 纯字母片段
 * @returns {Array<{s:number,e:number}>} 每组的起止下标（含两端）
 */
function vowelGroups(seg) {
  const out = [];
  let i = 0;
  while (i < seg.length) {
    if (isVowelAt(seg[i], i)) {
      const start = i;
      let end = i;
      while (end + 1 < seg.length && isVowelAt(seg[end + 1], end + 1)) end += 1;
      out.push({ s: start, e: end });
      i = end + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

/**
 * 按切点把片段切成音节数组。
 *
 * @param {string} seg 原片段
 * @param {number[]} cuts 每个音节的起始下标（升序，且 0 < cut < seg.length）
 * @returns {string[]}
 */
function sliceByCuts(seg, cuts) {
  const out = [];
  let from = 0;
  cuts.forEach((cut) => {
    if (cut <= from || cut >= seg.length) return;
    out.push(seg.slice(from, cut));
    from = cut;
  });
  out.push(seg.slice(from));
  return out.filter((s) => s.length > 0);
}

/**
 * 判断字符是否为「元音字母」（含 y，用于音节核心判断）。
 * @param {string} ch
 * @returns {boolean}
 */
function isVowelLetter(ch) {
  return 'aeiouy'.includes(String(ch).toLowerCase());
}

/**
 * 词尾 -Cle / -Cre 的成音节辅音判断（a·ble / ta·ble / cen·tre / i·ble）。
 *
 * 只有当词尾是「辅音 + l/r + e」且再前面一个字母不是元音时才算，
 * 这样 able（a·ble）成立，而 care（care）、belle（belle）、style（style）不会被硬切。
 *
 * @param {string} seg 纯字母片段
 * @returns {boolean}
 */
function isSyllabicLe(seg) {
  const len = seg.length;
  if (len < 4) return false;
  const end = seg[len - 1].toLowerCase();
  if (end !== 'e') return false;
  const lr = seg[len - 2].toLowerCase();
  if (lr !== 'l' && lr !== 'r') return false;
  const pre = seg[len - 3].toLowerCase();
  if (!pre || pre === lr) return false;
  if (isVowelLetter(pre)) return false;
  return true;
}

/**
 * 核心切分：不考虑词缀，只按「元音组 + 其后辅音」拆分。
 *
 * - 两元音组之间没有辅音（罕见，如 video 的 eo 已被合并成一个组）→ 在第二组前切
 * - 两元音组之间 1 个辅音：前一组的元音组长度 ≥ 2（beau-）或后一组长度 ≥ 2（-iev）
 *   时归后一个音节（V-CV），双短元音时归前一个音节（pol-i-cy 的 pol）
 * - 两元音组之间 ≥ 2 个辅音：第一个归前、其余归后（VC-CV，for-ma）
 * - 词尾的 y（poli-cy）作为独立音节核心，前面的单辅音跟着它走
 * - 词尾不发音的 e 不单独成音节（sched-ule、make），但 -ble / -cle / -tre
 *   这类成音节辅音要单独成段（a-ble、cen-tre）
 *
 * @param {string} seg 纯字母片段
 * @returns {string[]} 音节数组（至少 1 项，拼起来等于原片段）
 */
function coreSplit(seg) {
  if (seg.length < 2) return [seg];
  const groups = vowelGroups(seg);
  if (groups.length === 0) return [seg];

  /* 词尾不发音的 e：只在「至少两个元音组」且它以单 e 收尾时忽略，
     这样 make / hope / schedule 都不会多切出一个 e 音节。 */
  const last = groups[groups.length - 1];
  const silentFinalE =
    groups.length >= 2 &&
    last.s === last.e &&
    last.e === seg.length - 1 &&
    seg[last.s].toLowerCase() === 'e';
  const syllabicLe = silentFinalE && isSyllabicLe(seg);
  const eff = silentFinalE && !syllabicLe ? groups.slice(0, -1) : groups;
  if (eff.length <= 1) return [seg];

  const cuts = [];
  for (let g = 0; g < eff.length - 1; g += 1) {
    const a = eff[g];
    const b = eff[g + 1];
    const clusterStart = a.e + 1;
    const clusterLen = b.s - clusterStart;

    /* 成音节辅音收尾：a|ble、ta|ble、cen|tre —— 最后一个音节的起点固定在
       「辅音 + l/r + e」这三字母之前，不看辅音簇数量 */
    if (syllabicLe && g === eff.length - 2) {
      const cut = seg.length - 3;
      if (cut > 0 && cut > a.e) {
        cuts.push(cut);
        continue;
      }
    }

    if (clusterLen <= 0) {
      cuts.push(b.s);
      continue;
    }
    if (clusterLen >= 2) {
      /* VC-CV：第一个辅音归前一个音节（for|ma、in-for-ma-tion） */
      cuts.push(clusterStart + 1);
      continue;
    }

    const prevLen = a.e - a.s + 1;
    const nextLen = b.e - b.s + 1;
    const isLastPair = g === eff.length - 2;
    /* 词尾 y：poli|cy —— y 是完整元音，前面的单辅音跟它组成一个音节 */
    const finalY = isLastPair && b.e === seg.length - 1 && seg[b.s].toLowerCase() === 'y';
    const toNext = finalY || prevLen >= 2 || nextLen >= 2;
    cuts.push(toNext ? clusterStart : b.s);
  }

  const out = sliceByCuts(seg, cuts);
  return out.length ? out : [seg];
}

/**
 * 尝试切掉一个后缀。
 *
 * @param {string} seg 纯字母片段
 * @returns {{stem:string, tail:string}|null}
 */
function takeSuffix(seg) {
  const lower = seg.toLowerCase();
  for (let i = 0; i < SUFFIXES_SORTED.length; i += 1) {
    const suf = SUFFIXES_SORTED[i];
    if (seg.length - suf.length < 3) continue;
    if (!lower.endsWith(suf)) continue;
    const stem = seg.slice(0, seg.length - suf.length);
    if (!hasVowel(stem)) continue;
    /* 元音开头的后缀（-al / -ing / -able ...）要求词干以辅音收尾，
       否则 fin-al 成立、appe-al（应为 ap-peal）不成立 */
    if (isVowelLetter(suf[0]) && isVowelLetter(stem[stem.length - 1])) continue;
    return { stem, tail: seg.slice(seg.length - suf.length) };
  }
  return null;
}

/**
 * 尝试切掉一个前缀。
 *
 * @param {string} seg 纯字母片段
 * @returns {{head:string, rest:string}|null}
 */
function takePrefix(seg) {
  const lower = seg.toLowerCase();
  for (let i = 0; i < PREFIXES_SORTED.length; i += 1) {
    const pre = PREFIXES_SORTED[i];
    const rest = seg.slice(pre.length);
    if (!lower.startsWith(pre)) continue;
    if (rest.length < 3) continue;
    if (!hasVowel(rest)) continue;
    return { head: seg.slice(0, pre.length), rest };
  }
  return null;
}

/**
 * 整体切分单个纯字母片段（词缀 + 词干）。
 *
 * @param {string} seg 纯字母片段（长度 ≥ 3）
 * @returns {string[]} 音节数组
 */
function splitSegment(seg) {
  let core = seg;
  const heads = [];
  const tails = [];

  /* 后缀优先（information → informa + tion），最多剥两层（beautifully → beauti + ful + ly） */
  for (let pass = 0; pass < 2; pass += 1) {
    const hit = takeSuffix(core);
    if (!hit) break;
    tails.unshift(hit.tail);
    core = hit.stem;
  }
  /* 再剥前缀（informa → in + forma），最多两层（un-under 之类基本不会触发） */
  for (let pass = 0; pass < 2; pass += 1) {
    const hit = takePrefix(core);
    if (!hit) break;
    heads.push(hit.head);
    core = hit.rest;
  }

  const out = [];
  heads.forEach((h) => out.push(...coreSplit(h)));
  out.push(...coreSplit(core));
  tails.forEach((t) => out.push(...coreSplit(t)));
  return out;
}

/**
 * 校验切分结果：非空、拼回等于原词、数量合理。
 *
 * @param {string} word 原片段
 * @param {string[]} parts 切分结果
 * @returns {boolean}
 */
function isValidSplit(word, parts) {
  if (!Array.isArray(parts) || parts.length === 0) return false;
  if (parts.length > 8) return false;
  if (parts.some((p) => typeof p !== 'string' || p.length === 0)) return false;
  if (parts.join('') !== word) return false;
  return true;
}

/**
 * 把一个单词切成音节数组。
 *
 * 无法可靠切分时返回 `[word]`（调用方可以据此判断「不要显示分隔点」）。
 * 永不抛错，永不返回空数组。
 *
 * @param {string} word 单词（可含连字符）
 * @returns {string[]} 例：`'policy' → ['pol','i','cy']`
 */
export function syllables(word) {
  const src = typeof word === 'string' ? word.trim() : '';
  if (!src || !PLAIN_WORD.test(src)) return [src || ''].filter(Boolean);

  /* 连字符词按硬边界切开，各自切分后合并 */
  if (src.includes('-')) {
    const pieces = src.split('-').filter((p) => p.length > 0);
    if (!pieces.length) return [src];
    const out = [];
    pieces.forEach((p) => out.push(...syllables(p)));
    return out.length ? out : [src];
  }

  /* 规则 1：长度 < 3、无元音（全是辅音）→ 原样返回 */
  if (src.length < 3 || !hasVowel(src)) return [src];

  let parts;
  try {
    parts = splitSegment(src);
  } catch (err) {
    /* 兜底：任何异常都退回原词，界面不该因为音节拆分崩掉 */
    return [src];
  }
  if (!isValidSplit(src, parts)) return [src];
  /* 单音节（cat / rhythm）没有可拆的边界，直接返回原词 */
  if (parts.length < 2) return [src];
  return parts;
}

/**
 * 返回带间隔点的音节串：`'policy' → 'pol·i·cy'`。
 *
 * 单音节、无法切分、非字母输入一律返回原词（不加点）。
 *
 * @param {string} word
 * @returns {string}
 */
export function syllabify(word) {
  const src = typeof word === 'string' ? word.trim() : '';
  if (!src) return '';
  if (src.includes('-') && PLAIN_WORD.test(src)) {
    /* 连字符词：段内用 ·，段间保留 -（well·known / self-ev·i·dent） */
    return src
      .split('-')
      .map((p) => (p ? syllables(p).join('·') : ''))
      .join('-');
  }
  return syllables(src).join('·');
}

/**
 * 音节串是否值得显示（至少两个音节才算「拆开了」）。
 *
 * @param {string} word
 * @returns {boolean}
 */
export function hasSyllableBreak(word) {
  return syllables(word).length > 1;
}
