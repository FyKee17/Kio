import Phaser from 'phaser';
import { setupCamera } from '../view.js';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { loadSave, clearSave, newState } from '../save.js';
import { buildTitleArt } from '../gfx/title.js';
import { OptionsPanel } from '../ui/OptionsPanel.js';
import { playMusic, stopMusic } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { currentKeys, keyLabel } from '../controls.js';

const ADD = Phaser.BlendModes.ADD;
const MENU_X = 660;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    setupCamera(this);
    buildTitleArt(this);
    this.starting = false;
    this.overlay = null;
    playMusic('menu');

    // céu, névoa e floresta distante
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-sky');
    const rays = this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-rays').setBlendMode(ADD);
    this.tweens.add({ targets: rays, alpha: 0.35, duration: 3200, yoyo: true, repeat: -1 });
    this.far = this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'bg-far');
    this.far.tilePositionY = 300;
    this.fog = this.add.tileSprite(WIDTH / 2, HEIGHT / 2 + 140, WIDTH, HEIGHT, 'bg-fog').setAlpha(0.9);

    // ruínas com cachoeiras e água à direita
    this.add.image(WIDTH - 410, HEIGHT - 60, 'title-ruins').setOrigin(0.5, 1).setScale(0.5);
    this.falls = [
      this.add.tileSprite(WIDTH - 470, 470, 40, 280, 'title-fall').setAlpha(0.8),
      this.add.tileSprite(WIDTH - 250, 500, 30, 220, 'title-fall').setAlpha(0.7),
    ];
    for (const f of this.falls) this.add.image(f.x, f.y + f.height / 2, 'glow').setBlendMode(ADD).setTint(0x9fd4ff).setScale(1.2, 0.5).setAlpha(0.5);
    const water = this.add.rectangle(WIDTH - 330, HEIGHT - 45, 700, 90, 0x0b1b33, 0.85);
    this.water = this.add.tileSprite(water.x, water.y, 700, 90, 'title-water');
    for (let i = 0; i < 6; i++) {
      const l = this.add.image(Phaser.Math.Between(700, 1250), HEIGHT - Phaser.Math.Between(20, 70), 'glow').setBlendMode(ADD).setTint(0x7cc8ff).setScale(0.3).setAlpha(0.6);
      this.tweens.add({ targets: l, alpha: 0.2, duration: Phaser.Math.Between(900, 1800), yoyo: true, repeat: -1 });
    }

    // árvore com lanternas penduradas à esquerda
    this.add.image(0, 0, 'title-tree').setOrigin(0, 0).setScale(0.5);
    for (const [x, y] of [[150, 150], [210, 175], [300, 120], [365, 160], [440, 110], [95, 230]]) {
      const lan = this.add.image(x, y, 'title-lantern').setOrigin(0.5, 0).setScale(0.5);
      const light = this.add.image(x, y + 22, 'glow').setBlendMode(ADD).setTint(0x6ff6e0).setScale(0.6).setAlpha(0.5);
      this.tweens.add({ targets: lan, angle: { from: -6, to: 6 }, duration: Phaser.Math.Between(1800, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: light, alpha: 0.25, duration: 1400, yoyo: true, repeat: -1 });
    }

    // saliência de musgo com o Kio e a Vovó
    this.add.image(0, HEIGHT, 'title-ledge').setOrigin(0, 1).setScale(0.5);
    const floor = HEIGHT - 190 + 44; // topo do musgo na textura da saliência
    this.add.image(215, floor - 90, 'glow').setBlendMode(ADD).setTint(0x5fb4ff).setScale(3).setAlpha(0.35);
    this.add.sprite(200, floor + 4, 'kio_idle_hd').setOrigin(0.5, 262 / 272).setScale(1.05).play('kio-idle-hd');
    this.add.sprite(380, floor + 6, 'npc_musgo_hd').setOrigin(0.5, 230 / 240).setScale(0.92).play('musgo-idle-hd');
    this.add.image(392, floor - 40, 'glow').setBlendMode(ADD).setTint(0xc8ff8a).setScale(0.8).setAlpha(0.45);

    // vaga-lumes e grama escura nos cantos
    this.add.particles(0, 0, 'soft', {
      x: { min: 0, max: WIDTH },
      y: { min: 0, max: HEIGHT },
      lifespan: { min: 4000, max: 7000 },
      speedY: { min: -18, max: -4 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.35, end: 0.1 },
      alpha: { values: [0, 0.9, 0.9, 0] },
      tint: [0x6ff6e0, 0x9fd4ff, 0xffd98a],
      blendMode: 'ADD',
      frequency: 110,
    });
    this.add.image(-20, HEIGHT + 10, 'title-grass').setOrigin(0, 1).setScale(0.5);
    this.add.image(WIDTH + 20, HEIGHT + 10, 'title-grass').setOrigin(0, 1).setScale(-0.5, 0.5);
    this.add.image(WIDTH / 2, HEIGHT / 2, 'vignette');

    // sombra suave atrás do menu, para ler bem sobre as ruínas
    this.add.image(MENU_X, 420, 'glow').setTint(0x02040a).setScale(3.6, 3.4).setAlpha(0.75);

    // logotipo
    const logo = this.add.image(MENU_X - 15, 140, 'title-logo').setScale(0.5);
    const logoGlow = this.add.image(logo.x, logo.y - 10, 'glow').setBlendMode(ADD).setTint(0x5aa8ff).setScale(4.4, 1.6).setAlpha(0.25);
    this.tweens.add({ targets: logo, y: 146, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: logoGlow, alpha: 0.12, duration: 2400, yoyo: true, repeat: -1 });

    // menu
    this.save = loadSave();
    const entries = [
      { label: 'Iniciar', run: () => this.newGame() },
      { label: 'Continuar', run: () => this.continueGame(), disabled: !this.save },
      { label: 'Opções', run: () => this.openOptions() },
      { label: 'Sair', run: () => this.quit() },
    ];
    this.items = entries.map((e, i) => {
      const y = 330 + i * 72;
      const t = this.add
        .text(MENU_X, y, e.label, { fontFamily: TITLE_FONT, fontSize: '34px', color: '#e6f4ff' })
        .setOrigin(0.5)
        .setShadow(0, 2, '#000', 8, false, true)
        .setInteractive({ useHandCursor: !e.disabled });
      if (i < entries.length - 1) this.add.image(MENU_X, y + 36, 'ui-divider').setScale(0.46).setAlpha(0.7);
      t.on('pointerover', () => !e.disabled && this.select(i));
      t.on('pointerdown', () => !e.disabled && this.choose(i));
      return { t, ...e };
    });
    this.cursor = this.add.image(0, 0, 'ui-star').setScale(0.62);
    this.tweens.add({ targets: this.cursor, angle: 90, duration: 3000, repeat: -1 });
    this.selected = -1;
    this.select(this.save ? 1 : 0, true);

    this.footer = this.add
      .text(WIDTH / 2, HEIGHT - 14, this.controlsText(), {
        fontFamily: BODY_FONT,
        fontSize: '15px',
        color: '#7f93b3',
      })
      .setOrigin(0.5, 1)
      .setShadow(0, 2, '#000', 4, false, true);

    this.input.keyboard.on('keydown', (e) => this.onKey(e.code));
    this.cameras.main.fadeIn(900);
  }

  controlsText() {
    const k = currentKeys();
    const l = (a) => keyLabel(k[a]);
    return `${l('up')}${l('left')}${l('down')}${l('right')} andar · ${l('run')} correr · ${l('jump')} pular · clique atacar · ${l('dash')} dash · ${l('interact')} falar (segure: curar) · ${l('map')} mapa · Esc pausa`;
  }

  update(time) {
    this.far.tilePositionX = time * 0.004;
    this.fog.tilePositionX = time * 0.012;
    for (const f of this.falls) f.tilePositionY -= 3.2;
    this.water.tilePositionX = time * 0.01;
  }

  onKey(code) {
    if (this.overlay || this.starting) return;
    if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
    else if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.choose(this.selected);
  }

  move(dir) {
    let i = this.selected;
    do i = (i + dir + this.items.length) % this.items.length;
    while (this.items[i].disabled);
    this.select(i);
  }

  select(i, silent) {
    if (i === this.selected) return;
    this.selected = i;
    this.items.forEach((it, j) => {
      it.t.setColor(it.disabled ? '#4d5b73' : j === i ? '#ffffff' : '#9fb2cc');
      it.t.setScale(j === i ? 1.06 : 1);
    });
    const t = this.items[i].t;
    this.cursor.setPosition(t.x - t.width / 2 - 34, t.y);
    if (!silent) sfx(this, 'ui_move', { volume: 0.5 });
  }

  choose(i) {
    if (this.overlay || this.starting) return;
    sfx(this, 'ui_select', { volume: 0.6 });
    this.items[i].run();
  }

  newGame() {
    if (!this.save) return this.begin(newState());
    this.confirm('Começar uma nova jornada?', 'O progresso salvo será perdido.', () => {
      clearSave();
      this.begin(newState());
    });
  }

  continueGame() {
    this.begin(this.save);
  }

  begin(state) {
    this.starting = true;
    this.registry.set('state', state);
    stopMusic(900);
    this.cameras.main.fadeOut(900, 7, 11, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }

  openOptions() {
    this.overlay = new OptionsPanel(this, () => {
      this.overlay = null;
      this.footer.setText(this.controlsText());
    });
  }

  confirm(title, text, yes) {
    const items = [];
    items.push(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x02040a, 0.6).setInteractive());
    items.push(this.add.image(WIDTH / 2, HEIGHT / 2, 'ui-panel').setScale(0.5, 0.36));
    items.push(this.add.text(WIDTH / 2, HEIGHT / 2 - 40, title, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#eef7ff' }).setOrigin(0.5));
    items.push(this.add.text(WIDTH / 2, HEIGHT / 2, text, { fontFamily: BODY_FONT, fontSize: '19px', color: '#9fb2cc' }).setOrigin(0.5));
    let group = null;
    let keys = null;
    const close = () => {
      this.input.keyboard.off('keydown', keys);
      group.destroy();
      this.overlay = null;
    };
    const opts = [
      [
        'Sim',
        () => {
          close();
          yes();
        },
      ],
      [
        'Não',
        () => {
          close();
          sfx(this, 'ui_move', { volume: 0.5 });
        },
      ],
    ].map(([label, fn], i) => {
      const t = this.add
        .text(WIDTH / 2 - 70 + i * 140, HEIGHT / 2 + 56, label, { fontFamily: TITLE_FONT, fontSize: '28px', color: '#9fb2cc' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', fn);
      items.push(t);
      return { t, fn };
    });
    let sel = 1;
    const paint = () => opts.forEach((o, j) => o.t.setColor(j === sel ? '#ffffff' : '#7f93b3'));
    paint();
    opts.forEach((o, j) =>
      o.t.on('pointerover', () => {
        sel = j;
        paint();
      }),
    );
    keys = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        sel = 1 - sel;
        paint();
        sfx(this, 'ui_move', { volume: 0.5 });
      } else if (['Enter', 'Space', 'KeyE'].includes(e.code)) opts[sel].fn();
      else if (e.code === 'Escape') opts[1].fn();
    };
    group = this.add.container(0, 0, items).setDepth(400);
    this.overlay = { group };
    this.time.delayedCall(0, () => this.input.keyboard.on('keydown', keys));
  }

  // No navegador não dá para fechar a aba por código: escurece e se despede.
  quit() {
    this.overlay = {};
    stopMusic(1500);
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setDepth(500).setInteractive();
    const bye = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'Até a próxima, chama pequena.', { fontFamily: TITLE_FONT, fontSize: '36px', color: '#cfe6ff' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(501);
    const hint = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 60, 'clique para voltar', { fontFamily: BODY_FONT, fontSize: '16px', color: '#5d6f8a' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(501);
    this.tweens.add({ targets: shade, fillAlpha: 1, duration: 1200 });
    this.tweens.add({ targets: [bye, hint], alpha: 1, duration: 1200, delay: 900 });
    try {
      window.close();
    } catch {
      // aba não fechável: fica na despedida
    }
    this.time.delayedCall(1500, () => {
      const back = () => this.scene.restart();
      shade.on('pointerdown', back);
      this.input.keyboard.once('keydown', back);
    });
  }
}
