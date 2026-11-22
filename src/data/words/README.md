# 词库数据放置说明

本仓库不包含词库数据。词库由纸质资料扫描重建，版权状态待确认，因此不随源码公开。

如需本地运行，请自行准备以下 5 个 ES Module 文件：

| 路径 | 导出名 | 类型 |
|---|---|---|
| `src/data/words/kaoyan-5500.js` | `KAOYAN_5500` | 数组 |
| `src/data/words/hongbao.js` | `HONGBAO_OCR` | 数组 |
| `src/data/words/cet6-days.js` | `CET6_DAYS` | 数组 |
| `src/data/words/zhenti-words.js` | `ZHENTI_WORDS` | 数组 |
| `src/data/enrichment.js` | `ENRICHMENT` | 字典（key 为单词） |

词条最小结构：

```js
export const KAOYAN_5500 = [
  { w: 'abandon', ph: '/əˈbændən/', defs: [['v.', '放弃']], note: '来源说明' }
];
```

准备完成后，把 `src/data/` 同步到 `www/src/data/`，再执行 `npx cap sync android`。

另外，视频课默认指向一个公开的 Cloudflare R2 地址；如需换成自己的存储，在 App「我的 → 视频课地址」填入直链前缀即可。
