const api = '/api';

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function init() {
  const grid = document.getElementById('halls');
  try {
    const res = await fetch(`${api}/sections`);
    const sections = await res.json();
    if (!sections.length) {
      grid.innerHTML = '<div class="empty">展厅正在布置中，敬请期待。</div>';
      return;
    }
    grid.innerHTML = sections.map(s => `
      <a class="hall" href="section.html?id=${s.id}">
        <div class="hall-cover">${s.cover_image ? `<img src="${s.cover_image}" alt="${esc(s.title)}" loading="lazy">` : ''}</div>
        <div class="hall-body">
          <h3 class="hall-title">${esc(s.title)}</h3>
          <div class="hall-meta">${[s.location, s.year].filter(Boolean).join(' · ')}</div>
        </div>
      </a>`).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty">加载失败，请稍后重试。</div>';
  }
}

init();
