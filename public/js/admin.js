const api = '/api';
const TOKEN_KEY = 'museum_admin_token';

let sections = [];
let photoSectionId = null;   // 当前正在管理照片的展区 id
let activeSectionId = null;   // 正在编辑的展区 id（null = 新建）
let activePhotoId = null;     // 正在编辑的照片 id（null = 新建）

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }
function authHeaders() { return { 'Authorization': 'Bearer ' + getToken() }; }

async function apiFetch(url, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, authHeaders());
  const res = await fetch(url, opts);
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  return res;
}

function logout() { setToken(''); location.reload(); }

// 读取图片并压缩：最长边缩放到 maxEdge，输出 JPEG（体积小、上传快、避免超限）
function fileToDataUrl(file, maxEdge = 2000, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

/* ===== 登录 / 启动 ===== */
async function init() {
  if (getToken()) {
    try {
      const r = await fetch(`${api}/admin/check`, { headers: authHeaders() });
      if (r.ok) { showApp(); return; }
    } catch (e) { /* 忽略 */ }
  }
  showLogin();
}
function showLogin() {
  document.getElementById('login').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadSections();
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = document.getElementById('loginPw').value;
  const r = await fetch(`${api}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw })
  });
  if (r.ok) {
    const d = await r.json();
    setToken(d.token);
    document.getElementById('loginErr').textContent = '';
    showApp();
  } else {
    document.getElementById('loginErr').textContent = '密码错误';
  }
});

/* ===== 标签页切换 ===== */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'photos') { populatePicker(); if (photoSectionId) loadPhotos(photoSectionId); }
}

/* ===== 展区管理 ===== */
async function loadSections() {
  const r = await apiFetch(`${api}/sections`);
  sections = await r.json();
  renderSections();
  populatePicker();
}
function renderSections() {
  const el = document.getElementById('sectionList');
  if (!sections.length) { el.innerHTML = '<div class="muted-note">还没有展区，先创建一个吧。</div>'; return; }
  el.innerHTML = sections.map(s => `
    <div class="card-row">
      <img src="${s.cover_image || ''}" onerror="this.style.visibility='hidden'">
      <div class="info"><div class="t">${esc(s.title)}</div><div class="m">${[s.location, s.year].filter(Boolean).join(' · ')}</div></div>
      <div class="actions">
        <button class="btn small ghost" data-edit="${s.id}">编辑</button>
        <button class="btn small" data-photos="${s.id}">照片</button>
        <button class="btn small danger" data-del="${s.id}">删除</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editSection(+b.dataset.edit));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delSection(+b.dataset.del));
  el.querySelectorAll('[data-photos]').forEach(b => b.onclick = () => openPhotos(+b.dataset.photos));
}

function showSectionForm(section = null) {
  activeSectionId = section ? section.id : null;
  document.getElementById('secFormTitle').textContent = section ? '编辑展区' : '新建展区';
  document.getElementById('f_title').value = section ? section.title : '';
  document.getElementById('f_location').value = section ? (section.location || '') : '';
  document.getElementById('f_year').value = section ? (section.year || '') : '';
  document.getElementById('f_desc').value = section ? (section.description || '') : '';
  document.getElementById('f_sort').value = section ? (section.sort_order || 0) : 0;
  document.getElementById('f_cover').value = '';
  document.getElementById('secForm').style.display = 'block';
}
function hideSectionForm() { document.getElementById('secForm').style.display = 'none'; }

document.getElementById('newSectionBtn').onclick = () => showSectionForm();
document.getElementById('secCancel').onclick = hideSectionForm;

document.getElementById('secForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    title: document.getElementById('f_title').value,
    location: document.getElementById('f_location').value,
    year: document.getElementById('f_year').value,
    description: document.getElementById('f_desc').value,
    sort_order: document.getElementById('f_sort').value
  };
  const coverFile = document.getElementById('f_cover').files[0];
  if (coverFile) {
    try { body.cover = await fileToDataUrl(coverFile); }
    catch (err) { alert('封面读取失败'); return; }
  }
  const opts = { method: activeSectionId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const url = activeSectionId ? `${api}/sections/${activeSectionId}` : `${api}/sections`;
  const r = await apiFetch(url, opts);
  if (r.ok) { hideSectionForm(); loadSections(); }
  else { const d = await r.json().catch(() => ({})); alert(d.error || '保存失败'); }
});

async function editSection(id) { showSectionForm(sections.find(x => x.id === id)); }
async function delSection(id) {
  if (!confirm('确定删除该展区及其所有照片？此操作不可恢复。')) return;
  const r = await apiFetch(`${api}/sections/${id}`, { method: 'DELETE' });
  if (r.ok) loadSections();
}

/* ===== 照片管理 ===== */
let photos = [];
function populatePicker() {
  const sel = document.getElementById('sectionPicker');
  if (!sel) return;
  const cur = photoSectionId;
  sel.innerHTML = '<option value="">— 请选择展区 —</option>' +
    sections.map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
  if (cur) sel.value = cur;
}
document.getElementById('sectionPicker').addEventListener('change', e => {
  photoSectionId = e.target.value ? Number(e.target.value) : null;
  if (photoSectionId) loadPhotos(photoSectionId);
  else document.getElementById('photoList').innerHTML = '';
});

