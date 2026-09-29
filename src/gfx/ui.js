// Texturas de interface desenhadas em canvas no dobro do tamanho (exibidas em
// escala 0.5): bordas suaves em qualquer tela, sem o serrilhado das formas do WebGL.

import { canvasTexture, glow, rgba } from './util.js';

export const UI_SCALE = 0.5;

function hiRes(scene, key, w, h, draw) {
  canvasTexture(scene, key, w * 2, h * 2, (ctx) => {
    ctx.scale(2, 2);
    draw(ctx, w, h);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.8, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.8, y);
  ctx.closePath();
  ctx.fill();
}

// Linha ornamental: traço fino, losango no meio e volutas nas pontas.
export function ornamentLine(ctx, x0, x1, y, color = '#dff4ff', alpha = 0.85) {
  const mid = (x0 + x1) / 2;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x0 + 10, y);
  ctx.lineTo(mid - 14, y);
  ctx.moveTo(mid + 14, y);
  ctx.lineTo(x1 - 10, y);
  ctx.stroke();
  for (const [x, dir] of [[x0 + 10, -1], [x1 - 10, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + dir * 7, y - 7, x + dir * 12, y + 2, x + dir * 5, y + 4);
    ctx.stroke();
  }
  diamond(ctx, mid, y, 6, rgba(color, alpha));
  ctx.strokeStyle = rgba(color, alpha * 0.6);
  ctx.beginPath();
  ctx.arc(mid, y, 10, 0, Math.PI * 2);
  ctx.stroke();
}

// Estrela de quatro pontas (cursor do menu).
export function sparkle(ctx, x, y, s, color = '#ffffff') {
  glow(ctx, x, y, s * 1.8, '#9fd4ff', 0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.15, x + s, y);
  ctx.quadraticCurveTo(x + s * 0.15, y + s * 0.15, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.15, y + s * 0.15, x - s, y);
  ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.15, x, y - s);
  ctx.fill();
}

