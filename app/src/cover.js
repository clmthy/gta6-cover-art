// Neon Shore — the cover engine. Draws a GTA-style multi-panel cover onto a
// 2D canvas: panels of the user's photos, a colour grade, sunset-gradient
// Anton lettering with a neon Pacifico subtitle, a heat meter, a badge
// ribbon, grain and a vignette. Everything is drawn here, in one place, so
// the preview and the exported PNG are the same picture.

export const LAYOUTS = [
  { id: 'grid4', name: 'Four-panel grid', panels: 4 },
  { id: 'hero3', name: 'Hero and three', panels: 4 },
  { id: 'full', name: 'Full bleed', panels: 1 },
  { id: 'grid9', name: 'Nine-panel grid', panels: 9 },
  { id: 'tilted', name: 'Tilted snapshot', panels: 1 },
  { id: 'story', name: 'Story', panels: 4 },
];

export const GRADES = [
  { id: 'sunset', name: 'Sunset' },
  { id: 'neon', name: 'Neon' },
  { id: 'vice', name: 'Vice' },
  { id: 'golden', name: 'Golden hour' },
  { id: 'mono', name: 'Monochrome' },
];

// Each grade: the canvas filter for the photo, a top-to-bottom tint
// (drawn over the photo) and an 'overlay' tint colour with its alpha.
const GRADE_STYLE = {
  sunset: {
    filter: 'saturate(1.3) contrast(1.08)',
    tint: ['rgba(255, 170, 60, 0.10)', 'rgba(205, 35, 125, 0.30)'],
    overlay: ['#ff7a3c', 0.10],
  },
  neon: {
    filter: 'saturate(1.45) contrast(1.10)',
    tint: ['rgba(0, 255, 214, 0.10)', 'rgba(255, 0, 150, 0.30)'],
    overlay: ['#ff2d95', 0.12],
  },
  vice: {
    filter: 'saturate(1.35) contrast(1.06)',
    tint: ['rgba(0, 214, 255, 0.18)', 'rgba(255, 60, 180, 0.24)'],
    overlay: ['#00d6ff', 0.08],
  },
  golden: {
    filter: 'saturate(1.35) contrast(1.05) brightness(1.05)',
    tint: ['rgba(255, 222, 120, 0.20)', 'rgba(178, 88, 0, 0.22)'],
    overlay: ['#ffb347', 0.10],
  },
  mono: {
    filter: 'grayscale(1) contrast(1.18) brightness(1.03)',
    tint: ['rgba(255, 255, 255, 0.06)', 'rgba(0, 0, 0, 0.28)'],
    overlay: ['#ffffff', 0.05],
  },
};

/** Panel rectangles for a layout, in fractions of the canvas (x, y, w, h).
 *  `title` is the fraction of the height the title block takes at the foot.
 *  `tilt` marks the tilted-snapshot layout, drawn rotated with a border. */
export function layoutPanels(layout, w, h) {
  const g = 0.010; // gutter, as a fraction of the width
  const title = layout === 'story' ? 0.40 : layout === 'full' ? 0 : 0.17;
  const top = h * (1 - title);
  const gw = w * g;
  const gh = top * g;
  switch (layout) {
    case 'grid4': {
      const cw = (w - gw * 3) / 2;
      const ch = (top - gh * 3) / 2;
      return {
        title, panels: [
          { x: gw, y: gh, w: cw, h: ch },
          { x: gw * 2 + cw, y: gh, w: cw, h: ch },
          { x: gw, y: gh * 2 + ch, w: cw, h: ch },
          { x: gw * 2 + cw, y: gh * 2 + ch, w: cw, h: ch },
        ],
      };
    }
    case 'hero3': {
      const heroW = w * 0.64;
      const sideX = heroW + gw;
      const sideW = w - sideX - gw;
      const ch = (top - gh * 4) / 3;
      return {
        title, panels: [
          { x: gw, y: gh, w: heroW - gw, h: top - gh * 2 },
          { x: sideX, y: gh, w: sideW, h: ch },
          { x: sideX, y: gh * 2 + ch, w: sideW, h: ch },
          { x: sideX, y: gh * 3 + ch * 2, w: sideW, h: ch },
        ],
      };
    }
    case 'full':
      return { title, panels: [{ x: 0, y: 0, w, h }] };
    case 'grid9': {
      const cw = (w - gw * 4) / 3;
      const ch = (top - gh * 4) / 3;
      const panels = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          panels.push({ x: gw + c * (cw + gw), y: gh + r * (ch + gh), w: cw, h: ch });
        }
      }
      return { title: 0.14, panels };
    }
    case 'tilted': {
      const pw = w * 0.78;
      const ph = top * 0.78;
      return {
        title, tilt: true,
        panels: [{ x: (w - pw) / 2, y: (top - ph) / 2, w: pw, h: ph }],
      };
    }
    case 'story': {
      const stripH = top * 0.16;
      const sw = (w - gw * 4) / 3;
      return {
        title, panels: [
          { x: 0, y: 0, w, h: top - stripH - gh },
          { x: gw, y: top - stripH, w: sw, h: stripH },
          { x: gw * 2 + sw, y: top - stripH, w: sw, h: stripH },
          { x: gw * 3 + sw * 2, y: top - stripH, w: sw, h: stripH },
        ],
      };
    }
    default:
      return layoutPanels('grid4', w, h);
  }
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and
 *  pan offsets (fractions of the panel size). Offsets are clamped so the
 *  photo always covers the panel. */
