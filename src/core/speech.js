/**
 * 发音模块（v2.2）
 *
 * 三条通道，按可用性自动降级：
 *   1. 在线真人录音（有道优先 / gstatic 补充）—— 只用于单个单词
 *   2. 原生 TTS（@capacitor-community/text-to-speech）—— Android App 内所有文本
 *   3. Web Speech API（window.speechSynthesis）—— 桌面 / Chrome 浏览器
 *
 * 背景：Android WebView 没有实现 window.speechSynthesis，
 * 所以 App 内的单词兜底与「例句 / 长文本」必须走原生 TTS，否则必然无声。
 * App 内的 JS 没有打包器（www 直接跑，无 node_modules），bare specifier 的动态 import
 * 在 APK 里必然 404，因此一律用原生桥 window.Capacitor.nativePromise 直连插件：
 *   window.Capacitor.nativePromise('TextToSpeech', 'speak', opts)
 * 桥不可用（插件没注册 / 纯 Web 预览）即降级，不抛错、不白屏。
 *
 * 音色说明（v2.2）：Capacitor TextToSpeech 6.x 的 speak({ voice }) 在 Android / Web 两侧
 * 都要求 **number 下标**（getSupportedVoices().voices 数组的索引），不是 voiceURI 字符串。
 * 本模块先按 quality 规则挑出 voiceURI，再映射为下标传给插件；挑不到就只传 lang。
 */
import * as store from './store.js';

let voices = [];
let currentAudio = null;
/** 每次 stopSpeaking() 自增，用来让在途的异步 TTS 回调失效 */
let speakToken = 0;

/** 原生音色缓存（来自插件 getSupportedVoices()，顺序即原生侧排序，不能重排） */
let nativeVoices = [];
let nativeVoicesLoaded = false;
let nativeVoicesLoading = null;
/** 取音色失败后的冷却，避免每次发音都重复跨桥查询 */
let nativeVoicesRetryAt = 0;

const clampRate = (rate) => Math.min(1.4, Math.max(0.6, Number(rate) || 0.9));
const isSingleWord = (text) => /^[A-Za-z][A-Za-z'-]{1,}$/.test(String(text ?? '').trim());
const normalizeLang = (lang) => String(lang ?? '').replace('_', '-').toLowerCase();
const normalizeURI = (uri) => String(uri ?? '').replace('_', '-').toLowerCase();

/** 默认口音：设置项优先，缺省/脏数据一律按美音处理 */
function normalizeAccent(accent) {
  if (accent === 'us' || accent === 'uk') return accent;
  const saved = store.getState?.().settings?.accent;
  return saved === 'uk' ? 'uk' : 'us';
}

/* ============================================================
   平台探测 + 原生 TTS 插件（懒加载 / 失败即降级）
   ============================================================ */
export function isNativePlatform() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch (_) {
    return false;
  }
}

let ttsPlugin = null;
let ttsSettled = false;

/**
 * 无打包器场景（本项目 www 直接跑在 Capacitor WebView 里，没有 node_modules），
 * 动态 import 会因 bare specifier 解析失败，所以走原生桥直连：
 *   window.Capacitor.nativePromise(pluginId, methodName, options)
 * 原生侧是否注册了插件，看 window.Capacitor.PluginHeaders（由原生注入）。
 */
function bridgeTTS() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!cap || cap.isNativePlatform?.() !== true) return null;
  if (typeof cap.nativePromise !== 'function') return null;
  const headers = cap.PluginHeaders;
  const registered = Array.isArray(headers) && headers.some((h) => h?.name === 'TextToSpeech');
  if (!registered) return null; // cap sync 没跑过 / 插件没装
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // 排除 then/symbol，否则被 await 时会当成 thenable，直接卡死
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return (options) => cap.nativePromise('TextToSpeech', prop, options ?? {});
      }
    }
  );
}

