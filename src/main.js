import Phaser from 'phaser';
import { WIDTH, HEIGHT, PHYS } from './config.js';
import { waitForFont } from './fonts.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { EndScene } from './scenes/EndScene.js';

await waitForFont();

// ?canvas força o renderizador Canvas (útil em máquinas sem GPU)
const forceCanvas = new URLSearchParams(location.search).has('canvas');

window.game = new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#070b18',
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false, tileBias: 40 } },
  input: { activePointers: 5 },
  scene: [BootScene, TitleScene, WorldScene, HUDScene, EndScene],
});
