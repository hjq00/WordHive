#!/usr/bin/env node
/**
 * 把视频文件夹上传到 Cloudflare R2（S3 兼容协议）。
 *
 * 用法：
 *   1) 在项目根目录建 .env.r2（不要提交到仓库），内容：
 *        R2_ACCOUNT_ID=xxxxxxxxxxxxxxxx
 *        R2_ACCESS_KEY_ID=xxxxxxxx
 *        R2_SECRET_ACCESS_KEY=xxxxxxxx
 *        R2_BUCKET=qingci-videos
 *        R2_PREFIX=videos            # 可选，默认 videos
 *   2) node scripts/r2-upload.mjs "考研英语核心母词990（10小时刷完）"
 *
 * 脚本会逐个 PUT 到 s3://<bucket>/<prefix>/<文件名>，并打印进度。
 * 只依赖 Node 内置模块（crypto / fs / path），无需 npm install。
 */

import { createHash, createHmac } from 'node:crypto';
import { setDefaultResultOrder } from 'node:dns';

/* 本机 IPv6 不可用，DNS 若返回 AAAA 会先尝试 IPv6 并超时（ENETUNREACH），
   表现为 fetch failed / ETIMEDOUT。强制优先 IPv4 可显著减少这类失败。 */
try { setDefaultResultOrder('ipv4first'); } catch {}
import { createReadStream, readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/* ---------- 读取配置 ---------- */
function loadEnv() {
  const cfg = { ...process.env };
  if (existsSync('.env.r2')) {
    for (const line of readFileSync('.env.r2', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        // 允许行内注释：值写完后接 # 说明，取 # 之前的内容
        const raw = m[2].split('#')[0].trim();
        cfg[m[1]] = raw.replace(/^["']|["']$/g, '');
      }
    }
  }
  const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const miss = need.filter((k) => !cfg[k]);
  if (miss.length) {
    console.error('缺少配置：' + miss.join(', ') + '\n请在项目根目录创建 .env.r2 并填写。');
    process.exit(2);
  }
  return cfg;
}

/* ---------- AWS SigV4 ---------- */
const encSeg = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256Hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

function signV4({ method, host, path, region = 'auto', service = 's3', accessKey, secretKey, headers, payloadHash }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const allHeaders = {
    ...headers,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };

  const sortedKeys = Object.keys(allHeaders).map((k) => k.toLowerCase()).sort();
  const lower = {};
  for (const [k, v] of Object.entries(allHeaders)) lower[k.toLowerCase()] = String(v).trim();

  const canonicalHeaders = sortedKeys.map((k) => `${k}:${lower[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  let k = hmac('AWS4' + secretKey, dateStamp);
  k = hmac(k, region);
  k = hmac(k, service);
  k = hmac(k, 'aws4_request');
  const signature = createHmac('sha256', k).update(stringToSign).digest('hex');

  return {
    ...headers,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

/* ---------- 单个文件上传 ---------- */
async function putObject(cfg, key, filePath) {
  const size = statSync(filePath).size;
  const host = `${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = '/' + [cfg.R2_BUCKET, ...key.split('/').map(encSeg)].join('/');

  const payloadHash = 'UNSIGNED-PAYLOAD';
  const baseHeaders = {
    'content-length': String(size),
    'content-type': 'video/mp4',
    'cache-control': 'public, max-age=31536000'
  };

  const signed = signV4({
    method: 'PUT',
    host,
    path,
    accessKey: cfg.R2_ACCESS_KEY_ID,
    secretKey: cfg.R2_SECRET_ACCESS_KEY,
    headers: baseHeaders,
    payloadHash
  });

  const res = await fetch(`https://${host}${path}`, {
    method: 'PUT',
    headers: signed,
    body: createReadStream(filePath),
    duplex: 'half'
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  return size;
}

/** 带重试的 PUT：网络抖动在跨境传输里很常见，失败退避后重来 */
async function putWithRetry(cfg, key, filePath, maxTry = 5) {
  let last;
  for (let attempt = 1; attempt <= maxTry; attempt++) {
    try {
      return await putObject(cfg, key, filePath);
    } catch (e) {
      last = e;
      if (attempt < maxTry) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw last;
}

/* ---------- HEAD：判断对象是否已上传（大小一致才算） ---------- */
async function headObject(cfg, key, size) {
  const host = `${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = '/' + [cfg.R2_BUCKET, ...key.split('/').map(encSeg)].join('/');
  const payloadHash = sha256Hex('');              // HEAD 用空串哈希
  const signed = signV4({
    method: 'HEAD', host, path,
    accessKey: cfg.R2_ACCESS_KEY_ID,
    secretKey: cfg.R2_SECRET_ACCESS_KEY,
    headers: {}, payloadHash
  });
  try {
    const res = await fetch(`https://${host}${path}`, { method: 'HEAD', headers: signed });
    if (!res.ok) return false;
    const len = Number(res.headers.get('content-length'));
    return !len || len === size;                  // 大小一致才跳过
  } catch {
    return false;                                 // 探测失败就当没传过
  }
}

/* ---------- 主流程 ---------- */
const srcDir = process.argv[2] || '考研英语核心母词990（10小时刷完）';
if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
  console.error('目录不存在：' + srcDir);
  process.exit(2);
}

const cfg = loadEnv();
const prefix = (cfg.R2_PREFIX || 'videos').replace(/^\/+|\/+$/g, '');
const files = readdirSync(srcDir).filter((f) => /\.(mp4|m4v|webm)$/i.test(f)).sort((a, b) => {
  const na = parseInt(a, 10) || 0, nb = parseInt(b, 10) || 0;
  return na - nb;
});

const total = files.reduce((n, f) => n + statSync(join(srcDir, f)).size, 0);
console.log(`待上传 ${files.length} 个文件，共 ${(total / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`目标：s3://${cfg.R2_BUCKET}/${prefix}/\n`);

let done = 0, bytes = 0;
const failed = [];
const CONCURRENCY = 2;
let cursor = 0;

async function worker(id) {
  while (cursor < files.length) {
    const i = cursor++;
    const name = files[i];
    const key = `${prefix}/${name}`;
    const t0 = Date.now();
    try {
      const localSize = statSync(join(srcDir, name)).size;
      if (await headObject(cfg, key, localSize)) {
        done++;
        bytes += localSize;
        console.log(`[跳过] 已存在  ${name}`);
        continue;
      }
      const size = await putWithRetry(cfg, key, join(srcDir, name));
      bytes += size;
      done++;
      const mb = (size / 1024 / 1024).toFixed(1);
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${String(done).padStart(2)}/${files.length}] ${mb}MB ${sec}s  ${name}`);
    } catch (e) {
      const cause = e.cause ? ` [${e.cause.code || e.cause.message || e.cause}]` : '';
      failed.push({ name, err: String(e.message || e) + cause });
      console.error(`[失败] ${name} → ${e.message || e}${cause}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, (_, i) => worker(i)));

console.log(`\n完成：成功 ${done} / ${files.length}，累计 ${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
if (failed.length) {
  console.log('失败清单：');
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.err}`));
  process.exit(1);
}

/* ---------- 提示 App 端地址 ---------- */
console.log(`
下一步：在 App「我的 → 视频课地址」填入下面这一行（按你 R2 的公开访问方式二选一）：
  r2.dev 子域     https://<你的-r2-dev-子域>.r2.dev/${prefix}
  自定义域名      https://你的域名/${prefix}
`);
