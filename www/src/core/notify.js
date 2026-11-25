/**
 * 本地通知封装（v1.3）
 *
 * - 原生 App（Capacitor Android）：走 window.Capacitor.nativePromise 直连 LocalNotifications 插件，
 *   支持 App 关闭后的每日定时提醒
 * - Web 预览：降级为 Web Notification / 应用内提醒
 *
 * 为什么不用 `import('@capacitor/local-notifications')`：
 * 本项目 www 直接跑在 WebView 里，没有打包器、没有 node_modules，
 * bare specifier 的动态 import 在 App 内必然 404，于是每日提醒会静默失效。
 * 原生桥直连不需要任何模块解析（同 speech.js 的做法）：
 *   window.Capacitor.nativePromise(pluginId, methodName, options)
 * 插件是否可用看 window.Capacitor.PluginHeaders（由原生注入）。
 */
const PLUGIN_ID = 'LocalNotifications';

function isNativePlatform() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch (_) {
    return false;
  }
}

/**
 * 原生桥代理：把 tts.speak(...) 这类调用转成 nativePromise。
 * 必须排除 then，否则被 await 时会当成 thenable，直接卡死。
 */
function bridgePlugin() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!cap || cap.isNativePlatform?.() !== true) return null;
  if (typeof cap.nativePromise !== 'function') return null;
  const headers = cap.PluginHeaders;
  const registered = Array.isArray(headers) && headers.some((h) => h?.name === PLUGIN_ID);
  if (!registered) return null; // cap sync 没跑过 / 插件没装
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return (options) => cap.nativePromise(PLUGIN_ID, prop, options ?? {});
      }
    }
  );
}

let _plugin = null;
let _settled = false;

/**
 * 取插件代理。原生环境里暂时没拿到（PluginHeaders 可能还没注入）就不定稿，
 * 下次调用再试，避免一次失败后永久降级。
 */
function plugin() {
  if (_settled) return _plugin;
  const p = bridgePlugin();
  if (p) {
    _plugin = p;
    _settled = true;
  } else if (!isNativePlatform()) {
    _plugin = null;
    _settled = true;
  }
  return _plugin;
}

const DAILY_ID = 1001;
const DUE_ID = 1002;
/** 智能方案占用的通知 id，避免与遗留每日通知冲突 */
const PLAN_IDS = [1100, 1101, 1102];
let lastDueNotify = 0;
let lastSmartPriority = null;
const tapHandlers = [];

/** 把 { hour, minute } 归一化，避免 NaN / 越界传进原生 */
function parseTime(remindAt) {
  const [hh, mm] = String(remindAt || '20:00').split(':').map(Number);
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 20;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  return { hour, minute };
}

export async function status() {
  const p = plugin();
  if (!p) {
    const supported = 'Notification' in window;
    return { display: supported ? Notification.permission : 'unsupported', native: false };
  }
  try {
    const r = await p.checkPermissions();
    return { display: r?.display ?? 'unknown', native: true };
  } catch (_) {
    return { display: 'unknown', native: true };
  }
}

export async function request() {
  const p = plugin();
  if (!p) {
    if (!('Notification' in window)) return false;
    const r = await Notification.requestPermission();
    return r === 'granted';
  }
  try {
    const r = await p.requestPermissions();
    return r?.display === 'granted';
  } catch (_) {
    return false;
  }
}

