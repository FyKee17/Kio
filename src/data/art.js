// Catálogo de arte do jogo.
//
// Para usar sua própria arte: coloque o arquivo em `public/assets/` e troque
// `file: null` pelo caminho (ex.: 'assets/kio.png'). Enquanto `file` for null
// (ou o arquivo não carregar), o jogo desenha um placeholder com as mesmas
// dimensões e número de quadros — então dá para trocar um de cada vez.
//
// Spritesheets são lidas da esquerda para a direita, quadros de
// frameWidth x frameHeight. Veja public/assets/LEIA-ME.md.

export const ART = {
  kio: {
    file: null,
    frameWidth: 16,
    frameHeight: 24,
    frames: 8,
    // 0-1 parado, 2-5 correndo, 6 subindo, 7 caindo
    anims: {
      idle: { frames: [0, 1], rate: 3, repeat: -1 },
      run: { frames: [2, 3, 4, 5], rate: 12, repeat: -1 },
      jump: { frames: [6], rate: 1, repeat: 0 },
      fall: { frames: [7], rate: 1, repeat: 0 },
    },
  },
  // 0 grama (superfície), 1 terra (interior), 2 plataforma vazada, 3 espinhos
  tiles: { file: null, frameWidth: 16, frameHeight: 16, frames: 4 },
  memory: {
    file: null, frameWidth: 12, frameHeight: 12, frames: 4,
    anims: { spin: { frames: [0, 1, 2, 3], rate: 8, repeat: -1 } },
  },
  // 0 apagado, 1 aceso
  checkpoint: { file: null, frameWidth: 16, frameHeight: 32, frames: 2 },
  door: { file: null, frameWidth: 24, frameHeight: 32, frames: 1 },

  // NPCs: 2 quadros de "respiração"
  npc_musgo: { file: null, frameWidth: 20, frameHeight: 24, frames: 2, color: '#6b8f4e' },
  npc_lume: { file: null, frameWidth: 12, frameHeight: 12, frames: 2, color: '#f2d16b' },
  npc_eco: { file: null, frameWidth: 20, frameHeight: 32, frames: 2, color: '#8a8ea3' },
  npc_raiz: { file: null, frameWidth: 28, frameHeight: 32, frames: 2, color: '#b07ad6' },

  // Fundos (uma imagem cada, repetida horizontalmente com parallax)
  bg_sky: { file: null, frameWidth: 480, frameHeight: 270, frames: 1 },
  bg_far: { file: null, frameWidth: 480, frameHeight: 270, frames: 1 },
  bg_near: { file: null, frameWidth: 480, frameHeight: 270, frames: 1 },
};

// ---------------------------------------------------------------------------
// Placeholders desenhados em canvas. Não precisa mexer aqui para trocar a arte.