/**
 * 取原生 TTS 代理：桥可用就用，否则 null。
 * 正常情况下一次就定稿；原生环境里若 PluginHeaders 还没注入，留待下次再试。
 * 桥一旦就绪就 fire-and-forget 预热音色表，不阻塞首屏/首次点击。
 */
function getTTS() {
  if (!ttsSettled) {
    ttsPlugin = bridgeTTS();
    ttsSettled = !!ttsPlugin || !isNativePlatform();
    if (ttsPlugin) loadNativeVoices().catch(() => {});
  }
  return ttsPlugin;
}

/* 原生环境启动时先探一次，省掉第一次点喇叭的判断 */
if (isNativePlatform()) getTTS();

/* ============================================================
   原生音色：懒加载 + 优选
   ============================================================ */

/**
 * 取插件支持的音色表，只跑一次（失败后冷却 15s 再试）。
 * getSupportedVoices() 返回的数组顺序与原生 setVoice() 用的顺序一致，
 * 因此数组下标可以直接作为 speak({ voice: index }) 的入参。
 * @param {boolean} force 忽略冷却重试（TTS 引擎异步初始化时用）
 */
async function loadNativeVoices(force = false) {
  if (nativeVoicesLoaded && nativeVoices.length) return nativeVoices;
  if (nativeVoicesLoading) return nativeVoicesLoading;
  if (!force && Date.now() < nativeVoicesRetryAt) return nativeVoices;
  const tts = getTTS();
  if (!tts) return nativeVoices;
  nativeVoicesLoading = (async () => {
    try {
      const res = await tts.getSupportedVoices();
      const list = Array.isArray(res?.voices) ? res.voices : [];
      nativeVoices = list.filter((v) => v && typeof v === 'object');
      nativeVoicesLoaded = nativeVoices.length > 0;
      if (!nativeVoicesLoaded) nativeVoicesRetryAt = Date.now() + 15000;
    } catch (_) {
      /* 静默降级：没拿到音色表就只传 lang，仍可正常发音 */
      nativeVoices = [];
      nativeVoicesLoaded = false;
      nativeVoicesRetryAt = Date.now() + 15000;
    } finally {
      nativeVoicesLoading = null;
    }
    return nativeVoices;
  })();
  return nativeVoicesLoading;
}

/**
 * 按 lang 优选一个原生 voiceURI（只做挑选，不直接传给插件）。
 * 排序目标：神经/网络音色 > 高质量本地音色 > 通用 -language 音色 > null。
 * 大小写、下划线/连字符统一归一化后比较。
 */
function pickNativeVoiceURI(lang) {
  if (!nativeVoices.length) return null;
  const target = normalizeLang(lang);
  if (!target) return null;

  const sameLang = nativeVoices.filter((v) => normalizeLang(v.lang) === target);
  if (!sameLang.length) return null;

  const uriOf = (v) => normalizeURI(v?.voiceURI);
  const isNetwork = (v) => v.localService === false;
  // 通用 -language 音色放最后兜底，不参与前面的质量排序
  const candidates = sameLang.filter((v) => !uriOf(v).endsWith('-language'));
  const byURI = (list, uri) => list.find((v) => uriOf(v) === uri) || null;
  const first = (list, predicate) => list.find(predicate) || null;

  if (target.startsWith('en-gb')) {
    // 英音：rjs 是 Google 高质量神经音色，网络版优先；其次 gbX 网络音色；再其次任意英音
    const rjs = byURI(candidates, 'en-gb-x-rjs-network') || byURI(candidates, 'en-gb-x-rjs-local');
    if (rjs) return rjs.voiceURI;
    const gbNeural = first(candidates, (v) => isNetwork(v) && /(^|-)(gba|gbb|gbc|gbd|gbg)(-|$)/.test(uriOf(v)));
    if (gbNeural) return gbNeural.voiceURI;
    const gbNetwork = first(candidates, isNetwork);
    if (gbNetwork) return gbNetwork.voiceURI;
    const any = first(candidates, () => true);
    if (any) return any.voiceURI;
  } else if (target.startsWith('en-us')) {
    // 美音：网络音色优先，其次 iob 系列，再其次任意美音
    const usNetwork = first(candidates, isNetwork);
    if (usNetwork) return usNetwork.voiceURI;
    const iob = first(candidates, (v) => uriOf(v).startsWith('en-us-x-iob-'));
    if (iob) return iob.voiceURI;
    const any = first(candidates, () => true);
    if (any) return any.voiceURI;
  } else {
    const any = first(candidates, () => true);
    if (any) return any.voiceURI;
  }

  const fallback = byURI(sameLang, `${target}-language`);
  return fallback ? fallback.voiceURI : null;
}

