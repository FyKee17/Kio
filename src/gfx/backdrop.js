// Camadas de fundo com parallax: céu com lua, árvores distantes na névoa,
// árvores médias com cipós luminosos, névoa, raios de luz e folhagem da frente.
// Tudo gerado em canvas; as camadas horizontais se repetem sem emenda.

import { WIDTH, HEIGHT } from '../config.js';
import { rng, rgba, glow, taperedCurve, canvasTexture } from './util.js';

export const LAYER_W = 2048;
export const LAYER_H = 1024;

export function buildBackdrop(scene) {
  canvasTexture(scene, 'bg-sky', WIDTH, HEIGHT, drawSky);
  canvasTexture(scene, 'bg-far', LAYER_W, LAYER_H, (ctx, w, h) => drawTreeLayer(ctx, w, h, far));
  canvasTexture(scene, 'bg-mid', LAYER_W, LAYER_H, (ctx, w, h) => drawTreeLayer(ctx, w, h, mid));
  canvasTexture(scene, 'bg-fog', LAYER_W, 512, drawFog);
  canvasTexture(scene, 'bg-rays', WIDTH, HEIGHT, drawRays);
  canvasTexture(scene, 'fg-leaves', LAYER_W, HEIGHT, drawForeground);
  canvasTexture(scene, 'vignette', WIDTH, HEIGHT, drawVignette);
}

