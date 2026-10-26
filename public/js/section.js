const api = '/api';
const params = new URLSearchParams(location.search);
const sectionId = params.get('id');

let photos = [];
let current = 0;

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
          <div class="photo-thumb"><img src="${p.image_path}" alt="${esc(p.title || '')}" loading="lazy"></div>
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

function openLb(i) { current = i; renderLb(); document.getElementById('lb').classList.add('open'); }
function renderLb() {
  const p = photos[current];
  if (!p) return;
  document.getElementById('lbImg').src = p.image_path;
  document.getElementById('lbTitle').textContent = p.title || '';
  document.getElementById('lbMeta').textContent = [p.location, p.shot_date, p.description].filter(Boolean).join(' · ');
}
function closeLb() { document.getElementById('lb').classList.remove('open'); }
function nav(d) { current = (current + d + photos.length) % photos.length; renderLb(); }

function setupLb() {
  document.getElementById('lbClose').addEventListener('click', closeLb);
  document.getElementById('lbPrev').addEventListener('click', () => nav(-1));
  document.getElementById('lbNext').addEventListener('click', () => nav(1));
  document.getElementById('lb').addEventListener('click', e => { if (e.target.id === 'lb') closeLb(); });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lb').classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') nav(-1);
    if (e.key === 'ArrowRight') nav(1);
  });
}

init();
