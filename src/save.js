const KEY = 'kio-save-v2';

export function newState() {
  return {
    bench: null,           // "tx,ty" do último santuário onde descansou
    maxHealth: 5,
    geo: 0,
    abilities: { dash: false, doubleJump: false },
    collected: [],         // habilidades, corações e depósitos quebrados
    talked: [],            // NPCs com quem já conversou
    read: [],              // tábuas lidas
    bossDefeated: false,   // Ender
    element: null,         // 'wind' | 'fire' (elemento em uso)
    elements: [],          // elementos que o Kio já tem
    skills: 0,             // quantas habilidades do elemento já liberou (0 a 3)
    gateOpen: false,       // portão das Ruínas
    wormDefeated: false,
    knightDefeated: false,
    shade: null,           // { x, y, geo }: fragmentos deixados onde morreu
    mapW: 0,               // largura do mapa quando o 'explored' foi salvo
    explored: '',          // mapa descoberto (bitset em base64)
    deaths: 0,
    playMs: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { ...newState(), ...data, abilities: { ...newState().abilities, ...data.abilities } };
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

// Bitset <-> base64 para guardar as partes do mapa já exploradas.
export function encodeBits(bits) {
  let s = '';
  for (let i = 0; i < bits.length; i++) s += String.fromCharCode(bits[i]);
  return btoa(s);
}

export function decodeBits(str, length) {
  const out = new Uint8Array(length);
  if (!str) return out;
  try {
    const s = atob(str);
    for (let i = 0; i < Math.min(s.length, length); i++) out[i] = s.charCodeAt(i);
  } catch {
    // mapa corrompido: começa vazio
  }
  return out;
}