function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#060a1c');
  g.addColorStop(0.45, '#12224a');
  g.addColorStop(0.8, '#24406a');
  g.addColorStop(1, '#3d5f86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const r = rng(7);
  // nuvens-nebulosa bem suaves
  for (let i = 0; i < 9; i++) {
    glow(ctx, r() * w, r.range(0.1, 0.6) * h, r.range(120, 300), r.pick(['#3b5fa0', '#5a4a9a', '#2f7a8a']), 0.12);
  }
  // estrelas
  for (let i = 0; i < 260; i++) {
    const x = r() * w;
    const y = r() * h * 0.75;
    const s = r() < 0.92 ? r.range(0.6, 1.4) : r.range(1.6, 2.4);
    ctx.fillStyle = `rgba(230,244,255,${r.range(0.3, 0.95)})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  // lua crescente com halo
  const mx = w * 0.7;
  const my = h * 0.26;
  const mr = 88;
  glow(ctx, mx, my, mr * 4.2, '#9fd4ff', 0.28);
  glow(ctx, mx, my, mr * 1.9, '#d8efff', 0.35);
  const moon = document.createElement('canvas');
  moon.width = moon.height = mr * 2 + 8;
  const m = moon.getContext('2d');
  const mg = m.createRadialGradient(mr * 0.8, mr * 0.8, 4, mr + 4, mr + 4, mr);
  mg.addColorStop(0, '#ffffff');
  mg.addColorStop(1, '#bfe2ff');
  m.fillStyle = mg;
  m.beginPath();
  m.arc(mr + 4, mr + 4, mr, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(mr + 4 + mr * 0.42, mr + 4 - mr * 0.22, mr * 0.86, 0, Math.PI * 2);
  m.fill();
  ctx.drawImage(moon, mx - mr - 4, my - mr - 4);
  // brilhos de quatro pontas
  sparkle(ctx, mx + mr * 0.35, my + mr * 0.05, 26);
  sparkle(ctx, mx + mr * 0.95, my - mr * 0.55, 12);
  sparkle(ctx, w * 0.18, h * 0.16, 9);
  sparkle(ctx, w * 0.42, h * 0.09, 7);
}

function sparkle(ctx, x, y, s) {
  glow(ctx, x, y, s * 2.2, '#e6f4ff', 0.5);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

// Parâmetros de cada camada de árvores
const far = {
  seed: 11,
  trees: 9,
  trunk: '#22385a',
  leaf: '#2a4870',
  height: [650, 950],
  width: [34, 70],
  fog: 'rgba(80,120,170,0.35)',
  lights: 0,
  ground: '#1d3150',
};
const mid = {
  seed: 23,
  trees: 6,
  trunk: '#101a30',
  leaf: '#15253f',
  height: [760, 1000],
  width: [70, 130],
  fog: 'rgba(40,70,110,0.25)',
  lights: 40,
  ground: '#0d1628',
};

function drawTreeLayer(ctx, w, h, p) {
  const r = rng(p.seed);
  const draws = [];
  for (let i = 0; i < p.trees; i++) {
    const x = ((i + r.range(0.1, 0.9)) / p.trees) * w;
    draws.push({ x, height: r.range(...p.height), width: r.range(...p.width), seed: r() * 1e9 });
  }
  // desenha cada árvore também deslocada de ±w para emendar nas bordas
  for (const d of draws) {
    for (const off of [-w, 0, w]) {
      if (d.x + off < -400 || d.x + off > w + 400) continue;
      tree(ctx, d.x + off, h, d.height, d.width, p, rng(d.seed));
    }
  }
  // chão ondulado
  ctx.fillStyle = p.ground;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 16) {
    const y = h - 90 - Math.sin((x / w) * Math.PI * 4) * 30 - Math.sin((x / w) * Math.PI * 10) * 12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.fill();
  // névoa na base
  const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, p.fog);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // pontinhos de luz (vagalumes/cogumelos distantes)
  for (let i = 0; i < p.lights; i++) {
    const x = r() * w;
    const y = r.range(0.35, 0.95) * h;
    glow(ctx, x, y, r.range(6, 16), r.chance(0.7) ? '#6ff6e0' : '#c28dff', 0.6);
  }
}

function tree(ctx, x, base, height, width, p, r) {
  // raízes
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1;
    const len = r.range(width * 0.8, width * 2.2);
    taperedCurve(ctx, x, base - r.range(40, 120), x + side * len * 0.5, base - 30, x + side * len, base, width * 0.45, 3, p.trunk);
  }
  // tronco torto
  const bend = r.range(-80, 80);
  const top = { x: x + bend * 0.6, y: base - height };
  taperedCurve(ctx, x, base, x + bend, base - height * 0.55, top.x, top.y, width, width * 0.35, p.trunk);
  // galhos
  const branches = r.int(3, 6);
  for (let i = 0; i < branches; i++) {
    const t = r.range(0.35, 0.95);
    const bx = x + bend * t * 0.9;
    const by = base - height * t;
    branch(ctx, bx, by, r.chance(0.5) ? -1 : 1, width * (1 - t) * 0.6 + 6, height * r.range(0.18, 0.32), p, r, 2);
  }
  // copa em massas suaves
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = rgba(p.leaf, 0.55);
    ctx.beginPath();
    ctx.ellipse(top.x + r.range(-160, 160), top.y + r.range(-40, 80), r.range(70, 170), r.range(35, 80), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // cipós pendurados
  ctx.strokeStyle = rgba(p.leaf, 0.9);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const vx = top.x + r.range(-150, 150);
    const vy = top.y + r.range(20, 80);
    const len = r.range(80, 260);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(vx + r.range(-20, 20), vy + len / 2, vx + r.range(-10, 10), vy + len);
    ctx.stroke();
    if (p.lights) glow(ctx, vx, vy + len, 14, '#6ff6e0', 0.55);
  }
}

function branch(ctx, x, y, dir, w, len, p, r, depth) {
  const ang = -Math.PI / 2 + dir * r.range(0.5, 1.2);
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len;
  const end = taperedCurve(ctx, x, y, x + dir * len * 0.5, y - len * 0.1, ex, ey, w, Math.max(2, w * 0.4), p.trunk);
  if (depth > 0) {
    for (let i = 0; i < 2; i++) branch(ctx, end.x, end.y, r.chance(0.5) ? -1 : 1, w * 0.5, len * 0.55, p, r, depth - 1);
  }
}

function drawFog(ctx, w, h) {
  const r = rng(5);
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = r.range(0.3, 0.8) * h;
    const rx = r.range(140, 340);
    for (const off of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + off, y, 0, x + off, y, rx);
      g.addColorStop(0, 'rgba(170,210,240,0.10)');
      g.addColorStop(1, 'rgba(170,210,240,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x + off, y);
      ctx.scale(1, 0.35);
      ctx.translate(-(x + off), -y);
      ctx.fillRect(x + off - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }
}

function drawRays(ctx, w, h) {
  const r = rng(3);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = w * r.range(0.35, 0.95);
    const spread = r.range(40, 120);
    const g = ctx.createLinearGradient(x, 0, x - 260, h);
    g.addColorStop(0, 'rgba(180,225,255,0.10)');
    g.addColorStop(1, 'rgba(180,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - spread * 0.2, 0);
    ctx.lineTo(x + spread * 0.2, 0);
    ctx.lineTo(x - 260 + spread, h);
    ctx.lineTo(x - 260 - spread, h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawForeground(ctx, w, h) {
  const r = rng(77);
  const leaf = (x, y, s, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 18 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  ctx.fillStyle = '#04070f';
  ctx.strokeStyle = '#04070f';
  // galhos pendurados no topo
  for (let i = 0; i < 5; i++) {
    const x = r() * w;
    const len = r.range(60, 180);
    ctx.lineWidth = r.range(3, 7);
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.quadraticCurveTo(x + r.range(-40, 40), len * 0.6, x + r.range(-30, 30), len);
    ctx.stroke();
    for (let k = 0; k < 10; k++) leaf(x + r.range(-40, 40), r.range(0, len), r.range(0.8, 1.6), r.range(-1, 1));
  }
  // samambaias embaixo
  for (let i = 0; i < 7; i++) {
    const x = r() * w;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + r.range(-1.1, 1.1);
      const len = r.range(50, 130);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, h + 10);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.3, h - len * 0.7, x + Math.cos(a) * len, h + Math.sin(a) * len);
      ctx.stroke();
      for (let t = 0.3; t < 1; t += 0.15) leaf(x + Math.cos(a) * len * t, h + Math.sin(a) * len * t, 0.7, a + 1);
    }
  }
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(3,5,12,0)');
  g.addColorStop(1, 'rgba(3,5,12,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
