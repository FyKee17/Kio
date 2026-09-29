import { WIDTH } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { sfx } from '../audio/sfx.js';

const CHAR_MS = 22;

// "Voz" de cada personagem: altura do bipe que acompanha as letras.
const VOICES = { Kio: 1.35, 'Vovó Musgo': 0.78, Lume: 1.75, Eco: 1.05, Raiz: 0.55 };

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
    const bg = scene.add.image(WIDTH / 2, y + h / 2, 'ui-dialog').setScale(0.5);

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
    this.voice = VOICES[line.who] || (line.who ? 1 : 0);
    this.bodyText.setText('');
    this.arrow.setVisible(false);
    this.typing?.remove();
    this.typing = this.scene.time.addEvent({
      delay: CHAR_MS,
      repeat: this.full.length - 1,
      callback: () => {
        this.shown++;
        this.bodyText.setText(this.full.slice(0, this.shown));
        const ch = this.full[this.shown - 1];
        if (this.voice && this.shown % 2 === 0 && /[\p{L}\d]/u.test(ch)) {
          sfx(this.scene, 'talk', { volume: 0.32, rate: this.voice, vary: 0.08 });
        }
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
    sfx(this.scene, 'ui_move', { volume: 0.3 });
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
