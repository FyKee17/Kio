export const TILE = 32;
export const WIDTH = 1280;
export const HEIGHT = 720;

// Escala de renderização: a lógica do jogo é sempre 1280x720, mas o canvas é
// desenhado na resolução real da tela (até 2x) para ficar nítido, sem serrilhado.
// ?res=1 força a resolução base.
export const RES = (() => {
  if (typeof window === 'undefined') return 1;
  const forced = Number(new URLSearchParams(window.location.search).get('res'));
  if (forced > 0) return forced;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT) * dpr;
  return Math.max(1, Math.min(2, Math.round(fit * 4) / 4));
})();

// Movimento. Pulo simples ≈ 5 blocos; com pulo duplo ≈ 9; com Passo Etéreo cruza ~11 de vão.
export const PHYS = {
  gravity: 2100,
  walkSpeed: 175, // sem Shift o Kio anda
  runSpeed: 290, // segurando Shift ele corre
  accel: 3400,
  airAccel: 2600,
  decel: 3800,
  jumpVelocity: 820,
  doubleJumpVelocity: 720,
  jumpCut: 0.42,
  coyoteMs: 110,
  bufferMs: 130,
  maxFall: 950,
  dashSpeed: 760,
  dashMs: 200,
  dashCooldownMs: 420,
};

export const COMBAT = {
  attackCooldownMs: 320,
  attackActiveMs: 110,
  pogoVelocity: 720,
  invulnMs: 1100,
  hurtMs: 220,
  startHealth: 5,
  maxSoul: 99,
  soulPerHit: 11,
  healCost: 33,
  healMs: 850,
  nailDamage: 5, // dano do golpe de espada (as habilidades usam a mesma escala)
};

// Mana das habilidades de elemento: enche devagar com o tempo e batendo.
export const MANA = {
  max: 30,
  regenPerSec: 0.8,
  perHit: 2,
};

// Cores da paleta (Ori + Hollow Knight: noite azul, musgo turquesa, flores lilás)
export const PALETTE = {
  night: '#070b18',
  teal: '#6ff6e0',
  tealDeep: '#1d6f73',
  violet: '#c28dff',
  moon: '#e6f4ff',
  flame: '#7cc8ff',
  gold: '#ffd98a',
};
