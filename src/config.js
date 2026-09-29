export const TILE = 16;
// Resolução interna. O mundo é desenhado com ZOOM (pixel art 2x);
// textos e interface usam a resolução cheia para ficarem nítidos.
export const WIDTH = 960;
export const HEIGHT = 540;
export const ZOOM = 2;

// Sensação do controle. Ajuste à vontade.
export const PHYS = {
  gravity: 1400,
  runSpeed: 150,
  accel: 1400,
  airAccel: 900,
  decel: 1800,
  jumpVelocity: 500,
  jumpCut: 0.45,       // soltar o pulo cedo multiplica a velocidade vertical por isso
  coyoteMs: 100,       // tempo para ainda pular depois de sair da borda
  bufferMs: 120,       // pulo apertado antes de tocar o chão ainda conta
  maxFall: 520,
};
