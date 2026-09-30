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
  // Ruínas / deserto ao entardecer
  canvasTexture(scene, 'bgd-sky', WIDTH, HEIGHT, drawDesertSky);
  canvasTexture(scene, 'bgd-far', LAYER_W, LAYER_H, (ctx, w, h) => drawDunes(ctx, w, h, dunesFar));
  canvasTexture(scene, 'bgd-mid', LAYER_W, LAYER_H, (ctx, w, h) => drawDunes(ctx, w, h, dunesMid));
  canvasTexture(scene, 'bgd-haze', LAYER_W, 512, drawHaze);
  canvasTexture(scene, 'sand-storm', LAYER_W, 512, drawStorm);
}

function drawDesertSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#140c24');
  g.addColorStop(0.35, '#3a1c3e');
  g.addColorStop(0.62, '#8a3c3a');
  g.addColorStop(0.82, '#e0784a');
  g.addColorStop(1, '#ffc27a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(71);
  for (let i = 0; i < 120; i++) {
    const y = r() * h * 0.4;
    ctx.fillStyle = `rgba(255,236,220,${r.range(0.2, 0.8) * (1 - y / (h * 0.4))})`;
    ctx.beginPath();
    ctx.arc(r() * w, y, r.range(0.5, 1.3), 0, Math.PI * 2);
    ctx.fill();
  }
  // sol enorme meio afundado no horizonte
  const sx = w * 0.3;
  const sy = h * 0.8;
  glow(ctx, sx, sy, 520, '#ff9a5a', 0.35);
  glow(ctx, sx, sy, 220, '#ffd9a0', 0.55);
  const sg = ctx.createRadialGradient(sx, sy - 40, 10, sx, sy, 130);
  sg.addColorStop(0, '#fff3d0');
  sg.addColorStop(1, '#ffae62');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sx, sy, 130, 0, Math.PI * 2);
  ctx.fill();
  // faixas de nuvem na frente do sol
  for (let i = 0; i < 7; i++) {
    const y = h * r.range(0.55, 0.85);
    ctx.fillStyle = `rgba(90,30,50,${r.range(0.25, 0.5)})`;
    ctx.beginPath();
    ctx.ellipse(r() * w, y, r.range(160, 380), r.range(6, 14), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  sparkle(ctx, w * 0.78, h * 0.14, 10);
  sparkle(ctx, w * 0.62, h * 0.06, 6);
}

const dunesFar = { seed: 41, base: 0.62, amp: 70, color: '#6a2c34', rim: 'rgba(255,170,120,0.35)', ruins: 5, ruinColor: '#4e2030', haze: 'rgba(255,150,110,0.25)' };
const dunesMid = { seed: 57, base: 0.76, amp: 90, color: '#2e1420', rim: 'rgba(255,190,130,0.45)', ruins: 4, ruinColor: '#200c16', haze: 'rgba(120,50,50,0.2)' };

function drawDunes(ctx, w, h, p) {
  const r = rng(p.seed);
  const k1 = r.int(2, 3);
  const k2 = r.int(5, 7);
  const ph = r() * 6;
  const yAt = (x) => h * p.base - Math.sin((x / w) * Math.PI * 2 * k1 + ph) * p.amp - Math.sin((x / w) * Math.PI * 2 * k2) * p.amp * 0.3;
  // ruínas distantes (arcos, torres, colunas) atrás das dunas
  for (let i = 0; i < p.ruins; i++) {
    const x = ((i + r.range(0.1, 0.9)) / p.ruins) * w;
    for (const off of [-w, 0, w]) ruinSilhouette(ctx, x + off, yAt(x) + 20, p, rng(p.seed * 100 + i));
  }
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, yAt(x));
  ctx.lineTo(w, h);
  ctx.fill();
  // crista iluminada das dunas
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, yAt(x) + 1);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, p.haze);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function ruinSilhouette(ctx, x, base, p, r) {
  ctx.fillStyle = p.ruinColor;
  const kind = r.int(0, 2);
  if (kind === 0) {
    // arco partido
    const W = r.range(120, 200);
    const H = r.range(160, 260);
    ctx.beginPath();
    ctx.moveTo(x - W / 2, base);
    ctx.lineTo(x - W / 2, base - H);
    ctx.lineTo(x + W * 0.1, base - H - r.range(0, 30));
    ctx.lineTo(x + W * 0.05, base - H + 30);
    ctx.lineTo(x - W / 2 + 34, base - H + 34);
    ctx.lineTo(x - W / 2 + 34, base);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + W / 2, base);
    ctx.lineTo(x + W / 2, base - H * r.range(0.4, 0.8));
    ctx.lineTo(x + W / 2 - 34, base - H * 0.5);
    ctx.lineTo(x + W / 2 - 34, base);
    ctx.fill();
  } else if (kind === 1) {
    // torre com janelas
    const W = r.range(60, 90);
    const H = r.range(260, 420);
    ctx.fillRect(x - W / 2, base - H, W, H);
    ctx.beginPath();
    ctx.moveTo(x - W / 2 - 10, base - H);
    ctx.lineTo(x, base - H - 60);
    ctx.lineTo(x + W / 2 + 10, base - H);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,120,0.35)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 5, base - H + 40 + i * 70, 10, 22);
  } else {
    // fileira de colunas
    const n = r.int(3, 5);
    for (let i = 0; i < n; i++) {
      const H = r.range(120, 240);
      ctx.fillRect(x + i * 46 - 12, base - H, 24, H);
      ctx.fillRect(x + i * 46 - 18, base - H - 10, 36, 10);
    }
  }
}

function drawHaze(ctx, w, h) {
  const r = rng(15);
  for (let i = 0; i < 36; i++) {
    const x = r() * w;
    const y = r.range(0.35, 0.85) * h;
    const rx = r.range(160, 360);
    for (const off of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + off, y, 0, x + off, y, rx);
      g.addColorStop(0, 'rgba(255,190,140,0.10)');
      g.addColorStop(1, 'rgba(255,190,140,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x + off, y);
      ctx.scale(1, 0.3);
      ctx.translate(-(x + off), -y);
      ctx.fillRect(x + off - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }
}

// Faixas de areia soprada (tempestade), repetível na horizontal.
function drawStorm(ctx, w, h) {
  const r = rng(99);
  for (let i = 0; i < 70; i++) {
    const y = r() * h;
    const len = r.range(200, 700);
    const x = r() * w;
    for (const off of [-w, 0, w]) {
      const g = ctx.createLinearGradient(x + off, 0, x + off + len, 0);
      g.addColorStop(0, 'rgba(230,170,110,0)');
      g.addColorStop(0.5, `rgba(230,170,110,${r.range(0.08, 0.22)})`);
      g.addColorStop(1, 'rgba(230,170,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + off, y, len, r.range(3, 16));
    }
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(255,220,170,${r.range(0.2, 0.6)})`;
    ctx.fillRect(r() * w, r() * h, r.range(2, 6), 1.2);
  }
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
