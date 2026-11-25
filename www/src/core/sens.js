/**
 * 停留判定档位的唯一数据源。
 *
 * 语义约定（**不要改反**）：`decide()` 用 `sec <= fast` 判「认识」，所以
 * 阈值越**大**越容易判成认识 → 越大越**宽容**。因此必须满足：
 *   loose.fast > standard.fast > strict.fast
 *   loose.slow > standard.slow > strict.slow
 *
 * 历史上把档位表复制在 views/study.js 与 views/me.js 两处，且 loose.fast(1.1)
 * 反而小于 standard.fast(2.3)，导致「宽松」比「标准」更严格。这里收敛成一份，
 * 界面文案（me.js 的 hint）也从同一份数据取，避免再次漂移。
 */
export const SENS = {
  loose: { fast: 3.2, slow: 8, name: '宽松', hint: '3.2s / 8s，更宽容' },
  standard: { fast: 2.3, slow: 6, name: '标准', hint: '2.3s / 6s，推荐' },
  strict: { fast: 1.5, slow: 4, name: '严格', hint: '1.5s / 4s，更敏感' }
};

export const SENS_KEYS = ['loose', 'standard', 'strict'];

/** 未知/缺失档位统一回退到标准档 */
export const SENS_FALLBACK = 'standard';

/**
 * 取当前设置对应的档位阈值。
 *
 * @param {{sensitivity?: string}} [settings]
 * @returns {{fast:number, slow:number, name:string, hint:string}}
 */
export function sensOf(settings) {
  return SENS[settings?.sensitivity] || SENS[SENS_FALLBACK];
}

/**
 * 取档位的一句话说明（给「我的 → 停留判定」用）。
 *
 * @param {string} key 档位 key
 * @returns {string}
 */
export function sensHint(key) {
  return (SENS[key] || SENS[SENS_FALLBACK]).hint;
}
