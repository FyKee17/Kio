import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { getOptions, setOption } from '../options.js';
import { sfx } from '../audio/sfx.js';
import { KeysPanel } from './KeysPanel.js';

// Painel de opções (volume da música, dos efeitos e tela cheia).
// Usado no menu principal e no menu de pausa. Teclado: ↑↓ escolhe, ←→ ajusta,
// Enter/Espaço confirma, Esc volta. Mouse: clique e arraste nos controles.
export class OptionsPanel {
  constructor(scene, onClose) {
    this.scene = scene;
    this.onClose = onClose;
    this.index = 0;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const items = [];
    items.push(scene.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x02040a, 0.6).setInteractive());
    items.push(scene.add.image(cx, cy, 'ui-panel').setScale(0.5));
    items.push(scene.add.text(cx, cy - 170, 'Opções', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#eef7ff', padding: { x: 20, y: 20 } }).setOrigin(0.5).setShadow(0, 0, '#7cc8ff', 14, false, true));

    this.rows = [
      { label: 'Música', kind: 'slider', key: 'music' },
      { label: 'Efeitos', kind: 'slider', key: 'sfx' },
      { label: 'Tela cheia', kind: 'toggle' },
      { label: 'Controles', kind: 'keys' },
      { label: 'Voltar', kind: 'back' },
    ];
    this.rows.forEach((row, i) => {
      const y = cy - 100 + i * 60;
      row.text = scene.add.text(cx - 200, y, row.label, { fontFamily: TITLE_FONT, fontSize: '26px', color: '#bcd3ee' }).setOrigin(0, 0.5);
      row.text.setInteractive({ useHandCursor: true }).on('pointerover', () => this.select(i)).on('pointerdown', () => this.activate(i));
      items.push(row.text);
      if (row.kind === 'slider') {
        const track = scene.add.image(cx + 100, y, 'ui-slider').setScale(0.5).setInteractive({ useHandCursor: true });
        row.knob = scene.add.image(cx + 100, y, 'ui-knob').setScale(0.5);
        row.value = scene.add.text(cx + 225, y, '', { fontFamily: BODY_FONT, fontSize: '18px', color: '#8fa9c9' }).setOrigin(0, 0.5);
        const setFromPointer = (p) => {
          const local = (p.worldX - (cx + 100 - 104)) / 208;
          this.setValue(row, Math.max(0, Math.min(1, local)));
        };
        track.on('pointerdown', (p) => {
          this.select(i);
          setFromPointer(p);
          this.dragging = setFromPointer;
        });
        items.push(track, row.knob, row.value);
      } else if (row.kind === 'toggle') {
        row.value = scene.add.text(cx + 100, y, '', { fontFamily: BODY_FONT, fontSize: '22px', color: '#e6f4ff' }).setOrigin(0.5);
        items.push(row.value);
      } else if (row.kind === 'keys') {
        items.push(scene.add.text(cx + 100, y, 'ver e trocar teclas  ›', { fontFamily: BODY_FONT, fontSize: '18px', color: '#8fa9c9' }).setOrigin(0.5));
      }
    });
    this.cursor = scene.add.image(0, 0, 'ui-star').setScale(0.5);
    scene.tweens.add({ targets: this.cursor, angle: 90, duration: 2400, repeat: -1 });
    items.push(this.cursor);
    this.group = scene.add.container(0, 0, items).setDepth(400).setAlpha(0);
    scene.tweens.add({ targets: this.group, alpha: 1, duration: 200 });

    this.onMove = (p) => {
      if (this.sub) return;
      if (this.dragging && p.isDown) this.dragging(p);
    };
    this.onUp = () => {
      this.dragging = null;
    };
    this.onKey = (e) => this.key(e.code);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.keyboard.on('keydown', this.onKey);
    this.refresh();
    this.select(0, true);
  }

  refresh() {
    const o = getOptions();
    for (const row of this.rows) {
      if (row.kind === 'slider') {
        const v = o[row.key];
        row.knob.x = WIDTH / 2 + 100 - 104 + v * 208;
        row.value.setText(`${Math.round(v * 100)}%`);
      } else if (row.kind === 'toggle') {
        row.value.setText(this.scene.scale.isFullscreen ? '◆  Sim' : '◇  Não');
      }
    }
  }

  setValue(row, v) {
    setOption(row.key, Math.round(v * 20) / 20);
    this.refresh();
    if (row.key === 'sfx') sfx(this.scene, 'ui_move', { volume: 0.8 });
  }

  select(i, silent) {
    this.index = (i + this.rows.length) % this.rows.length;
    this.rows.forEach((r, j) => r.text.setColor(j === this.index ? '#ffffff' : '#8fa9c9'));
    const t = this.rows[this.index].text;
    this.cursor.setPosition(t.x - 26, t.y);
    if (!silent) sfx(this.scene, 'ui_move', { volume: 0.5 });
  }

  activate(i = this.index) {
    const row = this.rows[i];
    if (row.kind === 'toggle') {
      if (this.scene.scale.isFullscreen) this.scene.scale.stopFullscreen();
      else this.scene.scale.startFullscreen();
      this.scene.time.delayedCall(150, () => this.refresh());
      sfx(this.scene, 'ui_select', { volume: 0.6 });
    } else if (row.kind === 'keys') {
      this.sub = new KeysPanel(this.scene, () => {
        this.sub = null;
      });
    } else if (row.kind === 'back') {
      this.close();
    }
  }

  key(code) {
    if (this.sub) return; // o painel de teclas está aberto por cima
    const row = this.rows[this.index];
    if (code === 'ArrowUp' || code === 'KeyW') this.select(this.index - 1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.select(this.index + 1);
    else if ((code === 'ArrowLeft' || code === 'KeyA') && row.kind === 'slider') this.setValue(row, getOptions()[row.key] - 0.05);
    else if ((code === 'ArrowRight' || code === 'KeyD') && row.kind === 'slider') this.setValue(row, getOptions()[row.key] + 0.05);
    else if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.activate();
    else if (code === 'Escape') this.close();
  }

  close() {
    const s = this.scene;
    s.input.off('pointermove', this.onMove);
    s.input.off('pointerup', this.onUp);
    s.input.keyboard.off('keydown', this.onKey);
    sfx(s, 'ui_move', { volume: 0.5 });
    s.tweens.add({ targets: this.group, alpha: 0, duration: 150, onComplete: () => this.group.destroy() });
    this.onClose?.();
  }
}
