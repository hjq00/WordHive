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
let lastDueNotify = 0;

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

export function onNotificationTap(handler) {
  // 原生回调在 App 内由 Capacitor 处理，这里保留接口
  return () => {};
}
