import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { MAP } from '../data/world.js';
import { buildBackdrop } from '../gfx/backdrop.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildTerrain } from '../gfx/terrain.js';

// Carrega a arte do Kio e gera todo o resto (fundo, sprites, terreno) em código.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.spritesheet('kio_idle', 'assets/kio_idle.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('kio_run', 'assets/kio_run.png', { frameWidth: 192, frameHeight: 192 });
  }

  async create() {
    this.add.text(WIDTH / 2, HEIGHT / 2 - 40, 'KIO', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#e6f4ff' }).setOrigin(0.5);
    const label = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 40, 'a floresta está acordando...', { fontFamily: BODY_FONT, fontSize: '20px', color: '#8fb3d9' })
      .setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 80, 360, 4, 0x1b2a45).setOrigin(0.5);
    const bar = this.add.rectangle(WIDTH / 2 - 180, HEIGHT / 2 + 80, 1, 4, 0x6ff6e0).setOrigin(0, 0.5);
    const progress = (p) => {
      bar.width = Math.max(1, 360 * p);
    };
    await new Promise((r) => setTimeout(r, 30));

    buildSprites(this);
    buildBackdrop(this);
    progress(0.1);
    await new Promise((r) => setTimeout(r, 0));

    const terrain = await buildTerrain(this, MAP, (p) => progress(0.1 + p * 0.9));
    this.registry.set('terrain', terrain);

    this.createAnims();
    label.setText('');
    this.scene.start('Title');
  }

  createAnims() {
    const a = this.anims;
    a.create({ key: 'kio-idle', frames: a.generateFrameNumbers('kio_idle', { start: 0, end: 24 }), frameRate: 14, repeat: -1 });
    a.create({ key: 'kio-run', frames: a.generateFrameNumbers('kio_run', { start: 0, end: 24 }), frameRate: 30, repeat: -1 });
    a.create({ key: 'crawler-walk', frames: a.generateFrameNumbers('crawler', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    a.create({ key: 'flyer-fly', frames: a.generateFrameNumbers('flyer', { start: 0, end: 3 }), frameRate: 14, repeat: -1, yoyo: false });
    for (const npc of ['npc_musgo', 'npc_lume', 'npc_eco', 'npc_raiz']) {
      a.create({ key: `${npc}-idle`, frames: a.generateFrameNumbers(npc, { start: 0, end: 1 }), frameRate: 1.6, repeat: -1 });
    }
  }
}
