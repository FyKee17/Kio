// Trilha: uma música por vez, com transição suave (crossfade) entre elas.
// menu = Hidden Clearing, mundo = Sanctuary of Glowing Leaves, chefe = Cursed Spectral Knight.

import { getOptions, onOptionChange } from '../options.js';

export const TRACKS = {
  menu: 'assets/music/hidden_clearing.mp3',
  world: 'assets/music/sanctuary_of_glowing_leaves.mp3',
  boss: 'assets/music/cursed_spectral_knight.mp3',
};

// Faixas que ainda não chegaram tocam outra no lugar (troque em TRACKS quando
// tiver o arquivo: ex. ruins: 'assets/music/ruinas.mp3').
const FALLBACK = { ruins: 'world', worm: 'boss', knight: 'boss' };

// volume de cada faixa antes do volume geral de música
const MIX = { menu: 0.8, world: 0.6, boss: 0.75, ruins: 0.6, worm: 0.75, knight: 0.75 };

let game = null;
let current = null; // { name, sound }

function fade(sound, to, ms, done) {
  const from = sound.volume;
  const start = performance.now();
  clearInterval(sound._fadeTimer);
  sound._fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms);
    sound.setVolume(from + (to - from) * t);
    if (t >= 1) {
      clearInterval(sound._fadeTimer);
      done?.();
    }
  }, 30);
}

export function initMusic(g) {
  game = g;
  onOptionChange((name) => {
    if (name === 'music' && current) current.sound.setVolume(MIX[current.name] * getOptions().music);
  });
}

export function playMusic(name, { fadeMs = 1500 } = {}) {
  if (game && !game.cache.audio.exists(`music-${name}`) && FALLBACK[name]) name = FALLBACK[name];
  if (!game || current?.name === name) return;
  const key = `music-${name}`;
  if (!game.cache.audio.exists(key)) return;
  const old = current;
  if (old) fade(old.sound, 0, fadeMs, () => old.sound.destroy());
  const sound = game.sound.add(key, { loop: true, volume: 0 });
  current = { name, sound };
  const start = () => {
    // outra música pode ter sido pedida antes do navegador liberar o áudio
    if (current?.sound !== sound) return;
    sound.play();
    fade(sound, MIX[name] * getOptions().music, fadeMs);
  };
  // o navegador só libera o áudio depois do primeiro clique/tecla
  if (game.sound.locked) game.sound.once('unlocked', start);
  else start();
}

export function stopMusic(fadeMs = 1200) {
  if (!current) return;
  const old = current;
  current = null;
  fade(old.sound, 0, fadeMs, () => old.sound.destroy());
}
