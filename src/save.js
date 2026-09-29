const KEY = 'kio-save-v1';

export function newState() {
  return { level: 0, memories: [], talked: [], seenIntro: [] };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...newState(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // armazenamento indisponível (aba anônima etc.) — o jogo segue sem salvar
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
