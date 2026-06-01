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
  const cover = recipe.photos && recipe.photos.length > 0 ? recipe.photos[0] : null;
  const photoHtml = cover
    ? `<div class="card-photo-wrap">
        <img class="card-photo" src="${cover.url}" alt="${recipe.name}" loading="lazy">
        ${recipe.photos.length > 1 ? `<span class="card-photo-count">📷 ${recipe.photos.length}</span>` : ''}
      </div>`
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

let currentGalleryIndex = 0;
let currentGalleryPhotos = [];

function creditHtml(photo) {
  if (!photo || !photo.credit) return '';
  if (photo.creditUrl) return `📷 <a href="${photo.creditUrl}" target="_blank" rel="noopener">${photo.credit}</a>`;
  return `Photo by ${photo.credit} on Unsplash`;
}

function showGalleryPhoto(index) {
  if (!currentGalleryPhotos.length) return;
  currentGalleryIndex = index;
  const photo = currentGalleryPhotos[index];
  document.getElementById('modal-main-photo').src = photo.url;
  document.getElementById('modal-photo-credit').innerHTML = creditHtml(photo);
  document.getElementById('gallery-counter').textContent =
    `${index + 1} / ${currentGalleryPhotos.length}`;

  // Update thumbnails active state
  document.querySelectorAll('.gallery-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Show/hide arrows
  document.getElementById('gallery-prev').style.visibility = index > 0 ? 'visible' : 'hidden';
  document.getElementById('gallery-next').style.visibility = index < currentGalleryPhotos.length - 1 ? 'visible' : 'hidden';
}

function galleryPrev() { if (currentGalleryIndex > 0) showGalleryPhoto(currentGalleryIndex - 1); }
function galleryNext() { if (currentGalleryIndex < currentGalleryPhotos.length - 1) showGalleryPhoto(currentGalleryIndex + 1); }

function openModal(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  const s = recipe.settings;
  const fc = getFilmColor(s.filmSimulation);

  // Build gallery
  const galleryEl = document.getElementById('modal-gallery');
  currentGalleryPhotos = recipe.photos || [];
  if (currentGalleryPhotos.length > 0) {
    galleryEl.style.display = 'block';
    document.getElementById('modal-main-photo').src = currentGalleryPhotos[0].url;
    document.getElementById('modal-main-photo').alt = recipe.name;

    const thumbsHtml = currentGalleryPhotos.map((p, i) =>
      `<img class="gallery-thumb ${i === 0 ? 'active' : ''}" src="${p.url}" alt="Example ${i+1}" onclick="showGalleryPhoto(${i})">`
    ).join('');
    document.getElementById('gallery-thumbs').innerHTML = thumbsHtml;
    document.getElementById('gallery-counter').textContent = `1 / ${currentGalleryPhotos.length}`;
    document.getElementById('gallery-prev').style.visibility = 'hidden';
    document.getElementById('gallery-next').style.visibility = currentGalleryPhotos.length > 1 ? 'visible' : 'hidden';
    document.getElementById('modal-photo-credit').innerHTML = creditHtml(currentGalleryPhotos[0]);
    currentGalleryIndex = 0;
  } else {
    galleryEl.style.display = 'none';
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
    const spotOpen = document.getElementById('spot-overlay').classList.contains('open');
    if (e.key === 'Escape') { closeModal(); closeSpotModal(); }
    if (e.key === 'ArrowLeft') { spotOpen ? spotPrev() : galleryPrev(); }
    if (e.key === 'ArrowRight') { spotOpen ? spotNext() : galleryNext(); }
  });

  document.getElementById('submit-form').addEventListener('submit', handleSubmit);

  document.getElementById('spot-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('spot-overlay')) closeSpotModal();
  });

  loadDestinations();
  initExpert();

  // Back-to-top button visibility
  const toTop = document.getElementById('to-top');
  if (toTop) {
    const onScroll = () => toTop.classList.toggle('show', window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile nav: close the drawer after tapping any item
  const navEl = document.getElementById('header-nav');
  if (navEl) navEl.addEventListener('click', e => {
    if (e.target.closest('.nav-btn')) closeNav();
  });
}

function scrollToTop() {
  closeNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleNav() {
  const h = document.querySelector('header');
  const open = h.classList.toggle('nav-open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeNav() {
  document.querySelector('header').classList.remove('nav-open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
}

/* ───────────── Parameter Expert ───────────── */

function initExpert() {
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('expert-file');
  if (!dz) return;

  input.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) analyzeFile(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) analyzeFile(f);
  });
}

function resetExpert() {
  document.getElementById('expert-result').style.display = 'none';
  document.getElementById('dropzone').style.display = 'flex';
  document.getElementById('expert-file').value = '';
  const v = document.getElementById('expert-preview-vid');
  v.pause(); v.removeAttribute('src'); v.load();
}

function fmtShutter(t) {
  if (!t) return null;
  if (t >= 1) return t + 's';
  return '1/' + Math.round(1 / t) + 's';
}

async function analyzeFile(file) {
  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('expert-result').style.display = 'grid';
  document.getElementById('expert-filename').textContent = file.name;
  document.getElementById('expert-recipe-suggest').style.display = 'none';
  // reset scene-AI panel for the new file
  document.getElementById('scene-result').style.display = 'none';
  const sbtn = document.getElementById('scene-btn');
  sbtn.style.display = 'inline-block';
  sbtn.disabled = false;
  sbtn.textContent = '🧠 Detect scene with on-device AI';

  const img = document.getElementById('expert-preview-img');
  const vid = document.getElementById('expert-preview-vid');
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');

  img.style.display = 'none';
  vid.style.display = 'none';

  if (isVideo) {
    vid.src = url; vid.style.display = 'block';
    window.__expertMedia = { type: 'video', el: vid };
    await analyzeVideo(file, vid);
  } else {
    img.src = url; img.style.display = 'block';
    window.__expertMedia = { type: 'image', el: img };
    await analyzeImage(file, img);
  }
}

/* ── On-device CLIP scene detection (transformers.js, no API) ── */

let __sceneClassifier = null;

function currentMediaForCLIP() {
  const m = window.__expertMedia;
  if (!m) return null;
  if (m.type === 'image') return m.el.src;
  // video → grab the current frame as a data URL
  const v = m.el, c = document.createElement('canvas');
  c.width = v.videoWidth || 512; c.height = v.videoHeight || 512;
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function detectScene() {
  const btn = document.getElementById('scene-btn');
  const resEl = document.getElementById('scene-result');
  const imgSrc = currentMediaForCLIP();
  if (!imgSrc) return;

  btn.disabled = true;
  btn.textContent = '⏳ Loading model…';
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1');
    mod.env.allowLocalModels = false;
    if (!__sceneClassifier) {
      __sceneClassifier = await mod.pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
        progress_callback: p => {
          if (p.status === 'progress' && p.progress != null)
            btn.textContent = `⏳ Downloading model… ${Math.round(p.progress)}%`;
        },
      });
    }
    btn.textContent = '🔎 Analyzing…';

    const scenes = [
      'a portrait of a person', 'a landscape', 'a street photography scene',
      'architecture or a building', 'food', 'a night scene', 'a seascape or the ocean',
      'a forest or nature', 'a city skyline', 'an indoor interior',
      'a close-up macro shot', 'an animal or pet',
    ];
    const lights = [
      'golden hour sunset light', 'blue hour twilight', 'bright daylight',
      'overcast cloudy light', 'night or artificial light', 'strong backlight',
    ];

    const [sceneOut, lightOut] = await Promise.all([
      __sceneClassifier(imgSrc, scenes),
      __sceneClassifier(imgSrc, lights),
    ]);

    renderScene(sceneOut, lightOut);
    btn.style.display = 'none';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '🧠 Detect scene with on-device AI';
    resEl.style.display = 'block';
    resEl.innerHTML = `<div class="scene-err">Couldn't load the on-device model (needs a network connection the first time, and a browser that supports WebAssembly). ${(err && err.message) ? '<br><small>' + err.message + '</small>' : ''}</div>`;
  }
}

