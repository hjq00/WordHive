import { icon } from '../core/icons.js';
import { esc, h, toast, confirmSheet, openSheet } from '../core/ui.js';
import * as store from '../core/store.js';
import * as notify from '../core/notify.js';
import { BOOKS } from '../data/books.js';
import { hasLLM } from '../core/ai.js';
import { speechSupported } from '../core/speech.js';
import { sensHint } from '../core/sens.js';

export function createMeView({ onGoReview, onNotifyChange } = {}) {
  const el = h('<div class="screen"></div>');
  let notifState = { display: 'prompt', native: false };
  // 异步读取真实通知权限（原生插件需要 await）
  notify.status().then((st) => { notifState = st; if (el.isConnected) render(); });

  function render() {
    const st = store.getState();
    const s = st.settings;
    const cur = ['green', 'blue', 'gray'].includes(s.palette) ? s.palette : 'green';
    const stats = store.stats();
    const book = store.currentBook();
    const progress = store.bookProgress();
    const notifOn = notifState.display === 'granted';
    const notifPerm = notifState.display;
    const notifHint = notifState.native
      ? (notifOn ? '已授权，App 关闭时也能按设定时间提醒' : '开启后，App 关闭时也能收到每日复习提醒')
      : (notifOn ? '网页环境，仅在前台时提醒' : '未开启，目前只有应用内提醒条');

    el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>我的</h1><p class="sub">${st.demo ? '示例数据 · 可随时清空' : '所有数据保存在本机'}</p></div>
        <button class="icon-btn" data-export aria-label="导出">${icon('download', 18)}</button>
      </div>

      <section class="review-hero" style="background:var(--surface);color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow-sm)">
        <div class="row between" style="position:relative;z-index:1">
          <div>
            <div class="k" style="color:var(--muted)">连续打卡</div>
            <div class="big" style="color:var(--ink);font-size:38px">${stats.streak}<small style="color:var(--muted)">天</small></div>
          </div>
          <div class="row" style="gap:18px;text-align:right">
            <div><b style="font-size:19px;display:block">${stats.totalLearned}</b><span class="tiny muted">累计学词</span></div>
            <div><b style="font-size:19px;display:block">${stats.favCount}</b><span class="tiny muted">收藏</span></div>
          </div>
        </div>
        <div class="desc" style="color:var(--muted);margin-top:8px;position:relative;z-index:1">
          今日新学 ${stats.today.learn} · 复习 ${stats.today.review} · 待复习 ${stats.dueCount}
        </div>
      </section>

      <div class="section-title">当前词书</div>
      <button class="book-card on" data-book>
        <span class="cover" style="background:${book.color}">${esc(book.short)}</span>
        <span class="info">
          <b>${esc(book.name)}</b>
          <span>${esc(book.subtitle)} · ${progress.total} 词 · 已学 ${progress.learned}</span>
          <span class="prog"><i style="width:${Math.round(progress.pct * 100)}%"></i></span>
        </span>
        <span class="chev" style="color:var(--line-strong)">${icon('chevronRight', 16)}</span>
      </button>

      <div class="section-title">学习设置</div>
      <div class="card" style="padding:4px 16px">
        <div class="setting">
          <div class="lbl"><b>弹性计划</b><span>不设每日配额，随时开始、随时停下</span></div>
          <button class="switch ${s.flexible ? 'on' : ''}" data-switch="flexible" aria-label="弹性计划"></button>
        </div>
        <div class="setting">
          <div class="lbl"><b>${s.flexible ? '每组新词' : '每日新词'}</b><span>${s.flexible ? '一组刷完可以停，也可以再来一组' : '超过这个量，学习页会提示先复习'}</span></div>
          <input type="number" min="5" max="100" step="5" value="${s.dailyNew}" data-daily>
        </div>
        <div class="setting">
          <div class="lbl"><b>复习提醒</b><span>每天到这个时间，提醒今天到期的词</span></div>
          <input type="time" value="${esc(s.remindAt)}" data-remind>
        </div>
        <div class="setting">
          <div class="lbl"><b>系统通知</b><span>${notifHint}</span></div>
          ${notifOn ? '<span class="chip accent">已开启</span>' : notifPerm === 'unsupported' ? '<span class="chip">不支持</span>' : notifPerm === 'denied' ? '<span class="chip">已被拒绝，请在系统设置中开启</span>' : `<button class="chip-btn" data-notify>开启通知</button>`}
        </div>
        <div class="setting">
          <div class="lbl"><b>智能提醒时间</b><span>按你的复习高峰自动选提醒时间</span></div>
          <button class="switch ${s.notifySmart !== false ? 'on' : ''}" data-switch="notifySmart" aria-label="智能提醒时间"></button>
        </div>
        <div class="setting">
          <div class="lbl"><b>每日提醒次数</b><span>一天最多提醒几次</span></div>
          <select data-notify-max style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            ${[1, 2, 3].map((n) => `<option value="${n}" ${Number(s.notifyMax) === n ? 'selected' : ''}>${n} 次</option>`).join('')}
          </select>
        </div>
        <div class="setting">
          <div class="lbl"><b>提醒语气</b><span>通知文案的口吻</span></div>
          <select data-notify-tone style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            <option value="gentle" ${(s.notifyTone || 'gentle') === 'gentle' ? 'selected' : ''}>温和</option>
            <option value="lively" ${s.notifyTone === 'lively' ? 'selected' : ''}>轻快</option>
            <option value="plain" ${s.notifyTone === 'plain' ? 'selected' : ''}>简洁</option>
          </select>
        </div>
        <div class="setting">
          <div class="lbl"><b>目标保持率</b><span>影响间隔拉长的速度</span></div>
          <select data-target style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            ${[0.85, 0.9, 0.95].map((r) => `<option value="${r}" ${Number(s.targetRetention || 0.9) === r ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}
          </select>
        </div>
        <div class="setting">
          <div class="lbl"><b>停留判定</b><span>${sensHint(s.sensitivity)}</span></div>
          <select data-sens style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            <option value="loose" ${s.sensitivity === 'loose' ? 'selected' : ''}>宽松</option>
            <option value="standard" ${s.sensitivity === 'standard' ? 'selected' : ''}>标准</option>
            <option value="strict" ${s.sensitivity === 'strict' ? 'selected' : ''}>严格</option>
          </select>
        </div>
        <div class="setting">
          <div class="lbl"><b>显示停留计时</b><span>词卡右上角的判定环</span></div>
          <button class="switch ${s.showDwell ? 'on' : ''}" data-switch="showDwell" aria-label="显示停留计时"></button>
        </div>
        <div class="setting">
          <div class="lbl"><b>深色模式</b><span>夜间背词更护眼</span></div>
          <button class="switch ${s.dark ? 'on' : ''}" data-switch="dark" aria-label="深色模式"></button>
        </div>
        <div class="setting palette-setting">
          <div class="lbl"><b>颜色系统</b><span>绿 / 蓝 / 灰，随你喜欢</span></div>
          <div class="palette-row" role="radiogroup" aria-label="颜色系统">
            <button class="palette-opt${cur === 'green' ? ' on' : ''}" data-palette-opt="green" role="radio" aria-checked="${cur === 'green'}">
              <i style="background:#1E8A5F"></i><span>绿</span>
            </button>
            <button class="palette-opt${cur === 'blue' ? ' on' : ''}" data-palette-opt="blue" role="radio" aria-checked="${cur === 'blue'}">
              <i style="background:#23689E"></i><span>蓝</span>
            </button>
            <button class="palette-opt${cur === 'gray' ? ' on' : ''}" data-palette-opt="gray" role="radio" aria-checked="${cur === 'gray'}">
              <i style="background:#4A5551"></i><span>灰</span>
            </button>
          </div>
        </div>
        <div class="setting">
          <div class="lbl"><b>换词自动朗读</b><span>${speechSupported() ? '依次朗读单词和例句，不计入判定' : '当前浏览器不支持发音'}</span></div>
          <button class="switch ${s.autoSpeak ? 'on' : ''}" data-switch="autoSpeak" aria-label="换词自动朗读"></button>
        </div>
        <div class="setting">
          <div class="lbl"><b>默认口音</b><span>串播与例句默认口音；词卡上的 US / UK 按钮可单独覆盖</span></div>
          <select data-accent style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            <option value="us" ${s.accent !== 'uk' ? 'selected' : ''}>美音 US</option>
            <option value="uk" ${s.accent === 'uk' ? 'selected' : ''}>英音 UK</option>
          </select>
        </div>
        <div class="setting col">
          <div class="lbl"><b>视频课地址</b><span>默认已接入云端视频；如需换成自己的存储，填直链前缀（结尾不要带斜杠）</span></div>
          <input type="url" data-videobase inputmode="url" autocapitalize="off" spellcheck="false"
            value="${esc(s.videoBase || '')}" placeholder="留空使用内置云端视频"
            style="width:100%;margin-top:8px;padding:9px 11px;border-radius:10px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px" />
        </div>
        <div class="setting">
          <div class="lbl"><b>真人在线发音</b><span>${speechSupported() ? '单词优先用英美录音，失败时回退系统语音' : '当前浏览器不支持发音'}</span></div>
          <button class="switch ${s.onlineVoice !== false ? 'on' : ''}" data-switch="onlineVoice" aria-label="真人在线发音"></button>
        </div>
        <div class="setting">
          <div class="lbl"><b>发音语速</b><span>${speechSupported() ? '使用系统语音合成' : '当前浏览器不支持发音'}</span></div>
          <select data-rate style="width:90px;padding:7px 8px;border-radius:9px;border:1px solid var(--line-strong);background:var(--surface);font-size:12.5px">
            ${[0.75, 0.9, 1, 1.15].map((r) => `<option value="${r}" ${Number(s.ttsRate) === r ? 'selected' : ''}>${r}×</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="section-title">大模型（可选）</div>
      <div class="card" style="padding:16px">
        <p class="tiny" style="margin:0 0 12px;color:var(--muted);line-height:1.65">
          填入任意 OpenAI 兼容接口即可让 AI 生成更自然的文章。密钥只存在本机浏览器，不会上传。
          ${hasLLM(s) ? '<span class="chip accent" style="margin-left:4px">已配置</span>' : '<span class="chip" style="margin-left:4px">未配置 · 使用本地引擎</span>'}
        </p>
        <div class="field">
          <label>接口地址</label>
          <input type="text" data-api="base" value="${esc(s.api.base)}" placeholder="https://api.openai.com/v1" autocomplete="off">
        </div>
        <div class="field">
          <label>模型</label>
          <input type="text" data-api="model" value="${esc(s.api.model)}" placeholder="gpt-4o-mini / deepseek-chat" autocomplete="off">
        </div>
        <div class="field" style="margin-bottom:10px">
          <label>API Key</label>
          <input type="text" data-api="key" value="${esc(s.api.key)}" placeholder="sk-..." autocomplete="off">
        </div>
        <button class="btn ghost block" data-save-api>保存接口配置</button>
      </div>

      <div class="section-title">数据</div>
      <div class="card" style="padding:4px 16px">
        <button class="setting" style="width:100%;text-align:left" data-export-row>
          <div class="lbl"><b>导出备份</b><span>下载 JSON，换设备也能恢复</span></div>
          ${icon('download', 18)}
        </button>
        <button class="setting" style="width:100%;text-align:left" data-import-row>
          <div class="lbl"><b>导入备份</b><span>合并覆盖当前进度</span></div>
          ${icon('upload', 18)}
        </button>
        <button class="setting" style="width:100%;text-align:left" data-demo-row>
          <div class="lbl"><b>载入示例进度</b><span>看复习与统计页的真实样子</span></div>
          ${icon('sparkles', 18)}
        </button>
        <button class="setting" style="width:100%;text-align:left" data-reset-row>
          <div class="lbl"><b style="color:var(--rose)">清空所有数据</b><span>包含词书进度、收藏与设置</span></div>
          ${icon('trash', 18)}
        </button>
      </div>
      <input type="file" accept="application/json" data-file hidden>

      <div class="section-title">关于</div>
      <div class="card" style="padding:16px">
        <div class="row between" style="align-items:baseline">
          <b style="font-size:16px;letter-spacing:0.2px">WordHive</b>
          <span class="tiny muted">v1.0</span>
        </div>
        <p class="small" style="margin:6px 0 10px;line-height:1.7">把单词酿成记忆。</p>
        <p class="tiny muted" style="margin:0;line-height:1.75">
          hive 是蜂巢。零散的单词像花蜜，一次背完往往留不住；靠一次次回访、每次只取一点，
          才慢慢酿成长期记忆。这个应用就按这个节奏，安排你和单词的每一次碰面。
        </p>
      </div>

      <div class="card" style="padding:4px 16px">
        <div class="setting">
          <div class="lbl"><b>停留即判定</b><span style="font-size:12px;line-height:1.6">在一个词上停留多久，就自动记为认识、模糊或不认识，不用手点。</span></div>
        </div>
        <div class="setting">
          <div class="lbl"><b>间隔复习（FSRS 风格：稳定性 / 难度 / 可提取性）</b><span style="font-size:12px;line-height:1.6">按遗忘曲线安排回访，第二天的复习比第二十天重要得多。</span></div>
        </div>
        <div class="setting">
          <div class="lbl"><b>语境素材</b><span style="font-size:12px;line-height:1.6">真题阅读、听力与长难句，按考研一、考研二、六级分类。</span></div>
        </div>
        <div class="setting">
          <div class="lbl"><b>词条详解</b><span style="font-size:12px;line-height:1.6">联想、词根词缀、派生、正反义与短语，左右滑动查看。</span></div>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <p class="tiny" style="margin:0 0 8px;color:var(--ink);line-height:1.7;font-weight:600">数据来源</p>
        <p class="tiny" style="margin:0;color:var(--muted);line-height:1.7">
          词库释义参考 ECDICT（MIT License）及公开考研词汇资料整理；真题阅读、听力与长难句据公开真题语境改写，用于教学演示。发音由系统语音合成提供，不同设备音色会有差异。
        </p>
      </div>
      <p class="tiny center" style="color:var(--muted);margin:20px 0 0">数据保存在本机 · 换设备请先导出备份</p>
    </div>`;

    bind();
  }

  function bind() {
    el.querySelectorAll('[data-palette-opt]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const p = btn.dataset.paletteOpt;
        if (!['green', 'blue', 'gray'].includes(p) || p === store.getState().settings.palette) return;
        store.setSetting('palette', p);
        document.documentElement.dataset.palette = p;
        render();
        toast(p === 'green' ? '已切换到绿色系' : p === 'blue' ? '已切换到蓝色系' : '已切换到灰色系');
      })
    );
    el.querySelectorAll('[data-switch]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const key = btn.dataset.switch;
        const next = !store.getState().settings[key];
        store.setSetting(key, next);
        if (key === 'dark') document.documentElement.dataset.theme = next ? 'dark' : 'light';
        if (key === 'notifySmart') onNotifyChange?.();
        render();
      })
    );
    el.querySelector('[data-daily]')?.addEventListener('change', (e) => {
      const v = Math.max(5, Math.min(100, Number(e.target.value) || 20));
      store.setSetting('dailyNew', v);
      toast(`每日新词设为 ${v}`);
      render();
    });
    el.querySelector('[data-remind]')?.addEventListener('change', async (e) => {
      const value = e.target.value || '20:00';
      store.setSetting('remindAt', value);
      const perm = await notify.status();
      if (perm.display === 'granted') {
        onNotifyChange?.();
        toast(perm.native ? `每日提醒已设为 ${value}` : `已设为 ${value}（打开应用时生效）`);
      } else {
        toast(`提醒时间 ${value}，开启系统通知后生效`);
      }
    });
    el.querySelector('[data-notify]')?.addEventListener('click', async () => {
      const granted = await notify.request();
      notifState = await notify.status();
      /* 用户已经走过一次授权流程（无论同意还是拒绝），启动时不再自动弹系统框 */
      store.setSetting('notifyAsked', true);
      if (granted) {
        onNotifyChange?.();
        toast('已开启：每天到点提醒，App 关闭也有效');
      } else {
        toast('未授权，仍会在应用内提醒');
      }
      render();
    });
    el.querySelector('[data-sens]')?.addEventListener('change', (e) => {
      store.setSetting('sensitivity', e.target.value);
      toast('判定灵敏度已更新');
      render();
    });
    el.querySelector('[data-notify-max]')?.addEventListener('change', (e) => {
      store.setSetting('notifyMax', Number(e.target.value));
      onNotifyChange?.();
      toast(`每日提醒设为 ${e.target.value} 次`);
    });
    el.querySelector('[data-notify-tone]')?.addEventListener('change', (e) => {
      store.setSetting('notifyTone', e.target.value);
      onNotifyChange?.();
      toast('提醒语气已更新');
    });
    el.querySelector('[data-target]')?.addEventListener('change', (e) => {
      store.setSetting('targetRetention', Number(e.target.value));
      onNotifyChange?.();
      toast(`目标保持率设为 ${Math.round(Number(e.target.value) * 100)}%`);
    });
    el.querySelector('[data-accent]')?.addEventListener('change', (e) => {
      const accent = e.target.value === 'uk' ? 'uk' : 'us';
      store.setSetting('accent', accent);
      toast(accent === 'uk' ? '默认口音已设为英音 UK' : '默认口音已设为美音 US');
    });
    const vbase = el.querySelector('[data-videobase]');
    if (vbase) {
      const save = () => {
        const v = vbase.value.trim().replace(/\/+$/, '');
        if (v === (store.getState().settings.videoBase || '')) return;
        store.setSetting('videoBase', v);
        toast(v ? '视频课地址已保存' : '已清空视频课地址');
      };
      vbase.addEventListener('change', save);
      vbase.addEventListener('blur', save);
      vbase.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); vbase.blur(); } });
    }
    el.querySelector('[data-rate]')?.addEventListener('change', (e) => {
      store.setSetting('ttsRate', Number(e.target.value));
    });
    el.querySelector('[data-save-api]')?.addEventListener('click', () => {
      const api = {
        base: el.querySelector('[data-api="base"]').value.trim(),
        model: el.querySelector('[data-api="model"]').value.trim(),
        key: el.querySelector('[data-api="key"]').value.trim()
      };
      store.setSetting('api', api);
      toast(api.base && api.key ? '接口已保存，生成时会优先调用' : '未填写完整，继续使用本地引擎');
      render();
    });
    el.querySelector('[data-export]')?.addEventListener('click', () => store.exportData());
    el.querySelector('[data-export-row]')?.addEventListener('click', () => store.exportData());
    el.querySelector('[data-import-row]')?.addEventListener('click', () => el.querySelector('[data-file]').click());
    el.querySelector('[data-file]')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await store.importData(file);
        toast('已导入备份');
        render();
      } catch {
        toast('文件格式不正确');
      }
    });
    el.querySelector('[data-demo-row]')?.addEventListener('click', () => {
      store.seedDemo();
      toast('已载入示例进度');
      render();
    });
    el.querySelector('[data-reset-row]')?.addEventListener('click', async () => {
      const ok = await confirmSheet({
        title: '清空所有数据？',
        text: '词书进度、收藏、复习记录与设置都会被删除，且无法恢复。建议先导出备份。',
        confirmText: '清空',
        danger: true
      });
      if (ok) {
        store.resetAll();
        render();
        toast('已清空');
      }
    });
    el.querySelector('[data-book]')?.addEventListener('click', () => {
      const content = h(`<div class="book-list">
        ${BOOKS.map((b) => {
          const p = store.bookProgress(b.id);
          const on = store.getState().settings.bookId === b.id;
          return `<button class="book-card ${on ? 'on' : ''}" data-b="${b.id}">
            <span class="cover" style="background:${b.color}">${esc(b.short)}</span>
            <span class="info"><b>${esc(b.name)}</b><span>${p.total} 词 · 已学 ${p.learned}</span>
            <span class="prog"><i style="width:${Math.round(p.pct * 100)}%;background:${b.color}"></i></span></span>
          </button>`;
        }).join('')}
      </div>`);
      const sheet = openSheet({ title: '选择单词书', content });
      content.querySelectorAll('[data-b]').forEach((btn) =>
        btn.addEventListener('click', () => {
          store.switchBook(btn.dataset.b);
          sheet.close();
          render();
        })
      );
    });
  }

  render();
  return { el, destroy() {}, rerender: render };
}
