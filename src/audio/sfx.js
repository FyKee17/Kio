// Efeitos sonoros sintetizados na hora (sem arquivos): osciladores, ruído
// e filtros escritos à mão, renderizados uma vez em AudioBuffers quando o jogo carrega.

import { getOptions } from '../options.js';

const SR = 44100;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- blocos

function make(dur, fn) {
  const n = Math.ceil(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

const noise = (dur) => make(dur, () => Math.random() * 2 - 1);

// Oscilador com frequência variando no tempo (freq pode ser função de t).
function osc(dur, freq, shape = 'sine') {
  let phase = 0;
  return make(dur, (t) => {
    const f = typeof freq === 'function' ? freq(t) : freq;
    phase += f / SR;
    const p = phase % 1;
    if (shape === 'sine') return Math.sin(p * TAU);
    if (shape === 'tri') return 1 - 4 * Math.abs(p - 0.5);
    if (shape === 'saw') return 2 * p - 1;
    return p < 0.5 ? 1 : -1; // square
  });
}

// Filtro biquad (lowpass, highpass, bandpass) com frequência variável.
function filter(x, type, freq, q = 0.8) {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let b0;
  let b1;
  let b2;
  let a1;
  let a2;
  for (let i = 0; i < x.length; i++) {
    if (i % 32 === 0) {
      const f = Math.min(SR * 0.45, Math.max(20, typeof freq === 'function' ? freq(i / SR) : freq));
      const w = (TAU * f) / SR;
      const c = Math.cos(w);
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      if (type === 'low') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
      else if (type === 'high') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
      else [b0, b1, b2] = [alpha, 0, -alpha];
      b0 /= a0;
      b1 /= a0;
      b2 /= a0;
      a1 = (-2 * c) / a0;
      a2 = (1 - alpha) / a0;
    }
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

// Envelope: ataque linear e queda exponencial.
function env(x, attack, decay, hold = 0) {
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let e;
    if (t < attack) e = t / attack;
    else if (t < attack + hold) e = 1;
    else e = Math.exp(-(t - attack - hold) / decay);
    x[i] *= e;
  }
  return x;
}

function mix(...parts) {
  const n = Math.max(...parts.map(([a]) => a.length));
  const out = new Float32Array(n);
  for (const [a, g = 1, delay = 0] of parts) {
    const off = Math.round(delay * SR);
    for (let i = 0; i < a.length && i + off < n; i++) out[i + off] += a[i] * g;
  }
  return out;
}

function drive(x, amount) {
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * amount) / Math.tanh(amount);
  return x;
}

function normalize(x, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  // pequena rampa final para não estalar
  const tail = Math.min(x.length, 400);
  for (let i = 0; i < tail; i++) x[x.length - 1 - i] *= i / tail;
  return x;
}

// Eco simples (para o santuário, a Raiz e o Eco).
function echo(x, delay, feedback, times = 4) {
  const d = Math.round(delay * SR);
  const out = new Float32Array(x.length + d * times);
  out.set(x);
  for (let k = 1; k <= times; k++) {
    const g = feedback ** k;
    for (let i = 0; i < x.length; i++) out[i + d * k] += x[i] * g;
  }
  return out;
}

const bell = (f, dur, decay) => env(mix([osc(dur, f)], [osc(dur, f * 2.76), 0.3], [osc(dur, f * 5.4), 0.12]), 0.002, decay);

// ---------------------------------------------------------------- receitas

const RECIPES = {
  // Kio
  slash: () =>
    mix(
      [env(filter(noise(0.26), 'band', (t) => 4200 - t * 12000, 1.4), 0.004, 0.07), 1],
      [env(osc(0.2, (t) => 2400 - t * 3000, 'sine'), 0.002, 0.03), 0.12],
    ),
  slash_up: () => env(filter(noise(0.24), 'band', (t) => 1500 + t * 11000, 1.4), 0.004, 0.07),
  hit: () =>
    drive(
      mix(
        [env(osc(0.18, (t) => 220 * Math.exp(-t * 18) + 55), 0.001, 0.06), 1],
        [env(filter(noise(0.05), 'high', 2500), 0.001, 0.012), 0.7],
        [env(osc(0.25, 1250), 0.001, 0.05), 0.15],
      ),
      2,
    ),
  kill: () =>
    mix(
      [env(osc(0.3, (t) => 380 * Math.exp(-t * 10) + 60), 0.001, 0.08), 1],
      [bell(1760, 0.5, 0.12), 0.3, 0.03],
      [bell(2637, 0.5, 0.1), 0.2, 0.07],
      [env(filter(noise(0.3), 'band', 3000, 2), 0.001, 0.07), 0.3],
    ),
  hurt: () =>
    drive(
      mix(
        [env(osc(0.4, (t) => 140 * Math.exp(-t * 6) + 40, 'saw'), 0.001, 0.12), 1],
        [env(filter(noise(0.3), 'low', 900), 0.001, 0.08), 0.9],
      ),
      3,
    ),
  jump: () => env(filter(noise(0.18), 'band', (t) => 500 + t * 6000, 1.2), 0.01, 0.05),
  double_jump: () =>
    mix([env(filter(noise(0.22), 'band', (t) => 800 + t * 7000, 1.2), 0.005, 0.06), 0.8], [bell(988, 0.6, 0.14), 0.35], [bell(1480, 0.6, 0.12), 0.25, 0.04]),
  land: () => mix([env(filter(noise(0.12), 'low', 500), 0.001, 0.03), 1], [env(osc(0.12, 85), 0.001, 0.04), 0.5]),
  step: () => env(filter(noise(0.05), 'band', 2600, 1.5), 0.001, 0.012),
  dash: () =>
    mix(
      [env(filter(noise(0.32), 'band', (t) => 700 + Math.sin(t * 10) * 2500 + 1500, 1.3), 0.01, 0.09), 1],
      [env(osc(0.3, (t) => 300 + t * 900, 'tri'), 0.01, 0.08), 0.15],
    ),
  pogo: () => mix([env(osc(0.3, 1320), 0.001, 0.06), 0.5], [env(osc(0.3, 1980), 0.001, 0.05), 0.3], [env(filter(noise(0.05), 'high', 3000), 0.001, 0.01), 0.5]),
  geo: () => mix([bell(1568, 0.4, 0.09), 1], [bell(2093, 0.4, 0.08), 0.6, 0.035]),
  heal: () =>
    mix(
      ...[523, 659, 784, 1047, 1319].map((f, i) => [bell(f, 1.2, 0.35), 0.5, i * 0.07]),
      [env(filter(noise(1.2), 'band', (t) => 2000 + t * 3000, 3), 0.3, 0.3), 0.15],
    ),
  rest: () => echo(mix(...[220, 277, 330, 440, 554].map((f, i) => [env(osc(2.4, f, 'tri'), 0.25, 0.9), 0.35, i * 0.05])), 0.23, 0.35, 3),
  ability: () =>
    echo(
      mix(
        ...[262, 330, 392, 523, 659, 784].map((f, i) => [env(osc(3, f, 'tri'), 0.5 + i * 0.05, 1.1), 0.3]),
        [env(filter(noise(3), 'band', (t) => 1500 + t * 2500, 4), 1.2, 0.6), 0.25],
      ),
      0.3,
      0.3,
      3,
    ),
  // voz: um "blip" curto com formante; a altura muda por personagem
  talk: () => env(filter(mix([osc(0.08, (t) => 330 + Math.sin(t * 70) * 25, 'square'), 0.5], [osc(0.08, 330, 'tri'), 0.8]), 'band', 1100, 1.1), 0.004, 0.028),
  ui_move: () => env(osc(0.08, 1320), 0.001, 0.02),
  ui_select: () => mix([bell(880, 0.6, 0.12), 0.8], [bell(1320, 0.6, 0.12), 0.6, 0.06]),
  spit: () => env(osc(0.25, (t) => 500 - t * 1400 + Math.sin(t * 120) * 60, 'tri'), 0.005, 0.07),
  pop: () => mix([env(osc(0.15, (t) => 900 * Math.exp(-t * 20) + 200), 0.001, 0.04), 0.8], [env(filter(noise(0.1), 'band', 2500, 2), 0.001, 0.03), 0.5]),
  gate: () => mix([env(filter(noise(1.2), 'low', 180), 0.05, 0.4), 1], [env(osc(1.2, 48, 'saw'), 0.05, 0.35), 0.4]),
  // Ender
  roar: () =>
    drive(
      mix(
        [env(osc(1.6, (t) => 70 + Math.sin(t * 22) * 8 + t * 20, 'saw'), 0.15, 0.6), 0.9],
        [env(filter(noise(1.6), 'band', (t) => 500 + Math.sin(t * 9) * 250, 2), 0.1, 0.55), 1],
        [env(osc(1.6, (t) => 140 + Math.sin(t * 31) * 12, 'square'), 0.2, 0.5), 0.2],
      ),
      2.5,
    ),
  boss_swing: () =>
    mix(
      [env(filter(noise(0.4), 'band', (t) => 2500 - t * 5000, 1.2), 0.01, 0.1), 1],
      [env(osc(0.4, (t) => 180 - t * 250, 'saw'), 0.01, 0.1), 0.3],
    ),
  charge: () => mix([env(osc(0.55, (t) => 180 + t * 900, 'saw'), 0.3, 0.2, 0.2), 0.3], [env(filter(noise(0.55), 'band', (t) => 600 + t * 4000, 3), 0.3, 0.2, 0.2), 0.7]),
  slam: () =>
    drive(
      mix(
        [env(osc(1.4, (t) => 75 * Math.exp(-t * 2.5) + 28), 0.001, 0.35), 1.2],
        [env(filter(noise(1.4), 'low', (t) => 1800 * Math.exp(-t * 3) + 120), 0.001, 0.25), 1],
        [crackle(0.5), 0.5],
      ),
      2,
    ),
  thunder: () =>
    drive(
      mix(
        [crackle(0.35), 1],
        [env(filter(noise(1.6), 'low', (t) => 900 * Math.exp(-t * 2) + 90), 0.02, 0.5), 0.9, 0.05],
        [env(osc(1.2, 45), 0.01, 0.4), 0.4],
      ),
      1.8,
    ),
  zap: () => env(filter(mix([crackle(0.18), 1], [osc(0.18, (t) => 900 - t * 2000, 'saw'), 0.2]), 'high', 700), 0.001, 0.05),
  shock: () => env(mix([osc(0.5, 110, 'saw'), 0.4], [filter(noise(0.5), 'band', 1800, 2), 0.6]), 0.01, 0.15),
  orb: () => mix([env(osc(0.6, (t) => 260 + t * 700, 'sine'), 0.05, 0.2), 0.6], [env(filter(noise(0.6), 'band', (t) => 900 + t * 3000, 5), 0.05, 0.2), 0.5]),
  boss_hit: () =>
    drive(mix([env(osc(0.25, (t) => 160 * Math.exp(-t * 14) + 45), 0.001, 0.08), 1], [env(filter(noise(0.08), 'band', 3500, 1), 0.001, 0.02), 0.6], [crackle(0.12), 0.25]), 2.5),
  boss_die: () =>
    echo(
      mix(
        [env(osc(3, (t) => 60 * Math.exp(-t) + 25), 0.001, 1.1), 1],
        [env(filter(noise(3), 'low', (t) => 2500 * Math.exp(-t * 1.5) + 100), 0.001, 0.8), 0.9],
        ...[392, 494, 587, 784].map((f, i) => [env(osc(3, f, 'tri'), 0.8, 1), 0.18, 0.6 + i * 0.12]),
      ),
      0.35,
      0.3,
      2,
    ),
};

// estalos elétricos: picos aleatórios com filtro agudo
function crackle(dur) {
  let hold = 0;
  let v = 0;
  const x = make(dur, (t) => {
    if (hold-- <= 0) {
      hold = Math.floor(Math.random() * 90);
      v = Math.random() < 0.35 ? Math.random() * 2 - 1 : v * 0.3;
    }
    return v * Math.exp(-t * 5);
  });
  return filter(x, 'high', 1200);
}

// ---------------------------------------------------------------- uso

const lastPlayed = new Map();

// Gera todos os sons e registra no cache de áudio do Phaser.
export function buildSfx(game) {
  const ctx = game.sound.context;
  if (!ctx) return; // sem WebAudio: jogo segue mudo
  for (const [key, recipe] of Object.entries(RECIPES)) {
    const data = normalize(recipe());
    const buffer = ctx.createBuffer(1, data.length, SR);
    buffer.copyToChannel(data, 0);
    game.cache.audio.add(`sfx-${key}`, buffer);
  }
}

// Toca um efeito. `vary` sorteia a altura em ±vary (evita repetição robótica).
export function sfx(scene, key, { volume = 1, rate = 1, vary = 0.06 } = {}) {
  const sound = scene.sound;
  const full = `sfx-${key}`;
  if (!sound.context || !scene.cache.audio.exists(full)) return;
  const now = performance.now();
  if (now - (lastPlayed.get(key) || 0) < 35) return; // o mesmo som no mesmo instante vira barulho
  lastPlayed.set(key, now);
  const vol = volume * getOptions().sfx;
  if (vol <= 0) return;
  sound.play(full, { volume: vol, rate: rate * (1 + (Math.random() * 2 - 1) * vary) });
}

export const SFX_KEYS = Object.keys(RECIPES);
