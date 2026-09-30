import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';

// Sarkon, o Cavaleiro das Ruínas — chefe final da Cidadela.
//
// Lento para se mexer, rápido para punir. Pensa como o Ender (distância, se o
// Kio está no alto, se está apanhando em sequência), mas com outro repertório:
// combo de espadão (2 a 3 golpes, o último solta ondas de areia), estocada de
// vento que cruza a arena, salto que cai onde o Kio está, guarda que rebate
// quem bate de frente (e contra-ataca), gêiseres de vapor embaixo do Kio
// (fase 2) e, na fase 3, tempestade com redemoinhos e rajadas.
// Golpes de espada tiram 2 de vida. Ele cambaleia se apanhar muito de uma vez.

const SCALE = 0.56;
const AMBER = 0xffb050;
const SAND = 0xffc070;

// tempos de aviso por fase
const TELE = {
  slash: [520, 430, 360],
  thrust: [620, 520, 440],
  crouch: [460, 380, 320],
  think: [520, 380, 260],
};

export class RuinKnight extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, arena) {
    super(scene, x, y, 'rknight', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.arena = arena;
    this.isBoss = true;
    this.setOrigin(180 / 400, 364 / 380).setScale(SCALE).setDepth(12);
    this.body.setSize(120, 250).setOffset(120, 114);
    this.maxHp = 360;
    this.hp = this.maxHp;
    this.geo = 120;
    this.alive = true;
    this.contact = false;
    this.state = 'sleep';
    this.stateUntil = 0;
    this.face = -1;
    this.memory = [];
    this.hitLog = [];
    this.poise = [];
    this.ignorePlatforms = true;
    this.phaseShown = 1;
    this.nextGust = 0;
    this.combo = [];
    this.play('rknight-idle');
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(AMBER).setScale(3.4).setAlpha(0.15).setDepth(11);
    this.dust = scene.add.particles(0, 0, 'soft', {
      speedY: { min: -60, max: -20 },
      speedX: { min: -30, max: 30 },
      lifespan: 700,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: [0xe8fbff, 0xffe0c0],
      frequency: 110,
      emitting: false,
    });
    this.dust.setDepth(13);
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.6 ? 1 : r > 0.3 ? 2 : 3;
  }

  get player() {
    return this.scene.player;
  }

  tele(kind) {
    return TELE[kind][this.phase - 1];
  }

  set(state, ms, frame) {
    this.state = state;
    this.stateAt = this.scene.time.now;
    this.stateUntil = this.scene.time.now + ms;
    if (frame !== undefined) {
      this.anims.stop();
      this.setFrame(frame);
    }
  }

  wake() {
    if (this.state !== 'sleep') return;
    this.dust.start();
    this.roar();
    this.set('roar', 1400, 6);
  }

  roar() {
    sfx(this.scene, 'knight_roar', { vary: 0 });
    this.scene.cameras.main.shake(700, 0.008);
    this.ring(this.x, this.y - 120, AMBER, 3.5, 0.6);
  }

  // ------------------------------------------------------------ laço

