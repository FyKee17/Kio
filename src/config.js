export const TILE = 32;
export const WIDTH = 1280;
export const HEIGHT = 720;

// Movimento. Pulo simples ≈ 5 blocos; com pulo duplo ≈ 9; com Passo Etéreo cruza ~11 de vão.
export const PHYS = {
  gravity: 2100,
  runSpeed: 290,
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
