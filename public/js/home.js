const api = '/api';

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let allSections = [];
const filter = { q: '', year: '', loc: '' };

async function init() {
  const grid = document.getElementById('halls');
  try {
    const res = await fetch(`${api}/sections`);
    allSections = await res.json();
  } catch (e) {
    grid.innerHTML = '<div class="empty">加载失败，请稍后重试。</div>';
    return;
  }
  if (!allSections.length) {
    grid.innerHTML = `
      <div class="empty-guide">
        <div class="eg-ico">🏛️</div>
        <h2>展厅正在布置中</h2>
        <p>这里将陈列你的旅行记忆。进入 <a class="admin-link" href="admin.html">管理后台</a>，新建展区并上传照片，<br>它们就会以展厅的形式出现在这里。</p>
      </div>`;
    return;
  }
  buildChips();
  document.getElementById('galleryBar').style.display = 'block';
  render();
}

function buildChips() {
  const years = [...new Set(allSections.map(s => s.year).filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a)));
  const locs = [...new Set(allSections.map(s => s.location).filter(Boolean))];
  const yc = document.getElementById('yearChips');
  const lc = document.getElementById('locChips');
  yc.innerHTML = chip('全部年份', '', filter.year === '') + years.map(y => chip(y, y, filter.year === y)).join('');
  lc.innerHTML = (locs.length > 1 ? chip('全部地点', '', filter.loc === '') + locs.map(l => chip(l, l, filter.loc === l)).join('') : '');

  yc.querySelectorAll('.chip').forEach(c => c.onclick = () => { filter.year = c.dataset.val; buildChips(); render(); });
  lc.querySelectorAll('.chip').forEach(c => c.onclick = () => { filter.loc = c.dataset.val; buildChips(); render(); });

  const si = document.getElementById('searchInput');
  si.oninput = () => { filter.q = si.value.trim().toLowerCase(); render(); };
}

function chip(label, val, active) {
  return `<button class="chip ${active ? 'active' : ''}" data-val="${esc(val)}">${esc(label)}</button>`;
}

function filtered() {
  return allSections.filter(s => {
    if (filter.year && s.year != filter.year) return false;
    if (filter.loc && s.location !== filter.loc) return false;
    if (filter.q) {
      const hay = [s.title, s.location, s.year, s.description].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(filter.q)) return false;
    }
    return true;
  });
}

function render() {
  const grid = document.getElementById('halls');
  const list = filtered();
  if (!list.length) {
    grid.innerHTML = '<div class="empty">没有匹配的展区，试试其它关键词。</div>';
    grid.classList.remove('grouped');
    return;
  }
  // 有年份筛选时按年份分组展示，否则平铺
  const groupByYear = !filter.year && list.some(s => s.year);
  if (groupByYear) {
    grid.classList.add('grouped');
    const groups = {};
    list.forEach(s => { const y = s.year || '未标注年份'; (groups[y] = groups[y] || []).push(s); });
    const years = Object.keys(groups).sort((a, b) => String(b).localeCompare(String(a)));
    grid.innerHTML = years.map(y => `
      <div class="year-group">
        <h2 class="year-head">${esc(y)} <span class="year-count">${groups[y].length}</span></h2>
        <div class="halls">${groups[y].map(hallCard).join('')}</div>
      </div>`).join('');
  } else {
    grid.classList.remove('grouped');
    grid.innerHTML = list.map(hallCard).join('');
  }
}

function hallCard(s) {
  const meta = [s.location, s.year].filter(Boolean).join(' · ');
  return `
    <a class="hall" href="section.html?id=${s.id}">
      <div class="hall-cover">${s.cover_image ? `<img src="${s.cover_image}" alt="${esc(s.title)}" loading="lazy">` : ''}</div>
      <div class="hall-body">
        <h3 class="hall-title">${esc(s.title)}</h3>
        <div class="hall-meta">${esc(meta)}</div>
      </div>
      <div class="hall-overlay"><span>进入展厅 →</span></div>
    </a>`;
}

init();
