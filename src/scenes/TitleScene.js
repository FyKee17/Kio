import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { TITLE_FONT, BODY_FONT } from '../fonts.js';
import { loadSave, clearSave, newState } from '../save.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.starting = false;
    this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-sky');
    const rays = this.add.image(WIDTH / 2, HEIGHT / 2, 'bg-rays').setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: rays, alpha: 0.4, duration: 3000, yoyo: true, repeat: -1 });
    this.far = this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'bg-far');
    this.far.tilePositionY = 300;
    this.fog = this.add.tileSprite(WIDTH / 2, HEIGHT / 2 + 120, WIDTH, HEIGHT, 'bg-fog').setAlpha(0.9);
    this.mid = this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'bg-mid');
    this.mid.tilePositionY = 300;

    // saliência de pedra com musgo onde o Kio está
    const g = this.add.graphics();
    g.fillStyle(0x0b111f, 1);
    g.beginPath();
    g.moveTo(WIDTH / 2 - 190, HEIGHT);
    g.lineTo(WIDTH / 2 - 150, 560);
    g.lineTo(WIDTH / 2 + 140, 556);
    g.lineTo(WIDTH / 2 + 200, HEIGHT);
    g.closePath();
    g.fillPath();
    g.lineStyle(6, 0x3fd4b6, 1).lineBetween(WIDTH / 2 - 150, 560, WIDTH / 2 + 140, 556);
    this.add.image(WIDTH / 2, 560, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6ff6e0).setScale(5, 1.2).setAlpha(0.5);

    const halo = this.add.image(WIDTH / 2 - 8, 470, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5fb4ff).setScale(2.4).setAlpha(0.5);
    this.tweens.add({ targets: halo, alpha: 0.25, duration: 1600, yoyo: true, repeat: -1 });
    this.add.sprite(WIDTH / 2, 560, 'kio_idle').setOrigin(0.5, 182 / 192).setScale(1).play('kio-idle');
    this.add.image(WIDTH / 2, HEIGHT / 2, 'fg-leaves').setAlpha(0.9);

    this.add.particles(0, 0, 'soft', {
      x: { min: 0, max: WIDTH },
      y: { min: 0, max: HEIGHT },
      lifespan: { min: 4000, max: 7000 },
      speedY: { min: -20, max: -4 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.35, end: 0.1 },
      alpha: { values: [0, 0.9, 0.9, 0] },
      tint: [0x6ff6e0, 0xc28dff, 0xffd98a],
      blendMode: 'ADD',
      frequency: 110,
    });

    const title = this.add
      .text(WIDTH / 2, 150, 'KIO', { fontFamily: TITLE_FONT, fontSize: '140px', fontStyle: '700', color: '#eef7ff' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7cc8ff', 36, false, true);
    this.tweens.add({ targets: title, y: 160, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(WIDTH / 2, 240, 'a memória do mundo', { fontFamily: TITLE_FONT, fontSize: '26px', color: '#bcd3ee' })
      .setOrigin(0.5);

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
        .text(WIDTH - 230, 470 + i * 52, opt.label, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#e6f4ff' })
        .setOrigin(0.5)
        .setShadow(0, 2, '#000', 8, false, true)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.begin(opt));
      return { text: t, opt };
    });
    this.select(0);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT - 18,
        '←→ andar   Z/Espaço pular   X golpear (↑/↓ mira)   C dash   F curar (segure)   E/↑ falar   M mapa',
        { fontFamily: BODY_FONT, fontSize: '16px', color: '#8fa9c9' },
      )
      .setOrigin(0.5, 1)
      .setShadow(0, 2, '#000', 4, false, true);

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.select(this.selected - 1));
    kb.on('keydown-W', () => this.select(this.selected - 1));
    kb.on('keydown-DOWN', () => this.select(this.selected + 1));
    kb.on('keydown-S', () => this.select(this.selected + 1));
    const go = () => this.begin(this.buttons[this.selected].opt);
    kb.on('keydown-SPACE', go);
    kb.on('keydown-ENTER', go);
    kb.on('keydown-Z', go);

    this.cameras.main.fadeIn(900);
  }

  update(time) {
    this.far.tilePositionX = time * 0.004;
    this.fog.tilePositionX = time * 0.012;
    this.mid.tilePositionX = time * 0.01;
  }

  select(i) {
    const n = this.buttons.length;
    this.selected = (i + n) % n;
    this.buttons.forEach((b, j) => {
      const on = j === this.selected;
      b.text.setText(on ? `◆  ${b.opt.label}  ◆` : b.opt.label);
      b.text.setColor(on ? '#ffffff' : '#8fa9c9');
    });
  }

  begin(opt) {
    if (this.starting) return;
    this.starting = true;
    this.registry.set('state', opt.start());
    this.cameras.main.fadeOut(700, 7, 11, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
