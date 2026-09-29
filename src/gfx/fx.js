// Texturas de efeitos do Ender: raios, ondas de choque, orbes, anéis e avisos.
// Desenhadas em canvas (bordas suaves) e usadas com mistura aditiva.

import { canvasTexture, rng, glow } from './util.js';

export const BOLT_VARIANTS = 6;
export const SHOCK_VARIANTS = 3;

// Caminho de raio: deslocamento do ponto médio, com galhos.
function boltPath(r, x0, y0, x1, y1, rough, depth, out) {
  if (depth === 0) {
    out.push([x1, y1]);
    return;
  }
  const mx = (x0 + x1) / 2 + (r() - 0.5) * rough;
  const my = (y0 + y1) / 2 + (r() - 0.5) * rough * 0.2;
  boltPath(r, x0, y0, mx, my, rough / 2, depth - 1, out);
  boltPath(r, mx, my, x1, y1, rough / 2, depth - 1, out);
}

function strokeBolt(ctx, pts, width, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function drawBolt(ctx, w, h, seed) {
  const r = rng(seed);
  const main = [[w / 2, 4]];
  boltPath(r, w / 2, 4, w / 2 + (r() - 0.5) * 20, h - 4, w * 0.7, 6, main);
  const branches = [];
  for (let i = 0; i < 3; i++) {
    const start = main[Math.floor(r.range(0.2, 0.7) * main.length)];
    const len = r.range(0.2, 0.4) * h;
    const dir = r.chance(0.5) ? 1 : -1;
    const b = [start];
    boltPath(r, start[0], start[1], start[0] + dir * r.range(15, w * 0.45), start[1] + len, w * 0.35, 4, b);
    branches.push(b);
  }
  for (const b of branches) {
    strokeBolt(ctx, b, 5, 'rgba(170,90,255,0.35)', 10);
    strokeBolt(ctx, b, 1.6, 'rgba(236,210,255,0.9)', 4);
  }
  strokeBolt(ctx, main, 12, 'rgba(160,70,255,0.3)', 18);
  strokeBolt(ctx, main, 5, 'rgba(200,140,255,0.85)', 8);
  strokeBolt(ctx, main, 2, '#ffffff', 3);
}

export function buildFx(scene) {
  for (let i = 0; i < BOLT_VARIANTS; i++) {
    canvasTexture(scene, `bolt-${i}`, 96, 512, (ctx, w, h) => drawBolt(ctx, w, h, 101 + i * 37));
  }

  // onda de choque rasteira: chama elétrica vertical
  for (let i = 0; i < SHOCK_VARIANTS; i++) {
    canvasTexture(scene, `shock-${i}`, 80, 110, (ctx, w, h) => {
      const r = rng(900 + i * 13);
      glow(ctx, w / 2, h - 18, 44, '#b45cff', 0.7);
      const g = ctx.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(206,150,255,0.85)');
      g.addColorStop(1, 'rgba(140,60,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(8, h);
      for (let k = 0; k <= 6; k++) {
        const x = 8 + (k / 6) * (w - 16);
        const tip = h - r.range(45, 100) * (1 - Math.abs(k - 3) / 4.5);
        ctx.lineTo(x - 4, tip + 18);
        ctx.lineTo(x, tip);
      }
      ctx.lineTo(w - 8, h);
      ctx.closePath();
      ctx.fill();
      const pts = [[w / 2, h]];
      boltPath(r, w / 2, h, w / 2 + (r() - 0.5) * 20, 8, 30, 4, pts);
      strokeBolt(ctx, pts, 2, '#ffffff', 6);
    });
  }

  canvasTexture(scene, 'eorb', 72, 72, (ctx) => {
    glow(ctx, 36, 36, 36, '#b45cff', 0.95);
    glow(ctx, 36, 36, 18, '#f0dcff', 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(36, 36, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,205,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, 36, 17, 0.3, 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(36, 36, 17, 3.4, 5.3);
    ctx.stroke();
  });

  canvasTexture(scene, 'ering', 256, 256, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#c28dff';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(225,190,255,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 104, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // aviso no chão antes do raio cair
  canvasTexture(scene, 'sigil', 160, 48, (ctx) => {
    ctx.save();
    ctx.translate(80, 24);
    ctx.scale(1, 0.3);
    ctx.shadowColor = '#c28dff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(220,170,255,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  canvasTexture(scene, 'beam', 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(180,100,255,0)');
    g.addColorStop(0.5, 'rgba(220,170,255,0.55)');
    g.addColorStop(1, 'rgba(180,100,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