const clean = l => l.replace(/^(a |an |the )/, '');

function renderScene(sceneOut, lightOut) {
  const resEl = document.getElementById('scene-result');
  resEl.style.display = 'block';
  const topScene = sceneOut[0], topLight = lightOut[0];

  const chips = sceneOut.slice(0, 3).map((s, i) =>
    `<span class="scene-chip ${i === 0 ? 'top' : ''}">${clean(s.label)} <b>${Math.round(s.score * 100)}%</b></span>`
  ).join('');

  resEl.innerHTML = `
    <div class="scene-title">🧠 On-device AI · scene reading</div>
    <div class="scene-line"><span class="scene-k">Scene</span>${chips}</div>
    <div class="scene-line"><span class="scene-k">Light</span>
      <span class="scene-chip top">${clean(topLight.label)} <b>${Math.round(topLight.score * 100)}%</b></span></div>
    <div class="scene-foot">Open-source CLIP model, run locally — nothing uploaded.</div>`;

  refineSuggestionFromScene(topScene.label, topLight.label);
}

function refineSuggestionFromScene(scene, light) {
  const s = scene.toLowerCase(), l = light.toLowerCase();
  let name, why;
  if (s.includes('night') || l.includes('night') || l.includes('blue hour')) { name = 'Eterna Cinema Street'; why = `AI read this as ${clean(scene)}`; }
  else if (s.includes('landscape') || s.includes('forest') || s.includes('seascape') || s.includes('skyline')) { name = 'Velvia Landscape'; why = `AI read this as ${clean(scene)}`; }
  else if (s.includes('street') || s.includes('architecture')) { name = 'Classic Negative Street'; why = `AI read this as ${clean(scene)}`; }
  else if (s.includes('portrait') || s.includes('food') || s.includes('interior') || s.includes('close-up')) {
    name = l.includes('golden') ? 'Kodachrome 64' : 'Fujicolor 200';
    why = `AI read this as ${clean(scene)}${l.includes('golden') ? ' in golden light' : ''}`;
  } else { name = 'Fujicolor 200'; why = `AI read this as ${clean(scene)}`; }
  showRecipeSuggest(name, why);
}

