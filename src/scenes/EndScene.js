import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { FONT } from '../fonts.js';
import { ENDINGS, TOTAL_MEMORIES } from '../data/levels.js';
import { clearSave } from '../save.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    this.done = false;
    const state = this.registry.get('state');
    const found = state.memories.length;
    const complete = found >= TOTAL_MEMORIES;
    const lines = complete ? ENDINGS.complete : ENDINGS.partial;
    clearSave();

    this.cameras.main.setBackgroundColor(complete ? '#2a2145' : '#0d0b14');
    this.cameras.main.fadeIn(800);

    const who = this.add.text(WIDTH / 2, HEIGHT / 2 - 50, '', { fontFamily: FONT, fontSize: '24px', color: '#ffd36e' }).setOrigin(0.5);
    const text = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#f4efe6',
        align: 'center',
        wordWrap: { width: WIDTH - 200 },
      })
      .setOrigin(0.5, 0);

    let i = 0;
    const next = () => {
      if (i >= lines.length) return this.finish(found, complete);
      const line = lines[i++];
      who.setText(line.who);
      text.setText(line.text).setAlpha(0);
      this.tweens.add({ targets: [who, text], alpha: 1, duration: 500 });
    };
    next();

    const advance = () => {
      if (this.done) return this.scene.start('Title');
      next();
    };
    this.input.on('pointerdown', advance);
    this.input.keyboard.on('keydown-SPACE', advance);
    this.input.keyboard.on('keydown-ENTER', advance);
    this.input.keyboard.on('keydown-E', advance);
  }

  finish(found, complete) {
    this.done = true;
    this.children.removeAll(true);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, complete ? 'Fim.' : 'Fim?', { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#f4efe6' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 20, `✦ ${found}/${TOTAL_MEMORIES} lampejos recuperados`, { fontFamily: FONT, fontSize: '26px', color: '#9ee7ff' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 60, 'aperte ESPAÇO ou toque para voltar', { fontFamily: FONT, fontSize: '18px', color: '#8a7fa6' })
      .setOrigin(0.5);
  }
}
