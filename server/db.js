// 数据层：展区与照片的增删改查。
// 双模式：配置了 R2 时把 museum.json 存到 Cloudflare R2（持久、免费、出站零流量费）；
// 未配置时存本地 JSON 文件（exe 本地 / 局域网模式）。
const fs = require('fs');
const { dbPath, r2, useR2, s3 } = require('./config');

const DATA_KEY = 'museum.json'; // R2 中存放数据库对象的 key

let data = { sections: [], photos: [], _seq: { sections: 0, photos: 0 } };

// 启动时载入数据（R2 模式为异步）
async function init() {
  if (useR2) {
    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const res = await s3.send(new GetObjectCommand({ Bucket: r2.bucket, Key: DATA_KEY }));
      const body = await res.Body.transformToString();
      data = JSON.parse(body);
      console.log('📦  已从 R2 载入数据');
    } catch (e) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        console.log('📦  R2 中暂无数据，初始化空库');
      } else {
        console.error('⚠️  从 R2 载入数据失败：', e.message);
      }
    }
  } else {
    fs.mkdirSync(require('path').dirname(dbPath), { recursive: true });
    if (fs.existsSync(dbPath)) {
      try {
        data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      } catch {
        data = { sections: [], photos: [], _seq: { sections: 0, photos: 0 } };
      }
    }
  }
  data.sections = data.sections || [];
  data.photos = data.photos || [];
  data._seq = data._seq || { sections: 0, photos: 0 };
}

// 落盘：R2 模式异步写对象（失败仅记日志，不阻断请求）；本地模式原子写文件
function save() {
  if (useR2) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const buf = Buffer.from(JSON.stringify(data, null, 2));
    s3.send(new PutObjectCommand({
      Bucket: r2.bucket, Key: DATA_KEY, Body: buf, ContentType: 'application/json'
    })).catch(e => console.error('⚠️  写入 R2 失败：', e.message));
  } else {
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, dbPath);
  }
}

function nextId(kind) {
  data._seq[kind] = (data._seq[kind] || 0) + 1;
  return data._seq[kind];
}

/* ===== 展区 ===== */
function listSections() {
  return data.sections
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) ||
      (b.created_at || '').localeCompare(a.created_at || ''));
}
function getSection(id) { return data.sections.find(s => s.id === id) || null; }
function createSection(o) {
  const row = {
    id: nextId('sections'),
    title: o.title,
    location: o.location || null,
    year: o.year || null,
    description: o.description || null,
    cover_image: o.cover_image || null,
    sort_order: o.sort_order || 0,
    created_at: new Date().toISOString()
  };
  data.sections.push(row);
  save();
  return row;
}
function updateSection(id, patch) {
  const s = getSection(id);
  if (!s) return null;
  Object.assign(s, patch);
  save();
  return s;
}
function deleteSection(id) {
  const sec = getSection(id);
  if (!sec) return null;
  data.photos = data.photos.filter(p => p.section_id !== id);
  data.sections = data.sections.filter(s => s.id !== id);
  save();
  return sec;
}

/* ===== 照片 ===== */
function listPhotos(sectionId) {
  return data.photos
    .filter(p => p.section_id === sectionId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
}
function getPhoto(id) { return data.photos.find(p => p.id === id) || null; }
function createPhoto(o) {
  const row = {
    id: nextId('photos'),
    section_id: o.section_id,
    title: o.title || null,
    location: o.location || null,
    shot_date: o.shot_date || null,
    description: o.description || null,
    image_path: o.image_path,
    thumb_path: o.thumb_path || null,
    sort_order: o.sort_order || 0,
    created_at: new Date().toISOString()
  };
  data.photos.push(row);
  save();
  return row;
}
function updatePhoto(id, patch) {
  const p = getPhoto(id);
  if (!p) return null;
  Object.assign(p, patch);
  save();
  return p;
}
function deletePhoto(id) {
  const p = getPhoto(id);
  if (!p) return null;
  data.photos = data.photos.filter(x => x.id !== id);
  save();
  return p;
}

// 重排某展区内照片顺序：传入该展区照片 id 的有序数组
function reorderPhotos(sectionId, orderedIds) {
  const sec = getSection(sectionId);
  if (!sec) return null;
  (orderedIds || []).map(Number).forEach((id, idx) => {
    const p = data.photos.find(x => x.id === id && x.section_id === sectionId);
    if (p) p.sort_order = idx + 1;
  });
  save();
  return true;
}

// 重排展区顺序：传入展区 id 的有序数组
function reorderSections(orderedIds) {
  (orderedIds || []).map(Number).forEach((id, idx) => {
    const s = getSection(id);
    if (s) s.sort_order = idx + 1;
  });
  save();
  return true;
}

// 用某张照片的图作为展区封面（同时记录缩略图，首页网格更快）
function setSectionCover(sectionId, imagePath, thumbPath) {
  const s = getSection(sectionId);
  if (!s) return null;
  s.cover_image = imagePath;
  s.cover_thumb = thumbPath || null;
  save();
  return s;
}

module.exports = {
  init,
  listSections, getSection, createSection, updateSection, deleteSection,
  listPhotos, getPhoto, createPhoto, updatePhoto, deletePhoto,
  reorderPhotos, reorderSections, setSectionCover
};
