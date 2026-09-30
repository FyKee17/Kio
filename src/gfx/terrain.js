// Desenha o terreno do mundo a partir do mapa em blocos, no estilo "Ori":
// contornos orgânicos (blocos borrados + limiar), musgo brilhante nas superfícies,
// borda iluminada, e decoração: grama, cogumelos luminosos, flores, cipós,
// galhos (plataformas vazadas) e espinheiros.
//
// O resultado são texturas de 1000x1000 ("pedaços") postas lado a lado no mundo,
// e uma lista de luzes para a cena acender por cima.

import { TILE } from '../config.js';
import { rng, noise2, fbm, smoothstep, clamp, lerp, hexToRgb, rgba, glow } from './util.js';
import { RUINS_X } from '../data/world.js';

// peso do bioma das Ruínas (0 = floresta, 1 = arenito) numa coordenada x em px
const RUINS_PX = RUINS_X * TILE;
const ruinWeight = (wx) => smoothstep(RUINS_PX - 40, RUINS_PX + 200, wx);

// 1000 e não 1024: texturas potência de 2 repetem nas bordas e o filtro
// puxa uma linha do lado oposto (aparecia uma costura escura no céu).
export const CHUNK = 1000;
const S = 2; // resolução do campo de distância (1 amostra a cada 2 px)
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export async function buildTerrain(scene, map, onProgress = () => {}) {
  const W = map[0].length;
  const H = map.length;
  const PW = W * TILE;
  const PH = H * TILE;
  const cell = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H ? '#' : map[ty][tx]);
  const solid = (tx, ty) => cell(tx, ty) === '#';

  // 1) campo: 1 dentro da rocha, 0 fora, com bordas tortas e depois borrado
  const fw = PW / S;
  const fh = PH / S;
  let field = new Float32Array(fw * fh);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const wx = x * S;
      const wy = y * S;
      const ox = (noise2(wx / 70, wy / 70, 3) - 0.5) * 16;
      const oy = (noise2(wx / 70, wy / 70, 9) - 0.5) * 7;
      field[y * fw + x] = solid(Math.floor((wx + ox) / TILE), Math.floor((wy + oy) / TILE)) ? 1 : 0;
    }
  }
  field = blur(field, fw, fh, 5);
  field = blur(field, fw, fh, 4);
  onProgress(0.15);
  await yieldFrame();

  const F = (wx, wy) => {
    const fx = clamp(wx / S - 0.5, 0, fw - 1.001);
    const fy = clamp(wy / S - 0.5, 0, fh - 1.001);
    const xi = fx | 0;
    const yi = fy | 0;
    const tx = fx - xi;
    const ty = fy - yi;
    const i = yi * fw + xi;
    const a = field[i];
    const b = field[i + 1];
    const c = field[i + fw];
    const d = field[i + fw + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  // 2) decoração (lista global; cada pedaço desenha o que cruzar com ele)
  const { decor, lights } = planDecor(map, cell, solid);

  // 3) pintura de cada pedaço
  const chunks = [];
  const cols = Math.ceil(PW / CHUNK);
  const rows = Math.ceil(PH / CHUNK);
  let done = 0;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x0 = cx * CHUNK;
      const y0 = cy * CHUNK;
      const cw = Math.min(CHUNK, PW - x0);
      const ch = Math.min(CHUNK, PH - y0);
      const key = `terrain-${cx}-${cy}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      done++;
      // pedaço só de céu e sem decoração: nem cria a textura (economiza memória)
      if (isEmpty(F, x0, y0, cw, ch) && !decor.some((d) => !(d.x1 < x0 || d.x0 > x0 + cw || d.y1 < y0 || d.y0 > y0 + ch))) {
        onProgress(0.15 + 0.85 * (done / (cols * rows)));
        continue;
      }
      const tex = scene.textures.createCanvas(key, cw, ch);
      const ctx = tex.getContext();
      paintRock(ctx, x0, y0, cw, ch, PH, F);
      ctx.save();
      ctx.translate(-x0, -y0);
      paintRoots(ctx, x0, y0, cw, ch, cx * 31 + cy * 7);
      for (const d of decor) {
        if (d.x1 < x0 || d.x0 > x0 + cw || d.y1 < y0 || d.y0 > y0 + ch) continue;
        d.draw(ctx);
      }
      ctx.restore();
      tex.refresh();
      chunks.push({ key, x: x0, y: y0 });
      onProgress(0.15 + 0.85 * (done / (cols * rows)));
      await yieldFrame();
    }
  }
  return { chunks, lights, width: PW, height: PH };
}

function isEmpty(F, x0, y0, cw, ch) {
  for (let y = 0; y < ch; y += 8) for (let x = 0; x < cw; x += 8) if (F(x0 + x, y0 + y) > 0.03) return false;
  return true;
}

// Borrão de caixa separável (horizontal + vertical).
function blur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + clamp(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[clamp(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
    }
  }
  return out;
}

const C_TOP = hexToRgb('#1a2b45');
const C_BOTTOM = hexToRgb('#0b111f');
const C_RIM = hexToRgb('#5d8fd6');
const C_MOSS_DEEP = hexToRgb('#156c6c');
const C_MOSS = hexToRgb('#3fd4b6');
const C_MOSS_TIP = hexToRgb('#b6fff1');
const C_HALO = hexToRgb('#5ee8d8');
// Ruínas: arenito ao entardecer, areia por cima, borda dourada
const R_TOP = hexToRgb('#6e4a38');
const R_BOTTOM = hexToRgb('#1c1216');
const R_RIM = hexToRgb('#f2a86a');
const R_SAND_DEEP = hexToRgb('#8a5a34');
const R_SAND = hexToRgb('#d9a164');
const R_SAND_TIP = hexToRgb('#ffe6b0');
const R_HALO = hexToRgb('#ffb36b');
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Blocos de pedra talhada (juntas escuras) em faixas de 26px, deslocadas por fileira.
function masonry(wx, wy) {
  const row = Math.floor(wy / 26);
  const bw = 58 + (row % 3) * 6;
  const x = wx + (row % 2) * 29;
  const my = wy - row * 26;
  const col = Math.floor(x / bw);
  const mx = x - col * bw;
  const joint = my < 2.2 || mx < 2.2 ? 1 : 0;
  // leve variação de tom por bloco
  const h = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
  return { joint, tone: (h - Math.floor(h)) * 0.22 - 0.11 };
}

function paintRock(ctx, x0, y0, cw, ch, PH, F) {
  const img = ctx.createImageData(cw, ch);
  const px = img.data;

  // ruído de textura em baixa resolução (1/4), amostrado com interpolação
  const q = 4;
  const nw = Math.ceil(cw / q) + 2;
  const nh = Math.ceil(ch / q) + 2;
  const n1 = new Float32Array(nw * nh);
  const n2 = new Float32Array(nw * nh);
  for (let j = 0; j < nh; j++) {
    for (let i = 0; i < nw; i++) {
      const wx = x0 + i * q;
      const wy = y0 + j * q;
      n1[j * nw + i] = fbm(wx / 110, wy / 110, 21, 3);
      n2[j * nw + i] = fbm(wx / 16, wy / 70, 44, 2);
    }
  }
  const sampleN = (arr, x, y) => {
    const fx = x / q;
    const fy = y / q;
    const xi = fx | 0;
    const yi = fy | 0;
    const tx = fx - xi;
    const ty = fy - yi;
    const i = yi * nw + xi;
    const a = arr[i];
    const b = arr[i + 1];
    const c = arr[i + nw];
    const d = arr[i + nw + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  // profundidade desde o ar de cima (para o musgo só nascer nas superfícies de cima)
  const depth = new Int32Array(cw);
  for (let x = 0; x < cw; x++) {
    let d = 0;
    for (let yy = y0 - 1; yy >= Math.max(0, y0 - 40); yy--) {
      if (F(x0 + x, yy) > 0.5) d++;
      else break;
    }
    depth[x] = y0 === 0 ? 999 : d;
  }

  // cores por coluna (a floresta vira arenito perto do portão das Ruínas)
  const bwCol = new Float32Array(cw);
  for (let x = 0; x < cw; x++) bwCol[x] = ruinWeight(x0 + x);
  const anyRuin = bwCol[cw - 1] > 0;

  for (let y = 0; y < ch; y++) {
    const wy = y0 + y;
    const dv = wy / PH;
    const fTop = mixC(C_TOP, C_BOTTOM, dv);
    const rTop = mixC(R_TOP, R_BOTTOM, Math.pow(dv, 0.8));
    for (let x = 0; x < cw; x++) {
      const wx = x0 + x;
      const bw = bwCol[x];
      const baseR = lerp(fTop[0], rTop[0], bw);
      const baseG = lerp(fTop[1], rTop[1], bw);
      const baseB = lerp(fTop[2], rTop[2], bw);
      const f = F(wx, wy);
      if (f > 0.5) depth[x]++;
      else depth[x] = 0;
      if (f < 0.04) continue;

      const o = (y * cw + x) * 4;
      const inside = smoothstep(0.44, 0.56, f);
      let r = 0;
      let g = 0;
      let b = 0;
      if (inside > 0) {
        const t1 = sampleN(n1, x, y);
        const t2 = sampleN(n2, x, y);
        const tone = 0.7 + 0.6 * t1;
        const bark = 0.82 + 0.36 * t2;
        r = baseR * tone * bark;
        g = baseG * tone * bark;
        b = baseB * tone * bark;
        if (anyRuin && bw > 0) {
          // pedra talhada em manchas (paredes de ruína no meio da rocha)
          const m = masonry(wx, wy);
          const worked = smoothstep(0.42, 0.55, t1) * bw;
          const k = 1 + m.tone * worked - m.joint * worked * 0.55;
          r *= k;
          g *= k;
          b *= k;
        }
        // borda iluminada (bisel azulado; dourado nas Ruínas)
        const rim = 1 - smoothstep(0.56, 0.93, f);
        r += lerp(C_RIM[0], R_RIM[0], bw) * rim * 0.42;
        g += lerp(C_RIM[1], R_RIM[1], bw) * rim * 0.42;
        b += lerp(C_RIM[2], R_RIM[2], bw) * rim * 0.42;
        // musgo nas superfícies de cima
        const mossW = 7 + t1 * 12;
        const d = depth[x];
        if (d < mossW) {
          const m = 1 - d / mossW;
          const glowTop = m * m;
          const deep = mixC(C_MOSS_DEEP, R_SAND_DEEP, bw);
          const mid = mixC(C_MOSS, R_SAND, bw);
          const tip = mixC(C_MOSS_TIP, R_SAND_TIP, bw);
          const mr = lerp(deep[0], mid[0], m) + (tip[0] - mid[0]) * glowTop * glowTop;
          const mg = lerp(deep[1], mid[1], m) + (tip[1] - mid[1]) * glowTop * glowTop;
          const mb = lerp(deep[2], mid[2], m) + (tip[2] - mid[2]) * glowTop * glowTop;
          const k = smoothstep(0, 0.35, m);
          r = lerp(r, mr, k);
          g = lerp(g, mg, k);
          b = lerp(b, mb, k);
        }
      }
      // halo suave em volta da rocha
      const halo = f < 0.5 ? smoothstep(0.04, 0.5, f) : 0;
      const ga = halo * halo * 0.3;
      const A = inside + ga * (1 - inside);
      if (A <= 0) continue;
      const wIn = inside / A;
      const wGl = (ga * (1 - inside)) / A;
      const hr = lerp(C_HALO[0], R_HALO[0], bw);
      const hg = lerp(C_HALO[1], R_HALO[1], bw);
      const hb = lerp(C_HALO[2], R_HALO[2], bw);
      px[o] = clamp(r * wIn + hr * wGl, 0, 255);
      px[o + 1] = clamp(g * wIn + hg * wGl, 0, 255);
      px[o + 2] = clamp(b * wIn + hb * wGl, 0, 255);
      px[o + 3] = A * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Raízes e pontinhos de cristal por dentro da rocha (só onde já tem rocha).
function paintRoots(ctx, x0, y0, cw, ch, seed) {
  const r = rng(seed + 99);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 38; i++) {
    const sx = x0 + r() * cw;
    const sy = y0 + r() * ch;
    const len = r.range(60, 220);
    const ang = r.range(0, Math.PI * 2);
    const ruin = ruinWeight(sx) > 0.5;
    ctx.strokeStyle = r.chance(0.5) ? (ruin ? 'rgba(240,170,110,0.08)' : 'rgba(96,140,200,0.10)') : 'rgba(5,8,16,0.35)';
    ctx.lineWidth = r.range(1.5, 6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      sx + Math.cos(ang + 0.7) * len * 0.6,
      sy + Math.sin(ang + 0.7) * len * 0.6,
      sx + Math.cos(ang) * len,
      sy + Math.sin(ang) * len,
    );
    ctx.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const sx = x0 + r() * cw;
    const sy = y0 + r() * ch;
    ctx.fillStyle = ruinWeight(sx) > 0.5 ? (r.chance(0.7) ? 'rgba(255,210,150,0.22)' : 'rgba(120,230,255,0.18)') : r.chance(0.7) ? 'rgba(120,230,255,0.25)' : 'rgba(200,160,255,0.25)';
    ctx.fillRect(sx, sy, r.range(1, 2.5), r.range(1, 2.5));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Decoração

function planDecor(map, cell, solid) {
  const W = map[0].length;
  const H = map.length;
  const r = rng(2024);
  const decor = [];
  const lights = [];
  const open = (tx, ty) => !solid(tx, ty) && cell(tx, ty) !== '^';
  const add = (x0, y0, x1, y1, draw) => decor.push({ x0, y0, x1, y1, draw });

  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      const c = cell(tx, ty);
      if (tx >= RUINS_X) {
        planRuinTile(tx, ty, x, y, c, cell, open, r, add, lights);
        continue;
      }
      if (c === '#' && open(tx, ty - 1)) {
        // superfície de cima
        const seed = r() * 1e9;
        add(x - 8, y - 24, x + TILE + 8, y + 8, (ctx) => drawGrass(ctx, x, y + 3, seed));
        if (r.chance(0.16) && open(tx, ty - 2)) {
          const color = r.chance(0.65) ? '#6ff6e0' : '#c28dff';
          const s2 = r() * 1e9;
          const big = r.chance(0.25);
          add(x - 30, y - 70, x + TILE + 30, y + 10, (ctx) => drawMushrooms(ctx, x + TILE / 2, y + 4, color, s2, big));
          lights.push({ x: x + TILE / 2, y: y - (big ? 26 : 14), color, radius: big ? 150 : 90, strength: big ? 0.55 : 0.4 });
        } else if (r.chance(0.12)) {
          const color = r.chance(0.5) ? '#e6f4ff' : '#d9b8ff';
          const s2 = r() * 1e9;
          add(x - 10, y - 40, x + TILE + 10, y + 6, (ctx) => drawFlowers(ctx, x + TILE / 2, y + 4, color, s2));
          if (r.chance(0.4)) lights.push({ x: x + TILE / 2, y: y - 18, color, radius: 60, strength: 0.3 });
        }
      }
      if (c === '#' && open(tx, ty + 1) && r.chance(0.3)) {
        // teto: cipó pendurado
        let room = 0;
        while (room < 8 && open(tx, ty + 1 + room)) room++;
        const len = Math.min(room * TILE - 40, r.range(40, 190));
        if (len > 30) {
          const s2 = r() * 1e9;
          const bulb = r.chance(0.45);
          const vx = x + r.range(4, TILE - 4);
          add(vx - 30, y + TILE - 4, vx + 30, y + TILE + len + 20, (ctx) => drawVine(ctx, vx, y + TILE - 4, len, s2, bulb));
          if (bulb) lights.push({ x: vx, y: y + TILE + len, color: '#6ff6e0', radius: 80, strength: 0.45 });
        }
      }
    }
  }

  // galhos (=) e espinheiros (^) em trechos contínuos
  for (let ty = 0; ty < H; ty++) {
    let tx = 0;
    while (tx < W) {
      const c = cell(tx, ty);
      if (c !== '=' && c !== '^') {
        tx++;
        continue;
      }
      let end = tx;
      while (end + 1 < W && cell(end + 1, ty) === c) end++;
      const xa = tx * TILE;
      const xb = (end + 1) * TILE;
      const y = ty * TILE;
      const s2 = r() * 1e9;
      if (tx >= RUINS_X) {
        if (c === '=') {
          add(xa - 20, y - 20, xb + 20, y + 60, (ctx) => drawSlab(ctx, xa, xb, y, s2));
          lights.push({ x: (xa + xb) / 2, y: y - 4, color: '#ffc27a', radius: (xb - xa) * 0.6, strength: 0.18 });
        } else {
          add(xa - 10, y - 10, xb + 10, y + TILE + 4, (ctx) => drawSpikes(ctx, xa, xb, y + TILE, s2));
          lights.push({ x: (xa + xb) / 2, y: y + 12, color: '#ff9a5a', radius: (xb - xa) * 0.6 + 40, strength: 0.3 });
        }
      } else if (c === '=') {
        add(xa - 30, y - 30, xb + 30, y + 90, (ctx) => drawBranch(ctx, xa, xb, y, s2));
        lights.push({ x: (xa + xb) / 2, y: y - 4, color: '#6ff6e0', radius: (xb - xa) * 0.7, strength: 0.28 });
      } else {
        add(xa - 10, y - 10, xb + 10, y + TILE + 4, (ctx) => drawThorns(ctx, xa, xb, y + TILE, s2));
        lights.push({ x: (xa + xb) / 2, y: y + 12, color: '#c28dff', radius: (xb - xa) * 0.6 + 40, strength: 0.3 });
      }
      tx = end + 1;
    }
  }
  return { decor, lights };
}

function drawGrass(ctx, x, y, seed) {
  const r = rng(seed);
  const n = r.int(4, 9);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x + r() * TILE;
    const h = r.range(5, 17);
    const lean = r.range(-6, 6);
    ctx.strokeStyle = r.pick(['#2aa58c', '#43d1b0', '#1f7f72', '#6ff6e0']);
    ctx.lineWidth = r.range(1.2, 2.4);
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + lean * 0.2, y - h * 0.6, bx + lean, y - h);
    ctx.stroke();
    if (r.chance(0.25)) {
      ctx.fillStyle = 'rgba(190,255,240,0.8)';
      ctx.fillRect(bx + lean - 1, y - h - 1, 2, 2);
    }
  }
}

function drawMushrooms(ctx, x, y, color, seed, big) {
  const r = rng(seed);
  const n = big ? 1 : r.int(1, 3);
  const items = [];
  for (let i = 0; i < n; i++) {
    const s = big ? r.range(1.8, 2.4) : r.range(0.7, 1.25);
    items.push({ dx: (i - (n - 1) / 2) * 13 * s + r.range(-4, 4), s, h: r.range(10, 20) * s });
  }
  items.sort((a, b) => b.h - a.h);
  glow(ctx, x, y - 14 * (big ? 2 : 1), big ? 60 : 32, color, 0.25);
  for (const m of items) {
    const mx = x + m.dx;
    const capR = 9 * m.s;
    // talo
    const sg = ctx.createLinearGradient(mx, y, mx, y - m.h);
    sg.addColorStop(0, '#5a7fa8');
    sg.addColorStop(1, '#d8f2ff');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(mx - 2.4 * m.s, y);
    ctx.quadraticCurveTo(mx - 1 * m.s, y - m.h * 0.5, mx - 1.6 * m.s, y - m.h);
    ctx.lineTo(mx + 1.6 * m.s, y - m.h);
    ctx.quadraticCurveTo(mx + 1 * m.s, y - m.h * 0.5, mx + 2.4 * m.s, y);
    ctx.closePath();
    ctx.fill();
    // chapéu
    const cy = y - m.h;
    const cg = ctx.createRadialGradient(mx, cy - capR * 0.3, 1, mx, cy, capR * 1.2);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.35, color);
    cg.addColorStop(1, rgba(color, 0.55));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(mx, cy, capR, capR * 0.62, 0, Math.PI, 0);
    ctx.quadraticCurveTo(mx, cy + capR * 0.25, mx - capR, cy);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(mx + r.range(-0.6, 0.6) * capR, cy - r.range(0.15, 0.45) * capR, r.range(0.8, 1.8) * m.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFlowers(ctx, x, y, color, seed) {
  const r = rng(seed);
  const n = r.int(1, 3);
  for (let i = 0; i < n; i++) {
    const fx = x + r.range(-12, 12);
    const h = r.range(12, 28);
    const lean = r.range(-5, 5);
    ctx.strokeStyle = '#2a8f84';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.quadraticCurveTo(fx, y - h * 0.5, fx + lean, y - h);
    ctx.stroke();
    glow(ctx, fx + lean, y - h, 10, color, 0.45);
    ctx.fillStyle = color;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + r();
      ctx.beginPath();
      ctx.ellipse(fx + lean + Math.cos(a) * 3, y - h + Math.sin(a) * 3, 2.6, 1.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx + lean, y - h, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVine(ctx, x, y, len, seed, bulb) {
  const r = rng(seed);
  const sway = r.range(-18, 18);
  ctx.strokeStyle = '#1c5552';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway, y + len * 0.5, x + sway * 0.4, y + len);
  ctx.stroke();
  const at = (t) => {
    const mt = 1 - t;
    return [mt * mt * x + 2 * mt * t * (x + sway) + t * t * (x + sway * 0.4), mt * mt * y + 2 * mt * t * (y + len * 0.5) + t * t * (y + len)];
  };
  for (let t = 0.08; t < 0.98; t += r.range(0.07, 0.14)) {
    const [lx, ly] = at(t);
    const side = r.chance(0.5) ? 1 : -1;
    ctx.fillStyle = r.pick(['#2a8f84', '#237a74', '#3fbfa4']);
    ctx.beginPath();
    ctx.ellipse(lx + side * 4, ly, 5, 2.2, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (bulb) {
    const [bx, by] = at(1);
    glow(ctx, bx, by + 4, 26, '#6ff6e0', 0.6);
    ctx.fillStyle = '#c9fff6';
    ctx.beginPath();
    ctx.ellipse(bx, by + 4, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBranch(ctx, xa, xb, y, seed) {
  const r = rng(seed);
  const thick = 15;
  const len = xb - xa;
  // corpo do galho (topo reto na altura da colisão)
  const g = ctx.createLinearGradient(0, y, 0, y + thick + 6);
  g.addColorStop(0, '#3b3f62');
  g.addColorStop(1, '#151628');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(xa - 12, y + 3);
  ctx.quadraticCurveTo(xa + len * 0.5, y - 2, xb + 12, y + 3);
  ctx.quadraticCurveTo(xb + 4, y + thick * 0.7, xb - 10, y + thick);
  ctx.quadraticCurveTo(xa + len * 0.5, y + thick + 7, xa + 8, y + thick);
  ctx.quadraticCurveTo(xa - 6, y + thick * 0.7, xa - 12, y + 3);
  ctx.closePath();
  ctx.fill();
  // veios da casca
  ctx.strokeStyle = 'rgba(120,150,210,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < len / 14; i++) {
    const bx = xa + r() * len;
    ctx.beginPath();
    ctx.moveTo(bx, y + 5);
    ctx.lineTo(bx + r.range(6, 18), y + r.range(7, 13));
    ctx.stroke();
  }
  // musgo luminoso por cima
  ctx.save();
  ctx.shadowColor = '#6ff6e0';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#46d8b8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xa - 6, y + 2);
  ctx.quadraticCurveTo(xa + len * 0.5, y - 2, xb + 6, y + 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(210,255,248,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xa, y);
  ctx.quadraticCurveTo(xa + len * 0.5, y - 3, xb, y);
  ctx.stroke();
  for (let bx = xa; bx < xb; bx += TILE) drawGrass(ctx, bx, y + 1, r() * 1e9);
  // folhinhas e cipós curtos por baixo
  for (let i = 0; i < Math.max(1, len / 70); i++) {
    const vx = xa + r.range(10, len - 10);
    drawVine(ctx, vx, y + thick - 2, r.range(18, 60), r() * 1e9, r.chance(0.5));
  }
  if (r.chance(0.6)) drawMushrooms(ctx, xa + r.range(10, len - 10), y + 1, r.chance(0.6) ? '#6ff6e0' : '#c28dff', r() * 1e9, false);
}

function drawThorns(ctx, xa, xb, yb, seed) {
  const r = rng(seed);
  // emaranhado da base
  ctx.strokeStyle = '#1a1030';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xa, yb - 4);
  for (let x = xa; x <= xb; x += 12) ctx.lineTo(x, yb - 4 - r.range(0, 7));
  ctx.stroke();
  for (let x = xa + 4; x < xb - 2; x += r.range(7, 11)) {
    const h = r.range(16, 29);
    const lean = r.range(-7, 7);
    const w = r.range(4, 7);
    ctx.fillStyle = '#140b26';
    ctx.beginPath();
    ctx.moveTo(x - w, yb);
    ctx.quadraticCurveTo(x - w * 0.2, yb - h * 0.6, x + lean, yb - h);
    ctx.quadraticCurveTo(x + w * 0.3, yb - h * 0.5, x + w, yb);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(194,141,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.4, yb - h * 0.55);
    ctx.lineTo(x + lean, yb - h);
    ctx.stroke();
    glow(ctx, x + lean, yb - h, 7, '#d6a8ff', 0.7);
  }
}

// ---------------------------------------------------------------------------
// Ruínas: tufos secos, entulho, colunas partidas ao fundo, urnas, runas,
// correntes e estandartes rasgados, lajes de pedra e espetos de bronze.

function planRuinTile(tx, ty, x, y, c, cell, open, r, add, lights) {
  if (c === '#' && open(tx, ty - 1)) {
    const seed = r() * 1e9;
    add(x - 8, y - 20, x + TILE + 8, y + 8, (ctx) => drawDryTuft(ctx, x, y + 3, seed));
    let room = 0;
    while (room < 14 && open(tx, ty - 1 - room)) room++;
    if (room >= 7 && r.chance(0.07)) {
      // coluna partida ao fundo
      const h = r.range(Math.min(room - 1, 5), Math.min(room - 1, 12)) * TILE;
      const s2 = r() * 1e9;
      add(x - 30, y - h - 30, x + TILE + 30, y + 6, (ctx) => drawColumn(ctx, x + TILE / 2, y + 4, h, s2));
    } else if (r.chance(0.07) && open(tx, ty - 2)) {
      const s2 = r() * 1e9;
      add(x - 20, y - 50, x + TILE + 20, y + 6, (ctx) => drawUrn(ctx, x + TILE / 2, y + 4, s2));
    } else if (r.chance(0.05) && open(tx, ty - 2)) {
      const s2 = r() * 1e9;
      const color = r.chance(0.7) ? '#ffcf7a' : '#7af0ff';
      add(x - 30, y - 60, x + TILE + 30, y + 6, (ctx) => drawRuneStone(ctx, x + TILE / 2, y + 4, color, s2));
      lights.push({ x: x + TILE / 2, y: y - 22, color, radius: 110, strength: 0.45 });
    } else if (r.chance(0.12)) {
      const s2 = r() * 1e9;
      add(x - 16, y - 20, x + TILE + 16, y + 6, (ctx) => drawRubble(ctx, x + TILE / 2, y + 4, s2));
    }
  }
  if (c === '#' && open(tx, ty + 1) && r.chance(0.12)) {
    let room = 0;
    while (room < 8 && open(tx, ty + 1 + room)) room++;
    const len = Math.min(room * TILE - 40, r.range(50, 200));
    if (len > 40) {
      const s2 = r() * 1e9;
      const vx = x + r.range(6, TILE - 6);
      if (r.chance(0.45)) {
        add(vx - 34, y + TILE - 4, vx + 34, y + TILE + len + 40, (ctx) => drawBanner(ctx, vx, y + TILE - 4, len, s2));
      } else {
        const lamp = r.chance(0.5);
        add(vx - 24, y + TILE - 4, vx + 24, y + TILE + len + 40, (ctx) => drawChain(ctx, vx, y + TILE - 4, len, s2, lamp));
        if (lamp) lights.push({ x: vx, y: y + TILE + len + 12, color: '#ffb35a', radius: 110, strength: 0.5 });
      }
    }
  }
}

function drawDryTuft(ctx, x, y, seed) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  const n = r.int(0, 4);
  for (let i = 0; i < n; i++) {
    const bx = x + r() * TILE;
    const h = r.range(4, 13);
    const lean = r.range(-7, 7);
    ctx.strokeStyle = r.pick(['#b48a4e', '#8a6438', '#d8b06a', '#6e5030']);
    ctx.lineWidth = r.range(1, 1.8);
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + lean * 0.3, y - h * 0.6, bx + lean, y - h);
    ctx.stroke();
  }
  // pedrinhas
  for (let i = 0; i < r.int(0, 2); i++) {
    ctx.fillStyle = r.pick(['#8a6448', '#5e4032', '#a8805a']);
    ctx.beginPath();
    ctx.ellipse(x + r() * TILE, y - 1, r.range(1.5, 3.5), r.range(1, 2.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRubble(ctx, x, y, seed) {
  const r = rng(seed);
  for (let i = 0; i < r.int(2, 4); i++) {
    const w = r.range(8, 18);
    const h = r.range(5, 11);
    const bx = x + r.range(-18, 18);
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, '#b88a5e');
    g.addColorStop(1, '#4a3024');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, y);
    ctx.lineTo(bx - w / 2 + r.range(0, 3), y - h);
    ctx.lineTo(bx + w / 2 - r.range(0, 4), y - h + r.range(0, 3));
    ctx.lineTo(bx + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2 + 1, y - h + 1);
    ctx.lineTo(bx + w / 2 - 2, y - h + 1);
    ctx.stroke();
  }
}

function drawColumn(ctx, x, y, h, seed) {
  const r = rng(seed);
  const w = r.range(26, 36);
  ctx.save();
  ctx.globalAlpha = 0.55;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#3a2620');
  g.addColorStop(0.35, '#6e4c3a');
  g.addColorStop(1, '#24181a');
  ctx.fillStyle = g;
  // base e fuste com topo quebrado
  ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 12);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - 12);
  ctx.lineTo(x - w / 2, y - h + r.range(0, 20));
  const teeth = r.int(3, 5);
  for (let i = 1; i <= teeth; i++) ctx.lineTo(x - w / 2 + (w * i) / teeth, y - h + r.range(-10, 26));
  ctx.lineTo(x + w / 2, y - 12);
  ctx.closePath();
  ctx.fill();
  // caneluras
  ctx.strokeStyle = 'rgba(20,12,12,0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const cx = x - w / 2 + (w * i) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, y - 14);
    ctx.lineTo(cx, y - h + 28);
    ctx.stroke();
  }
  ctx.restore();
  // pedaço caído ao lado
  if (r.chance(0.6)) {
    const side = r.chance(0.5) ? -1 : 1;
    ctx.fillStyle = '#5a3c2e';
    ctx.beginPath();
    ctx.ellipse(x + side * (w + 8), y - 7, 14, 7, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawUrn(ctx, x, y, seed) {
  const r = rng(seed);
  const s = r.range(0.8, 1.2);
  const g = ctx.createLinearGradient(x - 12 * s, 0, x + 12 * s, 0);
  g.addColorStop(0, '#5a2e20');
  g.addColorStop(0.4, '#b0673c');
  g.addColorStop(1, '#3a1c16');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y);
  ctx.quadraticCurveTo(x - 16 * s, y - 14 * s, x - 7 * s, y - 28 * s);
  ctx.lineTo(x - 5 * s, y - 34 * s);
  ctx.lineTo(x + 5 * s, y - 34 * s);
  ctx.lineTo(x + 7 * s, y - 28 * s);
  ctx.quadraticCurveTo(x + 16 * s, y - 14 * s, x + 6 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,130,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - 17 * s);
  ctx.lineTo(x + 11 * s, y - 17 * s);
  ctx.stroke();
  if (r.chance(0.5)) {
    // rachada
    ctx.strokeStyle = 'rgba(20,10,8,0.7)';
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 34 * s);
    ctx.lineTo(x - 2 * s, y - 24 * s);
    ctx.lineTo(x + 4 * s, y - 16 * s);
    ctx.stroke();
  }
}

function drawRuneStone(ctx, x, y, color, seed) {
  const r = rng(seed);
  const h = r.range(34, 48);
  glow(ctx, x, y - h / 2, 40, color, 0.28);
  ctx.fillStyle = '#3e2a24';
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x - 10, y - h + 6);
  ctx.quadraticCurveTo(x, y - h - 4, x + 10, y - h + 6);
  ctx.lineTo(x + 12, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,160,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // runa brilhante
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const cy = y - h / 2 - 2;
  ctx.moveTo(x, cy - 10);
  ctx.lineTo(x, cy + 10);
  ctx.moveTo(x - 6, cy - 4);
  ctx.lineTo(x + 6, cy + 3);
  ctx.moveTo(x + 6, cy - 6);
  ctx.lineTo(x - 5, cy + 1);
  ctx.stroke();
  ctx.restore();
}

function drawChain(ctx, x, y, len, seed, lamp) {
  const r = rng(seed);
  ctx.strokeStyle = '#3a2c28';
  ctx.lineWidth = 2;
  for (let t = 0; t < len; t += 7) {
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t * 0.02) * 2, y + t + 3, (t / 7) % 2 ? 1.5 : 3, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (lamp) {
    const ly = y + len + 10;
    glow(ctx, x, ly, 34, '#ffb35a', 0.55);
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 7, ly - 10, 14, 3);
    ctx.fillRect(x - 5, ly + 8, 10, 3);
    ctx.fillStyle = '#ffd69a';
    ctx.beginPath();
    ctx.ellipse(x, ly, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // gancho
    ctx.beginPath();
    ctx.arc(x, y + len + 6, 5, 0, Math.PI * 1.3);
    ctx.stroke();
  }
  void r;
}

function drawBanner(ctx, x, y, len, seed) {
  const r = rng(seed);
  const w = r.range(20, 30);
  const color = r.pick(['#7a2a24', '#8a4a1e', '#3a4a6a', '#6a2a3e']);
  ctx.fillStyle = '#2a1c18';
  ctx.fillRect(x - w / 2 - 4, y, w + 8, 4);
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, color);
  g.addColorStop(1, rgba(color, 0.65));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + 4);
  ctx.lineTo(x + w / 2, y + 4);
  // barra rasgada
  let yy = y + len;
  ctx.lineTo(x + w / 2 + r.range(-3, 3), yy - r.range(0, 20));
  for (let i = 4; i >= 0; i--) ctx.lineTo(x - w / 2 + (w * i) / 5, yy - r.range(0, 26));
  ctx.closePath();
  ctx.fill();
  // emblema: sol partido
  ctx.strokeStyle = 'rgba(255,210,140,0.55)';
  ctx.lineWidth = 1.5;
  const cy = y + Math.min(40, len * 0.35);
  ctx.beginPath();
  ctx.arc(x, cy, 6, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    ctx.lineTo(x + Math.cos(a) * 11, cy + Math.sin(a) * 11);
    ctx.stroke();
  }
}

function drawSlab(ctx, xa, xb, y, seed) {
  const r = rng(seed);
  const thick = 16;
  const g = ctx.createLinearGradient(0, y, 0, y + thick);
  g.addColorStop(0, '#c49064');
  g.addColorStop(0.25, '#8a5e40');
  g.addColorStop(1, '#3a241c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(xa - 6, y);
  ctx.lineTo(xb + 6, y);
  ctx.lineTo(xb + 2, y + thick);
  ctx.lineTo(xa - 2, y + thick);
  ctx.closePath();
  ctx.fill();
  // juntas e rachaduras
  ctx.strokeStyle = 'rgba(30,16,12,0.7)';
  ctx.lineWidth = 1.5;
  for (let bx = xa + r.range(30, 60); bx < xb - 10; bx += r.range(40, 70)) {
    ctx.beginPath();
    ctx.moveTo(bx, y + 2);
    ctx.lineTo(bx + r.range(-3, 3), y + thick);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,225,170,0.8)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(xa - 5, y + 0.8);
  ctx.lineTo(xb + 5, y + 0.8);
  ctx.stroke();
  // areia escorrendo e pedrinhas soltas embaixo
  for (let i = 0; i < Math.max(1, (xb - xa) / 60); i++) {
    const sx = xa + r.range(8, xb - xa - 8);
    const sl = r.range(10, 30);
    const sg = ctx.createLinearGradient(0, y + thick, 0, y + thick + sl);
    sg.addColorStop(0, 'rgba(230,180,120,0.55)');
    sg.addColorStop(1, 'rgba(230,180,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 1.5, y + thick, 3, sl);
  }
  for (let bx = xa; bx < xb; bx += TILE) drawDryTuft(ctx, bx, y + 1, r() * 1e9);
}

function drawSpikes(ctx, xa, xb, yb, seed) {
  const r = rng(seed);
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(xa, yb - 6, xb - xa, 6);
  for (let x = xa + 5; x < xb - 3; x += r.range(8, 11)) {
    const h = r.range(18, 28);
    const w = r.range(3.5, 5.5);
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, '#4a2a18');
    g.addColorStop(0.5, '#c07a3a');
    g.addColorStop(1, '#3a2014');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, yb - 4);
    ctx.lineTo(x, yb - h);
    ctx.lineTo(x + w, yb - 4);
    ctx.closePath();
    ctx.fill();
    glow(ctx, x, yb - h, 6, '#ffb070', 0.6);
  }
}