async function analyzeImage(file, imgEl) {
  let exif = null;
  try {
    exif = await exifr.parse(file, { tiff: true, exif: true, gps: true, makerNote: true, mergeOutput: true });
  } catch { exif = null; }

  const hasRealParams = exif && (exif.FNumber || exif.ExposureTime || exif.ISO || exif.ISOSpeedRatings || exif.FocalLength);

  if (hasRealParams) {
    renderExifParams(exif);
    // If no film-sim-based suggestion was shown, suggest from pixels as a fallback
    if (document.getElementById('expert-recipe-suggest').style.display === 'none') {
      await new Promise(res => { if (imgEl.complete) res(); else imgEl.onload = res; });
      const est = estimateFromImage(imgEl);
      if (!est.failed) suggestRecipeFromEstimate(est);
    }
  } else {
    // fall back to pixel estimation
    await new Promise(res => { if (imgEl.complete) res(); else imgEl.onload = res; });
    const est = estimateFromImage(imgEl);
    renderEstimate(est, exif);
  }
}

async function analyzeVideo(file, vidEl) {
  // Try container metadata (very limited); always do a frame estimate.
  let exif = null;
  try { exif = await exifr.parse(file).catch(() => null); } catch { exif = null; }

  await new Promise(res => {
    vidEl.onloadeddata = () => { try { vidEl.currentTime = Math.min(1, (vidEl.duration || 2) / 2); } catch {} };
    vidEl.onseeked = res;
    setTimeout(res, 2500); // safety
  });
  const est = estimateFromImage(vidEl, true);
  est.isVideo = true;
  renderEstimate(est, exif);
}

