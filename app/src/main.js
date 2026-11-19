// Neon Shore — wires the editor: photos in, layout and grade picked, caption
// typed, cover drawn live, PNG exported in three post sizes. A `?shot=`
// query sets up a fixed scene for a screenshot instead (./shots.js).
import { renderCover, LAYOUTS, GRADES, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const panelInfo = document.getElementById('panel-info');

const SIZES = [
  { id: 'square', label: '1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 x 1080', w: 1920, h: 1080 },
];

const state = {
  layout: 'grid4',
  grade: 'sunset',
  title: 'Neon Shore',
  subtitle: 'a night on the coast',
  heat: 4,
  badge: 'Launch week',
  grain: true,
  vignette: true,
  size: 'square',
  photos: [], // { id, name, img, url }
  panels: [], // { photo, zoom, ox, oy } per panel index
  selectedPanel: 0,
};

let photoSeq = 0;
let undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, heat: state.heat, badge: state.badge,
    grain: state.grain, vignette: state.vignette, size: state.size,
    panels: state.panels, selectedPanel: state.selectedPanel,
    photos: state.photos.map((p) => ({ id: p.id, name: p.name, url: p.url })),
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, {
    layout: s.layout, grade: s.grade, title: s.title, subtitle: s.subtitle,
    heat: s.heat, badge: s.badge, grain: s.grain, vignette: s.vignette,
    size: s.size, panels: s.panels, selectedPanel: s.selectedPanel,
  });
  // Photos survive by id: re-attach the live images to the restored slots.
  state.photos = s.photos
    .map((p) => state.photos.find((q) => q.id === p.id) || null)
    .filter(Boolean);
  syncControls();
  redraw();
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('undo').disabled = !undoStack.length;
  document.getElementById('redo').disabled = !redoStack.length;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function panelCount() {
  return (LAYOUTS.find((l) => l.id === state.layout) || LAYOUTS[0]).panels;
}

function ensurePanels() {
  const n = panelCount();
  while (state.panels.length < n) {
    state.panels.push({ photo: state.photos.length ? 0 : -1, zoom: 1, ox: 0, oy: 0 });
  }
  state.panels.length = n;
  if (state.selectedPanel >= n) state.selectedPanel = 0;
}

function currentSize() {
  return SIZES.find((s) => s.id === state.size) || SIZES[0];
}

function redraw() {
  const size = currentSize();
  canvas.width = size.w;
  canvas.height = size.h;
  ensurePanels();
  renderCover(canvas, state);
  updatePanelInfo();
}

function updatePanelInfo() {
  const n = panelCount();
  const slot = state.panels[state.selectedPanel] || { photo: -1, zoom: 1 };
  const name = slot.photo >= 0 && state.photos[slot.photo]
    ? state.photos[slot.photo].name : 'no photo';
  panelInfo.textContent = `Panel ${state.selectedPanel + 1} of ${n} — ${name} — drag to move, scroll to zoom`;
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('on', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === state.size);
  });
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('heat').value = String(state.heat);
  document.getElementById('badge').value = state.badge;
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  renderPhotoList();
}

function renderPhotoList() {
  const list = document.getElementById('photos');
  list.innerHTML = '';
  state.photos.forEach((p, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = `${i + 1} · ${p.name}`;
    chip.title = 'Use this photo for the selected panel';
    chip.addEventListener('click', () => {
      pushUndo();
      ensurePanels();
      state.panels[state.selectedPanel].photo = i;
      redraw();
    });
    list.appendChild(chip);
  });
  const fillAll = document.createElement('button');
  fillAll.type = 'button';
  fillAll.className = 'chip wide';
  fillAll.textContent = 'Fill every panel with photo 1';
  fillAll.addEventListener('click', () => {
    if (!state.photos.length) return;
    pushUndo();
    ensurePanels();
    state.panels.forEach((s) => { s.photo = 0; });
    redraw();
  });
  list.appendChild(fillAll);
}

