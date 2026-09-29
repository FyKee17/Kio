import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { FONT } from '../fonts.js';
import { loadSave, clearSave, newState } from '../save.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.starting = false;
    this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH / 2, HEIGHT / 2, 'bg_sky').setScale(2);
    this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH / 2, HEIGHT / 2, 'bg_far').setScale(2);
    this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH / 2, HEIGHT / 2, 'bg_near').setScale(2);

    const title = this.add
      .text(WIDTH / 2, 150, 'KIO', { fontFamily: FONT, fontSize: '120px', fontStyle: 'bold', color: '#f4efe6' })
      .setOrigin(0.5)
      .setShadow(0, 6, '#e0584f', 0, false, true);
    this.tweens.add({ targets: title, y: 160, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(WIDTH / 2, 235, 'a memória do mundo', { fontFamily: FONT, fontSize: '26px', color: '#c9b8ff' })
      .setOrigin(0.5);

    this.add.sprite(WIDTH / 2, 330, 'kio').setScale(4).play('kio-idle');

    const save = loadSave();
    const options = [];
    if (save) options.push({ label: 'Continuar', start: () => save });
    options.push({
      label: 'Novo jogo',
      start: () => {
        clearSave();
        return newState();
      },
    });

    this.selected = 0;
    this.buttons = options.map((opt, i) => {
      const t = this.add
        .text(WIDTH / 2, 420 + i * 46, opt.label, { fontFamily: FONT, fontSize: '30px', color: '#f4efe6' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.begin(opt));
      return { text: t, opt };
    });
    this.select(0);

    this.add
      .text(WIDTH / 2, HEIGHT - 20, '← → / A D: andar   ESPAÇO: pular   E: falar   ↓: descer', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#8a7fa6',
      })
      .setOrigin(0.5, 1);

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.select(this.selected - 1));
    kb.on('keydown-W', () => this.select(this.selected - 1));
    kb.on('keydown-DOWN', () => this.select(this.selected + 1));
    kb.on('keydown-S', () => this.select(this.selected + 1));
    const go = () => this.begin(this.buttons[this.selected].opt);
    kb.on('keydown-SPACE', go);
    kb.on('keydown-ENTER', go);
    kb.on('keydown-Z', go);

    this.cameras.main.fadeIn(600);
  }

  select(i) {
    const n = this.buttons.length;
    this.selected = (i + n) % n;
    this.buttons.forEach((b, j) => {
      const on = j === this.selected;
      b.text.setText(on ? `▸ ${b.opt.label} ◂` : b.opt.label);
      b.text.setColor(on ? '#ffd36e' : '#f4efe6');
    });
  }

  begin(opt) {
    if (this.starting) return;
    this.starting = true;
    const state = opt.start();
    this.registry.set('state', state);
    this.cameras.main.fadeOut(400, 13, 11, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { level: state.level }));
  }
}
