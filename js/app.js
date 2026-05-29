const FILM_COLORS = {
  'Classic Chrome':    { bar: '#6b7c93', badge: 'background:#1e2b38;color:#8ba9c4;border:1px solid #2d4560' },
  'Classic Neg.':      { bar: '#8b7355', badge: 'background:#2b1e10;color:#c8a97a;border:1px solid #5a3f20' },
  'Velvia/Vivid':      { bar: '#e05c5c', badge: 'background:#3b1010;color:#e07070;border:1px solid #7a2020' },
  'Provia/Standard':   { bar: '#7ab37a', badge: 'background:#10281e;color:#6db37a;border:1px solid #2a5a3a' },
  'Astia/Soft':        { bar: '#c8a97a', badge: 'background:#2b2010;color:#c8a97a;border:1px solid #5a4020' },
  'Eterna':            { bar: '#7a9ab3', badge: 'background:#10202b;color:#7ab0d0;border:1px solid #204060' },
  'Eterna Cinema':     { bar: '#5a7a9a', badge: 'background:#10202b;color:#5a9ac8;border:1px solid #204060' },
  'Acros':             { bar: '#888', badge: 'background:#1e1e1e;color:#aaa;border:1px solid #444' },
  'Acros+R':           { bar: '#aaa', badge: 'background:#1e1e1e;color:#ccc;border:1px solid #555' },
  'Acros+Ye':          { bar: '#c8b87a', badge: 'background:#2b2810;color:#c8c07a;border:1px solid #5a4820' },
  'Acros+G':           { bar: '#7aaa8a', badge: 'background:#102820;color:#7aaa8a;border:1px solid #204830' },
  'Monochrome':        { bar: '#666', badge: 'background:#181818;color:#999;border:1px solid #383838' },
  'Nostalgic Neg.':    { bar: '#a87a5a', badge: 'background:#281810;color:#c89060;border:1px solid #5a3010' },
  'Reala Ace':         { bar: '#8a9ab0', badge: 'background:#1a2030;color:#8aaac8;border:1px solid #2a4060' },
  'Sepia':             { bar: '#9a7a4a', badge: 'background:#28200c;color:#b89050;border:1px solid #5a4010' },
};

const FILM_SIMULATIONS = ['All', ...Object.keys(FILM_COLORS)];

let recipes = [];
let activeFilter = 'All';
let searchQuery = '';

function getFilmColor(sim) {
  for (const key of Object.keys(FILM_COLORS)) {
    if (sim && sim.startsWith(key)) return FILM_COLORS[key];
  }
  return { bar: '#888', badge: 'background:#1e1e1e;color:#aaa;border:1px solid #444' };
}

function formatVal(v) {
  if (typeof v !== 'number') return `<span class="val-text">${v}</span>`;
  if (v > 0) return `<span class="val-pos">+${v}</span>`;
  if (v < 0) return `<span class="val-neg">${v}</span>`;
  return `<span class="val-zero">0</span>`;
}

function buildToneBar(label, value) {
  const pct = ((value + 4) / 8) * 100;
  const color = value > 0 ? '#e8c080' : value < 0 ? '#7a9ab3' : '#555';
  const leftPct = value < 0 ? pct : 50;
  const widthPct = Math.abs(value) * 6.25;
  return `
    <div class="tone-bar">
      <div class="tone-bar-label">${label}</div>
      <div class="tone-track">
        <div class="tone-center" style="left:50%"></div>
        <div class="tone-fill" style="left:${leftPct}%;width:${widthPct}%;background:${color}"></div>
      </div>
    </div>`;
}