async function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    state.photos.push({ id: ++photoSeq, name: file.name, img, url });
  }
  if (state.photos.length) {
    pushUndo();
    ensurePanels();
    state.panels.forEach((s) => { if (s.photo < 0) s.photo = 0; });
    redraw();
  }
}

function exportPNG(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const saved = state.size;
  state.size = size.id;
  renderCover(off, state);
  state.size = saved;
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-shore-${size.w}x${size.h}.png`;
    a.click();
    statusEl.textContent = `Saved neon-shore-${size.w}x${size.h}.png`;
  }, 'image/png');
}

// --- Controls -------------------------------------------------------------

document.getElementById('photo').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});
document.getElementById('load-sample').addEventListener('click', async () => {
  const img = await loadImage('samples/boulevard.jpg');
  state.photos.push({ id: ++photoSeq, name: 'boulevard.jpg', img, url: 'samples/boulevard.jpg' });
  const img2 = await loadImage('samples/pier.jpg');
  state.photos.push({ id: ++photoSeq, name: 'pier.jpg', img: img2, url: 'samples/pier.jpg' });
  pushUndo();
  ensurePanels();
  state.panels.forEach((s) => { if (s.photo < 0) s.photo = 0; });
  redraw();
  statusEl.textContent = 'Loaded the two sample photos';
});

document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => {
    if (state.layout === b.dataset.layout) return;
    pushUndo();
    state.layout = b.dataset.layout;
    redraw();
    syncControls();
  });
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => {
    if (state.grade === b.dataset.grade) return;
    pushUndo();
    state.grade = b.dataset.grade;
    redraw();
    syncControls();
  });
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    if (state.size === b.dataset.size) return;
    pushUndo();
    state.size = b.dataset.size;
    redraw();
    syncControls();
  });
});

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('heat').addEventListener('input', (e) => {
  state.heat = Number(e.target.value);
  redraw();
});
document.getElementById('badge').addEventListener('input', (e) => {
  state.badge = e.target.value;
  redraw();
});
document.getElementById('grain').addEventListener('change', (e) => {
  pushUndo();
  state.grain = e.target.checked;
  redraw();
});
document.getElementById('vignette').addEventListener('change', (e) => {
  pushUndo();
  state.vignette = e.target.checked;
  redraw();
});
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('export-all').addEventListener('click', () => {
  SIZES.forEach((s, i) => setTimeout(() => exportPNG(s), i * 350));
  statusEl.textContent = 'Exporting all three sizes…';
});
SIZES.forEach((s) => {
  document.getElementById(`export-${s.id}`).addEventListener('click', () => exportPNG(s));
});

// --- Drag to move, scroll to zoom, click to select a panel ---------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function hitPanel(p) {
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = hitPanel(p);
  if (i < 0) return;
  canvas.setPointerCapture(e.pointerId);
  state.selectedPanel = i;
  const slot = state.panels[i];
  drag = { i, x: p.x, y: p.y, ox: slot.ox, oy: slot.oy, moved: false };
  updatePanelInfo();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const r = panels[drag.i];
  const dx = (p.x - drag.x) / r.w;
  const dy = (p.y - drag.y) / r.h;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  const slot = state.panels[drag.i];
  slot.ox = drag.ox + dx;
  slot.oy = drag.oy + dy;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushUndo();
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const i = hitPanel(p);
  if (i < 0) return;
  pushUndo();
  const slot = state.panels[i];
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  state.selectedPanel = i;
  redraw();
}, { passive: false });

// --- Boot -----------------------------------------------------------------

async function boot() {
  try {
    const anton = new FontFace('Anton', 'url(fonts/Anton-Regular.ttf)');
    const pacifico = new FontFace('Pacifico', 'url(fonts/Pacifico-Regular.ttf)');
    document.fonts.add(anton);
    document.fonts.add(pacifico);
    await Promise.all([anton.load(), pacifico.load()]);
  } catch (err) {
    statusEl.textContent = 'Fonts did not load; the cover falls back to system fonts.';
  }
  syncControls();
  updateUndoButtons();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, state, redraw, loadImage);
    syncControls();
    updateUndoButtons();
  } else {
    redraw();
  }
}

boot();