function estimateFromImage(el, isVideo) {
  const w = 200, h = 200;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sw = el.naturalWidth || el.videoWidth || w;
  const sh = el.naturalHeight || el.videoHeight || h;
  try { ctx.drawImage(el, 0, 0, sw, sh, 0, 0, w, h); } catch { return { failed: true }; }
  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return { failed: true }; }

  const N = w * h;
  let rT = 0, gT = 0, bT = 0, lumaSum = 0, satSum = 0;
  const hist = new Float64Array(256);     // luma histogram
  const gray = new Float64Array(N);       // for Laplacian
  const samples = [];                     // RGB samples for k-means palette
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rT += r; gT += g; bT += b;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaSum += luma;
    gray[p] = luma;
    hist[Math.round(luma)]++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    if (p % 13 === 0) samples.push([r, g, b]);  // ~3000 samples
  }
  const avgR = rT / N, avgG = gT / N, avgB = bT / N;
  const avgLuma = lumaSum / N;
  const avgSat = satSum / N;

  // ---- Histogram-based exposure / dynamic range / contrast ----
  const pct = q => { let acc = 0, target = q * N; for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= target) return k; } return 255; };
  const p1 = pct(0.01), p5 = pct(0.05), p50 = pct(0.5), p95 = pct(0.95), p99 = pct(0.99);
  const shadowClip = (hist.slice(0, 4).reduce((a, x) => a + x, 0) / N) * 100;   // % near-black
  const highClip = (hist.slice(252).reduce((a, x) => a + x, 0) / N) * 100;       // % near-white
  const dynamicRange = p95 - p5;                                                 // 0..255 spread
  let varSum = 0; for (let p = 0; p < N; p++) varSum += (gray[p] - avgLuma) ** 2;
  const contrast = Math.sqrt(varSum / N);

  // ---- Gray-World white-balance → Kelvin estimate + suggested shift ----
  const rb = avgR / (avgB || 1);
  // map R:B ratio to an approximate colour temperature (empirical)
  let kelvinNum;
  if (rb >= 1.4) kelvinNum = 3000;
  else if (rb >= 1.25) kelvinNum = 3500;
  else if (rb >= 1.15) kelvinNum = 4300;
  else if (rb >= 1.06) kelvinNum = 5200;
  else if (rb >= 0.96) kelvinNum = 5800;
  else if (rb >= 0.88) kelvinNum = 6800;
  else if (rb >= 0.8) kelvinNum = 8000;
  else kelvinNum = 10000;
  const wbWord = rb > 1.18 ? 'Warm' : rb > 1.05 ? 'Slightly warm' : rb > 0.95 ? 'Neutral' : rb > 0.85 ? 'Slightly cool' : 'Cool';
  const kelvin = `≈ ${kelvinNum}K`;
  // green/magenta tint from G vs (R+B)/2
  const gm = avgG - (avgR + avgB) / 2;
  const tint = gm > 6 ? 'green cast' : gm < -6 ? 'magenta cast' : 'neutral tint';
  // suggested WB shift to neutralise (Fuji-style R/B shift, ~ each step ≈ small)
  const shiftR = Math.max(-9, Math.min(9, Math.round((1 - rb) * 9)));
  const shiftB = -shiftR;

  // ---- Laplacian variance → sharpness / softness ----
  let lapSum = 0, lapSq = 0, lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w];
      lapSum += lap; lapSq += lap * lap; lapN++;
    }
  }
  const lapVar = lapSq / lapN - (lapSum / lapN) ** 2;

  // ---- dominant colour palette (mini k-means) ----
  const palette = kMeansPalette(samples, 5, 8);

  // ---- words ----
  const expWord = p50 > 175 ? 'Bright / high-key' : p50 > 120 ? 'Normal' : p50 > 70 ? 'Low / moody' : 'Dark / low-key';
  let expDetail = [];
  if (highClip > 3) expDetail.push(`${highClip.toFixed(0)}% blown highlights`);
  if (shadowClip > 5) expDetail.push(`${shadowClip.toFixed(0)}% crushed shadows`);
  const contrastWord = (dynamicRange > 200 || contrast > 70) ? 'High' : (dynamicRange > 140 || contrast > 45) ? 'Medium' : 'Low / flat';
  const drWord = dynamicRange > 210 ? 'Wide' : dynamicRange > 150 ? 'Medium' : 'Narrow';
  const satWord = avgSat < 0.08 ? 'Monochrome / desaturated' : avgSat < 0.22 ? 'Muted' : avgSat < 0.4 ? 'Natural' : 'Vivid / saturated';
  const sharpWord = lapVar > 900 ? 'Crisp / lots of detail' : lapVar > 300 ? 'Normal' : 'Soft / shallow DOF or slight blur';

  return {
    avgLuma, avgSat, contrast, rb, wbWord, kelvin, kelvinNum, tint,
    shiftR, shiftB, expWord, expDetail, contrastWord, drWord, dynamicRange,
    satWord, sharpWord, lapVar, highClip, shadowClip, p5, p50, p95, palette,
  };
}