/**
 * 把挑中的 voiceURI 映射为插件需要的数组下标。
 * @returns {number} 找不到返回 -1（此时 speak 只传 lang）
 */
function pickNativeVoiceIndex(lang) {
  const uri = pickNativeVoiceURI(lang);
  if (!uri) return -1;
  const index = nativeVoices.findIndex((v) => String(v?.voiceURI ?? '') === uri);
  return index >= 0 ? index : -1;
}

/* ============================================================
   Web Speech API（仅 Web 环境）
   ============================================================ */
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  try {
    voices = window.speechSynthesis.getVoices() || [];
  } catch (_) {
    voices = [];
  }
}

if ('speechSynthesis' in window) {
  loadVoices();
  try {
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
  } catch (_) {
    /* 部分实现不支持 addEventListener，忽略 */
  }
}

export const speechSupported = () => isNativePlatform() || 'speechSynthesis' in window;

/* ============================================================
   失败反馈
   真机上「点了没声音」是最差的体验，任何一次真正的失败都要给用户一句话。
   取消（stop）不会走到这里：插件的 stop() 直接清空 pending 回调，不会 reject，
   所以不会出现「滑到下一个词就弹提示」的误报。
   ============================================================ */
let lastWarnAt = 0;
function warnVoice(reason) {
  const now = Date.now();
  if (now - lastWarnAt < 60000) return;
  lastWarnAt = now;
  try {
    /* 延迟引入，避免 speech.js 在纯逻辑测试里强依赖 DOM */
    import('./ui.js')
      .then((mod) => mod.toast?.(reason))
      .catch(() => {});
  } catch (_) {
    /* 忽略 */
  }
}

const PREFERRED = {
  'en-US': ['Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Samantha', 'Daniel'],
  'en-GB': ['Google UK English Female', 'Google UK English Male', 'Microsoft Sonia', 'Microsoft Ryan', 'Kate']
};

function pickVoice(lang) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;
  const exact = voices.filter((v) => String(v.lang || '').replace('_', '-') === lang);
  if (exact.length) {
    const preferred = PREFERRED[lang] || [];
    for (const name of preferred) {
      const found = exact.find((v) => v.name === name);
      if (found) return found;
    }
    return exact[0];
  }
  return voices.find((v) => String(v.lang || '').toLowerCase().startsWith(lang.slice(0, 2))) || null;
}

/* ============================================================
   在线真人录音（单词）
   ============================================================ */
function stopAudio() {
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
  } catch (_) {
    /* 忽略 */
  }
  currentAudio = null;
}

/**
 * 单词在线录音音源：有道优先，gstatic 作为可选补充。
 * 有道 type=1=英音、type=2=美音，覆盖率实测 10/10 且两侧音频内容确实不同；
 * gstatic 实测近半单词 404，放前面会让每个词空等一轮起播超时后才轮到有道。
 * 两个音源均走 HTTPS，Android 9+ 明文流量限制下无需改动 Manifest。
 */
function audioSources(word, accent) {
  const uk = accent === 'uk';
  const encoded = encodeURIComponent(word);
  const youdao = `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${uk ? 1 : 2}`;
  const gstatic = `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${encoded}--_${uk ? 'gb' : 'us'}_1.mp3`;
  // 口音通过参数直接进入 URL：每次调用都重新生成，不存在跨口音的 src 复用
  return [youdao, gstatic];
}

