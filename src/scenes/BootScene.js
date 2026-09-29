import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { MAP } from '../data/world.js';
import { buildBackdrop } from '../gfx/backdrop.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildTerrain } from '../gfx/terrain.js';
import { SHEETS, ANIMS } from '../data/anims.js';

// Carrega as folhas de arte (Kio, Vovó, besouro, mariposa) e gera o resto em código.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const [key, size] of Object.entries(SHEETS)) this.load.spritesheet(key, `assets/${key}.png`, size);
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
    for (const def of ANIMS) {
      a.create({ key: def.key, frames: a.generateFrameNumbers(def.sheet, { frames: def.frames }), frameRate: def.rate, repeat: def.repeat });
    }
    for (const npc of ['npc_lume', 'npc_eco', 'npc_raiz']) {
      a.create({ key: `${npc}-idle`, frames: a.generateFrameNumbers(npc, { start: 0, end: 1 }), frameRate: 1.6, repeat: -1 });
    }
  }
}
