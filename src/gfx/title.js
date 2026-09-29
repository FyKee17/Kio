// Arte da tela de título, desenhada em canvas (2x, bordas suaves):
// árvore com lanternas à esquerda, ruínas góticas com cachoeiras à direita,
// saliência de musgo onde o Kio e a Vovó ficam, e o logotipo ornamentado.

import { canvasTexture, rng, glow, rgba, taperedCurve } from './util.js';
import { sparkle } from './ui.js';
import { TITLE_FONT } from '../fonts.js';

function hiRes(scene, key, w, h, draw) {
  canvasTexture(scene, key, w * 2, h * 2, (ctx) => {
    ctx.scale(2, 2);
    draw(ctx, w, h);
  });
}

export function buildTitleArt(scene) {
  if (scene.textures.exists('title-logo')) return;
  hiRes(scene, 'title-ruins', 820, 640, drawRuins);
  hiRes(scene, 'title-tree', 620, 560, drawTree);
  hiRes(scene, 'title-ledge', 600, 190, drawLedge);
  hiRes(scene, 'title-logo', 640, 270, drawLogo);
  hiRes(scene, 'title-grass', 420, 170, drawGrassSilhouette);
  hiRes(scene, 'title-lantern', 30, 64, drawLantern);
  canvasTexture(scene, 'title-fall', 64, 256, drawFall);
  canvasTexture(scene, 'title-water', 512, 64, drawWater);
}