/**
 * 失败分类：
 * 「该词无录音」（服务端 404 / 非音频响应，通常表现为 MEDIA_ERR_SRC_NOT_SUPPORTED）
 *   只影响当前单词，跳过该音源或直接 TTS 兜底，绝不进静默期。
 *   旧逻辑把这种 404 也算失败，连续 2 次就静默 60s，导致快速滑词时整组词只剩机械 TTS，
 *   这也是「部分单词缺失自动发音」和「英美没区别」的根因。
 * 「网络层失败」（设备离线 / MEDIA_ERR_NETWORK）才计数，连续 6 次设 15s 短静默。
 */
let netFailStreak = 0;
let onlineCooldownUntil = 0;
const onlineUsable = () => Date.now() >= onlineCooldownUntil;

function isOffline() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  } catch (_) {
    return false;
  }
}

/** 判断一次 onerror 是否属于网络层失败，否则按「该词无录音」处理 */
function isNetworkFailure(audio) {
  if (isOffline()) return true;
  // MediaError.MEDIA_ERR_NETWORK === 2：下载过程中网络中断。
  // 1=ABORTED（主动 stop）、3=DECODE、4=SRC_NOT_SUPPORTED（多为 404）都不算网络失败。
  return Number(audio?.error?.code) === 2;
}

function markNetworkFail() {
  if (isOffline()) {
    // 明确离线：直接短静默，避免每个词都空等两轮起播超时
    onlineCooldownUntil = Date.now() + 15000;
    netFailStreak = 0;
    return;
  }
  netFailStreak += 1;
  if (netFailStreak >= 6) {
    onlineCooldownUntil = Date.now() + 15000;
    netFailStreak = 0;
  }
}

function markOnlineOk() {
  netFailStreak = 0;
}

function playRecording(word, accent, { rate = 0.9, onEnd } = {}) {
  const sources = audioSources(word, accent);
  /* 有道首字节通常很快；App 内 TTS 是可靠兜底，起播超过 1.8s 就别再等（Web 放宽到 2.5s），
     避免快速自动朗读时被前一个词的起播超时拖住。 */
  const startTimeout = isNativePlatform() ? 1800 : 2500;
  const token = speakToken;
  let i = 0;
  let timer = null;
  let done = false;

  /* 期间用户切了卡 / 主动停止：旧序列彻底作废。
     否则在途的超时、onerror 仍会继续起下一段音频甚至 TTS，造成串音。 */
  const cancelled = () => done || token !== speakToken;

  const fail = (networkFailure) => {
    if (cancelled()) return;
    stopAudio();
    clearTimeout(timer);
    if (networkFailure) markNetworkFail(); // 404 不计数、不触发静默，只换音源
    i += 1;
    if (i < sources.length) attempt();
    else {
      done = true;
      // 音源全部不可用：原生 TTS（App）或系统语音（Web）接手，绝不哑掉
      speakFallback(word, { accent, rate, onEnd });
    }
  };

  const attempt = () => {
    if (cancelled()) return;
    let audio = null;
    try {
      audio = new Audio();
    } catch (_) {
      done = true;
      speakFallback(word, { accent, rate, onEnd });
      return;
    }
    /* 同一次尝试只认第一个结果：onerror / play().catch / 超时可能同时触发，
       不去重会连跳两个音源、甚至起两段音频，onEnd 也会错乱。 */
    let settled = false;
    const failOnce = (networkFailure = false) => {
      if (settled || cancelled()) return;
      settled = true;
      fail(networkFailure || isNetworkFailure(audio));
    };
    currentAudio = audio;
    audio.preload = 'auto';
    audio.src = sources[i];
    try {
      audio.playbackRate = clampRate(rate);
    } catch (_) {
      /* 忽略 */
    }
    clearTimeout(timer);
    timer = setTimeout(() => failOnce(isOffline()), startTimeout);
    audio.onended = () => {
      if (cancelled() || settled) return;
      settled = true;
      done = true;
      clearTimeout(timer);
      stopAudio();
      onEnd?.();
    };
    audio.onerror = () => failOnce(false);
    audio.onplaying = () => {
      clearTimeout(timer);
      markOnlineOk();
    };
    try {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => failOnce(isNetworkFailure(audio)));
    } catch (_) {
      failOnce(isNetworkFailure(audio));
    }
  };

  attempt();
  return true;
}

