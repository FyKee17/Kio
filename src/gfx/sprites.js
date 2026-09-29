// Sprites desenhadas em código (inimigos, personagens, objetos, efeitos).
// Tudo é desenhado em 2x e exibido em escala 0.5 para ficar nítido.
// O Kio usa as folhas de arte em public/assets/.

import { sheetTexture, canvasTexture, glow, rgba } from './util.js';

const DARK = '#0b0f1e';
const DARK2 = '#18203a';
const EDGE = 'rgba(120,170,255,0.35)';

function eyes(ctx, x, y, gap, r, color = '#e8fbff') {
  glow(ctx, x - gap, y, r * 4, color, 0.5);
  glow(ctx, x + gap, y, r * 4, color, 0.5);
  ctx.fillStyle = color;
  for (const ex of [x - gap, x + gap]) {
    ctx.beginPath();
    ctx.ellipse(ex, y, r * 0.8, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function outline(ctx, color = EDGE, w = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

export function buildSprites(scene) {
  // ---- efeitos básicos
  canvasTexture(scene, 'glow', 128, 128, (ctx) => glow(ctx, 64, 64, 64, '#ffffff', 1));
  canvasTexture(scene, 'soft', 32, 32, (ctx) => glow(ctx, 16, 16, 16, '#ffffff', 1));
  canvasTexture(scene, 'slash', 280, 150, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#8fe9ff';
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(20, 0, 270, 0);
    g.addColorStop(0, 'rgba(160,230,255,0)');
    g.addColorStop(0.55, 'rgba(200,245,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.quadraticCurveTo(300, 20, 250, 132);
    ctx.quadraticCurveTo(250, 60, 30, 18);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(60, 22);
    ctx.quadraticCurveTo(280, 30, 248, 128);
    ctx.stroke();
  });
  canvasTexture(scene, 'hitfx', 96, 96, (ctx) => {
    glow(ctx, 48, 48, 40, '#ffffff', 0.7);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(48, 48);
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(46, 0);
      ctx.lineTo(0, 4);
      ctx.fill();
      ctx.restore();
    }
  });

  // ---- inimigos
  sheetTexture(scene, 'crawler', 128, 96, 4, (ctx, i) => {
    // perninhas
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const lx = 38 + k * 24;
      const phase = (i + k) % 2 ? 6 : -6;
      ctx.beginPath();
      ctx.moveTo(lx, 70);
      ctx.lineTo(lx + phase, 90);
      ctx.stroke();
    }
    // casco
    const bob = i % 2 ? 2 : 0;
    const g = ctx.createLinearGradient(0, 20, 0, 80);
    g.addColorStop(0, '#26335a');
    g.addColorStop(1, DARK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(62, 60 + bob, 48, 30, 0, Math.PI, 0);
    ctx.lineTo(110, 76 + bob);
    ctx.lineTo(14, 76 + bob);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    // placas e pintas luminosas
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    for (const px of [44, 66]) {
      ctx.beginPath();
      ctx.moveTo(px, 34 + bob);
      ctx.quadraticCurveTo(px + 6, 55, px, 76 + bob);
      ctx.stroke();
    }
    for (const [sx, sy] of [[36, 52], [57, 42], [80, 50]]) {
      glow(ctx, sx, sy + bob, 12, '#6ff6e0', 0.8);
    }
    // cabeça
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.ellipse(108, 66 + bob, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, 112, 64 + bob, 5, 3, '#ffe9a8');
  });

  sheetTexture(scene, 'flyer', 128, 112, 4, (ctx, i) => {
    const flap = [1, 0.55, 0.15, 0.55][i];
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(64, 50);
      ctx.scale(side, flap);
      const g = ctx.createRadialGradient(30, -10, 4, 30, -10, 56);
      g.addColorStop(0, '#3a2566');
      g.addColorStop(1, '#120a26');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.bezierCurveTo(30, -60, 70, -50, 60, -8);
      ctx.bezierCurveTo(56, 20, 30, 30, 4, 8);
      ctx.fill();
      outline(ctx, 'rgba(194,141,255,0.6)', 2);
      glow(ctx, 36, -18, 14, '#c28dff', 0.9);
      glow(ctx, 48, 2, 8, '#e3c8ff', 0.8);
      ctx.restore();
    }
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.ellipse(64, 60, 13, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 38);
    ctx.quadraticCurveTo(50, 20, 44, 22);
    ctx.moveTo(68, 38);
    ctx.quadraticCurveTo(78, 20, 84, 22);
    ctx.stroke();
    eyes(ctx, 64, 46, 6, 3, '#ff9fd6');
  });

  sheetTexture(scene, 'spitter', 112, 128, 2, (ctx, i) => {
    // raiz/caule
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(40, 128);
    ctx.quadraticCurveTo(52, 96, 50, 78);
    ctx.lineTo(62, 78);
    ctx.quadraticCurveTo(60, 96, 72, 128);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(56 + s * 22, 112, 22, 7, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // bulbo
    const open = i === 1;
    const g = ctx.createRadialGradient(56, 50, 6, 56, 56, 44);
    g.addColorStop(0, '#3d2466');
    g.addColorStop(1, DARK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(56, 54, 34, open ? 40 : 34, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 'rgba(194,141,255,0.5)');
    if (open) {
      glow(ctx, 56, 44, 30, '#e3a8ff', 0.9);
      ctx.fillStyle = '#f3dcff';
      ctx.beginPath();
      ctx.ellipse(56, 44, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#c28dff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, 44);
      ctx.quadraticCurveTo(56, 52, 74, 44);
      ctx.stroke();
      glow(ctx, 56, 46, 18, '#c28dff', 0.5);
    }
  });

  canvasTexture(scene, 'orb', 48, 48, (ctx) => {
    glow(ctx, 24, 24, 24, '#d9a8ff', 1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(24, 24, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'wave', 96, 72, (ctx) => {
    ctx.save();
    ctx.shadowColor = '#8fe9ff';
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(0, 72, 0, 0);
    g.addColorStop(0, 'rgba(210,245,255,1)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 72);
    ctx.quadraticCurveTo(40, 30, 48, 4);
    ctx.quadraticCurveTo(58, 30, 88, 72);
    ctx.fill();
    ctx.restore();
  });

  // Chefe: Guardião Oco — carapaça enorme, máscara pálida com chifres
  sheetTexture(scene, 'boss', 320, 288, 4, (ctx, i) => {
    const crouch = i === 3 ? 18 : 0;
    const lean = i === 2 ? 18 : i === 1 ? -10 : 0;
    ctx.save();
    ctx.translate(lean, crouch);
    // capa/carapaça
    const g = ctx.createLinearGradient(0, 60, 0, 280);
    g.addColorStop(0, '#1f2847');
    g.addColorStop(1, '#070a16');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(90, 120);
    ctx.bezierCurveTo(60, 170, 50, 240, 60, 270);
    ctx.lineTo(250, 270);
    ctx.bezierCurveTo(264, 230, 250, 160, 220, 118);
    ctx.quadraticCurveTo(160, 90, 90, 120);
    ctx.fill();
    outline(ctx, 'rgba(120,170,255,0.4)', 3);
    // runas na carapaça
    for (const [rx, ry] of [[120, 190], [160, 210], [200, 188]]) glow(ctx, rx, ry, 16, '#6ff6e0', 0.75);
    // pernas
    ctx.fillStyle = DARK;
    ctx.fillRect(100, 262 - crouch, 36, 26 + crouch);
    ctx.fillRect(184, 262 - crouch, 36, 26 + crouch);
    // braço com lâmina
    ctx.save();
    ctx.translate(226, 150);
    ctx.rotate(i === 1 ? -1.9 : i === 2 ? 0.35 : 0.7);
    ctx.fillStyle = DARK;
    ctx.fillRect(-10, -8, 70, 22);
    ctx.shadowColor = '#bff4ff';
    ctx.shadowBlur = i === 2 ? 30 : 12;
    ctx.fillStyle = '#cfefff';
    ctx.beginPath();
    ctx.moveTo(56, -4);
    ctx.lineTo(150, 4);
    ctx.lineTo(56, 16);
    ctx.fill();
    ctx.restore();
    // máscara
    ctx.fillStyle = '#e9eef6';
    ctx.beginPath();
    ctx.moveTo(122, 60);
    ctx.quadraticCurveTo(160, 40, 198, 60);
    ctx.quadraticCurveTo(206, 120, 160, 140);
    ctx.quadraticCurveTo(114, 120, 122, 60);
    ctx.fill();
    // chifres
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(160 + s * 28, 62);
      ctx.quadraticCurveTo(160 + s * 70, 40, 160 + s * 64, -2);
      ctx.quadraticCurveTo(160 + s * 50, 38, 160 + s * 20, 50);
      ctx.fill();
    }
    // olhos
    ctx.fillStyle = '#05070f';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(160 + s * 18, 92, 10, 17, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const eyeColor = i === 1 ? '#ffb3d9' : '#8ff4ff';
    glow(ctx, 142, 94, 14, eyeColor, 0.9);
    glow(ctx, 178, 94, 14, eyeColor, 0.9);
    ctx.restore();
  });

  // ---- personagens
  sheetTexture(scene, 'npc_musgo', 160, 170, 2, (ctx, i) => {
    const b = i;
    // bengala
    ctx.strokeStyle = '#2a2f45';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(122, 70);
    ctx.lineTo(128, 168);
    ctx.stroke();
    glow(ctx, 122, 64, 26, '#ffd98a', 0.9);
    ctx.fillStyle = '#fff1c9';
    ctx.beginPath();
    ctx.arc(122, 64, 6, 0, Math.PI * 2);
    ctx.fill();
    // corpo curvado com xale de musgo
    const g = ctx.createLinearGradient(0, 50, 0, 170);
    g.addColorStop(0, '#2b6b5f');
    g.addColorStop(0.5, '#173b3a');
    g.addColorStop(1, DARK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(40, 168);
    ctx.bezierCurveTo(26, 120, 44, 64 + b, 86, 56 + b);
    ctx.bezierCurveTo(118, 54 + b, 122, 100, 116, 168);
    ctx.fill();
    outline(ctx, 'rgba(111,246,224,0.45)');
    for (let k = 0; k < 7; k++) glow(ctx, 44 + k * 10, 80 + (k % 3) * 14 + b, 7, '#6ff6e0', 0.6);
    // rosto
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.ellipse(92, 84 + b, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, 96, 84 + b, 7, 2.6, '#fff4d0');
  });

  sheetTexture(scene, 'npc_lume', 72, 72, 2, (ctx, i) => {
    const b = i * 2;
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(36 + s * 14, 26 - b, 13, 7, s * -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = DARK2;
    ctx.beginPath();
    ctx.ellipse(36, 36 - b, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, 36, 52 - b, 16, '#ffd98a', 0.45);
    ctx.fillStyle = '#6a5a2a';
    ctx.beginPath();
    ctx.ellipse(36, 50 - b, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, 36, 33 - b, 4, 2, '#ffffff');
  });

  sheetTexture(scene, 'npc_eco', 150, 220, 2, (ctx, i) => {
    const g = ctx.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, '#5a6680');
    g.addColorStop(1, '#232a3d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(30, 218);
    ctx.lineTo(40, 110);
    ctx.quadraticCurveTo(40, 30, 75, 22);
    ctx.quadraticCurveTo(110, 30, 110, 110);
    ctx.lineTo(120, 218);
    ctx.fill();
    outline(ctx, 'rgba(160,190,230,0.35)', 3);
    ctx.fillStyle = '#2e3548';
    ctx.fillRect(22, 196, 106, 24);
    // runas que pulsam
    const a = i ? 0.95 : 0.6;
    for (const [rx, ry] of [[75, 120], [60, 150], [90, 160], [75, 185]]) glow(ctx, rx, ry, 10, '#8ff4ff', a);
    ctx.fillStyle = '#10141f';
    ctx.beginPath();
    ctx.ellipse(75, 66, 24, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, 75, 66, 9, 3, '#8ff4ff');
  });

  sheetTexture(scene, 'npc_raiz', 320, 380, 2, (ctx, i) => {
    // tronco ancestral com rosto
    const g = ctx.createLinearGradient(0, 0, 0, 380);
    g.addColorStop(0, '#2b2350');
    g.addColorStop(1, '#0c0a1c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, 380);
    ctx.bezierCurveTo(80, 330, 90, 200, 110, 60);
    ctx.quadraticCurveTo(160, 0, 210, 60);
    ctx.bezierCurveTo(230, 200, 240, 330, 300, 380);
    ctx.fill();
    outline(ctx, 'rgba(194,141,255,0.5)', 3);
    // veios luminosos
    ctx.strokeStyle = rgba('#c28dff', i ? 0.8 : 0.45);
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(120 + k * 20, 370);
      ctx.bezierCurveTo(100 + k * 25, 300, 150 + k * 5, 250, 140 + k * 10, 180);
      ctx.stroke();
    }
    const glowA = i ? 1 : 0.7;
    eyes(ctx, 160, 140, 34, 7, '#f0dcff');
    glow(ctx, 160, 200, 30, '#c28dff', glowA * 0.6);
    ctx.fillStyle = '#05040c';
    ctx.beginPath();
    ctx.ellipse(160, 200, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- objetos
  canvasTexture(scene, 'bench', 180, 150, (ctx) => {
    // lanterna de pedra com chama azul
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(20, 40, 22, 110);
    ctx.fillRect(12, 30, 38, 14);
    glow(ctx, 31, 22, 40, '#7cc8ff', 0.9);
    ctx.fillStyle = '#dff4ff';
    ctx.beginPath();
    ctx.moveTo(31, 4);
    ctx.quadraticCurveTo(42, 22, 31, 30);
    ctx.quadraticCurveTo(20, 22, 31, 4);
    ctx.fill();
    // banco
    const g = ctx.createLinearGradient(0, 90, 0, 150);
    g.addColorStop(0, '#48557a');
    g.addColorStop(1, '#1a2036');
    ctx.fillStyle = g;
    ctx.fillRect(56, 100, 116, 16);
    ctx.fillRect(64, 116, 14, 34);
    ctx.fillRect(150, 116, 14, 34);
    ctx.fillRect(60, 70, 108, 10);
    ctx.fillRect(66, 70, 8, 32);
    ctx.fillRect(154, 70, 8, 32);
    ctx.strokeStyle = 'rgba(111,246,224,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(56, 100);
    ctx.lineTo(172, 100);
    ctx.stroke();
  });

  canvasTexture(scene, 'tablet', 110, 150, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, '#4a5470');
    g.addColorStop(1, '#1b2033');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, 150);
    ctx.lineTo(14, 30);
    ctx.quadraticCurveTo(55, -4, 96, 30);
    ctx.lineTo(100, 150);
    ctx.fill();
    outline(ctx, 'rgba(160,190,230,0.35)', 3);
    ctx.strokeStyle = 'rgba(143,244,255,0.85)';
    ctx.shadowColor = '#8ff4ff';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const x = 26 + k * 16;
        const y = 50 + row * 22;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + (k % 2 ? 8 : -2));
      }
      ctx.stroke();
    }
  });

  canvasTexture(scene, 'deposit', 110, 110, (ctx) => {
    const shards = [[30, 104, 18, 60, -0.3], [55, 106, 22, 90, 0], [80, 104, 16, 55, 0.35], [44, 106, 12, 40, -0.6], [70, 108, 12, 36, 0.6]];
    glow(ctx, 55, 70, 50, '#ffd98a', 0.4);
    for (const [x, y, w, h, a] of shards) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, '#fff3cf');
      g.addColorStop(0.5, '#ffd98a');
      g.addColorStop(1, '#b7843a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(w / 2, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#1b2033';
    ctx.beginPath();
    ctx.ellipse(55, 104, 50, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'geo', 28, 28, (ctx) => {
    glow(ctx, 14, 14, 14, '#ffd98a', 0.7);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.moveTo(14, 3);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 25);
    ctx.lineTo(6, 14);
    ctx.fill();
  });

  canvasTexture(scene, 'ability', 120, 120, (ctx) => {
    glow(ctx, 60, 60, 60, '#7cc8ff', 0.9);
    ctx.strokeStyle = 'rgba(230,248,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(60, 60, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(60, 60, 14, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'heart', 80, 80, (ctx) => {
    glow(ctx, 40, 42, 40, '#6ff6e0', 0.8);
    ctx.fillStyle = '#b6fff1';
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.bezierCurveTo(10, 44, 16, 16, 40, 30);
    ctx.bezierCurveTo(64, 16, 70, 44, 40, 64);
    ctx.fill();
  });

  canvasTexture(scene, 'gate', 64, 64, (ctx) => {
    ctx.fillStyle = '#140b26';
    for (let x = 6; x < 64; x += 18) {
      ctx.fillRect(x, 0, 10, 64);
      ctx.fillStyle = 'rgba(194,141,255,0.5)';
      ctx.fillRect(x + 4, 0, 2, 64);
      ctx.fillStyle = '#140b26';
    }
  });

  // ---- HUD
  canvasTexture(scene, 'hp-full', 56, 64, (ctx) => flameIcon(ctx, true));
  canvasTexture(scene, 'hp-empty', 56, 64, (ctx) => flameIcon(ctx, false));
}

function flameIcon(ctx, full) {
  if (full) glow(ctx, 28, 38, 26, '#7cc8ff', 0.6);
  const g = ctx.createLinearGradient(0, 8, 0, 60);
  g.addColorStop(0, full ? '#ffffff' : 'rgba(120,140,170,0.35)');
  g.addColorStop(1, full ? '#4aa3ff' : 'rgba(40,50,70,0.5)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(28, 6);
  ctx.bezierCurveTo(40, 22, 48, 34, 44, 46);
  ctx.bezierCurveTo(40, 58, 16, 58, 12, 46);
  ctx.bezierCurveTo(8, 34, 20, 30, 22, 18);
  ctx.bezierCurveTo(26, 24, 30, 26, 28, 6);
  ctx.fill();
  ctx.strokeStyle = full ? 'rgba(255,255,255,0.8)' : 'rgba(160,180,210,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
