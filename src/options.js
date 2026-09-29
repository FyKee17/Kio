// Preferências do jogador (volume, tela cheia), guardadas no navegador.
const KEY = 'kio-options';

const DEFAULTS = { music: 0.7, sfx: 0.8 };

let current = null;

export function getOptions() {
  if (current) return current;
  try {
    current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    current = { ...DEFAULTS };
  }
  return current;
}

export function setOption(name, value) {
  getOptions()[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  for (const fn of listeners) fn(name, value);
}

const listeners = new Set();
export function onOptionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