// tiny k-means for a dominant-colour palette
function kMeansPalette(samples, k, iters) {
  if (!samples.length) return [];
  // init centroids from spread-out samples
  let cents = [];
  for (let i = 0; i < k; i++) cents.push(samples[Math.floor(i * samples.length / k)].slice());
  const assign = new Int32Array(samples.length);
  for (let it = 0; it < iters; it++) {
    for (let s = 0; s < samples.length; s++) {
      let best = 0, bd = Infinity;
      for (let cI = 0; cI < k; cI++) {
        const dr = samples[s][0] - cents[cI][0], dg = samples[s][1] - cents[cI][1], db = samples[s][2] - cents[cI][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = cI; }
      }
      assign[s] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s++) {
      const a = assign[s];
      sum[a][0] += samples[s][0]; sum[a][1] += samples[s][1]; sum[a][2] += samples[s][2]; sum[a][3]++;
    }
    for (let cI = 0; cI < k; cI++) if (sum[cI][3]) cents[cI] = [sum[cI][0] / sum[cI][3], sum[cI][1] / sum[cI][3], sum[cI][2] / sum[cI][3]];
  }
  const counts = new Array(k).fill(0);
  for (let s = 0; s < samples.length; s++) counts[assign[s]]++;
  return cents
    .map((c, i) => ({ rgb: c.map(Math.round), pct: counts[i] / samples.length }))
    .sort((a, b) => b.pct - a.pct);
}

function box(label, value, icon, estimated) {
  if (value == null || value === '') return '';
  return `<div class="param-box">
    <div class="param-label">${icon || ''} ${label}</div>
    <div class="param-value ${estimated ? 'estimated' : ''}">${value}</div>
  </div>`;
}

