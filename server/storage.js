// 图片存储：把前端传来的 base64 解码后写入存储层，返回可访问的地址。
// 双模式：R2 模式写入 Cloudflare R2 并返回公网 URL；本地模式写入 uploads 目录并返回 /uploads/xxx。
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uploadsDir, r2, useR2, s3 } = require('./config');

// 解码 data URL 为 { ext, buf }，并校验大小
function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error('图片格式无效');
  const ext = (m[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 15 * 1024 * 1024) throw new Error('文件过大（最大 15MB）');
  return { ext, buf };
}

// 保存图片，返回可访问地址（R2 模式为 https 公网地址，本地模式为 /uploads/xxx）
async function saveImage(dataUrl) {
  const { ext, buf } = decodeDataUrl(dataUrl);
  const fname = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  if (useR2) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new PutObjectCommand({
      Bucket: r2.bucket, Key: `uploads/${fname}`, Body: buf, ContentType: `image/${ext}`
    }));
    return `${r2.publicUrl}/uploads/${fname}`;
  }
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, fname), buf);
  return `/uploads/${fname}`;
}

// 删除图片：R2 模式按 key 删除；本地模式按文件名删除
async function deleteImage(ref) {
  if (!ref) return;
  if (useR2) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    let key = ref;
    if (ref.startsWith(r2.publicUrl)) key = ref.slice(r2.publicUrl.length + 1);
    else key = ref.replace(/^\/+/, '');
    try { await s3.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key })); }
    catch { /* 忽略不存在的对象 */ }
  } else {
    const fp = path.join(uploadsDir, path.basename(ref));
    try { fs.unlinkSync(fp); } catch { /* 忽略 */ }
  }
}

// 保存缩略图（网格用，体积更小），返回可访问地址。命名以 thumb- 前缀区分。
async function saveThumb(dataUrl) {
  const { ext, buf } = decodeDataUrl(dataUrl);
  const fname = `thumb-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  if (useR2) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new PutObjectCommand({
      Bucket: r2.bucket, Key: `uploads/${fname}`, Body: buf, ContentType: `image/${ext}`
    }));
    return `${r2.publicUrl}/uploads/${fname}`;
  }
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, fname), buf);
  return `/uploads/${fname}`;
}

module.exports = { saveImage, saveThumb, deleteImage };
