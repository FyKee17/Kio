import Phaser from 'phaser';
import { setupCamera } from '../view.js';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { MAP } from '../data/world.js';
import { buildBackdrop } from '../gfx/backdrop.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildTerrain } from '../gfx/terrain.js';
import { SHEETS, ANIMS } from '../data/anims.js';
import { buildSfx } from '../audio/sfx.js';
import { buildUi } from '../gfx/ui.js';
import { buildFx } from '../gfx/fx.js';
import { TRACKS, initMusic } from '../audio/music.js';
import { buildRuinsArt } from '../gfx/ruins.js';
import { buildSkins, createSkinAnims } from '../gfx/skins.js';

// Carrega as folhas de arte (Kio, Vovó, besouro, mariposa) e gera o resto em código.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    setupCamera(this);
    this.add.text(WIDTH / 2, HEIGHT / 2 - 40, 'KIO', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#e6f4ff' }).setOrigin(0.5);
    this.label = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 40, 'a floresta está acordando...', { fontFamily: BODY_FONT, fontSize: '20px', color: '#8fb3d9' })
      .setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 80, 360, 4, 0x1b2a45).setOrigin(0.5);
    this.bar = this.add.rectangle(WIDTH / 2 - 180, HEIGHT / 2 + 80, 1, 4, 0x6ff6e0).setOrigin(0, 0.5);
    // metade da barra: baixar arquivos; outra metade: gerar o mundo
    this.load.on('progress', (p) => this.progress(p * 0.5));
    for (const [key, size] of Object.entries(SHEETS)) this.load.spritesheet(key, `assets/${key}.png`, size);
    for (const [name, url] of Object.entries(TRACKS)) this.load.audio(`music-${name}`, url);
  }

  progress(p) {
    this.bar.width = Math.max(1, 360 * p);
  }

  async create() {
    await new Promise((r) => setTimeout(r, 30));
    buildSfx(this.game);
    initMusic(this.game);
    buildSprites(this);
    buildUi(this);
    buildFx(this);
    buildBackdrop(this);
    buildRuinsArt(this);
    buildSkins(this);
    this.progress(0.55);
    await new Promise((r) => setTimeout(r, 0));

    const terrain = await buildTerrain(this, MAP, (p) => this.progress(0.55 + p * 0.45));
    this.registry.set('terrain', terrain);

    this.createAnims();
    this.label.setText('');
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
    createSkinAnims(this);
    // Ruínas (folhas desenhadas em código em gfx/ruins.js)
    const mk = (key, sheet, frames, rate, repeat = -1) => a.create({ key, frames: a.generateFrameNumbers(sheet, { frames }), frameRate: rate, repeat });
    mk('pebble-walk', 'pebble', [0, 1, 2, 3], 8);
    mk('archer-idle', 'archer', [0, 1], 2);
    mk('squire-walk', 'squire', [0, 1, 2, 3], 6);
    mk('rknight-idle', 'rknight', [0, 1], 2.5);
    mk('rknight-walk', 'rknight', [2, 3, 4, 5], 7);
    mk('tornado-spin', 'tornado', [0, 1, 2, 3, 4, 5], 16);
  }
}
