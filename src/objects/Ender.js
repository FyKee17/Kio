import Phaser from 'phaser';
import { TILE } from '../config.js';
import { FEET } from '../data/anims.js';
import { BOLT_VARIANTS, SHOCK_VARIANTS } from '../gfx/fx.js';
import { sfx } from '../audio/sfx.js';

// Ender, o Cavaleiro Espectral — chefe do Santuário da Raiz.
//
// Ele não só persegue: a cada decisão ele "olha" a situação (distância, se o
// Kio está numa plataforma e há quanto tempo, se está apanhando em sequência,
// a própria vida, o que acabou de fazer) e sorteia uma ação com pesos.
// Fases: 1 (100–60%), 2 (60–30%: combos e ondas duplas), 3 (<30%: orbes).

const SCALE = 0.8;
const GRAVITY = 2100;
const ADD = Phaser.BlendModes.ADD;
const PURPLE = 0xb45cff;
const LILAC = 0xe3c8ff;

// tempos de aviso por fase (quanto menor, mais agressivo)
const TELEGRAPH = {
  slash: [430, 340, 280],
  dash: [540, 450, 380],
  crouch: [380, 320, 260],
  cast: [520, 440, 380],
  think: [460, 320, 230],
};

export class Ender extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, arena) {
    super(scene, x, y, 'ender_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.arena = arena; // { left, right, top, floor } em pixels
    this.setOrigin(0.5, FEET.ender).setScale(SCALE).setDepth(12);
    this.body.setSize(70, 170).setOffset(125, 100);
    this.play('ender-idle');

    this.maxHp = 40;
    this.hp = this.maxHp;
    this.alive = true;
    this.contact = false;
    this.state = 'sleep';
    this.stateAt = 0;
    this.stateUntil = 0;
    this.face = -1;
    this.memory = []; // últimas ações
    this.hitLog = [];
    this.highTime = 0; // quanto tempo o Kio está acima dele
    this.nextOrb = 0;
    this.nextBurst = 0;
    this.nextAura = 0;
    this.ignorePlatforms = true;
    this.combo = 0;
    this.swingHit = false;
    this.phaseShown = 1;
    this.setAlpha(0.9);

    this.halo = scene.add.image(x, y, 'glow').setBlendMode(ADD).setTint(PURPLE).setScale(3.2).setAlpha(0.25).setDepth(11);
    this.embers = scene.add.particles(0, 0, 'soft', {
      speedY: { min: -90, max: -30 },
      speedX: { min: -30, max: 30 },
      lifespan: { min: 500, max: 1100 },
      scale: { start: 0.45, end: 0 },
      tint: [PURPLE, LILAC, 0x8a3cff],
      blendMode: 'ADD',
      frequency: 70,
      emitting: false,
    });
    this.embers.setDepth(13);
  }

