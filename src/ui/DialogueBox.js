import { WIDTH, HEIGHT } from '../config.js';
import { FONT } from '../fonts.js';

const CHAR_MS = 24;

// Caixa de diálogo com efeito de máquina de escrever.
// `play(lines)` devolve uma Promise que resolve quando a última fala fecha.
export class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    const x = 40;
    const w = WIDTH - 80;
    const h = 140;
    const y = HEIGHT - h - 20;

    this.container = scene.add.container(0, 0).setDepth(100).setVisible(false);
    const bg = scene.add.graphics();
    bg.fillStyle(0x120e1c, 0.94).fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(3, 0xc9b8ff, 1).strokeRoundedRect(x, y, w, h, 10);

    this.nameText = scene.add.text(x + 24, y + 14, '', { fontFamily: FONT, fontSize: '22px', color: '#ffd36e' });
    this.bodyText = scene.add.text(x + 24, y + 48, '', {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#f4efe6',
      lineSpacing: 6,
      wordWrap: { width: w - 48 },
    });
    this.arrow = scene.add.text(x + w - 36, y + h - 34, '▼', { fontFamily: FONT, fontSize: '18px', color: '#c9b8ff' });
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 4, duration: 400, yoyo: true, repeat: -1 });

    const hit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    hit.on('pointerdown', () => this.advance());

    this.container.add([bg, this.nameText, this.bodyText, this.arrow, hit]);
    this.lines = [];
    this.index = 0;
    this.typing = null;
    this.resolve = null;
  }

  get active() {
    return this.container.visible;
  }

  play(lines) {
    this.lines = lines;
    this.index = 0;
    this.container.setVisible(true);
    this.showLine();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  showLine() {
    const line = this.lines[this.index];
    this.nameText.setText(line.who || '');
    this.bodyText.setFontStyle(line.who ? 'normal' : 'italic');
    this.bodyText.setColor(line.who ? '#f4efe6' : '#bfb6d6');
    this.full = line.text;
    this.shown = 0;
    this.bodyText.setText('');
    this.arrow.setVisible(false);
    this.typing?.remove();
    this.typing = this.scene.time.addEvent({
      delay: CHAR_MS,
      repeat: this.full.length - 1,
      callback: () => {
        this.shown++;
        this.bodyText.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.finishTyping();
      },
    });
  }

  finishTyping() {
    this.typing?.remove();
    this.typing = null;
    this.shown = this.full.length;
    this.bodyText.setText(this.full);
    this.arrow.setVisible(true);
  }

  advance() {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      this.finishTyping();
      return;
    }
    this.index++;
    if (this.index < this.lines.length) {
      this.showLine();
      return;
    }
    this.container.setVisible(false);
    const done = this.resolve;
    this.resolve = null;
    done?.();
  }
}