const px = (ctx, color, x, y, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

function drawKio(ctx, i, w, h) {
  const bob = i === 1 ? 1 : 0;
  const stretch = i === 6 ? -2 : i === 7 ? 1 : 0;
  const top = 6 + bob - stretch;
  // corpo
  px(ctx, '#f4efe6', 3, top, 10, h - top - 3);
  px(ctx, '#d9d0c1', 3, h - 6, 10, 3);
  // orelhas
  px(ctx, '#f4efe6', 3, top - 4, 2, 4);
  px(ctx, '#f4efe6', 11, top - 4, 2, 4);
  px(ctx, '#e89aa6', 3, top - 3, 1, 2);
  // olhos
  px(ctx, '#1b1726', 6, top + 4, 1, 2);
  px(ctx, '#1b1726', 10, top + 4, 1, 2);
  // cachecol
  px(ctx, '#e0584f', 2, top + 8, 12, 2);
  if (i >= 2 && i <= 5) px(ctx, '#e0584f', 0, top + 8 + (i % 2), 2, 2);
  // pés
  const step = i >= 2 && i <= 5 ? [0, 1, 0, -1][i - 2] : 0;
  px(ctx, '#1b1726', 4 + step, h - 3, 3, 3);
  px(ctx, '#1b1726', 9 - step, h - 3, 3, 3);
}

function drawTiles(ctx, i, w, h) {
  if (i === 0 || i === 1) {
    px(ctx, '#4a3a52', 0, 0, w, h);
    px(ctx, '#3b2e44', 2, 6, 2, 2);
    px(ctx, '#3b2e44', 10, 11, 3, 2);
    px(ctx, '#56455f', 7, 3, 2, 1);
    if (i === 0) {
      px(ctx, '#7fb069', 0, 0, w, 4);
      px(ctx, '#5f8f4e', 0, 4, w, 1);
      px(ctx, '#9fd08a', 3, 0, 2, 1);
      px(ctx, '#9fd08a', 11, 0, 3, 1);
    }
  } else if (i === 2) {
    px(ctx, '#a07850', 0, 0, w, 4);
    px(ctx, '#7a5a3a', 0, 4, w, 1);
    px(ctx, '#7a5a3a', 2, 5, 1, 3);
    px(ctx, '#7a5a3a', 13, 5, 1, 3);
  } else {
    for (let s = 0; s < 4; s++) {
      const x = s * 4;
      for (let r = 0; r < 4; r++) px(ctx, '#d8d8e8', x + r / 2, h - 2 - r * 2, 4 - r, 2);
      px(ctx, '#9a9ab0', x, h - 2, 4, 2);
    }
  }
}

function drawMemory(ctx, i, w, h) {
  const widths = [8, 6, 2, 6];
  const bw = widths[i];
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    const t = 1 - Math.abs(y - h / 2 + 0.5) / (h / 2);
    const rw = Math.max(1, Math.round(bw * t));
    px(ctx, '#9ee7ff', Math.round(cx - rw / 2), y, rw, 1);
  }
  px(ctx, '#ffffff', Math.round(cx - 1), 3, 2, 2);
}

function drawCheckpoint(ctx, i, w, h) {
  px(ctx, '#5a4a3a', 7, 6, 2, h - 6);
  px(ctx, '#3b2e44', 4, h - 2, 8, 2);
  px(ctx, i ? '#ffd36e' : '#6a6478', 4, 0, 8, 8);
  if (i) {
    px(ctx, '#fff4c4', 6, 2, 4, 4);
  }
}

function drawDoor(ctx, i, w, h) {
  px(ctx, '#3b2e44', 0, 0, w, h);
  px(ctx, '#1b1726', 3, 3, w - 6, h - 3);
  px(ctx, '#c9b8ff', 5, 5, w - 10, h - 5);
  px(ctx, '#ffffff', 7, 8, 3, 10);
}

function drawNpc(color) {
  return (ctx, i, w, h) => {
    const bob = i;
    px(ctx, color, 1, 2 + bob, w - 2, h - 2 - bob);
    px(ctx, 'rgba(0,0,0,0.25)', 1, h - 3, w - 2, 3);
    px(ctx, '#1b1726', Math.floor(w * 0.3), 5 + bob, 2, 2);
    px(ctx, '#1b1726', Math.floor(w * 0.65), 5 + bob, 2, 2);
  };
}

function drawSky(ctx, i, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d1636');
  g.addColorStop(1, '#5a3d6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let s = 0; s < 60; s++) px(ctx, 'rgba(255,255,255,0.7)', Math.floor(rnd() * w), Math.floor(rnd() * h * 0.6));
}

function drawHills(color, base, amp, freq) {
  return (ctx, i, w, h) => {
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
      const y = base + Math.sin((x / w) * Math.PI * 2 * freq) * amp + Math.sin((x / w) * Math.PI * 2 * freq * 3) * amp * 0.3;
      ctx.fillRect(x, Math.round(y), 1, h - Math.round(y));
    }
  };
}

export const PLACEHOLDERS = {
  kio: drawKio,
  tiles: drawTiles,
  memory: drawMemory,
  checkpoint: drawCheckpoint,
  door: drawDoor,
  npc_musgo: drawNpc(ART.npc_musgo.color),
  npc_lume: drawNpc(ART.npc_lume.color),
  npc_eco: drawNpc(ART.npc_eco.color),
  npc_raiz: drawNpc(ART.npc_raiz.color),
  bg_sky: drawSky,
  bg_far: drawHills('#3a2a55', 150, 25, 2),
  bg_near: drawHills('#2a1f3d', 190, 18, 3),
};
