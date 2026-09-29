import Phaser from 'phaser';
import { ART, PLACEHOLDERS } from '../data/art.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.failed = new Set();
    this.load.on('loaderror', (file) => {
      console.warn(`[Kio] Não consegui carregar ${file.src}; usando placeholder.`);
      this.failed.add(file.key);
    });
    for (const [key, def] of Object.entries(ART)) {
      if (!def.file) continue;
      this.load.spritesheet(key, def.file, { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
    }
  }

  create() {
    for (const [key, def] of Object.entries(ART)) {
      if (def.file && !this.failed.has(key) && this.textures.exists(key)) continue;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.makeSheet(key, def, PLACEHOLDERS[key]);
    }

    for (const [key, def] of Object.entries(ART)) {
      for (const [name, anim] of Object.entries(def.anims || {})) {
        this.anims.create({
          key: `${key}-${name}`,
          frames: this.anims.generateFrameNumbers(key, { frames: anim.frames }),
          frameRate: anim.rate,
          repeat: anim.repeat,
        });
      }
      // NPCs respiram devagar sozinhos
      if (key.startsWith('npc_')) {
        this.anims.create({
          key: `${key}-idle`,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: def.frames - 1 }),
          frameRate: 2,
          repeat: -1,
        });
      }
    }

    this.makeSheet('spark', { frameWidth: 3, frameHeight: 3, frames: 1 }, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 3, 3);
    });
    this.makeSheet('prompt', { frameWidth: 9, frameHeight: 9, frames: 1 }, (ctx) => {
      ctx.fillStyle = '#ffffff';
      [9, 7, 5, 3, 1].forEach((w, row) => ctx.fillRect((9 - w) / 2, row + 2, w, 1));
    });

    this.scene.start('Title');
  }

  makeSheet(key, def, draw) {
    const { frameWidth: fw, frameHeight: fh, frames } = def;
    const tex = this.textures.createCanvas(key, fw * frames, fh);
    const ctx = tex.getContext();
    for (let i = 0; i < frames; i++) {
      ctx.save();
      ctx.translate(i * fw, 0);
      ctx.beginPath();
      ctx.rect(0, 0, fw, fh);
      ctx.clip();
      draw(ctx, i, fw, fh);
      ctx.restore();
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
    tex.refresh();
  }
}
