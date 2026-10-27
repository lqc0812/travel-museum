const api = '/api';
const params = new URLSearchParams(location.search);
const sectionId = params.get('id');

let photos = [];
let current = 0;
let zoom = 1;

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function init() {
  if (!sectionId) { location.href = 'index.html'; return; }
  const grid = document.getElementById('grid');
  try {
    const [sRes, pRes] = await Promise.all([
      fetch(`${api}/sections/${sectionId}`),
      fetch(`${api}/sections/${sectionId}/photos`)
    ]);
    if (!sRes.ok) throw new Error('not found');
    const section = await sRes.json();
    photos = await pRes.json();

    document.getElementById('secTitle').textContent = section.title;
    document.getElementById('secMeta').textContent = [section.location, section.year].filter(Boolean).join(' · ');
    document.title = section.title + ' · 旅行博物馆';

    if (photos.length) {
      grid.innerHTML = photos.map((p, i) => `
        <div class="photo-card" data-i="${i}">
          <div class="photo-thumb"><img src="${p.thumb_path || p.image_path}" alt="${esc(p.title || '')}" loading="lazy" decoding="async"></div>
          <div class="photo-cap">
            <div class="t">${esc(p.title || '未命名')}</div>
            <div class="m">${[p.location, p.shot_date].filter(Boolean).join(' · ')}</div>
          </div>
        </div>`).join('');
      document.querySelectorAll('.photo-card').forEach(el =>
        el.addEventListener('click', () => openLb(+el.dataset.i)));
    } else {
      grid.innerHTML = '<div class="empty">这个展区还没有照片。</div>';
    }
  } catch (e) {
    grid.innerHTML = '<div class="empty">展区不存在或加载失败。</div>';
  }
  setupLb();
}

/* ===== 查看器 ===== */
function openLb(i) {
  current = i; zoom = 1;
  renderLb();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function renderLb() {
  const p = photos[current];
  if (!p) return;
  const img = document.getElementById('lbImg');
  img.style.transform = 'scale(1)';
  img.src = p.image_path;
  document.getElementById('lbTitle').textContent = p.title || '未命名';
  document.getElementById('lbLoc').textContent = p.location || '';
  document.getElementById('lbLoc').style.display = p.location ? '' : 'none';
  document.getElementById('lbDate').textContent = p.shot_date || '';
  document.getElementById('lbDate').style.display = p.shot_date ? '' : 'none';
  document.getElementById('lbDesc').textContent = p.description || '';
  document.getElementById('lbDesc').style.display = p.description ? '' : 'none';
  document.getElementById('lbCounter').textContent = `${current + 1} / ${photos.length}`;
  updateStrip();
}
function closeLb() {
  document.getElementById('lb').classList.remove('open');
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function nav(d) {
  current = (current + d + photos.length) % photos.length;
  zoom = 1;
  renderLb();
}
function setZoom(z) {
  zoom = Math.min(4, Math.max(1, z));
  document.getElementById('lbImg').style.transform = `scale(${zoom})`;
}

function updateStrip() {
  const strip = document.getElementById('lbStrip');
  strip.innerHTML = photos.map((p, i) =>
    `<button class="lb-thumb ${i === current ? 'active' : ''}" data-i="${i}"><img src="${p.thumb_path || p.image_path}" alt="" loading="lazy"></button>`
  ).join('');
  strip.querySelectorAll('.lb-thumb').forEach(b =>
    b.addEventListener('click', () => { current = +b.dataset.i; zoom = 1; renderLb(); }));
  const active = strip.querySelector('.lb-thumb.active');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function setupLb() {
  document.getElementById('lbClose').addEventListener('click', closeLb);
  document.getElementById('lbPrev').addEventListener('click', () => nav(-1));
  document.getElementById('lbNext').addEventListener('click', () => nav(1));
  document.getElementById('lbZoomIn').addEventListener('click', () => setZoom(zoom + 0.5));
  document.getElementById('lbZoomOut').addEventListener('click', () => setZoom(zoom - 0.5));
  document.getElementById('lbZoomReset').addEventListener('click', () => setZoom(1));
  document.getElementById('lbFull').addEventListener('click', () => {
    const lb = document.getElementById('lb');
    if (!document.fullscreenElement) lb.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  });

  const lb = document.getElementById('lb');
  lb.addEventListener('click', e => { if (e.target.id === 'lb' || e.target.id === 'lbStage') closeLb(); });

  // 滚轮缩放（在图片上）
  document.getElementById('lbImg').addEventListener('wheel', e => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });

  // 点击图片：放大 / 还原（不触发空白关闭）
  const lbImg = document.getElementById('lbImg');
  lbImg.addEventListener('click', e => {
    e.stopPropagation();
    if (zoom === 1) { setZoom(2); lbImg.classList.add('zoomed'); }
    else { setZoom(1); lbImg.classList.remove('zoomed'); }
  });

  // 触摸滑动切换
  const stage = document.getElementById('lbStage');
  let sx = 0, sy = 0, moved = false;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (Math.abs(e.touches[0].clientX - sx) > 24 || Math.abs(e.touches[0].clientY - sy) > 24) moved = true;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) nav(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') nav(-1);
    if (e.key === 'ArrowRight') nav(1);
    if (e.key === '+' || e.key === '=') setZoom(zoom + 0.5);
    if (e.key === '-') setZoom(zoom - 0.5);
  });
}

init();
