import { WIDTH, HEIGHT, RES } from './config.js';

// Câmeras desenham tudo ampliado por RES (ver config.js). Cenas de tela fixa
// (título, HUD, fim) usam origem no canto; o mundo usa origem no centro, que é
// o que o "seguir o jogador" e os limites da câmera esperam.
export function setupCamera(scene, { world = false } = {}) {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  if (!world) cam.setOrigin(0, 0);
  return cam;
}

// No mundo, objetos presos à tela (scrollFactor 0) precisam deste deslocamento
// para ocupar a mesma posição lógica que teriam sem zoom.
export const FIXED_X = (WIDTH * (RES - 1)) / 2;
export const FIXED_Y = (HEIGHT * (RES - 1)) / 2;
