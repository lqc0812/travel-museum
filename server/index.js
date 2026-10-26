const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const db = require('./db');
const { saveImage, deleteImage } = require('./storage');
const { uploadsDir, useR2, runtimeDir } = require('./config');
const { verifyPassword, signToken, verifyToken } = require('./auth');

// 从运行目录加载 .env（双击 exe 即 exe 同目录，方便配置密码 / R2）
require('dotenv').config({ path: path.join(runtimeDir, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

fs.mkdirSync(uploadsDir, { recursive: true });

// 静态资源：前端页面 + 本地上传的图片；JSON 请求体上限放宽以容纳 base64 图片
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 管理员鉴权中间件
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (verifyToken(token)) return next();
  return res.status(401).json({ error: '未授权' });
}

/* ============ 公开接口（访客无需登录） ============ */

app.get('/api/sections', (req, res) => res.json(db.listSections()));

app.get('/api/sections/:id', (req, res) => {
  const row = db.getSection(Number(req.params.id));
  if (!row) return res.status(404).json({ error: '展区不存在' });
  res.json(row);
});

app.get('/api/sections/:id/photos', (req, res) => res.json(db.listPhotos(Number(req.params.id))));

/* ============ 管理员接口（需 token） ============ */

// 登录：校验密码后返回 token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (verifyPassword(password)) return res.json({ token: signToken() });
  return res.status(401).json({ error: '密码错误' });
});

// 校验当前 token 是否有效
app.get('/api/admin/check', requireAuth, (req, res) => res.json({ ok: true }));

// 新建展区（封面以 base64 传入，可选）
app.post('/api/sections', requireAuth, async (req, res) => {
  try {
    const { title, location, year, description, sort_order, cover } = req.body || {};
    if (!title) return res.status(400).json({ error: '标题必填' });
    let cover_image = null;
    if (cover) cover_image = await saveImage(cover);
    const row = db.createSection({
      title, location: location || null, year: year || null,
      description: description || null, cover_image, sort_order: sort_order ? parseInt(sort_order) : 0
    });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 编辑展区
app.put('/api/sections/:id', requireAuth, async (req, res) => {
  try {
    const existing = db.getSection(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: '展区不存在' });
    const { title, location, year, description, sort_order, cover, coverAction } = req.body || {};
    let cover_image = existing.cover_image;
    if (cover) { await deleteImage(existing.cover_image); cover_image = await saveImage(cover); }
    else if (coverAction === 'remove') { await deleteImage(existing.cover_image); cover_image = null; }
    const row = db.updateSection(Number(req.params.id), {
      title, location: location || null, year: year || null,
      description: description || null, cover_image,
      sort_order: sort_order ? parseInt(sort_order) : existing.sort_order
    });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 删除展区（连带删除其照片与图片文件）
app.delete('/api/sections/:id', requireAuth, async (req, res) => {
  try {
    const existing = db.getSection(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: '展区不存在' });
    const photos = db.listPhotos(Number(req.params.id));
    for (const p of photos) await deleteImage(p.image_path);
    await deleteImage(existing.cover_image);
    db.deleteSection(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 向某展区上传照片（image 为 base64，必填）
app.post('/api/sections/:id/photos', requireAuth, async (req, res) => {
  try {
    const { title, location, shot_date, description, sort_order, image } = req.body || {};
    if (!image) return res.status(400).json({ error: '请选择图片' });
    const section = db.getSection(Number(req.params.id));
    if (!section) return res.status(404).json({ error: '展区不存在' });
    const image_path = await saveImage(image);
    const row = db.createPhoto({
      section_id: Number(req.params.id),
      title: title || null, location: location || null, shot_date: shot_date || null,
      description: description || null, image_path, sort_order: sort_order ? parseInt(sort_order) : 0
    });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 编辑照片（image 可选，传入则替换）
app.put('/api/photos/:id', requireAuth, async (req, res) => {
  try {
    const p = db.getPhoto(Number(req.params.id));
    if (!p) return res.status(404).json({ error: '照片不存在' });
    const { title, location, shot_date, description, sort_order, image } = req.body || {};
    let image_path = p.image_path;
    if (image) { await deleteImage(p.image_path); image_path = await saveImage(image); }
    const patch = {
      title: title !== undefined ? title : p.title,
      location: location !== undefined ? location : p.location,
      shot_date: shot_date !== undefined ? shot_date : p.shot_date,
      description: description !== undefined ? description : p.description,
      image_path,
      sort_order: sort_order !== undefined ? parseInt(sort_order) : p.sort_order,
    };
    res.json(db.updatePhoto(Number(req.params.id), patch));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 删除照片
app.delete('/api/photos/:id', requireAuth, async (req, res) => {
  try {
    const p = db.getPhoto(Number(req.params.id));
    if (!p) return res.status(404).json({ error: '照片不存在' });
    await deleteImage(p.image_path);
    db.deletePhoto(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 启动：先载入数据（R2 或本地），再监听端口
db.init().then(() => {
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`🏛  旅行博物馆运行中： ${url}`);
    // 打印局域网地址，方便同一 WiFi 下的手机访问（本地模式）
    const lan = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal);
    if (lan) console.log(`📱 手机同 WiFi 访问： http://${lan.address}:${PORT}`);
    console.log(`🗄  存储模式： ${useR2 ? 'Cloudflare R2（云端持久）' : '本地文件'}`);
    // 打包成 exe 双击启动时，自动打开浏览器
    if (typeof process.pkg !== 'undefined' || process.env.OPEN_BROWSER) {
      const { exec } = require('child_process');
      const cmd = process.platform === 'win32'
        ? `cmd /c start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      setTimeout(() => exec(cmd, () => {}), 800);
    }
  });
});
