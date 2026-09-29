import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { FONT } from '../fonts.js';
import { TOTAL_MEMORIES } from '../data/levels.js';
import { DialogueBox } from '../ui/DialogueBox.js';

// Interface por cima do jogo, em resolução cheia (sem o zoom do mundo).
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.memText = this.add
      .text(24, 20, '', { fontFamily: FONT, fontSize: '24px', color: '#9ee7ff' })
      .setShadow(0, 2, '#000000', 0, false, true);
    this.levelText = this.add
      .text(WIDTH / 2, 90, '', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#f4efe6' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setShadow(0, 3, '#000000', 0, false, true);

    this.dialogue = new DialogueBox(this);
    this.touchUI = null;
    this.events.once('shutdown', () => {
      this.dialogue = null;
    });
    this.events.emit('ui-ready');
  }

  setMemories(n) {
    this.memText.setText(`✦ ${n}/${TOTAL_MEMORIES}`);
  }

  showLevelName(name) {
    this.levelText.setText(name).setAlpha(0);
    this.tweens.chain({
      targets: this.levelText,
      tweens: [
        { alpha: 1, duration: 500 },
        { alpha: 0, duration: 700, delay: 1600 },
      ],
    });
  }

  // Botões de toque só aparecem em dispositivos com tela de toque.
  bindControls(controls) {
    if (!this.sys.game.device.input.touch) return;
    this.input.addPointer(3);
    this.controls = controls;
    this.touchUI = this.add.container(0, 0);
    const r = 46;
    const y = HEIGHT - 70;
    const button = (x, by, label, name) => {
      const c = this.add.circle(x, by, r, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.35).setInteractive();
      const t = this.add.text(x, by, label, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.7);
      this.touchUI.add([c, t]);
      const set = (v) => () => {
        controls.touch[name] = v;
        c.setFillStyle(0xffffff, v ? 0.3 : 0.12);
      };
      c.on('pointerdown', set(true));
      c.on('pointerup', set(false));
      c.on('pointerout', set(false));
    };
    button(80, y, '◀', 'left');
    button(190, y, '▶', 'right');
    button(135, y - 100, '▼', 'down');
    button(WIDTH - 80, y, '▲', 'jump');
    button(WIDTH - 190, y, 'E', 'action');
  }

  update() {
    // Durante o diálogo os botões somem; tocar na caixa avança a conversa.
    if (!this.touchUI) return;
    const talking = !!this.dialogue?.active;
    if (talking) {
      for (const k of Object.keys(this.controls.touch)) this.controls.touch[k] = false;
    }
    this.touchUI.setVisible(!talking);
  }
}