/* ============================================================
   语音合成：原生 TTS 优先，Web SpeechSynthesis 降级
   ============================================================ */
function webSpeak(text, { accent = 'us', rate = 0.9, onEnd } = {}) {
  if (!text) return false;
  if (!('speechSynthesis' in window)) {
    warnVoice('这台设备没有可用的语音引擎，发音暂时播不出来');
    return false;
  }
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch (_) {
    /* 忽略 */
  }
  let u = null;
  try {
    u = new SpeechSynthesisUtterance(String(text));
  } catch (_) {
    return false;
  }
  const lang = normalizeAccent(accent) === 'uk' ? 'en-GB' : 'en-US';
  u.lang = lang;
  u.rate = clampRate(rate);
  u.pitch = 1;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  if (onEnd) u.onend = () => onEnd();
  try {
    synth.speak(u);
  } catch (_) {
    return false;
  }
  return true;
}

/**
 * 原生 TTS：优选音色 + 失败重试 + onEnd 只回调一次。
 *
 * 降级链：优选音色 → 去掉 voice 只用 lang 重试一次 → Web Speech（若存在）。
 * 只有最后一级也失败才 warnVoice；网络音色临时不可用不会「点了没声音」。
 */
async function nativeSpeak(text, { accent = 'us', rate = 0.9, onEnd } = {}) {
  if (!text) return false;
  const tts = getTTS();
  if (!tts) {
    /* 插件没被注册（cap sync 没跑）——不能静默，至少让用户/QA 看见 */
    warnVoice('语音引擎未就绪，请重启 App 再试');
    return false;
  }
  const lang = normalizeAccent(accent) === 'uk' ? 'en-GB' : 'en-US';
  const token = speakToken;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    /* 期间用户又触发了别的发音，别再回调 onEnd（否则串播会串线） */
    if (token === speakToken) onEnd?.();
  };

  try {
    await tts.stop();
  } catch (_) {
    /* 没在播时 stop 可能报错，忽略 */
  }
  await loadNativeVoices();
  if (!nativeVoices.length) {
    /* TTS 引擎是异步初始化的：模块加载时预热可能拿到空表。
       首次发音前短暂等待再强制拉一次，避免第一下仍然落在机械默认音色上。 */
    await new Promise((resolve) => setTimeout(resolve, 250));
    await loadNativeVoices(true);
  }
  /* 等待音色表期间用户可能已切卡：放弃这次朗读，避免旧词在后台冒出来串音 */
  if (token !== speakToken) return false;
  const voiceIndex = pickNativeVoiceIndex(lang);

  /** voice 必须是 getSupportedVoices() 数组的下标（number），不是 voiceURI 字符串 */
  const optionsFor = (index) => {
    const opts = {
      text: String(text),
      lang,
      rate: clampRate(rate),
      pitch: 1.0,
      volume: 1.0,
      // Android 只认默认语音引擎；iOS 用 playback 让锁屏后也能读完
      category: 'playback',
      queueStrategy: 0 // Flush：新的朗读直接打断旧的
    };
    if (index >= 0) opts.voice = index;
    return opts;
  };

  try {
    await tts.speak(optionsFor(voiceIndex));
    finish();
    return true;
  } catch (err) {
    if (voiceIndex >= 0) {
      /* 首选音色失败（网络音色不可达 / 引擎拒绝）：换成系统默认音色再试一次 */
      try {
        await tts.stop();
        await tts.speak(optionsFor(-1));
        finish();
        return true;
      } catch (_) {
        /* 两条原生路径都不通，继续走 Web 兜底 / 提示 */
      }
    }
    const msg = String(err?.message || err || '');
    if (/language/i.test(msg)) {
      warnVoice('系统缺少英文语音包，可在「设置 → 语音合成」里安装后再试');
    } else {
      warnVoice('系统语音引擎没响应，请检查语音合成设置');
    }
    return false;
  }
}

