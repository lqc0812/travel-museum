const api = '/api';
const TOKEN_KEY = 'museum_admin_token';

let sections = [];
let photos = [];
let photoSectionId = null;
let activeSectionId = null;   // 正在编辑的展区 id（null = 新建）
let activePhotoId = null;     // 正在编辑的照片 id（null = 新建）
let dragType = null;          // 'section' | 'photo'
let dragId = null;

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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
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
  if (name === 'sections') loadSections();
}

/* ===== 展区管理 ===== */
async function loadSections() {
  const r = await apiFetch(`${api}/sections`);
  sections = await r.json();
  renderSections();
}
function renderSections() {
  const el = document.getElementById('sectionList');
  if (!sections.length) { el.innerHTML = '<div class="muted-note">还没有展区，先创建一个吧。</div>'; return; }
  el.innerHTML = sections.map(s => `
    <div class="card-row drag-row" draggable="true" data-type="section" data-id="${s.id}">
      <span class="drag-ico">⠿</span>
      <img src="${s.cover_image || ''}" onerror="this.style.visibility='hidden'">
      <div class="info"><div class="t">${esc(s.title)}</div><div class="m">${[s.location, s.year].filter(Boolean).join(' · ')}</div></div>
      <div class="actions">
        <button class="btn small ghost" data-edit="${s.id}">编辑</button>
        <button class="btn small" data-photos="${s.id}">照片</button>
        ${s.cover_image ? `<button class="btn small ghost" data-rmcover="${s.id}">去封面</button>` : ''}
        <button class="btn small danger" data-del="${s.id}">删除</button>
      </div>
    </div>`).join('');
  bindDrag(el, 'section');
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editSection(+b.dataset.edit));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delSection(+b.dataset.del));
  el.querySelectorAll('[data-photos]').forEach(b => b.onclick = () => openPhotos(+b.dataset.photos));
  el.querySelectorAll('[data-rmcover]').forEach(b => b.onclick = () => removeCover(+b.dataset.rmcover));
}

function showSectionForm(section = null) {
  activeSectionId = section ? section.id : null;
  document.getElementById('secFormTitle').textContent = section ? '编辑展区' : '新建展区';
  document.getElementById('f_title').value = section ? section.title : '';
  document.getElementById('f_location').value = section ? (section.location || '') : '';
  document.getElementById('f_year').value = section ? (section.year || '') : '';
  document.getElementById('f_desc').value = section ? (section.description || '') : '';
  document.getElementById('f_cover').value = '';
  document.getElementById('removeCoverRow').style.display = (section && section.cover_image) ? 'flex' : 'none';
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
    coverAction: (activeSectionId && document.getElementById('f_removeCover').checked) ? 'remove' : undefined
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
async function removeCover(id) {
  const r = await apiFetch(`${api}/sections/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coverAction: 'remove' })
  });
  if (r.ok) loadSections();
}
async function delSection(id) {
  if (!confirm('确定删除该展区及其所有照片？此操作不可恢复。')) return;
  const r = await apiFetch(`${api}/sections/${id}`, { method: 'DELETE' });
  if (r.ok) loadSections();
}

/* ===== 照片管理 ===== */
async function openPhotos(sectionId) {
  photoSectionId = sectionId;
  switchTab('photos');
  await loadPhotos(sectionId);
}
async function loadPhotos(sectionId) {
  const sec = sections.find(s => s.id === sectionId);
  document.getElementById('photoSecName').textContent = sec ? sec.title : '';
  const r = await apiFetch(`${api}/sections/${sectionId}/photos`);
  photos = await r.json();
  renderPhotos();
  updateSelCount();
}
function renderPhotos() {
  const el = document.getElementById('photoGrid');
  if (!photos.length) { el.innerHTML = '<div class="muted-note">该展区还没有照片。</div>'; return; }
  el.innerHTML = photos.map(p => `
    <div class="pm-card" draggable="true" data-type="photo" data-id="${p.id}">
      <span class="drag-ico">⠿</span>
      <label class="pm-check"><input type="checkbox" data-pick="${p.id}"></label>
      <div class="pm-thumb"><img src="${p.image_path}" onerror="this.style.visibility='hidden'"></div>
      <div class="pm-info"><div class="t">${esc(p.title || '未命名')}</div><div class="m">${[p.location, p.shot_date].filter(Boolean).join(' · ')}</div></div>
      <div class="pm-actions">
        <button class="btn small ghost" data-editp="${p.id}">编辑</button>
        <button class="btn small ghost" data-coverp="${p.id}">设封面</button>
        <button class="btn small danger" data-delp="${p.id}">删除</button>
      </div>
    </div>`).join('');
  bindDrag(el, 'photo');
  el.querySelectorAll('[data-editp]').forEach(b => b.onclick = () => editPhoto(+b.dataset.editp));
  el.querySelectorAll('[data-delp]').forEach(b => b.onclick = () => delPhoto(+b.dataset.delp));
  el.querySelectorAll('[data-coverp]').forEach(b => b.onclick = () => setCover(+b.dataset.coverp));
  el.querySelectorAll('[data-pick]').forEach(c => c.onchange = updateSelCount);
}

function updateSelCount() {
  const picked = [...document.querySelectorAll('[data-pick]:checked')].map(c => +c.dataset.pick);
  document.getElementById('selCount').textContent = picked.length;
  document.getElementById('batchDelBtn').disabled = !picked.length;
}
document.getElementById('selectAll').onchange = e => {
  document.querySelectorAll('[data-pick]').forEach(c => c.checked = e.target.checked);
  updateSelCount();
};
document.getElementById('batchDelBtn').onclick = async () => {
  const ids = [...document.querySelectorAll('[data-pick]:checked')].map(c => +c.dataset.pick);
  if (!ids.length) return;
  if (!confirm(`确定删除选中的 ${ids.length} 张照片？`)) return;
  const r = await apiFetch(`${api}/photos/batch-delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
  });
  if (r.ok) { loadPhotos(photoSectionId); loadSections(); }
};