  update(time, delta) {
    if (!this.alive || this.state === 'sleep') {
      this.syncFx();
      return;
    }
    const b = this.body;
    const p = this.player;
    const dx = p.x - this.x;
    this.hitLog = this.hitLog.filter((t) => time - t < 1800);
    this.poise = this.poise.filter((e) => time - e.t < 3000);

    // troca de fase: ruge (e na 3 chama a tempestade)
    if (this.phase > this.phaseShown && ['idle', 'walk', 'recover'].includes(this.state)) {
      this.phaseShown = this.phase;
      b.setVelocityX(0);
      this.roar();
      this.scene.onBossPhase?.(this.phase);
      this.set('roar', 1200, 6);
      if (this.phase === 3) this.scene.time.delayedCall(600, () => this.alive && this.summonStorm());
      return;
    }
    if (this.phase === 3 && time > this.nextGust) {
      this.nextGust = time + 5200;
      this.scene.gust?.(Math.sign(this.x - p.x) || 1, 150, 1300);
    }

    const s = this.state;
    if (s === 'roar' || s === 'stagger' || s === 'recover') {
      b.setVelocityX(b.velocity.x * 0.85);
      if (time > this.stateUntil) this.idle(time);
    } else if (s === 'idle') {
      b.setVelocityX(0);
      this.faceTo(dx);
      if (time > this.stateUntil) this.think(time);
    } else if (s === 'walk') {
      this.faceTo(dx);
      b.setVelocityX(this.face * (this.phase === 3 ? 170 : 130));
      if (this.anims.currentAnim?.key !== 'rknight-walk' || !this.anims.isPlaying) this.play('rknight-walk', true);
      if (Math.abs(dx) < 190 || time > this.stateUntil) this.startCombo(time);
    } else if (s === 'windup') {
      b.setVelocityX(0);
      if (time > this.stateUntil) {
        this.set('slash', 160, 7);
        this.swingHit = false;
        b.setVelocityX(this.face * 260);
        sfx(this.scene, 'boss_swing', { rate: 0.8 });
        this.slashArc();
      }
    } else if (s === 'slash') {
      this.melee(this.face > 0 ? this.x + 10 : this.x - 200, this.y - 210, 190, 210, 2);
      if (time > this.stateUntil) {
        if (this.slamNext) {
          this.slamNext = false;
          this.impact(this.x + this.face * 110, 0.8);
        }
        this.nextComboStep(time);
      }
    } else if (s === 'thrust-tele') {
      b.setVelocityX(-this.face * 30);
      if (Math.random() < 0.5) this.spark(this.x + this.face * 100, this.y - 90, 0xffffff);
      if (time > this.stateUntil) {
        this.set('thrust', 520, 8);
        this.swingHit = false;
        sfx(this.scene, 'wind_slash', { rate: 0.6 });
        sfx(this.scene, 'dash', { rate: 0.6 });
      }
    } else if (s === 'thrust') {
      b.setVelocityX(this.face * 900);
      this.afterimage();
      this.melee(this.face > 0 ? this.x : this.x - 240, this.y - 150, 240, 110, 2);
      const wall = this.face > 0 ? this.x > this.arena.right - 120 : this.x < this.arena.left + 120;
      if (time > this.stateUntil || wall || b.blocked.left || b.blocked.right) {
        b.setVelocityX(this.face * 120);
        this.set('recover', this.phase === 3 ? 420 : 620, 8);
      }
    } else if (s === 'crouch') {
      b.setVelocityX(0);
      if (time > this.stateUntil) this.leap();
    } else if (s === 'air') {
      if (b.velocity.y > 0) this.setFrame(7);
      if (b.blocked.down && time - this.stateAt > 150) {
        b.setVelocityX(0);
        this.impact(this.x + this.face * 60, 1);
        this.set('recover', 650, 7);
      }
    } else if (s === 'guard') {
      b.setVelocityX(0);
      this.faceTo(dx);
      if (time > this.stateUntil) this.idle(time);
    } else if (s === 'counter') {
      if (time > this.stateUntil) {
        this.set('slash', 160, 7);
        this.swingHit = false;
        b.setVelocityX(this.face * 320);
        sfx(this.scene, 'boss_swing', { rate: 1 });
        this.slashArc();
        this.combo = [];
      }
    } else if (s === 'plant') {
      b.setVelocityX(0);
      if (time > this.stateUntil) this.set('recover', 500, 7);
    }
    this.syncFx();
  }

  syncFx() {
    this.halo.setPosition(this.x, this.y - 110);
    this.dust.setPosition(this.x, this.y - 40);
    this.setFlipX(this.face < 0);
  }

  faceTo(dx) {
    if (Math.abs(dx) > 12) this.face = Math.sign(dx);
  }

  idle(time) {
    this.set('idle', this.tele('think') + Math.random() * 200);
    this.play('rknight-idle', true);
    void time;
  }

  // ------------------------------------------------------------ decisões

