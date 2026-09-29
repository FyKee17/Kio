import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { getOptions, setOption } from '../options.js';
import { DEFAULT_KEYS, ACTION_LABELS, currentKeys, keyLabel, keyNameFromCode } from '../controls.js';
import { sfx } from '../audio/sfx.js';

// Lista de controles com troca de teclas: escolha a ação, aperte Enter (ou
// clique) e depois a tecla nova. Esc cancela. Se a tecla já era de outra ação,
// as duas trocam de lugar.
export class KeysPanel {
  constructor(scene, onClose) {
    this.scene = scene;
    this.onClose = onClose;
    this.waiting = null;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const items = [];
    items.push(scene.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x02040a, 0.85).setInteractive());
    items.push(scene.add.image(cx, cy, 'ui-panel').setScale(0.5, 0.74));
    items.push(scene.add.text(cx, cy - 262, 'Controles', { fontFamily: TITLE_FONT, fontSize: '36px', color: '#eef7ff', padding: { x: 20, y: 20 } }).setOrigin(0.5).setShadow(0, 0, '#7cc8ff', 14, false, true));

    const actions = Object.keys(DEFAULT_KEYS);
    this.rows = [
      ...actions.map((a) => ({ kind: 'key', action: a, label: ACTION_LABELS[a] })),
      { kind: 'reset', label: 'Restaurar padrão' },
      { kind: 'back', label: 'Voltar' },
    ];
    this.rows.forEach((row, i) => {
      const y = cy - 210 + i * 36 + (row.kind !== 'key' ? 10 : 0);
      row.text = scene.add.text(cx - 210, y, row.label, { fontFamily: TITLE_FONT, fontSize: '21px', color: '#bcd3ee' }).setOrigin(0, 0.5);
      row.text.setInteractive({ useHandCursor: true }).on('pointerover', () => !this.waiting && this.select(i)).on('pointerdown', () => this.activate(i));
      items.push(row.text);
      if (row.kind === 'key') {
        row.value = scene.add.text(cx + 170, y, '', { fontFamily: BODY_FONT, fontSize: '19px', fontStyle: '700', color: '#e6f4ff' }).setOrigin(0.5);
        row.value.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.activate(i));
        items.push(row.value);
      }
    });
    this.hint = scene.add.text(cx, cy + 250, '', { fontFamily: BODY_FONT, fontSize: '16px', color: '#7f93b3' }).setOrigin(0.5);
    items.push(this.hint);
    this.cursor = scene.add.image(0, 0, 'ui-star').setScale(0.45);
    items.push(this.cursor);
    this.group = scene.add.container(0, 0, items).setDepth(410).setAlpha(0);
    scene.tweens.add({ targets: this.group, alpha: 1, duration: 150 });

    this.onKey = (e) => this.key(e);
    scene.time.delayedCall(0, () => scene.input.keyboard.on('keydown', this.onKey));
    this.refresh();
    this.select(0, true);
  }

  refresh() {
    const keys = currentKeys();
    for (const row of this.rows) {
      if (row.kind !== 'key') continue;
      const waiting = this.waiting === row;
      row.value.setText(waiting ? 'aperte uma tecla…' : `[ ${keyLabel(keys[row.action])} ]`);
      row.value.setColor(waiting ? '#ffd98a' : '#e6f4ff');
    }
    this.hint.setText(this.waiting ? 'Esc cancela' : 'Enter ou clique para trocar · setas também andam · Esc pausa (fixo)');
  }

  select(i, silent) {
    this.index = (i + this.rows.length) % this.rows.length;
    this.rows.forEach((r, j) => r.text.setColor(j === this.index ? '#ffffff' : '#8fa9c9'));
    const t = this.rows[this.index].text;
    this.cursor.setPosition(t.x - 22, t.y);
    if (!silent) sfx(this.scene, 'ui_move', { volume: 0.5 });
  }

  activate(i = this.index) {
    if (this.waiting) return;
    this.select(i, true);
    const row = this.rows[i];
    sfx(this.scene, 'ui_select', { volume: 0.5 });
    if (row.kind === 'key') {
      this.waiting = row;
    } else if (row.kind === 'reset') {
      setOption('keys', {});
    } else {
      return this.close();
    }
    this.refresh();
  }

  key(e) {
    if (this.waiting) {
      e.preventDefault?.();
      if (e.code !== 'Escape') {
        const name = keyNameFromCode(e.keyCode);
        if (name && name !== 'ESC') this.assign(this.waiting.action, name);
      }
      this.waiting = null;
      this.refresh();
      return;
    }
    if (e.code === 'ArrowUp') this.select(this.index - 1);
    else if (e.code === 'ArrowDown') this.select(this.index + 1);
    else if (e.code === 'Enter' || e.code === 'Space') this.activate();
    else if (e.code === 'Escape') this.close();
  }

  // Tecla nova para a ação; se outra ação usava essa tecla, elas trocam.
  assign(action, name) {
    const keys = currentKeys();
    const other = Object.keys(keys).find((a) => a !== action && keys[a] === name);
    const next = { ...(getOptions().keys || {}), [action]: name };
    if (other) next[other] = keys[action];
    setOption('keys', next);
    sfx(this.scene, 'ui_select', { volume: 0.5 });
  }

  close() {
    this.scene.input.keyboard.off('keydown', this.onKey);
    sfx(this.scene, 'ui_move', { volume: 0.5 });
    this.scene.tweens.add({ targets: this.group, alpha: 0, duration: 120, onComplete: () => this.group.destroy() });
    this.onClose?.();
  }
}
