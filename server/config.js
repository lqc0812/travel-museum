// 统一配置：运行目录、上传目录、以及是否启用 Cloudflare R2 外部存储
const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';
// 运行目录：打包成 exe 时资源放在 exe 同目录；开发时放在项目根目录
const runtimeDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Cloudflare R2 配置（全部来自环境变量；缺任一则不启用 R2，回退本地存储）
const r2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''), // 例如 https://xxx.r2.dev
};
const useR2 = !!(
  r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket && r2.publicUrl
);

// 本地存储路径（仅本地模式使用）
const uploadsDir = process.env.UPLOADS_DIR || path.join(runtimeDir, 'uploads');
const dbPath = process.env.DB_PATH
  ? process.env.DB_PATH.replace(/\.db$/i, '.json')
  : path.join(runtimeDir, 'data', 'museum.json');

// R2 客户端（仅启用 R2 时创建）
let s3 = null;
if (useR2) {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
  console.log('☁️  已启用 Cloudflare R2 外部存储（bucket: ' + r2.bucket + '）');
} else {
  console.log('💾  使用本地存储（未配置 R2；exe 本地运行 / 局域网访问时用此模式）');
}

module.exports = { isPkg, runtimeDir, uploadsDir, dbPath, r2, useR2, s3 };