async function openPhotos(sectionId) {
  photoSectionId = sectionId;
  const sel = document.getElementById('sectionPicker');
  if (sel) sel.value = sectionId;
  switchTab('photos');
  await loadPhotos(sectionId);
}
async function loadPhotos(sectionId) {
  const r = await apiFetch(`${api}/sections/${sectionId}/photos`);
  photos = await r.json();
  renderPhotos();
}
function renderPhotos() {
  const el = document.getElementById('photoList');
  if (!photos.length) { el.innerHTML = '<div class="muted-note">该展区还没有照片，拖几张进来吧。</div>'; return; }
  el.innerHTML = photos.map(p => `
    <div class="card-row">
      <img src="${p.image_path}" onerror="this.style.visibility='hidden'">
      <div class="info"><div class="t">${esc(p.title || '未命名')}</div><div class="m">${[p.location, p.shot_date].filter(Boolean).join(' · ')}</div></div>
      <div class="actions">
        <button class="btn small ghost" data-editp="${p.id}">编辑</button>
        <button class="btn small danger" data-delp="${p.id}">删除</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-editp]').forEach(b => b.onclick = () => editPhoto(+b.dataset.editp));
  el.querySelectorAll('[data-delp]').forEach(b => b.onclick = () => delPhoto(+b.dataset.delp));
}

// ===== 拖拽 / 多选直接上传 =====
function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('p_images');
  if (!zone || !input) return;
  zone.addEventListener('click', () => {
    if (!photoSectionId) { alert('请先在上方「选择要管理的展区」'); return; }
    input.click();
  });
  input.addEventListener('change', e => { handleFiles(e.target.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    if (!photoSectionId) { alert('请先选好要上传到哪个展区'); return; }
    handleFiles(e.dataTransfer.files);
  });
}

let uploading = 0;
async function handleFiles(files) {
  const arr = Array.from(files || []).filter(f => f.type.startsWith('image/'));
  if (!arr.length) { alert('请选择图片文件'); return; }
  if (!photoSectionId) { alert('请先在上方选择展区'); return; }
  const statusEl = document.getElementById('uploadStatus');
  let ok = 0, fail = 0;
  for (let i = 0; i < arr.length; i++) {
    const file = arr[i];
    uploading++;
    statusEl.textContent = `正在上传 ${i + 1}/${arr.length}：${file.name}`;
    try {
      const dataUrl = await fileToDataUrl(file);
      const title = file.name.replace(/\.[^.]+$/, '');
      const r = await apiFetch(`${api}/sections/${photoSectionId}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, image: dataUrl })
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || '上传失败'); }
      ok++;
    } catch (err) {
      fail++;
      console.error(err);
      alert(`「${file.name}」上传失败：${err.message}`);
    } finally {
      uploading--;
    }
  }
  statusEl.textContent = uploading === 0 ? `完成：成功 ${ok} 张${fail ? `，失败 ${fail} 张` : ''}` : '';
  loadPhotos(photoSectionId);
}

/* ===== 编辑照片信息（可选替换图片） ===== */
function showPhotoForm(photo = null) {
  activePhotoId = photo ? photo.id : null;
  document.getElementById('phFormTitle').textContent = photo ? '编辑照片信息' : '上传照片';
  document.getElementById('p_title').value = photo ? (photo.title || '') : '';
  document.getElementById('p_location').value = photo ? (photo.location || '') : '';
  document.getElementById('p_date').value = photo ? (photo.shot_date || '') : '';
  document.getElementById('p_desc').value = photo ? (photo.description || '') : '';
  document.getElementById('p_sort').value = photo ? (photo.sort_order || 0) : 0;
  document.getElementById('p_image').value = '';
  document.getElementById('phForm').style.display = 'block';
}
function hidePhotoForm() { document.getElementById('phForm').style.display = 'none'; }

document.getElementById('phCancel').onclick = hidePhotoForm;

document.getElementById('phForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!activePhotoId) return;
  const imageFile = document.getElementById('p_image').files[0];
  const body = {
    title: document.getElementById('p_title').value,
    location: document.getElementById('p_location').value,
    shot_date: document.getElementById('p_date').value,
    description: document.getElementById('p_desc').value,
    sort_order: document.getElementById('p_sort').value
  };
  if (imageFile) {
    try { body.image = await fileToDataUrl(imageFile); }
    catch (err) { alert('图片读取失败'); return; }
  }
  const r = await apiFetch(`${api}/photos/${activePhotoId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (r.ok) { hidePhotoForm(); loadPhotos(photoSectionId); }
  else { const d = await r.json().catch(() => ({})); alert(d.error || '保存失败'); }
});

async function editPhoto(id) { showPhotoForm(photos.find(x => x.id === id)); }
async function delPhoto(id) {
  if (!confirm('删除这张照片？')) return;
  const r = await apiFetch(`${api}/photos/${id}`, { method: 'DELETE' });
  if (r.ok) loadPhotos(photoSectionId);
}

setupUploadZone();
init();