function showPhotoForm(photo = null) {
  activePhotoId = photo ? photo.id : null;
  document.getElementById('phFormTitle').textContent = photo ? '编辑照片' : '上传照片';
  document.getElementById('p_title').value = photo ? (photo.title || '') : '';
  document.getElementById('p_location').value = photo ? (photo.location || '') : '';
  document.getElementById('p_date').value = photo ? (photo.shot_date || '') : '';
  document.getElementById('p_desc').value = photo ? (photo.description || '') : '';
  document.getElementById('p_image').value = '';
  document.getElementById('phForm').style.display = 'block';
}
function hidePhotoForm() { document.getElementById('phForm').style.display = 'none'; }

document.getElementById('newPhotoBtn').onclick = () => {
  if (!photoSectionId) return alert('请先在「展区管理」里点某个展区的「照片」按钮');
  showPhotoForm();
};
document.getElementById('phCancel').onclick = hidePhotoForm;

document.getElementById('phForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!photoSectionId) return;
  const imageFile = document.getElementById('p_image').files[0];
  if (!activePhotoId && !imageFile) { alert('请选择图片'); return; }
  const body = {
    title: document.getElementById('p_title').value,
    location: document.getElementById('p_location').value,
    shot_date: document.getElementById('p_date').value,
    description: document.getElementById('p_desc').value
  };
  if (imageFile) {
    try { body.image = await fileToDataUrl(imageFile); }
    catch (err) { alert('图片读取失败'); return; }
  }
  const opts = { method: activePhotoId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const url = activePhotoId ? `${api}/photos/${activePhotoId}` : `${api}/sections/${photoSectionId}/photos`;
  const r = await apiFetch(url, opts);
  if (r.ok) { hidePhotoForm(); loadPhotos(photoSectionId); }
  else { const d = await r.json().catch(() => ({})); alert(d.error || '保存失败'); }
});

async function editPhoto(id) { showPhotoForm(photos.find(x => x.id === id)); }
async function delPhoto(id) {
  if (!confirm('删除这张照片？')) return;
  const r = await apiFetch(`${api}/photos/${id}`, { method: 'DELETE' });
  if (r.ok) { loadPhotos(photoSectionId); loadSections(); }
}
async function setCover(photoId) {
  const r = await apiFetch(`${api}/sections/${photoSectionId}/set-cover`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId })
  });
  if (r.ok) { loadPhotos(photoSectionId); loadSections(); }
}

/* ===== 拖拽排序（展区 / 照片）===== */
function bindDrag(container, type) {
  container.querySelectorAll('[draggable="true"]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragType = type; dragId = +row.dataset.id;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragType !== type) return;
      const after = getDragAfter(container, type, e.clientY);
      const dragging = container.querySelector('.dragging');
      if (!dragging) return;
      if (after == null) container.appendChild(dragging);
      else container.insertBefore(dragging, after);
    });
    row.addEventListener('drop', async e => {
      e.preventDefault();
      const ordered = [...container.querySelectorAll('[data-type="' + type + '"]')].map(r => +r.dataset.id);
      if (type === 'section') {
        await apiFetch(`${api}/sections/reorder`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds: ordered })
        });
      } else {
        await apiFetch(`${api}/sections/${photoSectionId}/reorder-photos`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds: ordered })
        });
        loadSections();
      }
    });
  });
}
function getDragAfter(container, type, y) {
  const rows = [...container.querySelectorAll(`[data-type="${type}"]:not(.dragging)`)];
  return rows.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

init();
