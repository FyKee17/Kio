import Phaser from 'phaser';
import { WIDTH, HEIGHT, COMBAT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { AREAS } from '../data/world.js';
import { DialogueBox } from '../ui/DialogueBox.js';

// Interface por cima do mundo: vida, alma, fragmentos, títulos de área,
// diálogos, habilidades novas, mapa e botões de toque.
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    this.ready = false;
    this.world = null;
    this.abilityOpen = false;
    this.mapVisible = false;
    this.touchUI = null;

    this.add.image(WIDTH / 2, HEIGHT / 2, 'vignette').setDepth(0);
    this.hurtFlash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x2a0010, 0).setDepth(1);

    // vaso de alma + chamas de vida + fragmentos
    this.soulG = this.add.graphics().setDepth(10);
    this.hearts = [];
    this.geoIcon = this.add.image(128, 112, 'geo').setDepth(10);
    this.geoText = this.add
      .text(146, 112, '0', { fontFamily: BODY_FONT, fontSize: '22px', fontStyle: '700', color: '#fff3cf' })
      .setOrigin(0, 0.5)
      .setShadow(0, 2, '#000', 4, false, true)
      .setDepth(10);

    // título de área
    this.areaTitle = this.add
      .text(WIDTH / 2, 130, '', { fontFamily: TITLE_FONT, fontSize: '50px', color: '#eef7ff' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7cc8ff', 18, false, true);
    this.areaLine = this.add.graphics();
    this.areaGroup = this.add.container(0, 0, [this.areaTitle, this.areaLine]).setDepth(50).setAlpha(0);

    this.dialogue = new DialogueBox(this);

    this.toastText = this.add
      .text(WIDTH / 2, HEIGHT - 70, '', { fontFamily: BODY_FONT, fontSize: '22px', color: '#e6f4ff' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000', 6, false, true)
      .setAlpha(0)
      .setDepth(60);

    this.bossName = this.add
      .text(WIDTH / 2, HEIGHT - 58, 'Guardião Oco', { fontFamily: TITLE_FONT, fontSize: '18px', color: '#e6f4ff' })
      .setOrigin(0.5)
      .setDepth(60)
      .setVisible(false);
    this.bossBarBg = this.add.rectangle(WIDTH / 2, HEIGHT - 34, 520, 8, 0x0b1224, 0.8).setStrokeStyle(1, 0xdff4ff, 0.5).setDepth(60).setVisible(false);
    this.bossBarFill = this.add.rectangle(WIDTH / 2 - 258, HEIGHT - 34, 516, 5, 0xdff4ff).setOrigin(0, 0.5).setDepth(61).setVisible(false);

    this.events.once('shutdown', () => {
      this.ready = false;
    });
    this.events.emit('hud-ready');
  }

  bind(world) {
    this.world = world;
    this.ready = true;
    this.bindTouch(world.controls);
  }

  get modal() {
    return this.dialogue.active || this.abilityOpen;
  }

  advance() {
    if (this.abilityOpen) this.closeAbility?.();
    else this.dialogue.advance();
  }

  // --------------------------------------------------------------- status

  refresh({ health, maxHealth, soul, geo }) {
    while (this.hearts.length < maxHealth) {
      const i = this.hearts.length;
      this.hearts.push(this.add.image(136 + i * 40, 58, 'hp-full').setScale(0.62).setDepth(10));
    }
    this.hearts.forEach((h, i) => {
      const full = i < health;
      if (h.getData('full') !== full) {
        h.setTexture(full ? 'hp-full' : 'hp-empty');
        h.setData('full', full);
        if (!full) this.tweens.add({ targets: h, scale: 0.8, duration: 90, yoyo: true });
      }
    });
    this.geoText.setText(String(geo));
    this.drawSoul(soul / COMBAT.maxSoul);
  }

  drawSoul(t) {
    const g = this.soulG;
    const cx = 70;
    const cy = 76;
    const r = 42;
    g.clear();
    g.fillStyle(0x03050c, 0.7).fillCircle(cx, cy, r + 4);
    if (t > 0) {
      const top = cy + r - 2 * r * t;
      g.fillStyle(0xdff4ff, 0.92);
      // enche de baixo para cima em faixas horizontais
      for (let y = Math.ceil(top); y <= cy + r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
        g.fillRect(cx - half, y, half * 2, 1);
      }
    }
    g.lineStyle(3, 0xdff4ff, 0.9).strokeCircle(cx, cy, r + 4);
    g.lineStyle(1, 0x7cc8ff, 0.6).strokeCircle(cx, cy, r + 9);
  }

  flashDamage() {
    this.hurtFlash.setFillStyle(0x2a0010, 0.55);
    this.tweens.add({ targets: this.hurtFlash, fillAlpha: 0, duration: 450 });
  }

  // --------------------------------------------------------------- textos

  showArea(name) {
    this.areaTitle.setText(name);
    const w = this.areaTitle.width / 2 + 40;
    this.areaLine.clear().lineStyle(2, 0xdff4ff, 0.8);
    this.areaLine.lineBetween(WIDTH / 2 - w, 170, WIDTH / 2 - 14, 170).lineBetween(WIDTH / 2 + 14, 170, WIDTH / 2 + w, 170);
    this.areaLine.fillStyle(0xdff4ff, 1).fillCircle(WIDTH / 2, 170, 4);
    this.tweens.killTweensOf(this.areaGroup);
    this.areaGroup.setAlpha(0);
    this.tweens.chain({
      targets: this.areaGroup,
      tweens: [
        { alpha: 1, duration: 700 },
        { alpha: 0, duration: 900, delay: 2200 },
      ],
    });
  }

  toast(text) {
    this.toastText.setText(text);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.chain({
      targets: this.toastText,
      tweens: [
        { alpha: 1, duration: 300 },
        { alpha: 0, duration: 600, delay: 1800 },
      ],
    });
  }

  say(lines) {
    return this.dialogue.play(lines);
  }

  bossIntro(name) {
    const sub = this.add.text(WIDTH / 2, HEIGHT - 200, 'o', { fontFamily: TITLE_FONT, fontSize: '22px', color: '#bcd3ee' }).setOrigin(0.5);
    const t = this.add
      .text(WIDTH / 2, HEIGHT - 160, name, { fontFamily: TITLE_FONT, fontSize: '64px', color: '#ffffff' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffb3d9', 24, false, true);
    const group = this.add.container(0, 0, [sub, t]).setAlpha(0).setDepth(70);
    this.tweens.chain({
      targets: group,
      tweens: [
        { alpha: 1, duration: 500 },
        { alpha: 0, duration: 900, delay: 1800 },
      ],
      onComplete: () => group.destroy(),
    });
  }

  bossBar(show, ratio = 1) {
    for (const o of [this.bossName, this.bossBarBg, this.bossBarFill]) o.setVisible(show);
    this.bossBarFill.width = 516 * Math.max(0, ratio);
  }

  showAbility(title, text, hint) {
    this.abilityOpen = true;
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x02040a, 0.8);
    const light = this.add.image(WIDTH / 2, HEIGHT / 2 - 80, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7cc8ff).setScale(3);
    const orb = this.add.image(WIDTH / 2, HEIGHT / 2 - 80, 'ability').setScale(0.9);
    const t = this.add.text(WIDTH / 2, HEIGHT / 2 + 30, title, { fontFamily: TITLE_FONT, fontSize: '54px', color: '#ffffff' }).setOrigin(0.5).setShadow(0, 0, '#7cc8ff', 20, false, true);
    const d = this.add.text(WIDTH / 2, HEIGHT / 2 + 96, text, { fontFamily: BODY_FONT, fontSize: '24px', color: '#bcd3ee', fontStyle: 'italic' }).setOrigin(0.5);
    const h = this.add.text(WIDTH / 2, HEIGHT / 2 + 146, hint, { fontFamily: BODY_FONT, fontSize: '22px', color: '#6ff6e0', fontStyle: '700' }).setOrigin(0.5);
    const c = this.add.text(WIDTH / 2, HEIGHT - 50, 'aperte pulo para continuar', { fontFamily: BODY_FONT, fontSize: '16px', color: '#7f93b3' }).setOrigin(0.5);
    const group = this.add.container(0, 0, [shade, light, orb, t, d, h, c]).setDepth(150).setAlpha(0);
    this.tweens.add({ targets: group, alpha: 1, duration: 500 });
    this.tweens.add({ targets: light, scale: 3.6, duration: 1400, yoyo: true, repeat: -1 });
    const openedAt = this.time.now;
    shade.setInteractive().on('pointerdown', () => this.closeAbility?.());
    return new Promise((resolve) => {
      this.closeAbility = () => {
        if (this.time.now - openedAt < 700) return;
        this.closeAbility = null;
        this.tweens.add({
          targets: group,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            group.destroy();
            this.abilityOpen = false;
            this.world?.controls.consume();
            resolve();
          },
        });
      };
    });
  }

  // ----------------------------------------------------------------- mapa

  showMap(open) {
    this.mapVisible = open;
    this.mapGroup?.destroy();
    this.mapGroup = null;
    if (!open) return;
    const w = this.world;
    const S = 7;
    const mw = w.W * S;
    const mh = w.H * S;
    if (this.textures.exists('map-tex')) this.textures.remove('map-tex');
    const tex = this.textures.createCanvas('map-tex', mw, mh);
    const ctx = tex.getContext();
    for (let ty = 0; ty < w.H; ty++) {
      for (let tx = 0; tx < w.W; tx++) {
        if (!w.isExplored(tx, ty)) continue;
        const c = w.cell(tx, ty);
        if (c === '#') {
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.cell(tx + dx, ty + dy) !== '#');
          if (edge) {
            ctx.fillStyle = '#9fd4ea';
            ctx.fillRect(tx * S, ty * S, S, S);
          }
        } else {
          ctx.fillStyle = 'rgba(40,70,110,0.75)';
          ctx.fillRect(tx * S, ty * S, S, S);
          if (c === '^') {
            ctx.fillStyle = '#c28dff';
            ctx.fillRect(tx * S, ty * S + S / 2, S, S / 2);
          } else if (c === '=') {
            ctx.fillStyle = '#6ff6e0';
            ctx.fillRect(tx * S, ty * S, S, 2);
          }
        }
      }
    }
    tex.refresh();

    const scale = Math.min((WIDTH - 140) / mw, (HEIGHT - 180) / mh);
    const ox = (WIDTH - mw * scale) / 2;
    const oy = 110;
    const items = [];
    items.push(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x03060e, 0.92).setInteractive());
    items.push(this.add.text(WIDTH / 2, 56, 'Mapa', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#eef7ff' }).setOrigin(0.5));
    items.push(this.add.image(ox, oy, 'map-tex').setOrigin(0).setScale(scale));
    for (const a of AREAS) {
      let seen = false;
      for (let ty = a.y; ty < a.y + a.h && !seen; ty++) for (let tx = a.x; tx < a.x + a.w && !seen; tx++) if (tx < w.W && ty < w.H && w.isExplored(tx, ty)) seen = true;
      if (!seen) continue;
      items.push(
        this.add
          .text(ox + (a.x + a.w / 2) * S * scale, oy + (a.y + a.h / 2) * S * scale, a.name, { fontFamily: TITLE_FONT, fontSize: '17px', color: '#ffd98a' })
          .setOrigin(0.5)
          .setShadow(0, 2, '#000', 6, false, true),
      );
    }
    for (const b of w.benchSpots || []) {
      if (!w.isExplored(b.tx, b.ty)) continue;
      items.push(this.add.text(ox + (b.tx + 0.5) * S * scale, oy + (b.ty + 0.2) * S * scale, '◆', { fontFamily: BODY_FONT, fontSize: '16px', color: '#7cc8ff' }).setOrigin(0.5));
    }
    const me = this.add.circle(ox + (w.player.x / 32) * S * scale, oy + ((w.player.y - 30) / 32) * S * scale, 6, 0xffffff);
    this.tweens.add({ targets: me, scale: 1.6, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
    items.push(me);
    items.push(
      this.add
        .text(WIDTH / 2, HEIGHT - 40, '●  você      ◆  santuário      M / Tab: fechar', { fontFamily: BODY_FONT, fontSize: '18px', color: '#8fa9c9' })
        .setOrigin(0.5),
    );
    items[0].on('pointerdown', () => w.toggleMap());
    this.mapGroup = this.add.container(0, 0, items).setDepth(180);
  }

  // ---------------------------------------------------------------- toque

  bindTouch(controls) {
    if (!this.sys.game.device.input.touch) return;
    this.input.addPointer(4);
    this.controls = controls;
    this.touchUI = this.add.container(0, 0).setDepth(90);
    const button = (x, y, r, label, name) => {
      const c = this.add.circle(x, y, r, 0xffffff, 0.1).setStrokeStyle(2, 0xdff4ff, 0.35).setInteractive();
      const t = this.add.text(x, y, label, { fontFamily: BODY_FONT, fontSize: `${Math.round(r * 0.6)}px`, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8);
      this.touchUI.add([c, t]);
      const set = (v) => () => {
        controls.touch[name] = v;
        c.setFillStyle(0xffffff, v ? 0.3 : 0.1);
      };
      c.on('pointerdown', set(true));
      c.on('pointerup', set(false));
      c.on('pointerout', set(false));
    };
    const py = HEIGHT - 150;
    button(90, py, 50, '◀', 'left');
    button(250, py, 50, '▶', 'right');
    button(170, py - 80, 44, '▲', 'up');
    button(170, py + 80, 44, '▼', 'down');
    button(WIDTH - 90, py + 40, 58, 'Pulo', 'jump');
    button(WIDTH - 220, py + 60, 50, 'Golpe', 'attack');
    button(WIDTH - 150, py - 80, 44, 'Dash', 'dash');
    button(WIDTH - 280, py - 50, 40, 'Cura', 'heal');
    button(WIDTH - 60, 60, 34, 'Mapa', 'map');
    button(WIDTH - 140, 60, 34, 'Falar', 'interact');
  }

  update() {
    if (!this.touchUI) return;
    // durante diálogos os botões somem; tocar na caixa avança a conversa
    const hide = this.modal || this.mapVisible;
    if (hide) for (const k of Object.keys(this.controls.touch)) this.controls.touch[k] = false;
    this.touchUI.setVisible(!hide);
  }
}