  think(time) {
    const p = this.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const high = p.y < this.y - 120; // Kio numa plataforma
    const spam = this.hitLog.length >= 3;
    const last = this.memory[this.memory.length - 1];
    const w = {
      walk: dist > 220 ? 3 : 0.5,
      combo: dist < 260 ? 3.2 : 0.4,
      thrust: dist > 260 ? 2.4 : 0.8,
      leap: high ? 4 : dist > 380 ? 1.6 : 0.6,
      guard: spam ? 4 : 0.5,
      plant: this.phase >= 2 ? (high ? 2.2 : 1.4) : 0,
    };
    if (last && w[last]) w[last] *= 0.35;
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    let pick = 'walk';
    for (const [k, v] of Object.entries(w)) {
      r -= v;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    this.memory.push(pick);
    if (this.memory.length > 4) this.memory.shift();
    this.faceTo(dx);
    if (pick === 'walk') this.set('walk', 1300);
    else if (pick === 'combo') this.startCombo(time);
    else if (pick === 'thrust') {
      this.set('thrust-tele', this.tele('thrust'), 8);
      sfx(this.scene, 'charge', { volume: 0.7, rate: 0.8 });
    } else if (pick === 'leap') {
      this.set('crouch', this.tele('crouch'), 9);
      sfx(this.scene, 'charge', { volume: 0.5, rate: 0.6 });
    } else if (pick === 'guard') {
      this.set('guard', 1100, 11);
      sfx(this.scene, 'clang', { volume: 0.5, rate: 0.8 });
    } else if (pick === 'plant') this.plant();
  }

  startCombo() {
    const n = this.phase === 1 ? 2 : 3;
    this.combo = Array.from({ length: n }, (_, i) => (i === n - 1 ? 'slam' : 'slash'));
    this.nextComboStep();
  }

  nextComboStep() {
    const step = this.combo.shift();
    if (!step) {
      this.set('recover', this.phase === 3 ? 380 : 560, 7);
      return;
    }
    this.faceTo(this.player.x - this.x);
    this.slamNext = step === 'slam';
    // o último golpe demora mais a descer (e solta as ondas de areia)
    this.set('windup', this.tele('slash') * (step === 'slam' ? 1.25 : 0.85), 6);
    sfx(this.scene, 'charge', { volume: 0.35, rate: 1.4 });
  }

  leap() {
    const p = this.player;
    const b = this.body;
    const T = 0.8;
    const g = this.scene.physics.world.gravity.y;
    const onPlat = this.scene.standingOnPlatform?.(p);
    this.ignorePlatforms = !onPlat;
    const tx = Phaser.Math.Clamp(p.x, this.arena.left + 60, this.arena.right - 60);
    const ty = onPlat ? p.y : this.arena.floor;
    const vy = (ty - this.y - 0.5 * g * T * T) / T;
    b.setVelocity((tx - this.x) / T, Math.min(vy, -700));
    this.set('air', 3000, 10);
    sfx(this.scene, 'jump', { rate: 0.5 });
    this.scene.time.delayedCall(900, () => (this.ignorePlatforms = true));
  }

  // Crava a espada: o chão ferve e gêiseres de vapor sobem embaixo do Kio.
  plant() {
    const s = this.scene;
    this.set('plant', 1500, 7);
    sfx(s, 'slam', { volume: 0.6, rate: 1.2 });
    this.impactDust(this.x + this.face * 80);
    const n = this.phase === 3 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(250 + i * 380, () => {
        if (!this.alive) return;
        const p = this.player;
        const x = Phaser.Math.Clamp(p.x, this.arena.left + 30, this.arena.right - 30);
        this.geyser(x, this.surfaceBelow(x, p.y));
      });
    }
  }

  surfaceBelow(x, fromY) {
    let y = Math.max(this.arena.top, fromY - 10);
    while (y < this.arena.floor && !this.scene.isFloorAt(x, y + 1)) y += 16;
    return Math.min(Math.floor((y + 1) / 32) * 32, this.arena.floor);
  }

