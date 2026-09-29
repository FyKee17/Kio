import Phaser from 'phaser';
// fontes embutidas no jogo (não dependem do Google Fonts)
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/400-italic.css';
import '@fontsource/nunito/700.css';
import { WIDTH, HEIGHT, PHYS, RES } from './config.js';
import { waitForFont } from './fonts.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { EndScene } from './scenes/EndScene.js';

await waitForFont();

// Todo texto é rasterizado na resolução real, para não borrar com o zoom.
const addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function text(x, y, content, style = {}) {
  return addText.call(this, x, y, content, { resolution: RES, ...style });
};

// ?canvas força o renderizador Canvas (útil em máquinas sem GPU)
const forceCanvas = new URLSearchParams(location.search).has('canvas');

window.game = new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: Math.round(WIDTH * RES),
  height: Math.round(HEIGHT * RES),
  backgroundColor: '#070b18',
  antialias: true,
  roundPixels: false,
  render: { antialiasGL: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false, tileBias: 40 } },
  input: { activePointers: 5 },
  scene: [BootScene, TitleScene, WorldScene, HUDScene, EndScene],
});