function renderExifParams(e) {
  const badge = document.getElementById('expert-source-badge');
  badge.className = 'expert-source-badge exif';
  badge.textContent = '✓ Real EXIF data — read from the file';

  const iso = e.ISO || e.ISOSpeedRatings || (Array.isArray(e.ISOSpeedRatings) ? e.ISOSpeedRatings[0] : null);
  const aperture = e.FNumber || e.ApertureValue;
  const shutter = fmtShutter(e.ExposureTime);
  const focal = e.FocalLength ? Math.round(e.FocalLength) + 'mm' : null;
  const focal35 = e.FocalLengthIn35mmFormat ? `<small> (${Math.round(e.FocalLengthIn35mmFormat)}mm eq)</small>` : '';
  const ec = (e.ExposureCompensation != null) ? (e.ExposureCompensation > 0 ? '+' : '') + (Math.round(e.ExposureCompensation * 10) / 10) + ' EV' : null;
  const wbMap = { 0: 'Auto', 1: 'Manual' };
  const wb = (e.WhiteBalance != null) ? (wbMap[e.WhiteBalance] ?? e.WhiteBalance) : null;
  const cam = [e.Make, e.Model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;
  const lens = e.LensModel || e.LensMake || null;
  const flashOn = (e.Flash != null) ? ((e.Flash & 1) ? 'Fired' : 'Off') : null;
  const meterMap = { 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 5: 'Pattern/Matrix', 6: 'Partial' };
  const meter = (e.MeteringMode != null) ? (meterMap[e.MeteringMode] ?? e.MeteringMode) : null;
  const date = e.DateTimeOriginal ? new Date(e.DateTimeOriginal).toLocaleString() : null;
  // Fujifilm film simulation may surface under a few possible keys
  const filmSim = e.FilmMode || e.FilmSimulation || e.PictureMode || null;

  let html = '';
  html += box('Aperture', aperture ? 'f/' + aperture : null, '🔘');
  html += box('Shutter', shutter, '⏱️');
  html += box('ISO', iso, '📊');
  html += box('Focal Length', focal ? focal + focal35 : null, '🔭');
  html += box('Exposure Comp.', ec, '±');
  html += box('White Balance', wb, '🎨');
  html += box('Metering', meter, '🎯');
  html += box('Flash', flashOn, '⚡');
  html += box('Camera', cam, '📷');
  html += box('Lens', lens, '🔎');
  html += box('Film Simulation', filmSim, '🎞️');
  html += box('Shot On', date, '🗓️');
  if (e.latitude && e.longitude) {
    html += box('GPS', `<small>${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}</small>`, '📍');
  }
  document.getElementById('param-grid').innerHTML = html;

  suggestRecipeFromExif(e, filmSim);

  document.getElementById('expert-note').innerHTML =
    'These values were read directly from the image\'s embedded EXIF metadata, so they are the camera\'s actual settings. White Balance often only reports Auto/Manual — the fine Kelvin/shift isn\'t always stored.';
}

function renderEstimate(est, exif) {
  const badge = document.getElementById('expert-source-badge');
  if (est.failed) {
    badge.className = 'expert-source-badge none';
    badge.textContent = '✕ Couldn\'t read this file';
    document.getElementById('param-grid').innerHTML = '';
    document.getElementById('expert-note').textContent =
      'The browser couldn\'t decode this file for analysis (HEIC preview is sometimes unsupported). Try a JPEG.';
    return;
  }
  badge.className = 'expert-source-badge estimate';
  badge.textContent = est.isVideo
    ? '≈ Estimated from a video frame — no EXIF in video'
    : '≈ Estimated from pixels — no EXIF found in this file';

  const wbVal = `${est.wbWord} <small>${est.kelvin}${est.tint !== 'neutral tint' ? ', ' + est.tint : ''}</small>`;
  const wbShift = (est.shiftR > 0 ? `R+${est.shiftR} B${est.shiftB}` : est.shiftR < 0 ? `R${est.shiftR} B+${Math.abs(est.shiftB)}` : 'no shift');
  const expVal = est.expWord + (est.expDetail.length ? ` <small>${est.expDetail.join(', ')}</small>` : '');

  let html = '';
  html += box('White Balance', wbVal, '🎨', true);
  html += box('To neutralise', `<small>shift ${wbShift}</small>`, '⚖️', true);
  html += box('Exposure', expVal, '💡', true);
  html += box('Dynamic Range', `${est.drWord} <small>(${est.dynamicRange}/255)</small>`, '📈', true);
  html += box('Contrast', est.contrastWord, '◐', true);
  html += box('Saturation', est.satWord, '🌈', true);
  html += box('Sharpness', est.sharpWord, '🔍', true);
  html += box('Aperture', '— <small>not recoverable</small>', '🔘');
  html += box('Shutter', '— <small>not recoverable</small>', '⏱️');
  html += box('ISO', '— <small>not recoverable</small>', '📊');
  document.getElementById('param-grid').innerHTML = html;

  // dominant colour palette
  if (est.palette && est.palette.length) {
    const sw = est.palette.map(p =>
      `<div class="swatch" title="${p.pct > 0 ? (p.pct * 100).toFixed(0) + '%' : ''}" style="background:rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]});flex:${Math.max(0.6, p.pct * 5)}"></div>`
    ).join('');
    const wrap = `<div class="param-box" style="grid-column:1/-1">
        <div class="param-label">🎨 Dominant colours</div>
        <div class="palette-row">${sw}</div>
      </div>`;
    document.getElementById('param-grid').insertAdjacentHTML('beforeend', wrap);
  }

  suggestRecipeFromEstimate(est);

  document.getElementById('expert-note').innerHTML =
    '⚠️ No EXIF in this file (common for screenshots, social downloads and all videos). Aperture / shutter / ISO are <strong>physically not recoverable</strong>. Everything above is computed in your browser by real image-analysis algorithms — Gray-World white balance, a luma histogram (exposure &amp; dynamic range), Laplacian variance (sharpness) and k-means (dominant colours) — nothing is uploaded.';
}

function showRecipeSuggest(name, why) {
  const r = recipes.find(x => x.name === name) || recipes.find(x => x.settings.filmSimulation === name);
  if (!r) return;
  const el = document.getElementById('expert-recipe-suggest');
  el.style.display = 'block';
  el.innerHTML = `<div class="ers-label">Closest recipe on this site</div>
    <div class="ers-name">🎞️ ${r.name}</div>
    <div class="ers-why">${why} · click to view settings</div>`;
  el.onclick = () => openModal(r.id);
}

function suggestRecipeFromExif(e, filmSim) {
  if (filmSim && recipes.length) {
    const match = recipes.find(r => filmSim.toString().toLowerCase().includes(r.settings.filmSimulation.split('/')[0].toLowerCase()));
    if (match) { showRecipeSuggest(match.name, `Matches the film simulation in your file (${filmSim})`); return; }
  }
  // otherwise fall through to nothing specific
}

function suggestRecipeFromEstimate(est) {
  let name, why;
  if (est.avgSat < 0.08) { name = 'Ilford HP5 Plus'; why = 'Your image is near-monochrome'; }
  else if (est.avgSat > 0.4 && est.contrast > 55) { name = 'Velvia Landscape'; why = 'Vivid, high-contrast colours'; }
  else if (est.rb > 1.2) { name = 'Kodachrome 64'; why = 'Warm tones, like late-day light'; }
  else if (est.rb < 0.92 && est.avgSat < 0.25) { name = 'Eterna Cinema Street'; why = 'Cool, muted, cinematic palette'; }
  else { name = 'Fujicolor 200'; why = 'Balanced everyday colour'; }
  showRecipeSuggest(name, why);
}

/* ───────────── Destinations / Travel ───────────── */

let destinations = [];
let spotIndex = {};        // flat lookup: "istanbul:0" -> spot object
let spotGalleryPhotos = [];
let spotGalleryIndex = 0;

async function loadDestinations() {
  try {
    const res = await fetch('./destinations.json');
    destinations = await res.json();
  } catch {
    destinations = [];
  }
  renderDestinations();
}

function buildCityCard(dest) {
  const spotsHtml = dest.spots.map((spot, i) => {
    const key = `${dest.id}:${i}`;
    spotIndex[key] = spot;
    const cover = spot.photos[0];
    return `
      <div class="spot-card" onclick="openSpotModal('${key}')">
        <div class="spot-card-photo">
          <img src="${cover.url}" alt="${spot.name}" loading="lazy" onerror="this.style.opacity=0.15">
          ${spot.photos.length > 1 ? `<span class="spot-card-count">📷 ${spot.photos.length}</span>` : ''}
        </div>
        <div class="spot-card-body">
          <div class="spot-card-name">${spot.name}</div>
          <div class="spot-card-name-zh">${spot.nameZh || ''}</div>
          <div class="spot-card-recipe">🎞️ ${spot.recommendedRecipe}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="dest-card">
      <div class="dest-banner" style="background-image:url('${dest.coverPhoto}')">
        <div class="dest-banner-content">
          <h3>${dest.flag} ${dest.city} <span class="dest-city-zh">${dest.cityZh}</span></h3>
          <p class="dest-tagline">${dest.tagline}</p>
        </div>
      </div>
      <div class="dest-meta">📍 <strong>${dest.country} ${dest.countryZh}</strong> &nbsp;·&nbsp; 🗓️ Best season: <strong>${dest.bestSeason}</strong></div>
      ${dest.igTags && dest.igTags.length ? `
      <div class="ig-explore">
        <span class="ig-explore-label">📸 Find real Fuji shots on Instagram:</span>
        ${dest.igTags.map(t => `<a class="ig-tag" href="https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/" target="_blank" rel="noopener">#${t}</a>`).join('')}
      </div>` : ''}
      <div class="spots-grid">${spotsHtml}</div>
    </div>`;
}

function renderDestinations() {
  const container = document.getElementById('destinations-list');
  if (!destinations.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🗺️</div><p>No destinations yet.</p></div>`;
    return;
  }

  // group cities by country (preserve first-seen order)
  const countries = [];
  const byId = {};
  destinations.forEach(d => {
    const id = (d.country || 'Other').toLowerCase().replace(/\s+/g, '-');
    if (!byId[id]) { byId[id] = { id, country: d.country, countryZh: d.countryZh || '', flag: d.flag || '🌍', cities: [] }; countries.push(byId[id]); }
    byId[id].cities.push(d);
  });

  container.innerHTML = countries.map((c, idx) => {
    const spotCount = c.cities.reduce((a, city) => a + city.spots.length, 0);
    const open = idx === 0; // first country expanded by default
    const cities = c.cities.map(buildCityCard).join('');
    return `
      <div class="country-block ${open ? 'open' : ''}" id="country-${c.id}">
        <button class="country-header" onclick="toggleCountry('${c.id}')" aria-expanded="${open}">
          <span class="country-flag">${c.flag}</span>
          <span class="country-name">${c.country} <span class="country-name-zh">${c.countryZh}</span></span>
          <span class="country-count">${c.cities.length} cities · ${spotCount} spots</span>
          <span class="country-chevron">▾</span>
        </button>
        <div class="country-cities">${cities}</div>
      </div>`;
  }).join('');
}

function toggleCountry(id) {
  const el = document.getElementById('country-' + id);
  if (!el) return;
  const open = el.classList.toggle('open');
  const btn = el.querySelector('.country-header');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function showSpotPhoto(index) {
  if (!spotGalleryPhotos.length) return;
  spotGalleryIndex = index;
  const photo = spotGalleryPhotos[index];
  document.getElementById('spot-main-photo').src = photo.url;
  document.getElementById('spot-photo-credit').innerHTML = `📷 Source: ${photo.credit}`;
  document.getElementById('spot-counter').textContent = `${index + 1} / ${spotGalleryPhotos.length}`;
  document.querySelectorAll('#spot-thumbs .gallery-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  document.getElementById('spot-prev').style.visibility = index > 0 ? 'visible' : 'hidden';
  document.getElementById('spot-next').style.visibility = index < spotGalleryPhotos.length - 1 ? 'visible' : 'hidden';
}

function spotPrev() { if (spotGalleryIndex > 0) showSpotPhoto(spotGalleryIndex - 1); }
function spotNext() { if (spotGalleryIndex < spotGalleryPhotos.length - 1) showSpotPhoto(spotGalleryIndex + 1); }

function openSpotModal(key) {
  const spot = spotIndex[key];
  if (!spot) return;

  spotGalleryPhotos = spot.photos || [];
  spotGalleryIndex = 0;
  const thumbsHtml = spotGalleryPhotos.map((p, i) =>
    `<img class="gallery-thumb ${i === 0 ? 'active' : ''}" src="${p.url}" alt="Example ${i+1}" onclick="showSpotPhoto(${i})">`
  ).join('');
  document.getElementById('spot-thumbs').innerHTML = thumbsHtml;
  showSpotPhoto(0);

  document.getElementById('spot-title').textContent = spot.name;
  document.getElementById('spot-title-zh').textContent = spot.nameZh || '';
  document.getElementById('spot-tags').innerHTML =
    (spot.tags || []).map(t => `<span class="tag">#${t}</span>`).join(' ');
  document.getElementById('spot-besttime').textContent = spot.bestTime;
  document.getElementById('spot-recipe').innerHTML = `${spot.recommendedRecipe} <span style="font-size:11px">→ view</span>`;
  document.getElementById('spot-gear').textContent = spot.gear;

  document.getElementById('spot-angles').innerHTML =
    spot.angles.map(a => `<li>${a}</li>`).join('');

  // Clicking the recipe box jumps to that recipe
  const recipeBox = document.getElementById('spot-recipe-box');
  recipeBox.onclick = () => {
    const r = recipes.find(x => x.name === spot.recommendedRecipe);
    if (r) { closeSpotModal(); openModal(r.id); }
  };

  document.getElementById('spot-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSpotModal() {
  document.getElementById('spot-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', init);
