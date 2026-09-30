// Arte das Ruínas desenhada em código: inimigos (pedrisco, arqueiro, escudeiro),
// os dois chefes (a Minhoca e o Cavaleiro das Ruínas), perigos (redemoinho,
// vapor), projéteis, portão, altar e os ícones de elemento/habilidade do HUD.
// Tudo em 2x e exibido em escala ~0.5, como o resto (ver sprites.js).

import { sheetTexture, canvasTexture, glow, rgba } from './util.js';

const SAND_HI = '#e3b27a';
const SAND = '#b07a4c';
const SAND_LO = '#5e3a26';
const STONE_DARK = '#2a1a16';
const IRON = '#3a3440';
const IRON_HI = '#8a8296';
const AMBER = '#ffb050';
const STEAM = '#9ff0ff';

// Segmento afunilado de a (x0,y0) em direção `ang` com comprimento `len`.
function limb(ctx, x0, y0, ang, len, w0, w1, fill, stroke) {
  const x1 = x0 + Math.cos(ang) * len;
  const y1 = y0 + Math.sin(ang) * len;
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 * 0.5, y0 + ny * w0 * 0.5);
  ctx.lineTo(x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5);
  ctx.arc(x1, y1, w1 * 0.5, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0 * 0.5, y0 - ny * w0 * 0.5);
  ctx.arc(x0, y0, w0 * 0.5, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return { x: x1, y: y1 };
}

function stoneGrad(ctx, x0, y0, x1, y1, hi = SAND_HI, mid = SAND, lo = SAND_LO) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  return g;
}

function crack(ctx, pts, color = AMBER, w = 2.2) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