/** 系统级语音：原生 TTS 优先，不可用时退回 Web Speech */
function speakFallback(text, { accent = 'us', rate = 0.9, onEnd } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  const useAccent = normalizeAccent(accent);
  if (isNativePlatform()) {
    const token = speakToken;
    nativeSpeak(raw, { accent: useAccent, rate, onEnd })
      .then((ok) => {
        /* 用户已经点了别的/取消了，就不要在 Web 兜底里再冒出一句 */
        if (!ok && token === speakToken) webSpeak(raw, { accent: useAccent, rate, onEnd });
      })
      .catch(() => {
        if (token === speakToken) webSpeak(raw, { accent: useAccent, rate, onEnd });
      });
    return true;
  }
  return webSpeak(raw, { accent: useAccent, rate, onEnd });
}

/* ============================================================
   对外 API
   ============================================================ */
/* 单词优先播放在线真人/标准录音；例句与长文本使用系统语音 */
function useOnline(online) {
  if (online !== undefined) return online;
  return store.getState?.().settings?.onlineVoice !== false;
}

/**
 * 朗读一段文本（不阻塞）。
 * @returns {boolean} 是否已交给某条通道
 */
export function speak(text, { accent, rate = 0.9, onEnd, online } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  const useAccent = normalizeAccent(accent);
  stopSpeaking();
  /* 单词可以先试在线真人录音；连续失败后进入静默期，直接走 TTS，不再每次空等 */
  if (isSingleWord(raw) && useOnline(online) && onlineUsable()) {
    return playRecording(raw, useAccent, { rate, onEnd });
  }
  return speakFallback(raw, { accent: useAccent, rate, onEnd });
}

export function stopSpeaking() {
  speakToken += 1;
  stopAudio();
  if (isNativePlatform()) {
    try {
      const p = getTTS()?.stop?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {
      /* 插件不可用时无需处理 */
    }
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* 忽略 */
    }
  }
}

/** 粗略估计一句朗读时长，仅用于串播兜底计时 */
function estimateMs(text, rate) {
  const r = clampRate(rate);
  return Math.max(900, Math.min(20000, (String(text).length * 95) / r));
}

/** 朗读一句并等到结束（onEnd / 超时都算结束，保证队列一定能往下走） */
function speakOnce(text, { accent, rate = 0.9, online } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(finish, estimateMs(text, rate) + 2600);
    const started = speak(text, {
      accent,
      rate,
      online,
      onEnd: finish
    });
    if (!started) finish();
  });
}

/**
 * 串播：逐句朗读（听力页 / 朗读全文 / 换词自动朗读）。
 * @returns {() => void} 取消函数
 */
export function speakSequence(lines, { accent, rate = 0.9, onIndex, online } = {}) {
  const list = (Array.isArray(lines) ? lines : []).map((l) => String(l ?? '').trim()).filter(Boolean);
  if (!list.length) return () => {};

  const useAccent = normalizeAccent(accent);
  let cancelled = false;
  /* 原生 TTS 的句间停顿略长一点，听感更自然 */
  const gap = isNativePlatform() ? 280 : 180;

  const run = async () => {
    for (let i = 0; i < list.length; i += 1) {
      if (cancelled) return;
      onIndex?.(i);
      await speakOnce(list[i], {
        accent: useAccent,
        rate,
        online: useOnline(online) && isSingleWord(list[i])
      });
      if (cancelled) return;
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, gap));
      }
    }
  };

  run().catch(() => {});
  return () => {
    cancelled = true;
    stopSpeaking();
  };
}