  geyser(x, y) {
    const s = this.scene;
    const warn = s.add.image(x, y + 2, 'vent-hot').setOrigin(0.5, 1).setScale(0.5).setAlpha(0).setDepth(15);
    s.tweens.add({ targets: warn, alpha: 1, duration: 150 });
    const bub = s.add.particles(x, y - 4, 'soft', {
      speedY: { min: -90, max: -30 },
      speedX: { min: -30, max: 30 },
      lifespan: 400,
      scale: { start: 0.4, end: 0.8 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xffe0d0,
      frequency: 40,
    });
    bub.setDepth(16);
    sfx(s, 'steam_warn', { volume: 0.5 });
    s.time.delayedCall(560, () => {
      bub.destroy();
      sfx(s, 'steam', { volume: 0.7 });
      const col = s.add.particles(x, y - 4, 'soft', {
        speedY: { min: -900, max: -600 },
        speedX: { min: -40, max: 40 },
        lifespan: 380,
        scale: { start: 1.1, end: 2.4 },
        alpha: { start: 0.65, end: 0 },
        tint: [0xffffff, 0xffe0c8],
        frequency: 14,
      });
      col.setDepth(18);
      let hit = false;
      const check = s.time.addEvent({
        delay: 50,
        repeat: 10,
        callback: () => {
          const p = this.player;
          if (!hit && Math.abs(p.x - x) < 44 && p.y > y - 230 && p.y - 60 < y) {
            hit = true;
            s.damagePlayer(x);
          }
        },
      });
      s.time.delayedCall(600, () => {
        check.remove();
        col.stop();
        s.tweens.add({ targets: warn, alpha: 0, duration: 300, onComplete: () => warn.destroy() });
        s.time.delayedCall(500, () => col.destroy());
      });
    });
  }

  summonStorm() {
    const s = this.scene;
    const a = this.arena;
    s.hud?.toast('A areia responde ao Cavaleiro.');
    for (const x of [a.left + 140, a.right - 140]) s.spawnArenaTornado?.(x, a.floor);
  }

  // ------------------------------------------------------------ golpes

  melee(x, y, w, h, dmg) {
    if (this.swingHit) return;
    const pb = this.player.body;
    if (Phaser.Geom.Intersects.RectangleToRectangle(new Phaser.Geom.Rectangle(x, y, w, h), new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height))) {
      this.swingHit = true;
      this.scene.damagePlayer(this.x, dmg);
    }
  }

  slashArc() {
    const s = this.scene;
    const arc = s.add.image(this.x + this.face * 110, this.y - 110, 'slash').setBlendMode(Phaser.BlendModes.ADD).setTint(SAND).setScale(1.1).setFlipX(this.face < 0).setDepth(14);
    s.tweens.add({ targets: arc, alpha: 0, scaleX: 1.3, duration: 220, onComplete: () => arc.destroy() });
  }

  // Espadada no chão: tremida, poeira e duas ondas de areia correndo pelo chão.
  impact(x, power) {
    const s = this.scene;
    sfx(s, 'slam', { volume: 0.9 });
    s.cameras.main.shake(260 * power, 0.012 * power);
    this.impactDust(x);
    this.ring(x, this.y - 10, SAND, 1.6 * power, 0.35);
    for (const dir of [-1, 1]) this.spawnShock(x, this.y, dir);
  }

  impactDust(x) {
    const s = this.scene;
    const e = s.add.particles(x, this.y - 6, 'soft', {
      speedX: { min: -300, max: 300 },
      speedY: { min: -300, max: -60 },
      gravityY: 700,
      lifespan: 700,
      scale: { start: 0.8, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xe0b070, 0xc08a58],
      emitting: false,
    });
    e.setDepth(16);
    e.explode(26);
    s.time.delayedCall(800, () => e.destroy());
  }

  spawnShock(x, y, dir) {
    const s = this.scene;
    const w = s.bossFx.create(x + dir * 30, y - 1, 'airwave');
    w.setOrigin(0.5, 1).setScale(0.7).setTint(SAND).setBlendMode(Phaser.BlendModes.ADD).setDepth(15).setFlipX(dir < 0);
    w.body.setSize(50, 60).setOffset(35, 50);
    w.body.setAllowGravity(true);
    w.setVelocity(dir * 400, 0);
    w.setData({ kind: 'shock', dir, speed: 400, born: s.time.now, flicker: 0 });
  }

