const api = '/api';
const params = new URLSearchParams(location.search);
const sectionId = params.get('id');

let photos = [];
let current = 0;
let zoom = 1, tx = 0, ty = 0;

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function imgEl() { return document.getElementById('lbImg'); }

// 应用缩放 + 平移变换；animate=true 时带过渡动画
function applyTransform(animate) {
  const img = imgEl();
  if (!img) return;
  img.style.transition = animate ? 'transform .2s ease' : 'none';
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
}

// 限制平移范围，避免把图片拖出视野太远
function clampPan() {
  const lim = (zoom - 1) * Math.min(window.innerWidth, window.innerHeight) * 0.6;
  tx = Math.max(-lim, Math.min(lim, tx));
  ty = Math.max(-lim, Math.min(lim, ty));
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
  current = i; zoom = 1; tx = 0; ty = 0;
  renderLb();
  const lb = document.getElementById('lb');
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  const stage = document.getElementById('lbStage');
  stage.style.transform = ''; stage.style.opacity = ''; stage.style.transition = '';
  applyTransform(false);
}
function renderLb() {
  const p = photos[current];
  if (!p) return;
  const img = imgEl();
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
  const stage = document.getElementById('lbStage');
  stage.style.transform = ''; stage.style.opacity = ''; stage.style.transition = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function nav(d) {
  current = (current + d + photos.length) % photos.length;
  zoom = 1; tx = 0; ty = 0;
  renderLb();
}
// 缩放；ox/oy 为相对舞台中心的焦点偏移（捏合/双击时保持该点不动）
function setZoom(z, ox, oy) {
  const nz = Math.min(4, Math.max(1, z));
  if (nz === 1) { tx = 0; ty = 0; }
  else if (ox !== undefined) {
    const ratio = nz / zoom;
    tx = ox - (ox - tx) * ratio;
    ty = oy - (oy - ty) * ratio;
  }
  zoom = nz;
  clampPan();
  applyTransform(true);
}

function updateStrip() {
  const strip = document.getElementById('lbStrip');
  strip.innerHTML = photos.map((p, i) =>
    `<button class="lb-thumb ${i === current ? 'active' : ''}" data-i="${i}"><img src="${p.thumb_path || p.image_path}" alt="" loading="lazy"></button>`
  ).join('');
  strip.querySelectorAll('.lb-thumb').forEach(b =>
    b.addEventListener('click', () => { current = +b.dataset.i; zoom = 1; tx = 0; ty = 0; renderLb(); }));
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
  let gestureMoved = false;
  lb.addEventListener('click', e => {
    if (gestureMoved) { gestureMoved = false; return; }
    if (e.target.id === 'lb' || e.target.id === 'lbStage') closeLb();
  });

  // 滚轮缩放（桌面，在图片上）
  imgEl().addEventListener('wheel', e => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });

  // 双击缩放（桌面 / 无捏合时）
  imgEl().addEventListener('dblclick', e => {
    const rect = imgEl().getBoundingClientRect();
    const ox = e.clientX - (rect.left + rect.width / 2);
    const oy = e.clientY - (rect.top + rect.height / 2);
    if (zoom > 1) setZoom(1); else setZoom(2.5, ox, oy);
  });

  /* ===== 触摸手势：捏合缩放 / 双击缩放 / 拖动平移 / 横滑切图 / 下拉关闭 ===== */
  const stage = document.getElementById('lbStage');
  let mode = null;            // 'pan' | 'swipe' | 'pinch'
  let startX = 0, startY = 0, lastX = 0, lastY = 0;
  let startTx = 0, startTy = 0, moved = false, t0 = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  stage.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      mode = 'pinch';
      pinchStartDist = dist(e.touches[0], e.touches[1]);
      pinchStartZoom = zoom;
      e.preventDefault();
      return;
    }
    if (e.touches.length === 1) {
      mode = zoom > 1 ? 'pan' : 'swipe';
      const t = e.touches[0];
      startX = lastX = t.clientX; startY = lastY = t.clientY;
      t0 = Date.now(); moved = false; gestureMoved = false;
      startTx = tx; startTy = ty;
    }
  }, { passive: false });

  stage.addEventListener('touchmove', e => {
    if (mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      zoom = Math.min(4, Math.max(1, pinchStartZoom * (d / pinchStartDist)));
      clampPan(); applyTransform(false);
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - lastX, dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;
    if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) { moved = true; gestureMoved = true; }

    if (mode === 'pan') {
      e.preventDefault();
      tx = startTx + (t.clientX - startX);
      ty = startTy + (t.clientY - startY);
      clampPan(); applyTransform(false);
    } else if (mode === 'swipe') {
      const totalDy = t.clientY - startY;
      // 仅在未放大时，向下拖动给出“下拉关闭”的视觉反馈
      if (totalDy > 0) {
        e.preventDefault();
        stage.style.transition = 'none';
        stage.style.transform = `translateY(${totalDy}px)`;
        stage.style.opacity = String(Math.max(0.25, 1 - totalDy / 420));
      }
    }
  }, { passive: false });

  stage.addEventListener('touchend', e => {
    if (mode === 'pinch') {
      // 双指松开后若仍有一指，转为拖动
      if (e.touches.length === 1) {
        mode = 'pan';
        const t = e.touches[0];
        startX = lastX = t.clientX; startY = lastY = t.clientY;
        startTx = tx; startTy = ty;
      } else {
        mode = null;
      }
      applyTransform(true);
      return;
    }
    if (mode === 'pan') {
      applyTransform(true);
      mode = null;
      return;
    }
    if (mode === 'swipe') {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      stage.style.transition = 'transform .2s ease, opacity .2s ease';
      if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
        closeLb();
      } else if (moved && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        nav(dx < 0 ? 1 : -1);
        stage.style.transform = ''; stage.style.opacity = '';
      } else {
        // 未移动视为点击：检测双击缩放
        if (!moved) {
          const now = Date.now();
          if (now - lastTapTime < 300 && Math.abs(t.clientX - lastTapX) < 30 && Math.abs(t.clientY - lastTapY) < 30) {
            const rect = stage.getBoundingClientRect();
            const ox = t.clientX - (rect.left + rect.width / 2);
            const oy = t.clientY - (rect.top + rect.height / 2);
            if (zoom > 1) setZoom(1); else setZoom(2.5, ox, oy);
            lastTapTime = 0;
          } else {
            lastTapTime = now; lastTapX = t.clientX; lastTapY = t.clientY;
          }
        }
        stage.style.transform = ''; stage.style.opacity = '';
      }
      mode = null;
    }
  }, { passive: false });

  stage.addEventListener('touchcancel', () => {
    mode = null;
    stage.style.transform = ''; stage.style.opacity = '';
    applyTransform(true);
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