function drawPhotoInPanel(ctx, img, rect, zoom, ox, oy, grade) {
  const { x, y, w, h } = rect;
  const style = GRADE_STYLE[grade] || GRADE_STYLE.sunset;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  const maxOx = Math.max(0, (dw - w) / 2 / w);
  const maxOy = Math.max(0, (dh - h) / 2 / h);
  const cx = x + (w - dw) / 2 + Math.max(-maxOx, Math.min(maxOx, ox)) * w;
  const cy = y + (h - dh) / 2 + Math.max(-maxOy, Math.min(maxOy, oy)) * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = style.filter;
  ctx.drawImage(img, cx, cy, dw, dh);
  ctx.filter = 'none';
  const tint = ctx.createLinearGradient(0, y, 0, y + h);
  tint.addColorStop(0, style.tint[0]);
  tint.addColorStop(1, style.tint[1]);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = style.overlay[1];
  ctx.fillStyle = style.overlay[0];
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** A five-pointed star path centred at (cx, cy) with outer radius r. */
function starPath(ctx, cx, cy, r) {
  const inner = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The heat meter: a HEAT label and five stars, `heat` of them lit, on a
 *  dark pill so it reads over any photo. `align` is 'left' (x is the left
 *  edge) or 'right' (x is the right edge). */
function drawHeatMeter(ctx, x, y, size, heat, align = 'left') {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${size * 0.9}px Anton, sans-serif`;
  const labelW = ctx.measureText('HEAT').width;
  const r = size * 0.62;
  const gap = r * 2.5;
  const width = labelW + size * 0.9 + gap * 4 + r * 2;
  const x0 = align === 'right' ? x - width : x;
  const pad = size * 0.55;
  const pillH = size * 1.9;
  ctx.fillStyle = 'rgba(10, 4, 18, 0.55)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x0 - pad, y - pillH / 2, width + pad * 2, pillH, pillH / 2);
    ctx.fill();
  } else {
    ctx.fillRect(x0 - pad, y - pillH / 2, width + pad * 2, pillH);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('HEAT', x0, y);
  for (let i = 0; i < 5; i++) {
    const cx = x0 + labelW + size * 0.9 + i * gap + r;
    starPath(ctx, cx, y, r);
    if (i < heat) {
      ctx.fillStyle = '#ffc21c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A diagonal badge ribbon across the top-left corner. The band is anchored
 *  on the left edge and crosses to the top edge; the text sits at the middle
 *  of the visible segment so it is never cut off. */
function drawBadgeRibbon(ctx, w, h, text) {
  if (!text) return;
  const band = h * 0.052;
  const anchorY = h * 0.22;
  const seg = anchorY / Math.SQRT1_2; // visible segment, along the band
  ctx.save();
  ctx.translate(0, anchorY);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#ff2d78';
  ctx.fillRect(-w * 0.5, -band / 2, w, band);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${band * 0.52}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), seg / 2, band * 0.04);
  ctx.restore();
}

// A small noise tile, made once, tiled over the cover for film grain.
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 128;
  t.height = 128;
  const tc = t.getContext('2d');
  const img = tc.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  grainTile = t;
  return t;
}

/** Fits a font size so `text` fits `maxW`, starting from `start`. */
function fitFont(ctx, text, start, maxW, family, weight = '') {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/**
 * Draws the whole cover.
 * @param {HTMLCanvasElement} canvas
 * @param {object} state { layout, grade, title, subtitle, heat, badge,
 *   grain, vignette, photos: [{img}], panels: [{photo, zoom, ox, oy}] }
 */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = state.grade || 'sunset';
  const { title: titleFrac, panels, tilt } = layoutPanels(state.layout || 'grid4', w, h);

  // Backdrop: deep violet, so gutters and the tilted layout's surround read.
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#241031');
  bg.addColorStop(1, '#160a20');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Panels.
  const photoAt = (i) => {
    const slot = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    return { img: state.photos[slot.photo] ? state.photos[slot.photo].img : null, ...slot };
  };
  if (tilt) {
    const rect = panels[0];
    const { img, zoom, ox, oy } = photoAt(0);
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(-0.07);
    const bw = rect.w + w * 0.02;
    const bh = rect.h + w * 0.02;
    ctx.fillStyle = '#f7f2e8';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = w * 0.03;
    ctx.shadowOffsetY = h * 0.012;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (img) drawPhotoInPanel(ctx, img, { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }, zoom, ox, oy, grade);
    else {
      ctx.fillStyle = '#3a2b4d';
      ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    }
    ctx.restore();
  } else {
    panels.forEach((rect, i) => {
      const { img, zoom, ox, oy } = photoAt(i);
      if (img) drawPhotoInPanel(ctx, img, rect, zoom, ox, oy, grade);
      else {
        ctx.fillStyle = '#3a2b4d';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = Math.max(1, w * 0.002);
        ctx.setLineDash([w * 0.012, w * 0.008]);
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
        ctx.setLineDash([]);
      }
    });
  }

  // Title block.
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const blockH = h * titleFrac;
  const blockY = h - blockH;
  if (state.layout === 'full') {
    // Scrim over the foot of the photo so the lettering reads.
    const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
    scrim.addColorStop(0, 'rgba(10, 4, 18, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 18, 0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  } else if (titleFrac > 0) {
    const band = ctx.createLinearGradient(0, blockY, 0, h);
    band.addColorStop(0, '#1d0b2e');
    band.addColorStop(1, '#0e0518');
    ctx.fillStyle = band;
    ctx.fillRect(0, blockY, w, blockH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(0, blockY, w, Math.max(2, h * 0.003));
  }
  if (title) {
    const isFull = state.layout === 'full';
    const baseY = isFull ? h * 0.60 : blockY;
    const availH = isFull ? h * 0.40 : blockH;
    const pad = w * 0.04;
    const maxW = w - pad * 2;
    const size = fitFont(ctx, title, availH * 0.52, maxW, 'Anton, sans-serif');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = baseY + availH * (subtitle ? 0.36 : 0.52);
    const grad = ctx.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
    grad.addColorStop(0, '#ffe259');
    grad.addColorStop(0.5, '#ff7e3c');
    grad.addColorStop(1, '#ff2d78');
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a20';
    ctx.lineWidth = size * 0.10;
    ctx.strokeText(title, w / 2, ty);
    ctx.fillStyle = grad;
    ctx.fillText(title, w / 2, ty);
    ctx.restore();
    if (subtitle) {
      const subSize = fitFont(ctx, subtitle, availH * 0.26, maxW * 0.9, 'Pacifico, cursive');
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${subSize}px Pacifico, cursive`;
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = subSize * 0.55;
      ctx.fillStyle = '#ffd7f2';
      ctx.fillText(subtitle, w / 2, baseY + availH * 0.76);
      ctx.restore();
    }
  }

  // Heat meter: top-right corner of the canvas, on a pill, clear of the
  // badge ribbon (top-left) and of the centred title and subtitle.
  if (state.heat > 0) {
    drawHeatMeter(ctx, w * 0.96, h * 0.05, Math.max(14, h * 0.022), state.heat, 'right');
  }

  // Badge ribbon.
  drawBadgeRibbon(ctx, w, h, state.badge);

  // Grain + vignette.
  if (state.grain) {
    const tile = getGrainTile();
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const vig = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.72,
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
}
