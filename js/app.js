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

function showGalleryPhoto(index) {
  if (!currentGalleryPhotos.length) return;
  currentGalleryIndex = index;
  const photo = currentGalleryPhotos[index];
  document.getElementById('modal-main-photo').src = photo.url;
  document.getElementById('modal-photo-credit').innerHTML =
    `Photo by ${photo.credit} on Unsplash`;
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
    document.getElementById('modal-photo-credit').innerHTML =
      `Photo by ${currentGalleryPhotos[0].credit} on Unsplash`;
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

  const img = document.getElementById('expert-preview-img');
  const vid = document.getElementById('expert-preview-vid');
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');

  img.style.display = 'none';
  vid.style.display = 'none';

  if (isVideo) {
    vid.src = url; vid.style.display = 'block';
    await analyzeVideo(file, vid);
  } else {
    img.src = url; img.style.display = 'block';
    await analyzeImage(file, img);
  }
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
  const w = 80, h = 80;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sw = el.naturalWidth || el.videoWidth || w;
  const sh = el.naturalHeight || el.videoHeight || h;
  try { ctx.drawImage(el, 0, 0, sw, sh, 0, 0, w, h); } catch { return { failed: true }; }
  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return { failed: true }; }

  let rT = 0, gT = 0, bT = 0, lumaSum = 0, satSum = 0, n = 0;
  const lumas = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rT += r; gT += g; bT += b;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaSum += luma; lumas.push(luma);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    n++;
  }
  const avgR = rT / n, avgG = gT / n, avgB = bT / n;
  const avgLuma = lumaSum / n;
  const avgSat = satSum / n;
  const variance = lumas.reduce((a, l) => a + (l - avgLuma) ** 2, 0) / n;
  const contrast = Math.sqrt(variance);

  // crude colour-temperature tendency from R:B ratio
  const rb = avgR / (avgB || 1);
  let wbWord, kelvin;
  if (rb > 1.25) { wbWord = 'Warm'; kelvin = '≈ 3000–4000K (tungsten / sunset)'; }
  else if (rb > 1.08) { wbWord = 'Slightly warm'; kelvin = '≈ 4500–5500K (daylight)'; }
  else if (rb > 0.92) { wbWord = 'Neutral'; kelvin = '≈ 5500–6500K (daylight)'; }
  else if (rb > 0.8) { wbWord = 'Slightly cool'; kelvin = '≈ 6500–7500K (shade / cloudy)'; }
  else { wbWord = 'Cool'; kelvin = '≈ 7500K+ (deep shade / blue hour)'; }

  const expWord = avgLuma > 175 ? 'Bright / high-key' : avgLuma > 110 ? 'Normal' : avgLuma > 60 ? 'Low / moody' : 'Dark / low-key';
  const contrastWord = contrast > 70 ? 'High' : contrast > 45 ? 'Medium' : 'Low / flat';
  const satWord = avgSat < 0.08 ? 'Monochrome / desaturated' : avgSat < 0.22 ? 'Muted' : avgSat < 0.4 ? 'Natural' : 'Vivid / saturated';

  return { avgLuma, avgSat, contrast, rb, wbWord, kelvin, expWord, contrastWord, satWord };
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

  let html = '';
  html += box('White Balance', est.wbWord + ` <small>${est.kelvin}</small>`, '🎨', true);
  html += box('Exposure', est.expWord, '💡', true);
  html += box('Contrast', est.contrastWord, '◐', true);
  html += box('Saturation', est.satWord, '🌈', true);
  html += box('Aperture', '— <small>not recoverable</small>', '🔘');
  html += box('Shutter', '— <small>not recoverable</small>', '⏱️');
  html += box('ISO', '— <small>not recoverable</small>', '📊');
  document.getElementById('param-grid').innerHTML = html;

  suggestRecipeFromEstimate(est);

  document.getElementById('expert-note').innerHTML =
    '⚠️ This file has no EXIF metadata (common for screenshots, social-media downloads, and all videos). Aperture, shutter and ISO are <strong>physically not recoverable</strong> — that information was never stored in the pixels. The values above are rough estimates from the image colours and brightness only.';
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

function renderDestinations() {
  const container = document.getElementById('destinations-list');
  if (!destinations.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🗺️</div><p>No destinations yet.</p></div>`;
    return;
  }

  container.innerHTML = destinations.map(dest => {
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
        <div class="spots-grid">${spotsHtml}</div>
      </div>`;
  }).join('');
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