function drawRuins(ctx, w, h) {
  const r = rng(71);
  const far = '#1c2b4a';
  const mid = '#131d34';
  const near = '#0c1324';
  // torres distantes na névoa
  ctx.fillStyle = far;
  for (const [x, tw, th] of [[140, 60, 420], [300, 80, 520], [520, 70, 460], [680, 90, 560]]) {
    ctx.fillRect(x, h - th, tw, th);
    ctx.beginPath();
    ctx.moveTo(x - 8, h - th);
    ctx.lineTo(x + tw / 2, h - th - 70);
    ctx.lineTo(x + tw + 8, h - th);
    ctx.fill();
  }
  // janela gótica grande
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(360, h);
  ctx.lineTo(360, 220);
  ctx.quadraticCurveTo(460, 90, 560, 220);
  ctx.lineTo(560, h);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(400, 420);
  ctx.lineTo(400, 250);
  ctx.quadraticCurveTo(460, 160, 520, 250);
  ctx.lineTo(520, 420);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // ponte com arcos
  ctx.fillStyle = mid;
  ctx.fillRect(40, 330, 760, 34);
  for (let x = 60; x < 800; x += 120) {
    ctx.fillRect(x, 364, 26, h - 364);
    ctx.fillRect(x + 94, 364, 26, h - 364);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(x + 60, 420, 34, 56, 0, Math.PI, 0);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // balaustrada
  ctx.fillStyle = mid;
  for (let x = 44; x < 800; x += 14) ctx.fillRect(x, 312, 5, 20);
  ctx.fillRect(40, 306, 760, 6);
  // torre próxima à direita, com estandarte
  ctx.fillStyle = near;
  ctx.fillRect(640, 150, 130, h - 150);
  ctx.beginPath();
  ctx.moveTo(628, 150);
  ctx.lineTo(705, 40);
  ctx.lineTo(782, 150);
  ctx.fill();
  ctx.fillStyle = '#26184a';
  ctx.beginPath();
  ctx.moveTo(672, 210);
  ctx.lineTo(738, 210);
  ctx.lineTo(738, 330);
  ctx.lineTo(705, 310);
  ctx.lineTo(672, 330);
  ctx.fill();
  glow(ctx, 705, 250, 26, '#b9a4ff', 0.4);
  ctx.fillStyle = '#d9ccff';
  ctx.beginPath();
  ctx.arc(705, 250, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(711, 245, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // janelas acesas
  for (let i = 0; i < 26; i++) {
    const x = r.range(60, 780);
    const y = r.range(120, 560);
    const warm = r.chance(0.55);
    glow(ctx, x, y, 14, warm ? '#ffd98a' : '#7cc8ff', 0.55);
    ctx.fillStyle = warm ? '#ffe9b8' : '#cfeaff';
    ctx.fillRect(x - 2, y - 4, 4, 8);
  }
  // lanterna pendurada
  ctx.strokeStyle = near;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(620, 360);
  ctx.lineTo(620, 400);
  ctx.stroke();
  glow(ctx, 620, 418, 40, '#ffd98a', 0.7);
  ctx.fillStyle = '#fff1c9';
  ctx.fillRect(612, 404, 16, 26);
  // névoa na base
  const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g.addColorStop(0, 'rgba(60,100,150,0)');
  g.addColorStop(1, 'rgba(60,100,150,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawTree(ctx, w, h) {
  const r = rng(33);
  const bark = '#0b1220';
  // tronco que sobe pela esquerda e um galho enorme atravessando
  taperedCurve(ctx, 40, h + 20, 110, h * 0.5, 60, 40, 150, 70, bark);
  taperedCurve(ctx, 70, 90, 280, 20, 600, 70, 70, 16, bark);
  taperedCurve(ctx, 90, 200, 220, 150, 360, 210, 36, 8, bark);
  // folhagem em massas com borda brilhante
  for (let i = 0; i < 26; i++) {
    const x = r.range(0, w * 0.95);
    const y = r.range(-20, 150) + (x / w) * 30;
    const rad = r.range(30, 70);
    ctx.fillStyle = '#10301f';
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * 0.55, r.range(-0.4, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    const x = r.range(0, w);
    const y = r.range(0, 170);
    ctx.fillStyle = r.pick(['#1f6b4a', '#2e8a5c', '#3aa870', '#185b3e']);
    ctx.beginPath();
    ctx.ellipse(x, y, r.range(5, 11), r.range(2.5, 5), r.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  // cipós com folhinhas
  for (let i = 0; i < 14; i++) {
    const x = r.range(60, w - 20);
    const len = r.range(80, 320);
    const sway = r.range(-18, 18);
    ctx.strokeStyle = '#1a4a36';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.quadraticCurveTo(x + sway, 90 + len / 2, x + sway / 2, 90 + len);
    ctx.stroke();
    for (let t = 0.1; t < 1; t += 0.09) {
      const lx = x + sway * t * (1 - t) * 2 + (sway / 2) * t * t;
      const ly = 90 + len * t;
      ctx.fillStyle = r.chance(0.2) ? '#6ff6c0' : '#2f8c5e';
      ctx.beginPath();
      ctx.ellipse(lx + (r.chance(0.5) ? 5 : -5), ly, 6, 3, r.range(-1, 1), 0, Math.PI * 2);
      ctx.fill();
    }
    if (r.chance(0.5)) glow(ctx, x + sway / 2, 90 + len, 10, '#6ff6e0', 0.7);
  }
}

function drawLantern(ctx) {
  glow(ctx, 15, 40, 15, '#6ff6e0', 0.8);
  ctx.strokeStyle = '#1a4a36';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(15, 26);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 26, 0, 56);
  g.addColorStop(0, '#e8fff8');
  g.addColorStop(1, '#4fe0c8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(15, 26);
  ctx.bezierCurveTo(26, 30, 24, 50, 15, 56);
  ctx.bezierCurveTo(6, 50, 4, 30, 15, 26);
  ctx.fill();
}

function drawLedge(ctx, w, h) {
  const r = rng(12);
  ctx.fillStyle = '#0a111e';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 40);
  for (let x = 0; x <= w - 60; x += 20) ctx.lineTo(x, 40 + Math.sin(x / 70) * 6 + r.range(-2, 2));
  ctx.quadraticCurveTo(w - 30, 44, w - 50, 90);
  ctx.lineTo(w - 90, h);
  ctx.closePath();
  ctx.fill();
  // pedras e raízes internas
  ctx.strokeStyle = 'rgba(100,140,200,0.12)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const x = r.range(0, w - 120);
    ctx.beginPath();
    ctx.moveTo(x, r.range(60, h));
    ctx.quadraticCurveTo(x + 40, r.range(60, h), x + r.range(40, 120), r.range(60, h));
    ctx.stroke();
  }
  // musgo luminoso no topo
  ctx.save();
  ctx.shadowColor = '#6ff6e0';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#3fd4b6';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 42);
  for (let x = 0; x <= w - 60; x += 20) ctx.lineTo(x, 42 + Math.sin(x / 70) * 6);
  ctx.stroke();
  ctx.restore();
  // grama e flores
  for (let x = 4; x < w - 60; x += r.range(3, 7)) {
    const y = 40 + Math.sin(x / 70) * 6;
    const hh = r.range(8, 26);
    ctx.strokeStyle = r.pick(['#2aa58c', '#43d1b0', '#6ff6e0', '#1f7f72']);
    ctx.lineWidth = r.range(1.2, 2.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + r.range(-4, 4), y - hh * 0.6, x + r.range(-8, 8), y - hh);
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = r.range(20, w - 80);
    const y = 36 + Math.sin(x / 70) * 6 - r.range(6, 22);
    glow(ctx, x, y, 12, '#dff4ff', 0.6);
    ctx.fillStyle = r.chance(0.6) ? '#eaf6ff' : '#c9d9ff';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 3, 1.8, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // cogumelos dourados
  for (const x of [w - 160, w - 140]) {
    glow(ctx, x, 20, 22, '#ffd98a', 0.6);
    ctx.fillStyle = '#ffe3a6';
    ctx.beginPath();
    ctx.ellipse(x, 22, 9, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 1.5, 22, 3, 18);
  }
}

function drawGrassSilhouette(ctx, w, h) {
  const r = rng(5);
  ctx.fillStyle = '#03060d';
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, w);
    const len = r.range(40, h);
    const lean = r.range(-60, 60);
    ctx.beginPath();
    ctx.moveTo(x - 5, h);
    ctx.quadraticCurveTo(x + lean * 0.3, h - len * 0.6, x + lean, h - len);
    ctx.quadraticCurveTo(x + lean * 0.3 + 4, h - len * 0.5, x + 5, h);
    ctx.fill();
  }
}

function drawFall(ctx, w, h) {
  const r = rng(8);
  for (let i = 0; i < 40; i++) {
    const x = r.range(6, w - 6);
    const len = r.range(30, 120);
    const y = r.range(0, h);
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, 'rgba(200,235,255,0)');
    g.addColorStop(0.5, `rgba(200,235,255,${r.range(0.3, 0.8)})`);
    g.addColorStop(1, 'rgba(200,235,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, r.range(1.5, 3.5), len);
    ctx.fillRect(x, y - h, r.range(1.5, 3.5), len);
  }
}

function drawWater(ctx, w, h) {
  const r = rng(4);
  for (let i = 0; i < 60; i++) {
    const x = r.range(0, w);
    const y = r.range(4, h - 4);
    const len = r.range(20, 70);
    ctx.fillStyle = `rgba(160,210,255,${r.range(0.08, 0.3)})`;
    ctx.fillRect(x, y, len, 1.5);
    ctx.fillRect(x - w, y, len, 1.5);
  }
}

function drawLogo(ctx, w, h) {
  const cx = w / 2;
  const base = 175;
  ctx.font = `700 150px ${TITLE_FONT}`;
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, 40, 0, base);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#a9c8ff');
  // "KI" à esquerda; a lua crescente faz o papel do "O"
  const kiW = ctx.measureText('KI').width;
  const moonR = 62;
  const total = kiW + 6 + moonR * 2;
  const x0 = cx - total / 2;
  ctx.save();
  ctx.shadowColor = '#5aa8ff';
  ctx.shadowBlur = 28;
  ctx.fillStyle = grad;
  ctx.fillText('KI', x0, base);
  const mx = x0 + kiW + 6 + moonR;
  const my = base - 56;
  const moon = document.createElement('canvas');
  moon.width = moon.height = moonR * 2 + 4;
  const m = moon.getContext('2d');
  const mg = m.createLinearGradient(0, 0, 0, moonR * 2);
  mg.addColorStop(0, '#ffffff');
  mg.addColorStop(1, '#a9c8ff');
  m.fillStyle = mg;
  m.beginPath();
  m.arc(moonR + 2, moonR + 2, moonR, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(moonR + 30, moonR - 6, moonR * 0.82, 0, Math.PI * 2);
  m.fill();
  ctx.drawImage(moon, mx - moonR - 2, my - moonR - 2);
  ctx.restore();
  // estrelas: no pingo do I e dentro da lua
  sparkle(ctx, x0 + kiW - 26, 28, 18);
  sparkle(ctx, mx + 24, my - 4, 16);
  // volutas de folhas embaixo
  ctx.strokeStyle = 'rgba(200,225,255,0.9)';
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, base + 30);
    ctx.bezierCurveTo(cx + dir * 80, base + 8, cx + dir * 170, base + 50, cx + dir * 230, base + 18);
    ctx.bezierCurveTo(cx + dir * 262, base + 2, cx + dir * 262, base - 26, cx + dir * 240, base - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + dir * 232, base - 20, 9, 0, Math.PI * 2);
    ctx.stroke();
    for (const [t, s] of [[0.35, 1], [0.6, 0.8], [0.8, 0.7]]) {
      const lx = cx + dir * (230 * t);
      const ly = base + 22 + Math.sin(t * Math.PI) * 10;
      ctx.fillStyle = 'rgba(190,220,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(lx, ly - 8 * s, 9 * s, 4 * s, dir * -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // pingente em losango
  glow(ctx, cx, base + 46, 20, '#9fd4ff', 0.6);
  ctx.strokeStyle = '#e6f4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, base + 30);
  ctx.lineTo(cx + 9, base + 46);
  ctx.lineTo(cx, base + 66);
  ctx.lineTo(cx - 9, base + 46);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = rgba('#9fd4ff', 0.7);
  ctx.fill();
}