function buildCard(recipe) {
  const s = recipe.settings;
  const fc = getFilmColor(s.filmSimulation);
  const photoHtml = recipe.photo
    ? `<img class="card-photo" src="${recipe.photo.url}" alt="${recipe.name}" loading="lazy">`
    : '';
  return `
    <div class="card" onclick="openModal(${recipe.id})">
      ${photoHtml}
      <div class="card-film-bar" style="background:${fc.bar}"></div>
      <div class="card-body">
        <div class="card-header">
          <span class="card-title">${recipe.name}</span>
          <span class="film-badge" style="${fc.badge}">${s.filmSimulation}</span>
        </div>
        <p class="card-desc">${recipe.description}</p>
        <div class="card-meta">
          <span class="camera-chip">${recipe.camera}</span>
          ${recipe.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
        </div>
        ${recipe.recipeSource ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">📖 Source: <a href="${recipe.recipeUrl}" target="_blank" onclick="event.stopPropagation()">${recipe.recipeSource}</a></div>` : ''}
        <div class="settings-grid">
          <div class="setting-row"><span class="setting-label">DR</span><span class="setting-value val-text">${s.dynamicRange}</span></div>
          <div class="setting-row"><span class="setting-label">WB</span><span class="setting-value val-text">${s.whiteBalance}</span></div>
          <div class="setting-row"><span class="setting-label">Highlight</span><span class="setting-value">${formatVal(s.highlightTone)}</span></div>
          <div class="setting-row"><span class="setting-label">Shadow</span><span class="setting-value">${formatVal(s.shadowTone)}</span></div>
          <div class="setting-row"><span class="setting-label">Color</span><span class="setting-value">${formatVal(s.color)}</span></div>
          <div class="setting-row"><span class="setting-label">Sharpness</span><span class="setting-value">${formatVal(s.sharpness)}</span></div>
        </div>
        <div class="tone-bars">
          ${buildToneBar('HL', s.highlightTone)}
          ${buildToneBar('SH', s.shadowTone)}
          ${buildToneBar('COL', s.color)}
          ${buildToneBar('NR', s.noiseReduction)}
        </div>
      </div>
    </div>`;
}

function openModal(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  const s = recipe.settings;
  const fc = getFilmColor(s.filmSimulation);

  const modalPhoto = document.getElementById('modal-photo');
  if (recipe.photo) {
    modalPhoto.src = recipe.photo.url;
    modalPhoto.alt = recipe.name;
    modalPhoto.style.display = 'block';
    document.getElementById('modal-photo-credit').innerHTML =
      `Photo by <a href="${recipe.photo.creditUrl}" target="_blank">${recipe.photo.credit}</a> on Unsplash`;
  } else {
    modalPhoto.style.display = 'none';
    document.getElementById('modal-photo-credit').innerHTML = '';
  }

  document.getElementById('modal-film-bar').style.background = fc.bar;
  document.getElementById('modal-title').textContent = recipe.name;
  document.getElementById('modal-film-badge').textContent = s.filmSimulation;
  document.getElementById('modal-film-badge').style.cssText = fc.badge + ';padding:3px 12px;border-radius:12px;font-size:12px;font-weight:600';
  document.getElementById('modal-desc').textContent = recipe.description;
  document.getElementById('modal-camera').textContent = recipe.camera;
  document.getElementById('modal-author').textContent = recipe.author;

  const settingsHtml = [
    ['Film Simulation', s.filmSimulation, 'val-text'],
    ['Dynamic Range', s.dynamicRange, 'val-text'],
    ['White Balance', s.whiteBalance, 'val-text'],
    ['WB Shift R', s.wbShiftR >= 0 ? '+' + s.wbShiftR : s.wbShiftR, s.wbShiftR > 0 ? 'val-pos' : s.wbShiftR < 0 ? 'val-neg' : 'val-zero'],
    ['WB Shift B', s.wbShiftB >= 0 ? '+' + s.wbShiftB : s.wbShiftB, s.wbShiftB > 0 ? 'val-pos' : s.wbShiftB < 0 ? 'val-neg' : 'val-zero'],
    ['Highlight Tone', s.highlightTone >= 0 ? '+' + s.highlightTone : s.highlightTone, s.highlightTone > 0 ? 'val-pos' : s.highlightTone < 0 ? 'val-neg' : 'val-zero'],
    ['Shadow Tone', s.shadowTone >= 0 ? '+' + s.shadowTone : s.shadowTone, s.shadowTone > 0 ? 'val-pos' : s.shadowTone < 0 ? 'val-neg' : 'val-zero'],
    ['Color', s.color >= 0 ? '+' + s.color : s.color, s.color > 0 ? 'val-pos' : s.color < 0 ? 'val-neg' : 'val-zero'],
    ['Sharpness', s.sharpness >= 0 ? '+' + s.sharpness : s.sharpness, s.sharpness > 0 ? 'val-pos' : s.sharpness < 0 ? 'val-neg' : 'val-zero'],
    ['Noise Reduction', s.noiseReduction >= 0 ? '+' + s.noiseReduction : s.noiseReduction, s.noiseReduction > 0 ? 'val-pos' : s.noiseReduction < 0 ? 'val-neg' : 'val-zero'],
    ['Grain Effect', s.grainEffect, 'val-text'],
    ['Color Chrome', s.colorChromeEffect, 'val-text'],
    ['Clarity', s.clarity >= 0 ? '+' + s.clarity : s.clarity, s.clarity > 0 ? 'val-pos' : s.clarity < 0 ? 'val-neg' : 'val-zero'],
    ['ISO', s.iso, 'val-text'],
    ['Exp. Comp.', s.exposureComp, s.exposureComp.startsWith('+') ? 'val-pos' : s.exposureComp.startsWith('-') ? 'val-neg' : 'val-zero'],
  ].map(([label, val, cls]) => `
    <div class="modal-setting">
      <span class="modal-setting-label">${label}</span>
      <span class="modal-setting-value ${cls}">${val}</span>
    </div>`).join('');

  document.getElementById('modal-settings').innerHTML = settingsHtml;

  const tagsHtml = recipe.tags.map(t => `<span class="tag">#${t}</span>`).join(' ');
  document.getElementById('modal-tags').innerHTML = tagsHtml;

  const srcEl = document.getElementById('modal-source');
  if (recipe.recipeSource && recipe.recipeUrl) {
    srcEl.innerHTML = `📖 Recipe source: <a href="${recipe.recipeUrl}" target="_blank">${recipe.recipeSource}</a> — by ${recipe.author}`;
    srcEl.style.display = 'block';
  } else {
    srcEl.style.display = 'none';
  }

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function filterRecipes() {
  return recipes.filter(r => {
    const sim = r.settings.filmSimulation;
    const matchFilter = activeFilter === 'All' || sim === activeFilter || sim.startsWith(activeFilter);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      sim.toLowerCase().includes(q) ||
      r.camera.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
}

function renderCards() {
  const grid = document.getElementById('grid');
  const filtered = filterRecipes();
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">📷</div><p>No recipes found.<br>Try a different filter or search term.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(buildCard).join('');
}

function buildFilterChips() {
  const container = document.getElementById('filter-chips');
  const sims = ['All', ...new Set(recipes.map(r => r.settings.filmSimulation))];
  container.innerHTML = sims.map(sim => `
    <button class="chip ${sim === activeFilter ? 'active' : ''}" onclick="setFilter('${sim}')">${sim}</button>
  `).join('');
}

function setFilter(sim) {
  activeFilter = sim;
  buildFilterChips();
  renderCards();
}

function updateStats() {
  document.getElementById('stat-recipes').textContent = recipes.length;
  const sims = new Set(recipes.map(r => r.settings.filmSimulation));
  document.getElementById('stat-sims').textContent = sims.size;
  const cams = new Set(recipes.map(r => r.camera));
  document.getElementById('stat-cameras').textContent = cams.size;
}

// Slider display helpers
function initSliders() {
  document.querySelectorAll('.slider-group input[type=range]').forEach(input => {
    const display = input.nextElementSibling;
    const v = parseInt(input.value);
    display.textContent = v >= 0 ? '+' + v : v;
    input.addEventListener('input', () => {
      const val = parseInt(input.value);
      display.textContent = val >= 0 ? '+' + val : val;
    });
  });
}

// Submit form handler — generates a GitHub issue link
function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  const body = `## Recipe: ${data.name}

**Camera:** ${data.camera}
**Author:** ${data.author}
**Description:** ${data.description}
**Tags:** ${data.tags}

| Setting | Value |
|---|---|
| Film Simulation | ${data.filmSimulation} |
| Dynamic Range | ${data.dynamicRange} |
| Highlight Tone | ${data.highlightTone} |
| Shadow Tone | ${data.shadowTone} |
| Color | ${data.color} |
| Sharpness | ${data.sharpness} |
| Noise Reduction | ${data.noiseReduction} |
| White Balance | ${data.whiteBalance} |
| WB Shift R | ${data.wbShiftR} |
| WB Shift B | ${data.wbShiftB} |
| Grain Effect | ${data.grainEffect} |
| Color Chrome Effect | ${data.colorChromeEffect} |
| Clarity | ${data.clarity} |
| ISO | ${data.iso} |
| Exposure Comp | ${data.exposureComp} |
`;

  const issueUrl = `https://github.com/jellyfish1456/jellyfish1456.github.io/issues/new?title=Recipe: ${encodeURIComponent(data.name)}&body=${encodeURIComponent(body)}&labels=recipe`;
  window.open(issueUrl, '_blank');
  showToast('Opening GitHub to submit your recipe!');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function loadVersionInfo() {
  try {
    const res = await fetch('./version.json');
    const v = await res.json();
    const vEl = document.getElementById('info-version');
    const tEl = document.getElementById('info-deploy-time');
    if (vEl) vEl.textContent = v.version;
    if (tEl) tEl.textContent = v.deployTime;
  } catch { /* silently fail */ }
}

async function init() {
  try {
    const res = await fetch('./recipes.json');
    recipes = await res.json();
  } catch {
    recipes = [];
  }

  updateStats();
  buildFilterChips();
  renderCards();
  initSliders();
  loadVersionInfo();

  document.getElementById('search').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCards();
  });

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('submit-form').addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);