function eye(ctx, x, y, r, color) {
  glow(ctx, x, y, r * 5, color, 0.6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.3, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function steamPuff(ctx, x, y, s, a = 0.35) {
  for (let i = 0; i < 3; i++) glow(ctx, x + i * 5 * s, y - i * 9 * s, 12 * s, '#e8fbff', a * (1 - i * 0.25));
}

export function buildRuinsArt(scene) {
  buildPebble(scene);
  buildArcher(scene);
  buildSquire(scene);
  buildWorm(scene);
  buildKnight(scene);
  buildHazards(scene);
  buildProjectiles(scene);
  buildObjects(scene);
  buildIcons(scene);
}

// ------------------------------------------------------------ pedrisco
// Montinho de pedra de areia que anda aos pulinhos. 0-3 andar, 4 agachar, 5 no ar.
function buildPebble(scene) {
  sheetTexture(scene, 'pebble', 170, 140, 6, (ctx, i) => {
    const bob = i < 4 ? [0, -4, 0, -4][i] : 0;
    const squash = i === 4 ? 0.82 : i === 5 ? 1.1 : 1;
    const cx = 85;
    const foot = 128;
    // pezinhos
    const step = i < 4 ? [0, 1, 0, -1][i] : 0;
    for (const [dx, ph] of [[-34, 1], [-12, -1], [14, 1], [36, -1]]) {
      const lift = i === 5 ? 10 : Math.max(0, step * ph) * 7;
      ctx.fillStyle = SAND_LO;
      ctx.beginPath();
      ctx.ellipse(cx + dx, foot - 5 - lift, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, foot - 10 + bob);
    ctx.scale(1 / squash, squash);
    // corpo: pedra grande + pedra de cima
    ctx.fillStyle = stoneGrad(ctx, -40, -80, 40, 0);
    ctx.beginPath();
    ctx.moveTo(-54, -6);
    ctx.quadraticCurveTo(-60, -52, -20, -64);
    ctx.quadraticCurveTo(28, -74, 52, -40);
    ctx.quadraticCurveTo(62, -12, 44, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,170,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = stoneGrad(ctx, -20, -100, 20, -60, '#f0c890', '#c08a58', '#7a4e32');
    ctx.beginPath();
    ctx.moveTo(-26, -58);
    ctx.quadraticCurveTo(-28, -92, 4, -96);
    ctx.quadraticCurveTo(32, -94, 30, -62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // rachaduras que brilham
    crack(ctx, [[-30, -20], [-16, -32], [-20, -46], [-6, -56]]);
    crack(ctx, [[20, -12], [30, -26], [24, -38]]);
    // olho
    eye(ctx, 18, -44, i === 4 ? 7 : 5.5, AMBER);
    ctx.restore();
  });
}

// ------------------------------------------------------------ arqueiro
// Estátua encapuzada de arenito com arco. 0-1 parado, 2-3 puxando, 4 soltou.
function buildArcher(scene) {
  sheetTexture(scene, 'archer', 200, 240, 5, (ctx, i) => {
    const cx = 92;
    const foot = 228;
    const breath = i === 1 ? -2 : 0;
    const pull = [0, 0, 0.5, 1, 0][i];
    // pernas
    limb(ctx, cx - 8, foot - 70, Math.PI / 2 + 0.12, 64, 22, 16, SAND_LO);
    limb(ctx, cx + 12, foot - 70, Math.PI / 2 - 0.1, 64, 22, 16, '#4a2e20');
    // manto
    ctx.fillStyle = stoneGrad(ctx, cx - 40, foot - 170, cx + 40, foot - 40, '#c89464', '#8a5a38', '#3e2418');
    ctx.beginPath();
    ctx.moveTo(cx - 34, foot - 40);
    ctx.lineTo(cx - 28, foot - 150 + breath);
    ctx.quadraticCurveTo(cx, foot - 172 + breath, cx + 30, foot - 150 + breath);
    ctx.lineTo(cx + 40, foot - 44);
    ctx.lineTo(cx + 20, foot - 58);
    ctx.lineTo(cx + 4, foot - 38);
    ctx.lineTo(cx - 14, foot - 56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,160,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    crack(ctx, [[cx - 10, foot - 130], [cx - 2, foot - 110], [cx - 12, foot - 92]], '#ffc070', 1.8);
    // capuz
    ctx.fillStyle = stoneGrad(ctx, cx - 30, foot - 220, cx + 30, foot - 150, '#e0b07c', '#9a6a44', '#4a2c1c');
    ctx.beginPath();
    ctx.moveTo(cx - 30, foot - 150 + breath);
    ctx.quadraticCurveTo(cx - 34, foot - 200 + breath, cx + 4, foot - 222 + breath);
    ctx.quadraticCurveTo(cx + 30, foot - 196 + breath, cx + 32, foot - 150 + breath);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#120a0a';
    ctx.beginPath();
    ctx.ellipse(cx + 10, foot - 176 + breath, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, cx + 16, foot - 178 + breath, 4, STEAM);
    // braços e arco (virado para a direita)
    const shoulder = { x: cx + 6, y: foot - 140 + breath };
    const bowX = cx + 74;
    const bowY = foot - 136;
    limb(ctx, shoulder.x, shoulder.y, -0.05, 64, 16, 12, '#8a5a38');
    // arco
    ctx.strokeStyle = '#3a2216';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(bowX - 18, bowY - 70);
    ctx.quadraticCurveTo(bowX + 26, bowY, bowX - 18, bowY + 70);
    ctx.stroke();
    ctx.strokeStyle = '#d8a060';
    ctx.lineWidth = 2;
    ctx.stroke();
    const sx = bowX - 18 - pull * 60;
    ctx.strokeStyle = 'rgba(255,240,210,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bowX - 18, bowY - 70);
    ctx.lineTo(sx, bowY);
    ctx.lineTo(bowX - 18, bowY + 70);
    ctx.stroke();
    // mão que puxa
    limb(ctx, shoulder.x - 4, shoulder.y + 6, Math.atan2(bowY - shoulder.y, sx - shoulder.x + 10), Math.max(18, Math.hypot(sx - shoulder.x, bowY - shoulder.y) - 8), 15, 12, '#7a4a2e');
    if (pull > 0) {
      // flecha armada
      ctx.strokeStyle = '#4a3020';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, bowY);
      ctx.lineTo(bowX + 34, bowY);
      ctx.stroke();
      glow(ctx, bowX + 38, bowY, 16 + pull * 12, STEAM, 0.5 + pull * 0.4);
      ctx.fillStyle = '#e8fbff';
      ctx.beginPath();
      ctx.moveTo(bowX + 48, bowY);
      ctx.lineTo(bowX + 32, bowY - 7);
      ctx.lineTo(bowX + 32, bowY + 7);
      ctx.fill();
    }
  });
}

// ------------------------------------------------------------ escudeiro partido
// Armadura rachada (vazando vapor) com escudo-torre e maça.
// 0-3 andar, 4 guarda, 5 erguer maça, 6 golpe, 7 atordoado.
function buildSquire(scene) {
  sheetTexture(scene, 'squire', 280, 280, 8, (ctx, i) => {
    const cx = 130;
    const foot = 266;
    const walk = i < 4 ? i : 0;
    const bob = i < 4 ? [0, -4, 0, -4][walk] : i === 6 ? 8 : i === 7 ? 6 : 0;
    const lean = i === 6 ? 0.18 : i === 5 ? -0.12 : i === 7 ? -0.2 : 0;
    const legA = i < 4 ? [0.25, 0, -0.25, 0][walk] : i === 6 ? 0.4 : 0.1;
    // pernas
    limb(ctx, cx - 16, foot - 96, Math.PI / 2 + legA, 86, 34, 26, IRON, 'rgba(160,150,180,0.35)');
    limb(ctx, cx + 18, foot - 96, Math.PI / 2 - legA, 86, 34, 26, '#2a2530', 'rgba(160,150,180,0.35)');
    ctx.save();
    ctx.translate(cx, foot - 96 + bob);
    ctx.rotate(lean);
    // tronco: couraça rachada com pedra brilhando por baixo
    const g = ctx.createLinearGradient(-50, -120, 50, 0);
    g.addColorStop(0, IRON_HI);
    g.addColorStop(0.4, IRON);
    g.addColorStop(1, '#16121c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-46, 4);
    ctx.lineTo(-54, -92);
    ctx.quadraticCurveTo(0, -130, 56, -92);
    ctx.lineTo(46, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,220,0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // buraco na armadura
    ctx.fillStyle = '#5a3020';
    ctx.beginPath();
    ctx.moveTo(8, -70);
    ctx.lineTo(34, -58);
    ctx.lineTo(24, -30);
    ctx.lineTo(4, -40);
    ctx.closePath();
    ctx.fill();
    crack(ctx, [[10, -64], [22, -50], [14, -38]], AMBER, 2.5);
    crack(ctx, [[-30, -80], [-20, -60], [-34, -40]], 'rgba(255,176,80,0.7)', 1.6);
    // elmo
    ctx.fillStyle = stoneGrad(ctx, -30, -170, 30, -110, IRON_HI, IRON, '#16121c');
    ctx.beginPath();
    ctx.moveTo(-32, -104);
    ctx.lineTo(-34, -150);
    ctx.quadraticCurveTo(0, -178, 34, -150);
    ctx.lineTo(32, -104);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // chifre quebrado
    ctx.fillStyle = '#d8c8b0';
    ctx.beginPath();
    ctx.moveTo(-28, -150);
    ctx.quadraticCurveTo(-54, -164, -50, -184);
    ctx.lineTo(-40, -176);
    ctx.lineTo(-44, -168);
    ctx.quadraticCurveTo(-30, -160, -18, -160);
    ctx.fill();
    // visor
    ctx.fillStyle = '#08060a';
    ctx.fillRect(-4, -142, 36, 10);
    eye(ctx, 18, -137, i === 5 ? 6 : 4.5, i === 7 ? '#ffffff' : AMBER);
    steamPuff(ctx, -40, -100, 1, 0.3);
    // maça (braço de trás)
    const armAng = i === 5 ? -2.3 : i === 6 ? 0.35 : i === 7 ? 1.9 : 0.9;
    const hand = limb(ctx, -10, -86, armAng, 64, 22, 18, '#2a2530', 'rgba(160,150,180,0.35)');
    const hx = hand.x + Math.cos(armAng) * 50;
    const hy = hand.y + Math.sin(armAng) * 50;
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = stoneGrad(ctx, hx - 20, hy - 20, hx + 20, hy + 20, '#bba48a', '#6a5a4a', '#2a2018');
    ctx.beginPath();
    ctx.arc(hx, hy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8c8b0';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * 18, hy + Math.sin(a) * 18);
      ctx.lineTo(hx + Math.cos(a + 0.25) * 32, hy + Math.sin(a + 0.25) * 32);
      ctx.lineTo(hx + Math.cos(a + 0.5) * 18, hy + Math.sin(a + 0.5) * 18);
      ctx.fill();
    }
    if (i === 6) glow(ctx, hx, hy, 50, '#ffd090', 0.4);
    // escudo-torre (braço da frente)
    const guard = i === 4;
    const sx = guard ? 58 : i === 6 ? 30 : i === 7 ? 20 : 46;
    const sy = guard ? -70 : -60;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(guard ? 0 : i === 7 ? 0.5 : 0.12);
    const sg = ctx.createLinearGradient(-26, -80, 26, 80);
    sg.addColorStop(0, '#9a8a78');
    sg.addColorStop(0.5, '#5a4a3e');
    sg.addColorStop(1, '#241a16');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-26, -86);
    ctx.lineTo(26, -86);
    ctx.lineTo(28, 50);
    ctx.lineTo(0, 92);
    ctx.lineTo(-28, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c8b090';
    ctx.lineWidth = 3;
    ctx.stroke();
    // sol partido gravado + rachadura
    ctx.strokeStyle = 'rgba(255,200,120,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, Math.PI * 2);
    ctx.stroke();
    crack(ctx, [[8, -86], [-2, -40], [10, -10], [-6, 30]], guard ? '#ffd090' : 'rgba(255,176,80,0.6)', 2);
    ctx.restore();
    ctx.restore();
  });
}

// ------------------------------------------------------------ a Minhoca
function buildWorm(scene) {
  // cabeça de perfil, olhando para a direita: 0 fechada, 1 aberta, 2 rugido
  sheetTexture(scene, 'worm-head', 300, 260, 3, (ctx, i) => {
    const cx = 130;
    const cy = 130;
    const open = [0.08, 0.45, 0.8][i];
    glow(ctx, cx + 60, cy, 120, AMBER, 0.12 + open * 0.2);
    // mandíbula de baixo
    ctx.save();
    ctx.translate(cx + 10, cy + 6);
    ctx.rotate(open * 0.7);
    ctx.fillStyle = stoneGrad(ctx, 0, 0, 120, 60, '#c8905a', '#7a4a2a', '#2a160e');
    ctx.beginPath();
    ctx.moveTo(-60, 10);
    ctx.quadraticCurveTo(40, 70, 134, 20);
    ctx.lineTo(120, 4);
    ctx.quadraticCurveTo(40, 20, -40, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4e4c8';
    for (let k = 0; k < 7; k++) {
      const x = 10 + k * 16;
      ctx.beginPath();
      ctx.moveTo(x, 10 - k * 0.6);
      ctx.lineTo(x + 6, -12 - (k % 2) * 6);
      ctx.lineTo(x + 12, 10 - k * 0.6);
      ctx.fill();
    }
    ctx.restore();
    // boca por dentro
    if (open > 0.2) {
      glow(ctx, cx + 70, cy + 8, 60 * open + 20, '#ff7a3a', 0.8);
    }
    // crânio / placas
    ctx.save();
    ctx.translate(cx + 10, cy);
    ctx.rotate(-open * 0.35);
    ctx.fillStyle = stoneGrad(ctx, -80, -100, 140, 20, '#f0c890', '#a06a40', '#3a2014');
    ctx.beginPath();
    ctx.moveTo(-90, 40);
    ctx.quadraticCurveTo(-110, -60, -20, -92);
    ctx.quadraticCurveTo(90, -110, 150, -12);
    ctx.lineTo(128, 4);
    ctx.quadraticCurveTo(30, -10, -50, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // presas de cima
    ctx.fillStyle = '#f4e4c8';
    for (let k = 0; k < 7; k++) {
      const x = 20 + k * 15;
      ctx.beginPath();
      ctx.moveTo(x, -4 - k * 1.2);
      ctx.lineTo(x + 6, 20 + (k % 2) * 8);
      ctx.lineTo(x + 12, -6 - k * 1.2);
      ctx.fill();
    }
    // placas e rachaduras
    ctx.strokeStyle = 'rgba(40,20,10,0.7)';
    ctx.lineWidth = 4;
    for (const a of [-40, 0, 40]) {
      ctx.beginPath();
      ctx.moveTo(a - 30, -80 + Math.abs(a) * 0.3);
      ctx.quadraticCurveTo(a - 10, -30, a - 36, 20);
      ctx.stroke();
    }
    crack(ctx, [[-50, -40], [-30, -20], [-44, 4]], AMBER, 2.5);
    // olhos (três de cada lado, em fileira)
    for (let k = 0; k < 3; k++) eye(ctx, 62 + k * 18, -48 + k * 6, i === 2 ? 6 : 4.5 - k * 0.6, AMBER);
    ctx.restore();
  });
  // segmento do corpo (visto de lado, redondo com placas)
  canvasTexture(scene, 'worm-seg', 200, 200, (ctx) => {
    glow(ctx, 100, 100, 100, AMBER, 0.1);
    const g = ctx.createRadialGradient(80, 70, 10, 100, 100, 86);
    g.addColorStop(0, '#e8b47a');
    g.addColorStop(0.6, '#8a5530');
    g.addColorStop(1, '#2a160e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(100, 100, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,170,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // anéis de placas
    ctx.strokeStyle = 'rgba(40,20,10,0.75)';
    ctx.lineWidth = 5;
    for (const r of [60, 36]) {
      ctx.beginPath();
      ctx.arc(100, 100, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    crack(ctx, [[100, 16], [100, 40]], AMBER, 3);
    crack(ctx, [[100, 160], [100, 184]], AMBER, 3);
    crack(ctx, [[16, 100], [40, 100]], AMBER, 3);
    crack(ctx, [[160, 100], [184, 100]], AMBER, 3);
    // espinhos das costas
    ctx.fillStyle = '#f0dcc0';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(100 + k * 30 - 10, 22 + Math.abs(k) * 6);
      ctx.lineTo(100 + k * 34, -2 + Math.abs(k) * 10);
      ctx.lineTo(100 + k * 30 + 10, 22 + Math.abs(k) * 6);
      ctx.fill();
    }
  });
  canvasTexture(scene, 'worm-tail', 200, 120, (ctx) => {
    ctx.fillStyle = stoneGrad(ctx, 0, 0, 0, 120, '#e0aa70', '#8a5530', '#2a160e');
    ctx.beginPath();
    ctx.moveTo(190, 20);
    ctx.quadraticCurveTo(80, 30, 6, 60);
    ctx.quadraticCurveTo(80, 90, 190, 100);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,170,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    crack(ctx, [[120, 40], [110, 60], [124, 80]], AMBER, 2.5);
  });
}

// ------------------------------------------------------------ Cavaleiro das Ruínas
// 0-1 parado, 2-5 andar, 6 espada no alto, 7 golpe baixo, 8 estocada,
// 9 agachado (vai saltar), 10 no ar, 11 guarda, 12 atordoado.
function buildKnight(scene) {
  sheetTexture(scene, 'rknight', 400, 380, 13, (ctx, i) => {
    const cx = 180;
    const foot = 364;
    const walk = i >= 2 && i <= 5 ? i - 2 : -1;
    const crouch = i === 9 ? 26 : i === 7 ? 18 : i === 12 ? 14 : 0;
    const bob = (walk >= 0 ? [0, -5, 0, -5][walk] : i === 1 ? 2 : 0) + crouch;
    const lean = { 6: -0.1, 7: 0.22, 8: 0.28, 9: 0.12, 10: -0.05, 11: 0.05, 12: -0.18 }[i] || 0;
    // capa esfarrapada (atrás)
    ctx.save();
    ctx.translate(cx - 10, foot - 250 + bob);
    const capeWave = walk >= 0 ? walk * 0.5 : i === 10 ? 2 : 0;
    ctx.fillStyle = '#5a1e22';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-80 - capeWave * 6, 90, -100 - capeWave * 10, 200 - i * 0);
    for (let k = 0; k < 6; k++) ctx.lineTo(-100 + k * 24 - capeWave * 6, 200 - (k % 2) * 30);
    ctx.lineTo(30, 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,140,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // pernas
    const legA = walk >= 0 ? [0.3, 0, -0.3, 0][walk] : i === 8 ? 0.55 : i === 9 ? 0.7 : i === 10 ? 0.5 : 0.12;
    const hipY = foot - 120 + crouch;
    if (i === 9) {
      limb(ctx, cx - 20, hipY, Math.PI / 2 + 0.8, 60, 42, 34, '#24202c');
      limb(ctx, cx + 20, hipY, Math.PI / 2 - 0.4, 70, 42, 34, IRON);
    } else {
      limb(ctx, cx - 18, hipY, Math.PI / 2 + legA, 112 - crouch * 0.6, 42, 32, '#24202c', 'rgba(170,160,190,0.3)');
      limb(ctx, cx + 22, hipY, Math.PI / 2 - legA, 112 - crouch * 0.6, 42, 32, IRON, 'rgba(170,160,190,0.35)');
    }
    ctx.save();
    ctx.translate(cx, hipY - 4 + (bob - crouch));
    ctx.rotate(lean);
    // couraça
    const g = ctx.createLinearGradient(-60, -150, 60, 0);
    g.addColorStop(0, '#b0a8bc');
    g.addColorStop(0.35, '#4a4452');
    g.addColorStop(1, '#141018');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-50, 6);
    ctx.lineTo(-70, -120);
    ctx.quadraticCurveTo(0, -170, 72, -120);
    ctx.lineTo(52, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,210,240,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // sol partido no peito (brilha)
    ctx.save();
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ffc070';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(4, -86, 16, 0.3, Math.PI * 1.7);
    ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(4 + Math.cos(a) * 22, -86 + Math.sin(a) * 22);
      ctx.lineTo(4 + Math.cos(a) * 30, -86 + Math.sin(a) * 30);
      ctx.stroke();
    }
    ctx.restore();
    crack(ctx, [[-40, -100], [-26, -70], [-44, -40], [-30, -10]], 'rgba(255,176,80,0.75)', 2);
    // ombreiras
    for (const s of [-1, 1]) {
      ctx.fillStyle = stoneGrad(ctx, s * 60 - 30, -150, s * 60 + 30, -100, '#c8c0d4', '#5a5462', '#1c1822');
      ctx.beginPath();
      ctx.ellipse(s * 58, -124, 34, 24, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // elmo com chifres e crista
    ctx.fillStyle = stoneGrad(ctx, -40, -230, 40, -140, '#d0c8dc', '#524c5c', '#14101a');
    ctx.beginPath();
    ctx.moveTo(-36, -140);
    ctx.lineTo(-40, -196);
    ctx.quadraticCurveTo(0, -236, 42, -196);
    ctx.lineTo(38, -140);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8dcc4';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 30, -200);
      ctx.quadraticCurveTo(s * 80, -214, s * 76, -262);
      ctx.quadraticCurveTo(s * 66, -226, s * 20, -214);
      ctx.fill();
    }
    ctx.fillStyle = '#08060a';
    ctx.fillRect(-6, -188, 44, 12);
    eye(ctx, 22, -182, i === 6 || i === 8 ? 7 : 5, i === 12 ? '#ffffff' : AMBER);
    steamPuff(ctx, 50, -136, 1.2, 0.3);
    steamPuff(ctx, -54, -30, 1, 0.25);
    // braço + espadão
    const pose = {
      0: [0.95, 0.5],
      1: [0.95, 0.52],
      6: [-2.4, -2.0],
      7: [0.55, 0.25],
      8: [0.02, 0],
      9: [1.1, 0.9],
      10: [-2.0, -1.7],
      11: [-1.1, -1.55],
      12: [1.6, 1.4],
    }[i] || [0.95 + (walk >= 0 ? [0.1, 0, -0.1, 0][walk] : 0), 0.5];
    const [armA, bladeA] = pose;
    const hand = limb(ctx, 30, -124, armA, 74, 30, 24, '#3a3444', 'rgba(170,160,190,0.35)');
    const len = 230;
    const tipX = hand.x + Math.cos(bladeA) * len;
    const tipY = hand.y + Math.sin(bladeA) * len;
    const nx = -Math.sin(bladeA);
    const ny = Math.cos(bladeA);
    // guarda
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(hand.x + nx * 26, hand.y + ny * 26);
    ctx.lineTo(hand.x - nx * 26, hand.y - ny * 26);
    ctx.stroke();
    // lâmina
    const bg = ctx.createLinearGradient(hand.x + nx * 14, hand.y + ny * 14, hand.x - nx * 14, hand.y - ny * 14);
    bg.addColorStop(0, '#f4ecff');
    bg.addColorStop(0.5, '#9a92a8');
    bg.addColorStop(1, '#3a3444');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(hand.x + nx * 13, hand.y + ny * 13);
    ctx.lineTo(tipX + nx * 6 - Math.cos(bladeA) * 20, tipY + ny * 6 - Math.sin(bladeA) * 20);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - nx * 9 - Math.cos(bladeA) * 30, tipY - ny * 9 - Math.sin(bladeA) * 30);
    // lasca quebrada no meio do fio
    const mx = hand.x + Math.cos(bladeA) * len * 0.55;
    const my = hand.y + Math.sin(bladeA) * len * 0.55;
    ctx.lineTo(mx - nx * 6, my - ny * 6);
    ctx.lineTo(mx - nx * 13 - Math.cos(bladeA) * 12, my - ny * 13 - Math.sin(bladeA) * 12);
    ctx.lineTo(hand.x - nx * 13, hand.y - ny * 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,130,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (i === 6 || i === 7 || i === 8) {
      glow(ctx, tipX, tipY, 50, '#ffd9a0', 0.45);
    }
    // pomo
    ctx.fillStyle = '#ffc070';
    ctx.beginPath();
    ctx.arc(hand.x - Math.cos(bladeA) * 34, hand.y - Math.sin(bladeA) * 34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ------------------------------------------------------------ perigos
function buildHazards(scene) {
  // redemoinho de areia: 6 quadros girando
  sheetTexture(scene, 'tornado', 180, 280, 6, (ctx, i) => {
    const cx = 90;
    const ph = (i / 6) * Math.PI * 2;
    for (let k = 0; k < 26; k++) {
      const t = k / 25; // 0 embaixo, 1 no alto
      const y = 270 - t * 250;
      const rw = 12 + t * t * 70;
      const off = Math.sin(ph + t * 5) * 10 * t;
      ctx.strokeStyle = `rgba(${220 - t * 30},${170 - t * 30},${110 - t * 20},${0.25 + 0.4 * (1 - Math.abs(t - 0.5))})`;
      ctx.lineWidth = 3 + t * 3;
      ctx.beginPath();
      ctx.ellipse(cx + off, y, rw, 6 + t * 7, 0, ph + k, ph + k + Math.PI * 1.2);
      ctx.stroke();
    }
    // grãos
    for (let k = 0; k < 40; k++) {
      const t = ((k * 37) % 100) / 100;
      const a = ph * (1 + t) + k;
      const rw = 14 + t * t * 72;
      ctx.fillStyle = 'rgba(255,220,170,0.7)';
      ctx.fillRect(cx + Math.cos(a) * rw, 270 - t * 250 + Math.sin(a) * 5, 3, 2);
    }
  });
  // grades de vapor: quente (laranja) e corrente que levanta (ciano)
  for (const [key, color] of [['vent-hot', '#ff8a4a'], ['vent-lift', '#8ff4ff']]) {
    canvasTexture(scene, key, 110, 50, (ctx) => {
      glow(ctx, 55, 18, 50, color, 0.5);
      ctx.fillStyle = '#2a1c18';
      ctx.beginPath();
      ctx.moveTo(6, 50);
      ctx.lineTo(16, 18);
      ctx.lineTo(94, 18);
      ctx.lineTo(104, 50);
      ctx.fill();
      ctx.fillStyle = '#120a0a';
      ctx.fillRect(22, 20, 66, 12);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      for (let x = 28; x < 88; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 21);
        ctx.lineTo(x, 31);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,220,180,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 18);
      ctx.lineTo(94, 18);
      ctx.stroke();
    });
  }
}

// ------------------------------------------------------------ projéteis
function buildProjectiles(scene) {
  canvasTexture(scene, 'arrow', 110, 24, (ctx) => {
    glow(ctx, 92, 12, 20, STEAM, 0.7);
    ctx.strokeStyle = '#6a4a30';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(90, 12);
    ctx.stroke();
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath();
    ctx.moveTo(106, 12);
    ctx.lineTo(86, 4);
    ctx.lineTo(86, 20);
    ctx.fill();
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(22, 12);
    ctx.lineTo(4, 20);
    ctx.lineTo(12, 12);
    ctx.fill();
  });
  canvasTexture(scene, 'sandball', 64, 64, (ctx) => {
    glow(ctx, 32, 32, 32, AMBER, 0.5);
    ctx.fillStyle = stoneGrad(ctx, 16, 16, 48, 48);
    ctx.beginPath();
    ctx.arc(32, 32, 15, 0, Math.PI * 2);
    ctx.fill();
    crack(ctx, [[24, 26], [32, 32], [28, 40]], AMBER, 1.5);
  });
  // lâmina de vento: meia-lua branca (tingida de verde no jogo)
  canvasTexture(scene, 'windblade', 150, 170, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(40, 0, 140, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(60, 8);
    ctx.quadraticCurveTo(160, 85, 60, 162);
    ctx.quadraticCurveTo(118, 85, 60, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (const o of [-24, -44]) {
      ctx.beginPath();
      ctx.moveTo(60 + o, 30);
      ctx.quadraticCurveTo(128 + o, 85, 60 + o, 140);
      ctx.stroke();
    }
  });
  // onda de ar rasteira (Quebra-Chão)
  canvasTexture(scene, 'airwave', 120, 110, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 14;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 - k * 0.25})`;
      ctx.lineWidth = 6 - k * 1.5;
      ctx.beginPath();
      ctx.moveTo(20 + k * 16, 106);
      ctx.quadraticCurveTo(110 - k * 10, 90, 80 - k * 12, 10 + k * 18);
      ctx.stroke();
    }
    ctx.restore();
  });
  // bola de fogo (núcleo branco, borda laranja)
  canvasTexture(scene, 'fireball', 96, 96, (ctx) => {
    glow(ctx, 48, 48, 48, '#ff6a1a', 0.8);
    glow(ctx, 48, 48, 30, '#ffb040', 0.9);
    const g = ctx.createRadialGradient(44, 44, 2, 48, 48, 18);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#fff0b0');
    g.addColorStop(1, '#ff9a3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(48, 48, 17, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTexture(scene, 'flame', 64, 96, (ctx) => {
    glow(ctx, 32, 60, 32, '#ff7a2a', 0.6);
    const g = ctx.createLinearGradient(0, 90, 0, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#ffe08a');
    g.addColorStop(0.7, '#ff8a2a');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.quadraticCurveTo(58, 50, 50, 70);
    ctx.quadraticCurveTo(32, 96, 14, 70);
    ctx.quadraticCurveTo(6, 50, 32, 4);
    ctx.fill();
  });
  // anel de choque genérico (tingível)
  canvasTexture(scene, 'ring', 256, 256, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 104, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, 88, 0, Math.PI * 2);
    ctx.stroke();
  });
  // espiral (furacão), tingível
  canvasTexture(scene, 'spiral', 256, 256, (ctx) => {
    ctx.save();
    ctx.translate(128, 128);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    for (let arm = 0; arm < 4; arm++) {
      ctx.rotate(Math.PI / 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.75 - arm * 0.1})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const a = t * Math.PI * 2.2;
        const rr = 14 + t * 104;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  });
}

// ------------------------------------------------------------ objetos
function buildObjects(scene) {
  // portão das Ruínas: laje de pedra com o sol partido (5 blocos de altura)
  canvasTexture(scene, 'ruin-gate', 110, 330, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 110, 0);
    g.addColorStop(0, '#3a2418');
    g.addColorStop(0.3, '#a8764a');
    g.addColorStop(0.7, '#7a4e32');
    g.addColorStop(1, '#2a1810');
    ctx.fillStyle = g;
    ctx.fillRect(8, 0, 94, 330);
    ctx.strokeStyle = 'rgba(30,16,10,0.8)';
    ctx.lineWidth = 3;
    for (let y = 40; y < 330; y += 48) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(102, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 0, 94, 330);
    ctx.save();
    ctx.shadowColor = '#7dffc8';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#bfffe6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(55, 165, 22, 0.4, Math.PI * 1.6);
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(55 + Math.cos(a) * 30, 165 + Math.sin(a) * 30);
      ctx.lineTo(55 + Math.cos(a) * 40, 165 + Math.sin(a) * 40);
      ctx.stroke();
    }
    ctx.restore();
  });
  // altar do elemento: pedestal de pedra com uma tigela (a chama é desenhada no jogo)
  canvasTexture(scene, 'altar', 180, 200, (ctx) => {
    ctx.fillStyle = stoneGrad(ctx, 30, 60, 150, 200, '#c89464', '#7a4e32', '#2a1810');
    ctx.fillRect(40, 70, 100, 110);
    ctx.fillRect(20, 176, 140, 24);
    ctx.fillRect(28, 56, 124, 18);
    ctx.strokeStyle = 'rgba(255,220,170,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 70, 100, 110);
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.ellipse(90, 56, 56, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd9a0';
    ctx.stroke();
    // runas
    ctx.strokeStyle = 'rgba(255,200,130,0.6)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const x = 62 + k * 28;
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x, 150);
      ctx.moveTo(x - 7, 112);
      ctx.lineTo(x + 7, 126);
      ctx.stroke();
    }
  });
  // fragmentos deixados na morte (sombra do Kio): orbe escuro rachado
  canvasTexture(scene, 'shade-core', 120, 120, (ctx) => {
    glow(ctx, 60, 60, 60, '#ffd98a', 0.35);
    const g = ctx.createRadialGradient(52, 50, 4, 60, 60, 34);
    g.addColorStop(0, '#3a3050');
    g.addColorStop(1, '#05040a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(60, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    crack(ctx, [[46, 44], [58, 58], [52, 72]], '#ffd98a', 2);
    crack(ctx, [[70, 46], [64, 58], [76, 70]], '#ffd98a', 1.6);
  });
}

// ------------------------------------------------------------ ícones do HUD
function buildIcons(scene) {
  const S = 96;
  canvasTexture(scene, 'sk-slot', S, S, (ctx) => {
    const g = ctx.createRadialGradient(48, 44, 6, 48, 48, 44);
    g.addColorStop(0, 'rgba(40,50,80,0.85)');
    g.addColorStop(1, 'rgba(8,10,20,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(48, 48, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(223,233,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(48, 48, 34, 0, Math.PI * 2);
    ctx.stroke();
    // pontas de losango
    ctx.fillStyle = '#dfe9ff';
    for (const [x, y] of [[48, 4], [48, 92], [4, 48], [92, 48]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.fill();
    }
  });
  canvasTexture(scene, 'sk-lock', S, S, (ctx) => {
    ctx.strokeStyle = 'rgba(200,210,230,0.7)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(48, 42, 12, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,210,230,0.7)';
    ctx.fillRect(32, 42, 32, 24);
  });
  const icon = (key, draw) =>
    canvasTexture(scene, key, S, S, (ctx) => {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      draw(ctx);
      ctx.restore();
    });
  icon('sk-wind-1', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(38, 16);
    ctx.quadraticCurveTo(86, 48, 38, 80);
    ctx.quadraticCurveTo(64, 48, 38, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    for (const o of [0, 12]) {
      ctx.beginPath();
      ctx.moveTo(14 + o, 34 + o);
      ctx.lineTo(34 + o, 34 + o);
      ctx.stroke();
    }
  });
  icon('sk-wind-2', (ctx) => {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(18, 74);
    ctx.lineTo(78, 74);
    ctx.stroke();
    ctx.lineWidth = 3.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(28 + k * 16, 70);
      ctx.quadraticCurveTo(52 + k * 14, 62, 42 + k * 14, 26 + k * 6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(20, 18);
    ctx.lineTo(20, 50);
    ctx.stroke();
  });
  icon('sk-wind-3', (ctx) => {
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = t * Math.PI * 4;
      const r = 4 + t * 34;
      const x = 48 + Math.cos(a) * r;
      const y = 48 + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  icon('sk-fire-1', (ctx) => {
    ctx.beginPath();
    ctx.arc(58, 50, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    for (const [o, l] of [[-10, 26], [0, 36], [10, 26]]) {
      ctx.beginPath();
      ctx.moveTo(42, 50 + o);
      ctx.lineTo(42 - l, 50 + o * 1.4);
      ctx.stroke();
    }
  });
  icon('sk-fire-2', (ctx) => {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(24, 76);
    ctx.lineTo(70, 22);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, 60);
    ctx.lineTo(38, 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 30);
    ctx.quadraticCurveTo(68, 36, 64, 16);
    ctx.quadraticCurveTo(84, 32, 70, 50);
    ctx.stroke();
  });
  icon('sk-fire-3', (ctx) => {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(48, 48, 28, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(48 + Math.cos(a) * 28, 48 + Math.sin(a) * 28, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(48, 48, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  // emblemas dos elementos
  icon('el-wind', (ctx) => {
    ctx.lineWidth = 5;
    for (const [y, l, c] of [[34, 56, 14], [50, 66, 18], [66, 46, 10]]) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(14 + l, y);
      ctx.arc(14 + l, y - c, c, Math.PI / 2, -Math.PI * 0.9, true);
      ctx.stroke();
    }
  });
  icon('el-fire', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(48, 10);
    ctx.quadraticCurveTo(80, 44, 70, 66);
    ctx.quadraticCurveTo(58, 90, 48, 86);
    ctx.quadraticCurveTo(24, 88, 24, 64);
    ctx.quadraticCurveTo(24, 44, 40, 34);
    ctx.quadraticCurveTo(38, 52, 48, 56);
    ctx.quadraticCurveTo(56, 36, 48, 10);
    ctx.fill();
  });
  // barra de mana (moldura + preenchimento claro para tingir)
  canvasTexture(scene, 'mana-frame', 420, 40, (ctx) => {
    ctx.fillStyle = 'rgba(6,8,16,0.8)';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(406, 8);
    ctx.lineTo(414, 20);
    ctx.lineTo(406, 32);
    ctx.lineTo(14, 32);
    ctx.lineTo(6, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
  for (const [key, hi, mid, lo] of [
    ['mana-fill', '#ffffff', '#d8d8d8', '#9a9a9a'],
    ['mana-fill-wind', '#e8ffe8', '#5cff7a', '#12702e'],
    ['mana-fill-fire', '#fff0c8', '#ff9a3a', '#8a2a0a'],
  ]) {
    canvasTexture(scene, key, 392, 16, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 16);
      g.addColorStop(0, hi);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, lo);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 392, 16);
    });
  }
  void rgba;
}
