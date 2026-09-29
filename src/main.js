import Phaser from 'phaser';
import { WIDTH, HEIGHT, PHYS } from './config.js';
import { waitForFont } from './fonts.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { EndScene } from './scenes/EndScene.js';

await waitForFont();

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0d0b14',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false } },
  scene: [BootScene, TitleScene, GameScene, UIScene, EndScene],
});