  updateFx(time) {
    const s = this.scene;
    for (const h of [...s.bossFx.getChildren()]) {
      if (h.getData('kind') !== 'shock') continue;
      h.body.velocity.x = h.getData('dir') * h.getData('speed');
      if (time - h.getData('flicker') > 70) {
        h.setData('flicker', time);
        h.setScale(0.7, Phaser.Math.FloatBetween(0.6, 0.85));
        this.spark(h.x, h.y - 20, SAND);
      }
      if (time - h.getData('born') > 2400) s.popBossFx(h);
    }
  }

  // ------------------------------------------------------------ vida

  guards(fromX, dir) {
    return this.state === 'guard' && dir !== 'down' && Math.sign(fromX - this.x) === this.face;
  }

  // Bateu na guarda: rebate e contra-ataca na hora.
  onBlocked() {
    this.set('counter', 150, 6);
    sfx(this.scene, 'charge', { volume: 0.5, rate: 1.8 });
  }

  hit(fromX, dir, dmg = 5, opts = {}) {
    if (!this.alive) return false;
    this.hp -= dmg;
    const now = this.scene.time.now;
    if (!opts.dot) this.hitLog.push(now);
    this.poise.push({ t: now, d: dmg });
    this.setTintFill(opts.dot ? 0xffb070 : 0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    this.scene.onBossHit?.(this);
    if (this.state === 'sleep') this.wake();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    // apanhou muito de uma vez: cambaleia (janela para bater)
    const taken = this.poise.reduce((a, e) => a + e.d, 0);
    if (taken >= 55 && !['stagger', 'air', 'roar'].includes(this.state)) {
      this.poise = [];
      this.combo = [];
      this.body.setVelocityX(-this.face * 160);
      this.set('stagger', 1100, 12);
      sfx(this.scene, 'clang', { rate: 0.6 });
    }
    return false;
  }

  die() {
    const s = this.scene;
    this.alive = false;
    this.state = 'dead';
    this.body.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame(12);
    for (const h of [...s.bossFx.getChildren()]) s.popBossFx(h);
    s.onEnemyKilled(this);
    sfx(s, 'knight_roar', { rate: 0.6, vary: 0 });
    s.cameras.main.shake(1800, 0.01);
    // ajoelha e vira areia, de baixo para cima
    for (let i = 0; i < 14; i++) {
      s.time.delayedCall(i * 110, () => {
        s.burst(this.x + Phaser.Math.Between(-60, 60), this.y - i * 14, 0xe0b070, 8);
        if (i % 3 === 0) sfx(s, 'worm_burst', { volume: 0.4, rate: 1.4 });
      });
    }
    s.time.delayedCall(1600, () => {
      sfx(s, 'boss_die', { vary: 0 });
      s.cameras.main.flash(900, 255, 230, 190);
      this.ring(this.x, this.y - 100, AMBER, 4, 0.8);
      this.dust.stop();
      s.tweens.add({
        targets: [this, this.halo],
        alpha: 0,
        duration: 1200,
        onComplete: () => {
          this.dust.destroy();
          this.halo.destroy();
          this.destroy();
        },
      });
    });
  }

  // ------------------------------------------------------------ efeitos

  ring(x, y, color, scale, secs) {
    const s = this.scene;
    const r = s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(0.1).setDepth(15);
    s.tweens.add({ targets: r, scale, alpha: 0, duration: secs * 1000, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  spark(x, y, color) {
    const s = this.scene;
    const d = s.add.image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-8, 8), 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(0.5).setDepth(15);
    s.tweens.add({ targets: d, alpha: 0, scale: 0.05, duration: 300, onComplete: () => d.destroy() });
  }

  afterimage() {
    const s = this.scene;
    const g = s.add.image(this.x, this.y, this.texture.key, this.frame.name).setOrigin(this.originX, this.originY).setScale(this.scaleX, this.scaleY).setFlipX(this.flipX).setTint(SAND).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setDepth(11);
    s.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }
}