  // --------------------------------------------------------------- estado

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.6 ? 1 : r > 0.3 ? 2 : 3;
  }

  tele(kind) {
    return TELEGRAPH[kind][this.phase - 1];
  }

  set(state, ms = 0) {
    this.state = state;
    this.stateAt = this.scene.time.now;
    this.stateUntil = this.stateAt + ms;
  }

  wake() {
    this.contact = true;
    this.setAlpha(1);
    this.embers.start();
    this.set('idle', 700);
    sfx(this.scene, 'roar', { volume: 0.9, vary: 0 });
    this.scene.cameras.main.shake(500, 0.006);
  }

  get player() {
    return this.scene.player;
  }

  // --------------------------------------------------------------- laço

  update(time, delta) {
    if (!this.active) return;
    this.halo.setPosition(this.x, this.y - 80);
    this.embers.setPosition(this.x, this.y - 70);
    if (this.state === 'dying') return;
    this.aura(time);
    if (!this.alive || this.state === 'sleep') return;

    const p = this.player;
    const b = this.body;
    const dx = p.x - this.x;
    const adx = Math.abs(dx);
    const above = p.y < this.y - 70;
    this.highTime = above && p.onGround ? this.highTime + delta : Math.max(0, this.highTime - delta * 2);
    this.hitLog = this.hitLog.filter((t) => time - t < 1800);

    // fase 3: orbes de energia saem dele de tempos em tempos
    if (this.phase === 3 && time > this.nextOrb && !p.dead) {
      this.nextOrb = time + 3400;
      this.spawnOrbs(2);
    }
    if (this.phase !== this.phaseShown) {
      this.phaseShown = this.phase;
      this.enrage();
      return;
    }

    const elapsed = time - this.stateAt;
    const done = time >= this.stateUntil;
    switch (this.state) {
      case 'idle':
        this.faceTo(dx);
        b.setVelocityX(b.velocity.x * 0.8);
        this.anim('ender-idle');
        if (done) this.think(adx, above);
        break;

      case 'walk':
        this.faceTo(dx);
        b.setVelocityX(this.face * (this.phase === 1 ? 170 : 220));
        this.anim('ender-walk');
        if (adx < 150 && !above) this.startSlash();
        else if (done) this.think(adx, above);
        break;

      case 'retreat':
        this.anim('ender-air');
        if (elapsed > 150 && b.blocked.down) {
          b.setVelocityX(0);
          // recuou: agora vem com tudo
          if (Math.random() < 0.6) this.startDash();
          else this.set('idle', 200);
        }
        break;

      case 'windup-slash':
        b.setVelocityX(0);
        this.anim('ender-windup');
        if (done) {
          this.set('slash', 260);
          this.swingHit = false;
          b.setVelocityX(this.face * 460);
          this.play('ender-slash');
          sfx(this.scene, 'boss_swing');
        }
        break;

      case 'slash':
        b.setVelocityX(b.velocity.x * 0.88);
        if (elapsed < 170) this.meleeCheck(this.face > 0 ? this.x - 10 : this.x - 220, this.y - 190, 230, 190);
        if (done) {
          if (this.combo > 0) {
            this.combo--;
            this.faceTo(dx);
            this.set('windup-slash', 200);
            this.play('ender-windup');
          } else {
            this.recover(620);
          }
        }
        break;

      case 'windup-dash':
        b.setVelocityX(0);
        this.anim('ender-crouch');
        if (elapsed % 90 < delta) this.miniBolt(this.x + Phaser.Math.Between(-40, 40), this.y - Phaser.Math.Between(20, 140), 0.18);
        if (done) {
          this.set('dash', 650);
          this.swingHit = false;
          this.anims.stop();
          this.setTexture('ender_attack', 18);
          sfx(this.scene, 'dash', { rate: 0.6, volume: 0.9 });
        }
        break;

      case 'dash':
        b.setVelocityX(this.face * (this.phase === 1 ? 760 : 860));
        this.meleeCheck(this.face > 0 ? this.x - 40 : this.x - 150, this.y - 170, 190, 170);
        if (elapsed % 40 < delta) this.ghost();
        if ((this.face > 0 && b.blocked.right) || (this.face < 0 && b.blocked.left) || done) {
          if (b.blocked.left || b.blocked.right) {
            this.scene.cameras.main.shake(200, 0.006);
            sfx(this.scene, 'land', { rate: 0.5 });
          }
          b.setVelocityX(0);
          this.recover(650);
        }
        break;

      case 'crouch':
        b.setVelocityX(0);
        this.anim('ender-crouch');
        if (done) this.launch();
        break;

      case 'air':
        this.anim(b.velocity.y < -150 ? 'ender-rise' : 'ender-air');
        if (this.uppercut && b.velocity.y < 0) this.meleeCheck(this.x - 80, this.y - 300, 160, 300);
        if (elapsed > 150 && b.blocked.down && b.velocity.y >= 0) {
          b.setVelocityX(0);
          this.impact();
          this.play('ender-land');
          this.recover(this.phase === 3 ? 480 : 650);
        }
        break;

      case 'cast':
        b.setVelocityX(0);
        this.anim('ender-raise');
        if (elapsed % 70 < delta) this.miniBolt(this.x + 20 * this.face, this.y - 200, 0.22);
        if (done) this.recover(420);
        break;

      case 'burst-windup':
        b.setVelocityX(0);
        this.setTintFill(Math.floor(elapsed / 60) % 2 ? 0xffffff : LILAC);
        if (done) {
          this.clearTint();
          this.nova();
          this.recover(650);
        }
        break;

      case 'orbs':
        b.setVelocityX(0);
        this.anim('ender-raise');
        if (done) this.recover(380);
        break;

      case 'recover':
        b.setVelocityX(b.velocity.x * 0.85);
        if (!this.anims.isPlaying || this.anims.currentAnim?.key === 'ender-idle') this.anim('ender-idle');
        if (done) this.set('idle', this.tele('think'));
        break;

      case 'stagger':
        b.setVelocityX(0);
        if (done) this.set('idle', 250);
        break;

      default:
        break;
    }
    this.setFlipX(this.face < 0);
  }

  // --------------------------------------------------------------- cabeça

  // Escolhe a próxima ação olhando a situação. Pesos mais altos = mais provável.
  think(adx, above) {
    const p = this.player;
    const now = this.scene.time.now;
    const options = [];
    const add = (name, w) => w > 0 && options.push([name, w]);
    const spamming = this.hitLog.length >= 4;
    const cornered = this.x - this.arena.left < 110 || this.arena.right - this.x < 110;

    if (spamming && now > this.nextBurst) add('burst', 12); // levando combo: explode e afasta
    if (above) {
      // o Kio subiu numa plataforma: não fica embaixo esperando
      add('leap', 5);
      add('uppercut', adx < 170 ? 6 : 0);
      add('cast', this.highTime > 900 ? 7 : 3);
    } else if (adx < 150) {
      add('slash', 6);
      add('retreat', cornered ? 0 : 2);
      add('leap', 1);
    } else if (adx < 420) {
      add('dash', 4);
      add('walk', 3);
      add('leap', 3);
      add('cast', 1);
    } else {
      add('dash', 4);
      add('leap', 4);
      add('cast', 3);
      add('walk', 1);
    }
    if (this.phase === 3 && now > this.nextOrb - 1500) add('orbs', 2);
    if (p.dead) return this.set('idle', 600);

    // não repetir a mesma coisa três vezes seguidas
    const [a, b] = this.memory;
    for (const o of options) {
      if (o[0] === a) o[1] *= 0.5;
      if (o[0] === a && o[0] === b) o[1] = 0;
    }
    let total = options.reduce((s, o) => s + o[1], 0);
    let roll = Math.random() * total;
    let choice = options[0]?.[0] || 'walk';
    for (const [name, w] of options) {
      roll -= w;
      if (roll <= 0) {
        choice = name;
        break;
      }
    }
    this.memory.unshift(choice);
    this.memory.length = 3;

    switch (choice) {
      case 'slash':
        this.startSlash();
        break;
      case 'dash':
        this.startDash();
        break;
      case 'leap':
        this.startLeap(false);
        break;
      case 'uppercut':
        this.startLeap(true);
        break;
      case 'cast':
        this.startCast();
        break;
      case 'burst':
        this.nextBurst = now + 6000;
        this.set('burst-windup', 300);
        sfx(this.scene, 'charge', { rate: 1.4 });
        break;
      case 'orbs':
        this.set('orbs', 700);
        this.nextOrb = now + 3400;
        this.spawnOrbs(3);
        break;
      case 'retreat':
        this.set('retreat', 600);
        this.body.setVelocity(-this.face * 380, -560);
        break;
      default:
        this.set('walk', 900 + Math.random() * 500);
    }
  }

  startSlash() {
    this.faceTo(this.player.x - this.x);
    this.combo = this.phase === 1 ? 0 : this.phase === 2 ? 1 : 2;
    this.set('windup-slash', this.tele('slash'));
    this.play('ender-windup');
    this.glint();
  }

  startDash() {
    this.faceTo(this.player.x - this.x);
    this.set('windup-dash', this.tele('dash'));
    sfx(this.scene, 'charge');
    this.glint();
  }

  startLeap(uppercut) {
    this.uppercut = uppercut;
    this.faceTo(this.player.x - this.x);
    this.set('crouch', this.tele('crouch') * (uppercut ? 0.7 : 1));
    this.play('ender-crouch');
  }

  startCast() {
    const n = this.phase === 1 ? 3 : this.phase === 2 ? 4 : 5;
    this.set('cast', this.tele('cast') + n * 330 + 300);
    this.play('ender-raise');
    sfx(this.scene, 'charge', { rate: 0.8 });
    for (let i = 0; i < n; i++) {
      this.scene.time.delayedCall(this.tele('cast') + i * 330, () => {
        if (!this.alive) return;
        const p = this.player;
        // mira onde o Kio vai estar, não onde está
        const lead = p.body.velocity.x * 0.35;
        this.lightning(Phaser.Math.Clamp(p.x + lead, this.arena.left + 40, this.arena.right - 40));
      });
    }
  }

  // Salto calculado para cair exatamente onde o Kio está (inclusive em plataforma).
  launch() {
    const p = this.player;
    const onPlatform = this.scene.cellAt(p.x, p.y + 4) === '=';
    const tx = Phaser.Math.Clamp(p.x + p.body.velocity.x * 0.25, this.arena.left + 60, this.arena.right - 60);
    const ty = onPlatform || this.uppercut ? p.y : this.arena.floor;
    this.ignorePlatforms = !(onPlatform || this.uppercut);
    const rise = Math.max(0, this.y - ty);
    const apex = Math.max(this.uppercut ? rise + 120 : 220, rise + 150);
    const vy = -Math.sqrt(2 * GRAVITY * apex);
    const tUp = -vy / GRAVITY;
    const tDown = Math.sqrt((2 * (apex - rise)) / GRAVITY);
    const vx = Phaser.Math.Clamp((tx - this.x) / (tUp + tDown), -780, 780);
    this.faceTo(tx - this.x);
    this.body.setVelocity(this.uppercut ? vx * 0.6 : vx, vy);
    this.set('air', 4000);
    sfx(this.scene, 'jump', { rate: 0.55, volume: 0.9 });
    if (this.uppercut) sfx(this.scene, 'boss_swing', { rate: 1.2 });
  }

  recover(ms) {
    this.uppercut = false;
    this.set('recover', ms);
    if (this.anims.currentAnim?.key !== 'ender-land') this.play('ender-recover');
  }

  // Mudou de fase: rugido, raios em volta, breve pausa.
  enrage() {
    this.set('stagger', 900);
    this.body.setVelocityX(0);
    sfx(this.scene, 'roar', { vary: 0 });
    this.scene.cameras.main.shake(600, 0.008);
    this.scene.cameras.main.flash(250, 180, 90, 255);
    for (let i = 0; i < 10; i++) this.scene.time.delayedCall(i * 70, () => this.miniBolt(this.x + Phaser.Math.Between(-90, 90), this.y - Phaser.Math.Between(0, 200), 0.35));
    this.scene.onBossPhase?.(this.phase);
    if (this.phase === 3) this.nextOrb = this.scene.time.now + 1200;
  }

  // --------------------------------------------------------------- golpes

  faceTo(dx) {
    if (Math.abs(dx) > 8) this.face = Math.sign(dx);
  }

  anim(key) {
    if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.play(key, true);
  }

  meleeCheck(x, y, w, h) {
    if (this.swingHit) return;
    const pb = this.player.body;
    if (Phaser.Geom.Intersects.RectangleToRectangle(new Phaser.Geom.Rectangle(x, y, w, h), new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height))) {
      this.swingHit = true;
      this.scene.damagePlayer(this.x);
    }
  }

  hit(fromX) {
    if (!this.alive) return false;
    this.hp--;
    this.hitLog.push(this.scene.time.now);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.state !== 'burst-windup' && this.clearTint());
    this.scene.onBossHit?.(this);
    if (this.state === 'sleep') this.wake();
    if (this.hp <= 0) {
      this.die(fromX);
      return true;
    }
    return false;
  }

  die() {
    this.alive = false;
    this.contact = false;
    this.state = 'dying';
    this.body.setVelocity(0, 0);
    this.clearOrbs();
    this.scene.onEnemyKilled(this);
    sfx(this.scene, 'boss_die', { vary: 0 });
    const cam = this.scene.cameras.main;
    cam.shake(1400, 0.01);
    for (let i = 0; i < 16; i++) {
      this.scene.time.delayedCall(i * 90, () => {
        this.miniBolt(this.x + Phaser.Math.Between(-100, 100), this.y - Phaser.Math.Between(0, 220), 0.5);
        if (i % 4 === 0) sfx(this.scene, 'zap');
      });
    }
    this.scene.time.delayedCall(1500, () => {
      cam.flash(700, 230, 200, 255);
      this.ring(this.x, this.y - 90, 4);
      this.scene.tweens.add({
        targets: [this, this.halo],
        alpha: 0,
        duration: 900,
        onComplete: () => {
          this.embers.destroy();
          this.halo.destroy();
          this.destroy();
        },
      });
    });
  }

  // --------------------------------------------------------------- efeitos

  aura(time) {
    if (this.state === 'sleep' || time < this.nextAura) return;
    const intense = this.phase === 3 ? 0.45 : this.phase === 2 ? 0.7 : 1;
    this.nextAura = time + Phaser.Math.Between(160, 420) * intense;
    this.miniBolt(this.x + Phaser.Math.Between(-55, 55), this.y - Phaser.Math.Between(30, 190), Phaser.Math.FloatBetween(0.1, 0.2));
    this.halo.setAlpha(0.2 + Math.random() * 0.15);
  }

  miniBolt(x, y, scale) {
    const s = this.scene;
    const b = s.add
      .image(x, y, `bolt-${Phaser.Math.Between(0, BOLT_VARIANTS - 1)}`)
      .setBlendMode(ADD)
      .setScale(scale * 0.8, scale)
      .setAngle(Phaser.Math.Between(0, 359))
      .setDepth(14);
    s.tweens.add({ targets: b, alpha: 0, duration: 150, onComplete: () => b.destroy() });
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x + this.face * 50, this.y - 120, 'hitfx').setBlendMode(ADD).setTint(LILAC).setScale(0.2).setDepth(16);
    s.tweens.add({ targets: g, scale: 1.1, alpha: 0, angle: 90, duration: 380, onComplete: () => g.destroy() });
    sfx(s, 'zap', { volume: 0.4, rate: 1.4 });
  }

  ghost() {
    const s = this.scene;
    const g = s.add
      .image(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY)
      .setScale(this.scaleX)
      .setFlipX(this.flipX)
      .setTint(PURPLE)
      .setBlendMode(ADD)
      .setAlpha(0.6)
      .setDepth(11);
    s.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
  }

  ring(x, y, size) {
    const s = this.scene;
    const r = s.add.image(x, y, 'ering').setBlendMode(ADD).setScale(0.15).setDepth(15);
    s.tweens.add({ targets: r, scale: size, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  // Queda do salto: raios de impacto, tremida, anel e ondas de choque pelo chão.
  impact() {
    const s = this.scene;
    const x = this.x;
    const y = this.y;
    sfx(s, 'slam', { vary: 0.03 });
    sfx(s, 'thunder', { volume: 0.7 });
    s.cameras.main.shake(260, 0.009);
    const flash = s.add.image(x, y - 30, 'glow').setBlendMode(ADD).setTint(PURPLE).setScale(5).setDepth(15);
    s.tweens.add({ targets: flash, alpha: 0, scale: 7, duration: 450, onComplete: () => flash.destroy() });
    this.ring(x, y - 10, 2.6);
    // raios saindo do ponto de impacto em leque
    const rays = 7 + this.phase * 2;
    for (let i = 0; i < rays; i++) {
      const angle = 180 + Phaser.Math.Linear(-70, 70, i / (rays - 1)) + Phaser.Math.Between(-8, 8);
      const ray = s.add
        .image(x, y, `bolt-${Phaser.Math.Between(0, BOLT_VARIANTS - 1)}`)
        .setOrigin(0.5, 0)
        .setBlendMode(ADD)
        .setAngle(angle)
        .setScale(Phaser.Math.FloatBetween(0.5, 0.8), Phaser.Math.FloatBetween(0.3, 0.6))
        .setDepth(15);
      s.time.delayedCall(90, () => ray.active && ray.setTexture(`bolt-${Phaser.Math.Between(0, BOLT_VARIANTS - 1)}`));
      s.tweens.add({ targets: ray, alpha: 0, duration: 320, delay: 60, onComplete: () => ray.destroy() });
    }
    const debris = s.add.particles(x, y - 6, 'soft', {
      speedX: { min: -320, max: 320 },
      speedY: { min: -420, max: -80 },
      gravityY: 900,
      lifespan: { min: 400, max: 900 },
      scale: { start: 0.55, end: 0 },
      tint: [PURPLE, LILAC, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    debris.setDepth(15);
    debris.explode(34);
    s.time.delayedCall(1000, () => debris.destroy());
    // ondas de choque: uma para cada lado (duas na fase 2+)
    this.spawnShock(x, y, -1);
    this.spawnShock(x, y, 1);
    if (this.phase >= 2) {
      s.time.delayedCall(260, () => {
        if (!this.alive) return;
        this.spawnShock(x, y, -1);
        this.spawnShock(x, y, 1);
      });
    }
  }

  // Choque que corre pelo chão; sai da plataforma e cai até o chão de baixo.
  spawnShock(x, y, dir) {
    const s = this.scene;
    const w = s.bossFx.create(x + dir * 30, y - 1, 'shock-0');
    w.setOrigin(0.5, 1).setScale(0.85).setBlendMode(ADD).setDepth(15);
    w.body.setSize(36, 56).setOffset(22, 54);
    w.body.setAllowGravity(true);
    w.setVelocity(dir * 440, 0);
    w.setData({ kind: 'shock', dir, born: s.time.now, flicker: 0 });
    sfx(s, 'shock', { volume: 0.5 });
  }

  spawnOrbs(n) {
    const s = this.scene;
    sfx(s, 'orb');
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 200, () => {
        if (!this.alive) return;
        const o = s.bossFx.create(this.x, this.y - 150, 'eorb');
        o.setBlendMode(ADD).setDepth(16).setScale(0.8);
        o.body.setAllowGravity(false).setCircle(14, 22, 22);
        const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.7;
        o.setVelocity(Math.cos(ang) * 260, Math.sin(ang) * 260);
        o.setData({ kind: 'orb', homing: true, born: s.time.now });
      });
    }
  }

  clearOrbs() {
    for (const h of [...this.scene.bossFx.getChildren()]) this.scene.popBossFx(h);
  }

  // Raio que cai do teto no x escolhido, com aviso antes.
  lightning(x) {
    const s = this.scene;
    const top = this.arena.top;
    // primeira superfície abaixo (chão ou plataforma)
    let y = top;
    while (y < this.arena.floor && !s.isFloorAt(x, y + 1)) y += TILE / 2;
    y = Math.min(Math.floor((y + 1) / TILE) * TILE, this.arena.floor);
    const len = y - top;
    const beam = s.add.image(x, top, 'beam').setOrigin(0.5, 0).setBlendMode(ADD).setScale(1, len / 256).setAlpha(0).setDepth(9);
    const sigil = s.add.image(x, y, 'sigil').setBlendMode(ADD).setScale(0.6).setAlpha(0).setDepth(9);
    s.tweens.add({ targets: [beam, sigil], alpha: 1, duration: 480 });
    s.tweens.add({ targets: sigil, scale: 1, duration: 520 });
    s.time.delayedCall(560, () => {
      beam.destroy();
      sigil.destroy();
      sfx(s, 'thunder', { volume: 0.8 });
      s.cameras.main.shake(140, 0.004);
      for (let k = 0; k < 2; k++) {
        const bolt = s.add
          .image(x + (k ? 6 : -6), top, `bolt-${Phaser.Math.Between(0, BOLT_VARIANTS - 1)}`)
          .setOrigin(0.5, 0)
          .setBlendMode(ADD)
          .setScale(1.1, len / 512)
          .setDepth(15);
        s.tweens.add({ targets: bolt, alpha: 0, duration: 380, delay: 80, onComplete: () => bolt.destroy() });
      }
      const flash = s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(PURPLE).setScale(3).setDepth(15);
      s.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
      this.ring(x, y - 4, 1.1);
      const pb = this.player.body;
      if (Math.abs(this.player.x - x) < 40 + pb.width / 2 && pb.bottom > top && pb.top < y) s.damagePlayer(x);
    });
  }

  // Contra-ataque: explosão de raios em volta dele que empurra o Kio.
  nova() {
    const s = this.scene;
    sfx(s, 'thunder');
    sfx(s, 'slam', { rate: 1.4, volume: 0.6 });
    s.cameras.main.shake(220, 0.007);
    this.ring(this.x, this.y - 90, 2.2);
    for (let i = 0; i < 12; i++) {
      const ray = s.add
        .image(this.x, this.y - 90, `bolt-${i % BOLT_VARIANTS}`)
        .setOrigin(0.5, 0)
        .setBlendMode(ADD)
        .setAngle(i * 30 + Phaser.Math.Between(-10, 10))
        .setScale(0.6, 0.38)
        .setDepth(15);
      s.tweens.add({ targets: ray, alpha: 0, duration: 300, onComplete: () => ray.destroy() });
    }
    const p = this.player;
    if (Phaser.Math.Distance.Between(p.x, p.y - 30, this.x, this.y - 90) < 190) s.damagePlayer(this.x);
  }

  // Chamado pela cena a cada quadro para mover orbes e choques.
  updateFx(time) {
    const s = this.scene;
    const p = this.player;
    for (const h of [...s.bossFx.getChildren()]) {
      const age = time - h.getData('born');
      if (h.getData('kind') === 'orb') {
        h.setScale(0.75 + Math.sin(time / 70) * 0.08);
        if (h.getData('homing')) {
          const dx = p.x - h.x;
          const dy = p.y - 45 - h.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 150 || age > 3500) {
            // chegou perto: para de seguir e segue reto (dá chance de desviar)
            h.setData('homing', false);
          } else {
            const speed = 230 + this.phase * 20;
            h.body.velocity.x = Phaser.Math.Linear(h.body.velocity.x, (dx / d) * speed, 0.045);
            h.body.velocity.y = Phaser.Math.Linear(h.body.velocity.y, (dy / d) * speed, 0.045);
          }
        }
        if (age % 50 < 17) this.trail(h.x, h.y);
        if (age > 6000) s.popBossFx(h);
      } else {
        // choque: tremula, solta faísca, mantém a velocidade
        h.body.velocity.x = h.getData('dir') * 440;
        if (time - h.getData('flicker') > 60) {
          h.setData('flicker', time);
          h.setTexture(`shock-${Phaser.Math.Between(0, SHOCK_VARIANTS - 1)}`);
          h.setScale(0.85, Phaser.Math.FloatBetween(0.7, 1.05));
          this.trail(h.x, h.y - 20);
        }
        if (age > 2600) s.popBossFx(h);
      }
    }
  }

  trail(x, y) {
    const s = this.scene;
    const d = s.add.image(x, y, 'soft').setBlendMode(ADD).setTint(PURPLE).setScale(0.6).setDepth(14);
    s.tweens.add({ targets: d, alpha: 0, scale: 0.1, duration: 350, onComplete: () => d.destroy() });
  }
}