/** 每日固定时间提醒；仅原生生效 */
export async function scheduleDaily(remindAt, dueCount) {
  const p = plugin();
  if (!p) return false;
  const { hour, minute } = parseTime(remindAt);
  try {
    await p.cancel({ notifications: [{ id: DAILY_ID }] });
    await p.schedule({
      notifications: [
        {
          id: DAILY_ID,
          title: 'WordHive · 该背单词了',
          body: dueCount > 0 ? `今天有 ${dueCount} 个词到期，5 分钟就能清完。` : '打开 WordHive，按记忆曲线安排今天的复习。',
          schedule: { every: 'day', on: { hour, minute } },
          sound: null,
          autoCancel: true
        }
      ]
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function cancelDaily() {
  const p = plugin();
  if (!p) return;
  try {
    await p.cancel({ notifications: [{ id: DAILY_ID }] });
  } catch (_) {
    /* 忽略：没排过期或原生不可用时无需处理 */
  }
}

/** 前台检测到到期词时的即时提醒，30 分钟节流 */
export async function notifyDue(dueCount) {
  if (!dueCount) return;
  const now = Date.now();
  if (now - lastDueNotify < 30 * 60 * 1000) return;
  lastDueNotify = now;

  const body = `今天有 ${dueCount} 个词到期，5 分钟就能清完。`;
  const p = plugin();
  if (p) {
    try {
      const s = await status();
      if (s.display !== 'granted') return;
      await p.schedule({
        notifications: [
          {
            id: DUE_ID,
            title: 'WordHive · 该复习了',
            body,
            /* 原生按 yyyy-MM-dd'T'HH:mm:ss.SSS'Z' 解析，toISOString 正好一致 */
            schedule: { at: new Date(Date.now() + 1000).toISOString() },
            autoCancel: true
          }
        ]
      });
      return;
    } catch (_) {
      /* 降级到 Web 通知 */
    }
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('WordHive · 该复习了', { body });
    } catch (_) {
      /* 忽略 */
    }
  }
}

/**
 * 空方案时的兜底槽位。
 *
 * schedulePlan 是「先取消再注册」，拿到空 slots 就等于把提醒全清空 —— 用户清完复习、
 * 或者当天次数已达上限之后，只要不再打开 App 就再也收不到提醒。所以这里兜一条每日提醒：
 * 时间取 plan.peakHour（没有就用 20:00），并沿用 23:00–07:00 静默时段顺延到 08:00。
 *
 * @param {{peakHour?:number}} [plan]
 * @returns {{id:number,hour:number,minute:number,title:string,body:string}}
 */
function fallbackSlot(plan) {
  const h = Number(plan?.peakHour);
  let hour = Number.isFinite(h) ? Math.min(23, Math.max(0, Math.trunc(h))) : 20;
  let minute = 0;
  if (hour >= 23 || hour <= 7) { hour = 8; minute = 0; }
  return {
    id: PLAN_IDS[0],
    hour,
    minute,
    title: 'WordHive · 该复习了',
    body: '打开 WordHive，按记忆曲线安排今天的复习。'
  };
}

/**
 * 按智能方案注册每日通知（仅原生生效）。
 * @param {{slots: Array<{id:number,title:string,body:string,hour:number,minute:number}>, peakHour?:number}} plan
 * @returns {Promise<boolean>} 任一槽位失败返回 false；Web 环境返回 false
 */
export async function schedulePlan(plan) {
  const p = plugin();
  if (!p) return false;
  const cancelIds = [{ id: DAILY_ID }, ...PLAN_IDS.map((id) => ({ id }))];
  try {
    await p.cancel({ notifications: cancelIds });
    const slots = Array.isArray(plan?.slots) ? plan.slots : [];
    /* 空方案不能只取消：至少保留一条每日基线提醒，否则关掉 App 就再无提醒 */
    const targets = slots.length ? slots : [fallbackSlot(plan)];
    for (const slot of targets) {
      await p.schedule({
        notifications: [
          {
            id: slot.id,
            title: slot.title,
            body: slot.body,
            schedule: { every: 'day', on: { hour: slot.hour, minute: slot.minute } },
            sound: null,
            autoCancel: true
          }
        ]
      });
    }
    return true;
  } catch (_) {
    return false;
  }
}

/** 取消智能方案与遗留每日通知 */
export async function cancelPlan() {
  const p = plugin();
  if (!p) return;
  try {
    await p.cancel({
      notifications: [{ id: DAILY_ID }, ...PLAN_IDS.map((id) => ({ id }))]
    });
  } catch (_) {
    /* 忽略：没排过期或原生不可用时无需处理 */
  }
}

/**
 * 智能即时提醒：复用 30 分钟节流与原生/Web 降级；priority 仅作记录，不影响发送。
 * @param {{title?:string, body?:string, priority?:string}} opts
 */
export async function notifySmart({ title, body, priority } = {}) {
  const now = Date.now();
  if (now - lastDueNotify < 30 * 60 * 1000) return;
  lastDueNotify = now;
  lastSmartPriority = priority || null;

  const t = title || 'WordHive · 该复习了';
  const b = body || '打开 WordHive，按记忆曲线安排今天的复习。';
  const p = plugin();
  if (p) {
    try {
      const s = await status();
      if (s.display !== 'granted') return;
      await p.schedule({
        notifications: [
          {
            id: DUE_ID,
            title: t,
            body: b,
            /* 原生按 yyyy-MM-dd'T'HH:mm:ss.SSS'Z' 解析，toISOString 正好一致 */
            schedule: { at: new Date(Date.now() + 1000).toISOString() },
            autoCancel: true
          }
        ]
      });
      return;
    } catch (_) {
      /* 降级到 Web 通知 */
    }
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(t, { body: b });
    } catch (_) {
      /* 忽略 */
    }
  }
}

/** 注册通知点击回调，返回取消订阅函数（不依赖原生事件监听） */
export function onNotificationTap(handler) {
  if (typeof handler !== 'function') return () => {};
  tapHandlers.push(handler);
  return () => {
    const i = tapHandlers.indexOf(handler);
    if (i >= 0) tapHandlers.splice(i, 1);
  };
}

/** 逐个派发通知点击 payload，单个订阅者失败不影响其它 */
export function emitNotificationTap(payload) {
  tapHandlers.slice().forEach((fn) => {
    try {
      fn(payload);
    } catch (_) {
      /* 单个订阅者失败不影响其它 */
    }
  });
}
