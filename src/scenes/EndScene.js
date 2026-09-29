import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { ENDING, TABLETS } from '../data/world.js';
import { clearSave } from '../save.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    this.done = false;
    const s = this.registry.get('state');
    // porcentagem de conclusão: habilidades, corações, tábuas, conversas e o chefe
    const parts = [
      s.abilities.dash,
      s.abilities.doubleJump,
      s.collected.includes('H:93,5'),
      s.collected.includes('musgo-heart'),
      s.bossDefeated,
      ...Object.keys(TABLETS).map((k) => s.read.includes(k)),
      ...['m', 'l', 'e'].map((k) => s.talked.includes(k)),
    ];
    const pct = Math.round((parts.filter(Boolean).length / parts.length) * 100);
    const minutes = Math.max(1, Math.round(s.playMs / 60000));
    clearSave();

    this.cameras.main.setBackgroundColor('#eaf6ff');
    this.cameras.main.fadeIn(1500, 255, 255, 255);
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-sky').setAlpha(0);

    const text = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', {
        fontFamily: TITLE_FONT,
        fontSize: '30px',
        color: '#16233a',
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: WIDTH - 260 },
      })
      .setOrigin(0.5);

    let i = 0;
    const next = () => {
      if (i >= ENDING.length) return this.finish(pct, minutes, s.deaths);
      text.setText(ENDING[i++]).setAlpha(0);
      this.tweens.add({ targets: text, alpha: 1, duration: 900 });
    };
    this.time.delayedCall(800, next);

    const advance = () => {
      if (this.done) return this.scene.start('Title');
      if (text.alpha > 0.8) next();
    };
    this.input.on('pointerdown', advance);
    for (const k of ['SPACE', 'ENTER', 'Z', 'X', 'E']) this.input.keyboard.on(`keydown-${k}`, advance);
  }

  finish(pct, minutes, deaths) {
    this.done = true;
    this.children.removeAll(true);
    const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-sky').setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 1, duration: 2000 });
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 90, 'Fim', { fontFamily: TITLE_FONT, fontSize: '96px', color: '#ffffff' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7cc8ff', 30, false, true);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 30, `${pct}% da floresta lembrada`, { fontFamily: TITLE_FONT, fontSize: '28px', color: '#ffd98a' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, `${minutes} min   ·   ${deaths} ${deaths === 1 ? 'queda' : 'quedas'}`, { fontFamily: BODY_FONT, fontSize: '22px', color: '#bcd3ee' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 50, 'obrigado por jogar  ·  aperte pulo para voltar', { fontFamily: BODY_FONT, fontSize: '18px', color: '#8fa9c9' })
      .setOrigin(0.5);
  }
}
