import { WIDTH } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';

const CHAR_MS = 22;

// Caixa de diálogo no topo da tela, com ornamentos, efeito de máquina de escrever.
// `play(lines)` devolve uma Promise que resolve quando a última fala fecha.
export class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    const w = 900;
    const h = 170;
    const x = (WIDTH - w) / 2;
    const y = 128; // abaixo da vida e dos fragmentos
    this.boxY = y;

    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false);
    const bg = scene.add.graphics();
    bg.fillStyle(0x03050c, 0.82).fillRoundedRect(x, y, w, h, 18);
    const orn = scene.add.graphics();
    orn.lineStyle(2, 0xdff4ff, 0.8);
    for (const oy of [y + 10, y + h - 10]) {
      orn.lineBetween(x + 120, oy, WIDTH / 2 - 16, oy);
      orn.lineBetween(WIDTH / 2 + 16, oy, x + w - 120, oy);
      orn.fillStyle(0xdff4ff, 0.9).fillPoints(
        [
          { x: WIDTH / 2, y: oy - 7 },
          { x: WIDTH / 2 + 9, y: oy },
          { x: WIDTH / 2, y: oy + 7 },
          { x: WIDTH / 2 - 9, y: oy },
        ],
        true,
      );
    }

    this.nameText = scene.add.text(WIDTH / 2, y + 36, '', { fontFamily: TITLE_FONT, fontSize: '22px', color: '#ffd98a' }).setOrigin(0.5);
    this.bodyText = scene.add
      .text(WIDTH / 2, y + 62, '', {
        fontFamily: BODY_FONT,
        fontSize: '24px',
        color: '#e6f4ff',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: w - 110 },
      })
      .setOrigin(0.5, 0);
    this.arrow = scene.add.text(x + w - 44, y + h - 42, '◆', { fontFamily: BODY_FONT, fontSize: '16px', color: '#dff4ff' });
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    const hit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    hit.on('pointerdown', () => this.advance());

    this.container.add([bg, orn, this.nameText, this.bodyText, this.arrow, hit]);
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
    this.container.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 160 });
    this.showLine();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  showLine() {
    const line = this.lines[this.index];
    const narrator = !line.who;
    this.nameText.setText(line.who || '');
    this.bodyText.setY(this.boxY + (narrator ? 52 : 62));
    this.bodyText.setFontStyle(narrator ? 'italic' : 'normal');
    this.bodyText.setColor(narrator ? '#bcd3ee' : '#e6f4ff');
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
