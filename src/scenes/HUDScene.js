import Phaser from 'phaser';
import { setupCamera } from '../view.js';
import { WIDTH, HEIGHT, COMBAT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { AREAS } from '../data/world.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { OptionsPanel } from '../ui/OptionsPanel.js';
import { BOSSBAR } from '../gfx/ui.js';
import { sfx } from '../audio/sfx.js';
import { stopMusic } from '../audio/music.js';

// Interface por cima do mundo: vida, alma, fragmentos, títulos de área,
// diálogos, habilidades novas, mapa e botões de toque.
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    setupCamera(this);
    this.ready = false;
    this.world = null;
    this.abilityOpen = false;
    this.mapVisible = false;
    this.touchUI = null;

    this.add.image(WIDTH / 2, HEIGHT / 2, 'vignette').setDepth(0);
    this.hurtFlash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x2a0010, 0).setDepth(1);

    // vaso de alma + chamas de vida + fragmentos
    this.add.image(70, 76, 'soul-back').setScale(0.5).setDepth(10);
    this.soulFill = this.add.image(70, 76, 'soul-fill').setScale(0.5).setDepth(10);
    this.add.image(70, 76, 'soul-ring').setScale(0.5).setDepth(11);
    this.soulAnim = { v: 0 };
    this.soulFill.setCrop(0, this.soulFill.height, this.soulFill.width, 0);
    this.hearts = [];
    this.geoIcon = this.add.image(128, 112, 'geo').setDepth(10);
    this.geoText = this.add
      .text(146, 112, '0', { fontFamily: BODY_FONT, fontSize: '22px', fontStyle: '700', color: '#fff3cf' })
      .setOrigin(0, 0.5)
      .setShadow(0, 2, '#000', 4, false, true)
      .setDepth(10);

    // título de área
    this.areaTitle = this.add
      .text(WIDTH / 2, 130, '', { fontFamily: TITLE_FONT, fontSize: '50px', color: '#eef7ff', padding: { x: 24, y: 24 } })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7cc8ff', 18, false, true);
    this.areaLine = this.add.image(WIDTH / 2, 172, 'ui-divider').setScale(0.5);
    this.areaGroup = this.add.container(0, 0, [this.areaTitle, this.areaLine]).setDepth(50).setAlpha(0);

    this.dialogue = new DialogueBox(this);

    this.toastText = this.add
      .text(WIDTH / 2, HEIGHT - 70, '', { fontFamily: BODY_FONT, fontSize: '22px', color: '#e6f4ff' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000', 6, false, true)
      .setAlpha(0)
      .setDepth(60);

    this.buildBossBar();
    this.paused = false;

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
    this.setSoul(soul / COMBAT.maxSoul);
  }

  // o vaso enche de baixo para cima (recorte da textura)
  setSoul(t) {
    this.tweens.killTweensOf(this.soulAnim);
    this.tweens.add({
      targets: this.soulAnim,
      v: t,
      duration: 220,
      onUpdate: () => {
        const h = this.soulFill.height;
        const cut = h * (1 - this.soulAnim.v);
        this.soulFill.setCrop(0, cut, this.soulFill.width, h - cut);
      },
    });
  }

  flashDamage() {
    this.hurtFlash.setFillStyle(0x2a0010, 0.55);
    this.tweens.add({ targets: this.hurtFlash, fillAlpha: 0, duration: 450 });
  }

  // --------------------------------------------------------------- textos

  showArea(name) {
    this.areaTitle.setText(name);
    this.areaLine.setDisplaySize(this.areaTitle.width + 70, 10);
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

  // Apresentação do chefe no estilo Hollow Knight: faixas pretas e o nome grande.
  bossIntro(name, subtitle) {
    const bars = [
      this.add.rectangle(WIDTH / 2, -40, WIDTH, 80, 0x000000).setDepth(69),
      this.add.rectangle(WIDTH / 2, HEIGHT + 40, WIDTH, 80, 0x000000).setDepth(69),
    ];
    this.tweens.add({ targets: bars[0], y: 40, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: bars[1], y: HEIGHT - 40, duration: 400, ease: 'Cubic.easeOut' });
    const sub = this.add.text(120, HEIGHT - 250, subtitle, { fontFamily: TITLE_FONT, fontSize: '24px', color: '#d9c2f5' }).setOrigin(0, 0.5);
    const t = this.add
      .text(72, HEIGHT - 190, name, { fontFamily: TITLE_FONT, fontSize: '96px', fontStyle: '700', color: '#ffffff', padding: { x: 40, y: 40 } })
      .setOrigin(0, 0.5)
      .setShadow(0, 0, '#b45cff', 30, false, true);
    const group = this.add.container(0, 0, [sub, t]).setAlpha(0).setDepth(70);
    this.tweens.add({ targets: t, x: 80, duration: 2600 });
    this.tweens.chain({
      targets: group,
      tweens: [
        { alpha: 1, duration: 600 },
        { alpha: 0, duration: 900, delay: 1700 },
      ],
      onComplete: () => group.destroy(),
    });
    this.time.delayedCall(2600, () => {
      this.tweens.add({ targets: bars[0], y: -40, duration: 500, onComplete: () => bars[0].destroy() });
      this.tweens.add({ targets: bars[1], y: HEIGHT + 40, duration: 500, onComplete: () => bars[1].destroy() });
    });
  }

  // Barra de vida do Ender: moldura de ferro com espinhos, rastro do dano e tremida.
  buildBossBar() {
    const cx = WIDTH / 2;
    const cy = HEIGHT - 50;
    const left = cx - BOSSBAR.width / 2;
    const top = cy - BOSSBAR.height / 2;
    const frame = this.add.image(cx, cy, 'bossbar-frame').setScale(0.5);
    this.bbTrail = this.add.image(left + BOSSBAR.fillX, top + BOSSBAR.fillY, 'bossbar-trail').setOrigin(0).setScale(0.5).setAlpha(0.85);
    this.bbFill = this.add.image(left + BOSSBAR.fillX, top + BOSSBAR.fillY, 'bossbar-fill').setOrigin(0).setScale(0.5);
    this.bbGlow = this.add.image(left + BOSSBAR.fillX, top + BOSSBAR.fillY + 7, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb45cff).setScale(0.5).setAlpha(0);
    const name = this.add
      .text(left + BOSSBAR.fillX - 20, top + 14, 'ENDER', { fontFamily: TITLE_FONT, fontSize: '30px', fontStyle: '700', color: '#f1e4ff', padding: { x: 20, y: 20 } })
      .setOrigin(0, 1)
      .setShadow(0, 0, '#b45cff', 16, false, true);
    const sub = this.add
      .text(left + BOSSBAR.fillX + name.width - 20, top - 12, 'Cavaleiro Espectral', { fontFamily: TITLE_FONT, fontSize: '15px', color: '#a98cc9' })
      .setOrigin(0, 1);
    this.bossGroup = this.add.container(0, 0, [frame, this.bbTrail, this.bbFill, this.bbGlow, name, sub]).setDepth(60).setAlpha(0);
    this.bossRatio = 1;
    this.trail = { v: 1 };
  }

  bossBar(show, ratio = this.bossRatio) {
    this.tweens.add({ targets: this.bossGroup, alpha: show ? 1 : 0, duration: show ? 500 : 900 });
    const fullW = this.bbFill.width;
    const dropped = ratio < this.bossRatio;
    this.bossRatio = Math.max(0, ratio);
    this.bbFill.setCrop(0, 0, fullW * this.bossRatio, this.bbFill.height);
    this.bbGlow.setX(this.bbFill.x + (fullW * 0.5) * this.bossRatio);
    if (dropped) {
      // tremida e brilho no ponto do dano; o rastro claro alcança depois
      this.tweens.killTweensOf(this.bossGroup);
      this.bossGroup.setAlpha(1).setX(0);
      this.tweens.add({ targets: this.bossGroup, x: { from: -6, to: 0 }, duration: 160, ease: 'Bounce.easeOut' });
      this.bbGlow.setAlpha(0.9);
      this.tweens.add({ targets: this.bbGlow, alpha: 0, duration: 300 });
      this.tweens.killTweensOf(this.trail);
      this.tweens.add({
        targets: this.trail,
        v: this.bossRatio,
        delay: 450,
        duration: 500,
        ease: 'Cubic.easeIn',
        onUpdate: () => this.bbTrail.setCrop(0, 0, fullW * this.trail.v, this.bbTrail.height),
      });
    } else if (show) {
      this.trail.v = this.bossRatio;
      this.bbTrail.setCrop(0, 0, fullW * this.trail.v, this.bbTrail.height);
    }
  }

  bossPhase() {
    this.cameras.main.flash(200, 120, 40, 200);
    this.tweens.add({ targets: this.bossGroup, scaleY: { from: 1.08, to: 1 }, duration: 300 });
  }

  showAbility(title, text, hint) {
    this.abilityOpen = true;
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x02040a, 0.8);
    const light = this.add.image(WIDTH / 2, HEIGHT / 2 - 80, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7cc8ff).setScale(3);
    const orb = this.add.image(WIDTH / 2, HEIGHT / 2 - 80, 'ability').setScale(0.9);
    const t = this.add.text(WIDTH / 2, HEIGHT / 2 + 30, title, { fontFamily: TITLE_FONT, fontSize: '54px', color: '#ffffff', padding: { x: 24, y: 24 } }).setOrigin(0.5).setShadow(0, 0, '#7cc8ff', 20, false, true);
    const d = this.add.text(WIDTH / 2, HEIGHT / 2 + 96, text, { fontFamily: BODY_FONT, fontSize: '24px', color: '#bcd3ee', fontStyle: 'italic' }).setOrigin(0.5);
    const h = this.add.text(WIDTH / 2, HEIGHT / 2 + 146, hint, { fontFamily: BODY_FONT, fontSize: '22px', color: '#6ff6e0', fontStyle: '700' }).setOrigin(0.5);
    const c = this.add.text(WIDTH / 2, HEIGHT - 50, 'aperte Espaço para continuar', { fontFamily: BODY_FONT, fontSize: '16px', color: '#7f93b3' }).setOrigin(0.5);
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

  // ---------------------------------------------------------------- pausa

  togglePause() {
    if (this.options) return;
    if (this.paused) return this.resumeGame();
    this.paused = true;
    this.scene.pause('World');
    sfx(this, 'ui_select', { volume: 0.5 });
    const cx = WIDTH / 2;
    const items = [this.add.rectangle(cx, HEIGHT / 2, WIDTH, HEIGHT, 0x02040a, 0.7).setInteractive()];
    items.push(this.add.text(cx, 200, 'Pausa', { fontFamily: TITLE_FONT, fontSize: '54px', color: '#eef7ff', padding: { x: 24, y: 24 } }).setOrigin(0.5).setShadow(0, 0, '#7cc8ff', 18, false, true));
    items.push(this.add.image(cx, 250, 'ui-divider').setScale(0.6));
    const entries = [
      ['Continuar', () => this.resumeGame()],
      ['Opções', () => this.openOptions()],
      ['Menu principal', () => this.quitToTitle()],
    ];
    this.pauseItems = entries.map(([label, fn], i) => {
      const t = this.add.text(cx, 320 + i * 64, label, { fontFamily: TITLE_FONT, fontSize: '32px', color: '#8fa9c9' }).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerover', () => this.pauseSelect(i)).on('pointerdown', fn);
      items.push(t);
      return { t, fn };
    });
    this.pauseCursor = this.add.image(0, 0, 'ui-star').setScale(0.5);
    items.push(this.pauseCursor);
    this.pauseGroup = this.add.container(0, 0, items).setDepth(300);
    this.pauseSelect(0, true);
    this.pauseKeys = (e) => {
      if (this.options) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.pauseSelect(this.pauseIndex - 1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.pauseSelect(this.pauseIndex + 1);
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') this.pauseItems[this.pauseIndex].fn();
      else if (e.code === 'Escape') this.resumeGame();
    };
    this.input.keyboard.on('keydown', this.pauseKeys);
  }

  pauseSelect(i, silent) {
    this.pauseIndex = (i + this.pauseItems.length) % this.pauseItems.length;
    this.pauseItems.forEach(({ t }, j) => t.setColor(j === this.pauseIndex ? '#ffffff' : '#8fa9c9'));
    const t = this.pauseItems[this.pauseIndex].t;
    this.pauseCursor.setPosition(t.x - t.width / 2 - 30, t.y);
    if (!silent) sfx(this, 'ui_move', { volume: 0.5 });
  }

  openOptions() {
    sfx(this, 'ui_select', { volume: 0.5 });
    this.options = new OptionsPanel(this, () => {
      this.options = null;
    });
  }

  resumeGame() {
    this.input.keyboard.off('keydown', this.pauseKeys);
    this.pauseGroup?.destroy();
    this.pauseGroup = null;
    this.paused = false;
    this.scene.resume('World');
    this.world?.controls.consume();
  }

  quitToTitle() {
    this.input.keyboard.off('keydown', this.pauseKeys);
    sfx(this, 'ui_select', { volume: 0.5 });
    stopMusic(800);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('World');
      this.scene.start('Title');
    });
  }

  // ---------------------------------------------------------------- toque

  bindTouch(controls) {
    if (!this.sys.game.device.input.touch) return;
    this.input.addPointer(4);
    this.controls = controls;
    this.touchUI = this.add.container(0, 0).setDepth(90);
    const button = (x, y, r, label, name) => {
      const c = this.add.image(x, y, 'touch-btn').setScale(r / 120).setInteractive();
      const t = this.add.text(x, y, label, { fontFamily: BODY_FONT, fontSize: `${Math.round(r * 0.6)}px`, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8);
      this.touchUI.add([c, t]);
      const set = (v) => () => {
        controls.touch[name] = v;
        c.setTint(v ? 0x9fd4ff : 0xffffff);
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
    button(WIDTH - 220, 60, 34, 'Menu', 'pause');
  }

  update() {
    if (!this.touchUI) return;
    // durante diálogos os botões somem; tocar na caixa avança a conversa
    const hide = this.modal || this.mapVisible;
    if (hide) for (const k of Object.keys(this.controls.touch)) this.controls.touch[k] = false;
    this.touchUI.setVisible(!hide);
  }
}
