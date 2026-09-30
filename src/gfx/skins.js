// Skins do Kio por elemento: as folhas originais (chama azul) são repintadas
// quando o jogo carrega. Só os pixels azulados e saturados mudam de cor; os
// claros (miolo da chama) e os escuros neutros (roupa, botas) ficam iguais.
//
// Cada folha kio_x ganha kio_x_wind e kio_x_fire, e cada animação kio-y ganha
// kio-y@wind e kio-y@fire (ver Player.anim()).

import { SHEETS, ANIMS } from '../data/anims.js';

// matiz (0..1) para os tons claros (chama) e escuros (capa), ganho de saturação e brilho
const SKINS = {
  wind: { bright: 0.35, dark: 0.37, sat: 1.05, lift: 1.08 },
  fire: { bright: 0.095, dark: 0.055, sat: 1.1, lift: 1.25 },
};

export const SKIN_KEYS = Object.keys(SKINS);

const KIO_SHEETS = Object.keys(SHEETS).filter((k) => k.startsWith('kio_') && !k.endsWith('_hd'));

export function buildSkins(scene) {
  for (const sheet of KIO_SHEETS) {
    const src = scene.textures.get(sheet).getSourceImage();
    const { frameWidth: fw, frameHeight: fh } = SHEETS[sheet];
    const w = src.width;
    const h = src.height;
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(src, 0, 0);
    const pixels = bctx.getImageData(0, 0, w, h);
    for (const [name, skin] of Object.entries(SKINS)) {
      const key = `${sheet}_${name}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const img = new ImageData(new Uint8ClampedArray(pixels.data), w, h);
      recolor(img.data, skin);
      ctx.putImageData(img, 0, 0);
      const tex = scene.textures.addCanvas(key, canvas);
      let i = 0;
      for (let y = 0; y + fh <= h; y += fh) for (let x = 0; x + fw <= w; x += fw) tex.add(i++, 0, x, y, fw, fh);
    }
  }
}

export function createSkinAnims(scene) {
  const a = scene.anims;
  for (const def of ANIMS) {
    if (!KIO_SHEETS.includes(def.sheet)) continue;
    for (const name of SKIN_KEYS) {
      a.create({
        key: `${def.key}@${name}`,
        frames: a.generateFrameNumbers(`${def.sheet}_${name}`, { frames: def.frames }),
        frameRate: def.rate,
        repeat: def.repeat,
      });
    }
  }
}

function recolor(d, skin) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max;
    const c = max - min;
    const s = max ? c / max : 0;
    if (s < 0.16 || c === 0) continue;
    let h;
    if (max === r) h = ((g - b) / c) % 6;
    else if (max === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
    h /= 6;
    if (h < 0) h += 1;
    if (h < 0.47 || h > 0.78) continue;
    // força da troca: some suave na borda da faixa de azul
    const k = Math.min(1, (h - 0.47) / 0.04, (0.78 - h) / 0.04);
    const t = Math.min(1, Math.max(0, (v - 0.45) / 0.4)); // 0 = capa escura, 1 = chama
    const nh = skin.dark + (skin.bright - skin.dark) * t;
    const ns = Math.min(1, s * skin.sat);
    const nv = Math.min(1, v * (1 + (skin.lift - 1) * (1 - t)));
    const [nr, ng, nb] = hsv(nh, ns, nv);
    d[i] = (r + (nr - r) * k) * 255;
    d[i + 1] = (g + (ng - g) * k) * 255;
    d[i + 2] = (b + (nb - b) * k) * 255;
  }
}

function hsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}