export function buildUi(scene) {
  hiRes(scene, 'ui-dialog', 900, 170, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(4,7,16,0.9)');
    g.addColorStop(1, 'rgba(8,12,26,0.86)');
    ctx.fillStyle = g;
    roundRect(ctx, 2, 2, w - 4, h - 4, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(159,212,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ornamentLine(ctx, 110, w - 110, 12);
    ornamentLine(ctx, 110, w - 110, h - 12);
  });

  hiRes(scene, 'ui-divider', 260, 20, (ctx, w, h) => ornamentLine(ctx, 0, w, h / 2, '#cfe6ff', 0.7));
  hiRes(scene, 'ui-star', 48, 48, (ctx) => sparkle(ctx, 24, 24, 16));

  hiRes(scene, 'ui-panel', 560, 440, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(6,10,22,0.95)');
    g.addColorStop(1, 'rgba(10,14,30,0.95)');
    ctx.fillStyle = g;
    roundRect(ctx, 2, 2, w - 4, h - 4, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(159,212,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ornamentLine(ctx, 90, w - 90, 16);
    ornamentLine(ctx, 90, w - 90, h - 16);
  });

  hiRes(scene, 'ui-slider', 220, 24, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(159,212,255,0.35)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 8, h / 2);
    ctx.stroke();
  });
  hiRes(scene, 'ui-knob', 24, 24, (ctx) => {
    glow(ctx, 12, 12, 12, '#9fd4ff', 0.7);
    diamond(ctx, 12, 12, 8, '#ffffff');
  });

  // anel do vaso de alma (a parte cheia é desenhada por baixo)
  hiRes(scene, 'soul-ring', 110, 110, (ctx) => {
    ctx.strokeStyle = 'rgba(223,244,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(55, 55, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(124,200,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(55, 55, 52, 0, Math.PI * 2);
    ctx.stroke();
    // pontas ornamentais
    for (const a of [-Math.PI / 2, Math.PI / 2]) diamond(ctx, 55 + Math.cos(a) * 52, 55 + Math.sin(a) * 52, 5, '#dff4ff');
  });
  hiRes(scene, 'soul-fill', 92, 92, (ctx) => {
    const g = ctx.createRadialGradient(40, 36, 4, 46, 46, 46);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#bfe4ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(46, 46, 45, 0, Math.PI * 2);
    ctx.fill();
  });
  hiRes(scene, 'soul-back', 100, 100, (ctx) => {
    ctx.fillStyle = 'rgba(3,5,12,0.75)';
    ctx.beginPath();
    ctx.arc(50, 50, 49, 0, Math.PI * 2);
    ctx.fill();
  });

  hiRes(scene, 'touch-btn', 120, 120, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(223,244,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(60, 60, 57, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  buildBossBar(scene);
}

// Barra de vida do Ender: moldura de ferro com espinhos, emblema da lua, fenda roxa.
function buildBossBar(scene) {
  const W = 820;
  const H = 96;
  hiRes(scene, 'bossbar-frame', W, H, (ctx) => {
    const top = 34;
    const bh = 30;
    // espinhos de cima e de baixo
    ctx.fillStyle = '#1a1422';
    for (let x = 90; x < W - 30; x += 26) {
      const tall = (x / 26) % 3 === 0 ? 16 : 9;
      ctx.beginPath();
      ctx.moveTo(x - 7, top + 2);
      ctx.lineTo(x, top - tall);
      ctx.lineTo(x + 7, top + 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 6, top + bh - 2);
      ctx.lineTo(x + 13, top + bh + tall * 0.7);
      ctx.lineTo(x + 20, top + bh - 2);
      ctx.fill();
    }
    // corpo de ferro
    const g = ctx.createLinearGradient(0, top, 0, top + bh);
    g.addColorStop(0, '#3a3046');
    g.addColorStop(0.5, '#15101c');
    g.addColorStop(1, '#2a2233');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(70, top);
    ctx.lineTo(W - 40, top);
    ctx.lineTo(W - 8, top + bh / 2);
    ctx.lineTo(W - 40, top + bh);
    ctx.lineTo(70, top + bh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // trilho interno (onde entra a vida)
    ctx.fillStyle = '#07040c';
    ctx.fillRect(96, top + 8, W - 150, bh - 16);
    // rebites
    ctx.fillStyle = '#6b5a7e';
    for (let x = 110; x < W - 60; x += 90) {
      ctx.beginPath();
      ctx.arc(x, top + 4, 2, 0, Math.PI * 2);
      ctx.arc(x, top + bh - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // marcas das fases (60% e 30%)
    ctx.fillStyle = 'rgba(230,200,255,0.6)';
    for (const f of [0.6, 0.3]) ctx.fillRect(96 + (W - 150) * f - 1, top + 6, 2, bh - 12);
    // emblema: escudo com lua crescente
    glow(ctx, 52, top + bh / 2, 60, '#b45cff', 0.55);
    ctx.fillStyle = '#1a1422';
    ctx.beginPath();
    ctx.moveTo(52, top - 26);
    ctx.lineTo(86, top - 6);
    ctx.lineTo(80, top + bh + 14);
    ctx.lineTo(52, top + bh + 30);
    ctx.lineTo(24, top + bh + 14);
    ctx.lineTo(18, top - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(214,168,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e9d6ff';
    ctx.beginPath();
    ctx.arc(52, top + bh / 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(59, top + bh / 2 - 5, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
  // enchimento (é recortado conforme a vida)
  hiRes(scene, 'bossbar-fill', W - 150, 14, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f0c8ff');
    g.addColorStop(0.35, '#b45cff');
    g.addColorStop(1, '#4a1686');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // rachaduras de energia
    ctx.strokeStyle = 'rgba(255,240,255,0.5)';
    ctx.lineWidth = 1;
    for (let x = 12; x < w; x += 37) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 6, h * 0.45);
      ctx.lineTo(x + 2, h * 0.6);
      ctx.lineTo(x + 9, h);
      ctx.stroke();
    }
  });
  hiRes(scene, 'bossbar-trail', W - 150, 14, (ctx, w, h) => {
    ctx.fillStyle = '#ffe6f4';
    ctx.fillRect(0, 0, w, h);
  });
}

export const BOSSBAR = { width: 820, height: 96, fillX: 96, fillY: 34 + 8, fillW: 670, fillH: 14 };
