// Fixed scenes for screenshots.
//   ?shot=cover   — the cover alone, controls hidden, the canvas full frame.
//                   `photo`, `photo2`, `layout`, `grade`, `title`, `subtitle`,
//                   `size` (square | portrait | wide) pick the scene.
//   ?shot=editor  — the editor with a sample photo loaded.
// window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, state, redraw, loadImage) {
  const photo = query.get('photo') ?? 'pier';
  const photo2 = query.get('photo2');
  const img = await loadImage(`samples/${photo}.jpg`);
  state.photos.push({ id: 1, name: `${photo}.jpg`, img, url: `samples/${photo}.jpg` });
  if (photo2) {
    const img2 = await loadImage(`samples/${photo2}.jpg`);
    state.photos.push({ id: 2, name: `${photo2}.jpg`, img: img2, url: `samples/${photo2}.jpg` });
  }
  state.layout = query.get('layout') ?? 'grid4';
  state.grade = query.get('grade') ?? 'sunset';
  state.title = query.get('title') ?? 'Sunset Heist';
  state.subtitle = query.get('subtitle') ?? 'a night on the coast';
  state.size = query.get('size') ?? 'square';
  state.heat = Number(query.get('heat') ?? 4);
  state.badge = query.get('badge') ?? 'Launch week';
  // Spread the photos across the panels: first photo in the hero, the
  // second (if any) in the rest, so multi-photo layouts read.
  const n = { grid4: 4, hero3: 4, full: 1, grid9: 9, tilted: 1, story: 4 }[state.layout] ?? 4;
  state.panels = Array.from({ length: n }, (_, i) => ({
    photo: state.photos.length > 1 && i > 0 ? 1 : 0,
    zoom: 1, ox: 0, oy: 0,
  }));
  if (shot === 'cover') document.body.classList.add('shot-cover');
  redraw();
  await document.fonts.ready;
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
