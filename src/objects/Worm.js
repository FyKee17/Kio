import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';

// Ixtara, a Fome das Dunas — a Minhoca gigante do Ninho.
//
// Ela vive debaixo da areia da arena: o rastro de poeira no chão mostra por
// onde anda. Ataques: salto em arco (sai onde o Kio está), investida rasteira
// saindo da parede (pule por cima), cabeça para fora cuspindo pedras (a melhor
// hora para bater), e caçada por baixo da areia com erupções (fase 2+).
// Fase 3 (<35%): mais rápida, pedras caem do teto a cada mergulho.
// Só as partes fora da areia levam golpe e machucam.

const SEGMENTS = 12;
const SPACING = 50;
const HEAD_SCALE = 0.62;
const SEG_SCALE = 0.5;
const AMBER = 0xffb050;
const SAND = 0xe0b070;

export class Worm extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, arena) {
    super(scene, x, y, 'worm-head', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.enable = false;
    this.arena = arena;
    this.isBoss = true;
    this.maxHp = 280;
    this.hp = this.maxHp;
    this.alive = true;
    this.contact = false;
    this.geo = 60;
    this.state = 'sleep';
    this.stateUntil = 0;
    this.memory = [];
    this.nextContact = 0;
    this.setScale(HEAD_SCALE).setDepth(13).setOrigin(0.43, 0.5);

    // cabeça começa enterrada no meio da arena
    this.hx = (arena.left + arena.right) / 2;
    this.hy = arena.floor + 260;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.trail = [];
    for (let i = 0; i <= SEGMENTS * SPACING + 40; i += 4) this.trail.push({ x: this.hx, y: this.hy + i });

    // só aparece o que está acima da areia
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff);
    g.fillRect(arena.left - 200, arena.top - 400, arena.right - arena.left + 400, arena.floor - arena.top + 400 + 8);
    const mask = g.createGeometryMask();
    this.setMask(mask);
    this.parts = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const last = i === SEGMENTS - 1;
      const seg = scene.add.image(this.hx, this.hy, last ? 'worm-tail' : 'worm-seg').setScale(last ? 0.5 : SEG_SCALE * (1 - i * 0.025)).setDepth(12 - i * 0.01);
      seg.setMask(mask);
      this.parts.push(seg);
    }
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(AMBER).setScale(3).setAlpha(0).setDepth(11);
    this.halo.setMask(mask);
    this.syncParts();
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.6 ? 1 : r > 0.35 ? 2 : 3;
  }

  get player() {
    return this.scene.player;
  }

  // ------------------------------------------------------------ estados

  wake() {
    if (this.state !== 'sleep') return;
    const a = this.arena;
    this.hx = (a.left + a.right) / 2 + 120;
    this.hy = a.floor + 200;
    this.rumble(this.hx, 700);
    this.set('rise', 700, { x: this.hx, vx: 0, vy: -1350, g: 1500, roar: true });
  }

  set(state, ms, data = {}) {
    this.state = state;
    this.stateAt = this.scene.time.now;
    this.stateUntil = this.scene.time.now + ms;
    this.data_ = data;
  }

  update(time, delta) {
    if (this.state === 'sleep' || this.state === 'dead') return;
    const dt = Math.min(delta, 40) / 1000;
    const a = this.arena;
    const p = this.player;
    const fast = this.phase === 3 ? 1.25 : this.phase === 2 ? 1.1 : 1;
    const d = this.data_;

    if (this.state === 'under') {
      // anda por baixo da areia até o ponto escolhido (poeira no chão avisa)
      const dx = d.x - this.hx;
      this.vx = Math.sign(dx) * Math.min(Math.abs(dx) / dt, 520 * fast);
      this.hx += this.vx * dt;
      this.hy = Phaser.Math.Linear(this.hy, a.floor + 170, 0.1);
      this.surfaceDust(time, 90);
      if (Math.abs(dx) < 8 || time > this.stateUntil) this.act(time);
    } else if (this.state === 'rise') {
      // aviso: a areia borbulha onde ela vai sair
      this.hx = d.x;
      this.hy = Phaser.Math.Linear(this.hy, a.floor + 150, 0.1);
      this.surfaceDust(time, 40, 2);
      if (time > this.stateUntil) {
        this.vx = d.vx;
        this.vy = d.vy;
        this.gravity = d.g;
        this.set('air', 6000, { lunge: d.lunge });
        sfx(this.scene, d.roar ? 'worm_roar' : 'worm_burst', { vary: 0.05 });
        this.scene.cameras.main.shake(d.roar ? 500 : 220, d.roar ? 0.012 : 0.006);
        this.sandSplash(this.hx, 26);
        this.setFrame(d.roar ? 2 : 1);
        if (d.roar) this.scene.time.delayedCall(900, () => this.state !== 'dead' && this.setFrame(0));
      }
    } else if (this.state === 'air') {
      this.vy += this.gravity * dt;
      this.hx += this.vx * dt;
      this.hy += this.vy * dt;
      // bate nas paredes da arena: escorrega de volta
      if (this.hx < a.left + 40 || this.hx > a.right - 40) {
        this.vx *= -0.4;
        this.hx = Phaser.Math.Clamp(this.hx, a.left + 40, a.right - 40);
      }
      if (this.hy > a.floor + 40 && this.vy > 0 && !this.dived) {
        this.dived = true;
        this.sandSplash(this.hx, 20);
        sfx(this.scene, 'worm_burst', { volume: 0.7, rate: 0.8 });
        if (this.phase === 3) this.dropRocks(2);
      }
      if (this.hy > a.floor + 280) {
        this.dived = false;
        this.set('under', 900, { x: this.hx });
        this.think(time);
      }
    } else if (this.state === 'peek') {
      // cabeça para fora, cuspindo pedras no Kio
      const up = time - this.stateAt < 500;
      const down = time > this.stateUntil - 450;
      const targetY = down ? a.floor + 200 : a.floor - 70;
      this.hy = Phaser.Math.Linear(this.hy, targetY, up ? 0.08 : 0.12);
      this.hx = d.x + Math.sin(time / 160) * 6;
      this.vx = Math.sign(p.x - this.hx) * 10;
      this.vy = -40;
      if (!up && !down && time > d.nextSpit) {
        d.nextSpit = time + (this.phase === 3 ? 330 : 440);
        this.spit();
      }
      if (time > this.stateUntil) {
        this.setFrame(0);
        this.set('under', 800, { x: this.hx });
        this.think(time);
      }
    } else if (this.state === 'hunt') {
      // caça por baixo: segue o Kio e a areia explode por onde passa
      const dx = p.x - this.hx;
      this.vx = Phaser.Math.Linear(this.vx, Math.sign(dx) * 380 * fast, 0.08);
      this.hx = Phaser.Math.Clamp(this.hx + this.vx * dt, a.left + 60, a.right - 60);
      this.hy = Phaser.Math.Linear(this.hy, a.floor + 120, 0.1);
      this.surfaceDust(time, 50, 2);
      if (time > d.nextErupt) {
        d.nextErupt = time + 300;
        this.erupt(this.hx);
      }
      if (time > this.stateUntil) this.leapAt(p.x, time, 450);
    }

    this.recordTrail();
    this.syncParts(time);
    this.checkContact(time);
  }

  // Escolhe o próximo ataque (com memória para não repetir demais).
  think() {
    const p = this.player;
    const a = this.arena;
    const ph = this.phase;
    const last = this.memory[this.memory.length - 1];
    const opts = [
      ['leap', 3],
      ['peek', ph === 1 ? 2.5 : 2],
      ['lunge', 1.5 + ph * 0.5],
      ['hunt', ph >= 2 ? 2.5 : 0],
    ].map(([k, w]) => [k, k === last ? w * 0.3 : w]);
    let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0);
    let pick = opts[0][0];
    for (const [k, w] of opts) {
      r -= w;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    this.memory.push(pick);
    if (this.memory.length > 4) this.memory.shift();
    this.next = pick;
    if (pick === 'lunge') {
      // vai para o lado da arena mais longe do Kio
      const side = p.x < (a.left + a.right) / 2 ? 1 : -1;
      this.data_.x = side > 0 ? a.right - 90 : a.left + 90;
      this.data_.side = side;
    } else if (pick === 'peek') {
      const off = Phaser.Math.Between(220, 340) * (Math.random() < 0.5 ? -1 : 1);
      this.data_.x = Phaser.Math.Clamp(p.x + off, a.left + 120, a.right - 120);
    } else {
      this.data_.x = Phaser.Math.Clamp(p.x, a.left + 80, a.right - 80);
    }
  }

  act(time) {
    const p = this.player;
    const fast = this.phase === 3 ? 0.75 : this.phase === 2 ? 0.88 : 1;
    if (this.next === 'peek') {
      this.set('peek', 2300, { x: this.hx, nextSpit: time + 700 });
      this.rumble(this.hx, 400);
      sfx(this.scene, 'worm_burst', { volume: 0.5, rate: 1.3 });
      this.setFrame(1);
    } else if (this.next === 'lunge') {
      const side = this.data_.side;
      this.rumble(this.hx, 650 * fast);
      this.set('rise', 650 * fast, { x: this.hx, vx: -side * 860, vy: -560, g: 900, lunge: true });
    } else if (this.next === 'hunt') {
      this.rumble(this.hx, 300);
      sfx(this.scene, 'rumble', { volume: 0.7 });
      this.set('hunt', 2200, { nextErupt: time + 400 });
    } else {
      this.leapAt(p.x, time, 620 * fast);
    }
  }

  leapAt(x, time, tele) {
    const a = this.arena;
    const tx = Phaser.Math.Clamp(x, a.left + 80, a.right - 80);
    this.hx = tx;
    this.rumble(tx, tele);
    // sobe quase reto e cai do outro lado do Kio
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.set('rise', tele, { x: tx, vx: dir * 240, vy: -1250 - this.phase * 60, g: 1500 });
  }

  // ------------------------------------------------------------ corpo

  recordTrail() {
    const head = this.trail[0];
    const dist = Math.hypot(this.hx - head.x, this.hy - head.y);
    if (dist < 1) return;
    // insere pontos a cada 4px para o corpo seguir o caminho da cabeça
    const n = Math.ceil(dist / 4);
    const pts = [];
    for (let i = n; i >= 1; i--) pts.push({ x: head.x + ((this.hx - head.x) * i) / n, y: head.y + ((this.hy - head.y) * i) / n });
    this.trail.unshift(...pts);
    const max = (SEGMENTS * SPACING) / 4 + 20;
    if (this.trail.length > max) this.trail.length = max;
  }

  syncParts(time = 0) {
    this.setPosition(this.hx, this.hy);
    const t1 = this.trail[Math.min(3, this.trail.length - 1)];
    const ang = Math.atan2(this.hy - t1.y, this.hx - t1.x);
    this.setRotation(Math.abs(Math.cos(ang)) < 0.01 && Math.abs(Math.sin(ang)) < 0.01 ? this.rotation : ang);
    this.setFlipY(Math.cos(ang) < 0);
    this.halo.setPosition(this.hx, this.hy).setAlpha(this.state === 'peek' ? 0.35 : 0.18);
    for (let i = 0; i < SEGMENTS; i++) {
      const idx = Math.min(this.trail.length - 1, Math.round(((i + 1) * SPACING) / 4));
      const pt = this.trail[idx];
      const prev = this.trail[Math.max(0, idx - 3)];
      const seg = this.parts[i];
      seg.setPosition(pt.x, pt.y + Math.sin(time / 120 + i) * 1.5);
      seg.setRotation(Math.atan2(prev.y - pt.y, prev.x - pt.x));
    }
  }

  // Partes fora da areia (círculos): { x, y, r }
  exposed() {
    const out = [];
    const floor = this.arena.floor;
    if (this.hy < floor + 50) out.push({ x: this.hx + Math.cos(this.rotation) * 30, y: this.hy + Math.sin(this.rotation) * 30, r: 62 });
    for (let i = 0; i < SEGMENTS; i++) {
      const s = this.parts[i];
      if (s.y < floor + 30) out.push({ x: s.x, y: s.y, r: i === SEGMENTS - 1 ? 26 : 42 - i });
    }
    return out;
  }

  hitTest(rect) {
    if (!this.alive || this.state === 'sleep') return false;
    return this.exposed().some((c) => Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(c.x, c.y, c.r), rect));
  }

  center() {
    const parts = this.exposed();
    if (parts.length) return { x: parts[0].x, y: parts[0].y };
    return { x: this.hx, y: this.arena.floor - 20 };
  }

  checkContact(time) {
    if (time < this.nextContact || !this.alive) return;
    const p = this.player;
    const pb = p.body;
    const rect = new Phaser.Geom.Rectangle(pb.x + 4, pb.y + 4, pb.width - 8, pb.height - 8);
    if (this.hitTest(rect)) {
      this.nextContact = time + 400;
      this.scene.damagePlayer(this.hx, this.state === 'air' && this.data_.lunge ? 2 : 1);
    }
  }

  // ------------------------------------------------------------ efeitos

  surfaceDust(time, every, big = 1) {
    if (time < (this.nextDust || 0)) return;
    this.nextDust = time + every;
    const s = this.scene;
    const x = this.hx + Phaser.Math.Between(-20, 20);
    const y = this.arena.floor;
    for (let i = 0; i < big * 2; i++) {
      const d = s.add.image(x, y - 4, 'soft').setTint(SAND).setScale(Phaser.Math.FloatBetween(0.3, 0.6) * big).setAlpha(0.8).setDepth(15);
      s.tweens.add({ targets: d, x: x + Phaser.Math.Between(-40, 40), y: y - Phaser.Math.Between(20, 60) * big, alpha: 0, duration: 500, onComplete: () => d.destroy() });
    }
  }

  rumble(x, ms) {
    const s = this.scene;
    sfx(s, 'rumble', { volume: 0.5 });
    s.cameras.main.shake(ms, 0.002);
    // círculo de aviso no chão
    const w = s.add.image(x, this.arena.floor - 2, 'ring').setTint(AMBER).setScale(0.6, 0.12).setAlpha(0.8).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: w, scaleX: 1.1, alpha: 0.2, duration: ms, yoyo: false, onComplete: () => w.destroy() });
  }

  sandSplash(x, n) {
    const s = this.scene;
    const y = this.arena.floor;
    const e = s.add.particles(x, y - 6, 'soft', {
      speedX: { min: -320, max: 320 },
      speedY: { min: -620, max: -200 },
      gravityY: 1400,
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.7, end: 0.1 },
      tint: [SAND, 0xc08a58, 0xffe0b0],
      emitting: false,
    });
    e.setDepth(16);
    e.explode(n);
    s.time.delayedCall(1000, () => e.destroy());
  }

  spit() {
    const s = this.scene;
    const p = this.player;
    sfx(s, 'spit', { volume: 0.7, rate: 0.6 });
    const mx = this.hx + Math.cos(this.rotation) * 70;
    const my = this.hy + Math.sin(this.rotation) * 40 - 30;
    const n = this.phase === 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const tx = p.x + (i - (n - 1) / 2) * 120;
      const t = 0.9;
      const vx = (tx - mx) / t;
      const vy = (p.y - 30 - my - 0.5 * 1400 * t * t) / t;
      const o = s.bossFx.create(mx, my, 'sandball');
      o.setScale(0.8).setDepth(16);
      o.body.setCircle(14, 18, 18).setAllowGravity(true).setGravityY(1400 - s.physics.world.gravity.y);
      o.setVelocity(vx, vy);
      o.setData({ kind: 'rock', born: s.time.now });
    }
  }

  erupt(x) {
    const s = this.scene;
    const y = this.arena.floor;
    sfx(s, 'worm_burst', { volume: 0.4, rate: 1.4 });
    this.sandSplash(x, 10);
    const col = s.add.image(x, y, 'tornado', 2).setOrigin(0.5, 1).setScale(0.35, 0.05).setTint(0xffd9a0).setDepth(16);
    s.tweens.add({ targets: col, scaleY: 0.5, duration: 120, yoyo: true, hold: 120, onComplete: () => col.destroy() });
    s.time.delayedCall(90, () => {
      const p = this.player;
      if (Math.abs(p.x - x) < 50 && p.y > y - 150) s.damagePlayer(x);
    });
  }

  dropRocks(n) {
    const s = this.scene;
    const a = this.arena;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(a.left + 60, a.right - 60);
      const warn = s.add.image(x, a.floor - 2, 'soft').setTint(AMBER).setScale(1.2, 0.3).setAlpha(0.7).setDepth(15);
      s.tweens.add({ targets: warn, alpha: 0.2, duration: 150, yoyo: true, repeat: 3, onComplete: () => warn.destroy() });
      s.time.delayedCall(500 + i * 200, () => {
        if (!this.alive) return;
        const o = s.bossFx.create(x, a.top + 20, 'sandball');
        o.setScale(1.1).setDepth(16);
        o.body.setCircle(14, 18, 18).setAllowGravity(true);
        o.setData({ kind: 'rock', born: s.time.now });
      });
    }
  }

  updateFx(time) {
    for (const h of [...this.scene.bossFx.getChildren()]) {
      if (h.getData('kind') === 'rock') {
        h.rotation += 0.15;
        if (time - h.getData('born') > 4000) this.scene.popBossFx(h);
      }
    }
  }

  // ------------------------------------------------------------ vida

  hit(fromX, dir, dmg = 5, opts = {}) {
    if (!this.alive) return false;
    this.hp -= dmg;
    const flash = opts.dot ? 0xffb070 : 0xffffff;
    for (const o of [this, ...this.parts]) o.setTintFill(flash);
    this.scene.time.delayedCall(60, () => {
      if (!this.active) return;
      for (const o of [this, ...this.parts]) o.clearTint();
    });
    this.scene.onBossHit?.(this);
    if (this.hp <= 0) this.die();
    return this.hp <= 0;
  }

  die() {
    const s = this.scene;
    this.alive = false;
    this.state = 'dead';
    for (const h of [...s.bossFx.getChildren()]) s.popBossFx(h);
    s.onEnemyKilled(this);
    sfx(s, 'worm_roar', { rate: 0.7, vary: 0 });
    s.cameras.main.shake(1600, 0.012);
    this.setFrame(2);
    // o corpo se desfaz em areia, do rabo até a cabeça
    const parts = [...this.parts].reverse();
    parts.forEach((p, i) => {
      s.time.delayedCall(120 + i * 110, () => {
        s.burst(p.x, p.y, SAND, 14);
        sfx(s, 'worm_burst', { volume: 0.5, rate: 1 + i * 0.05 });
        s.tweens.add({ targets: p, alpha: 0, scale: p.scale * 0.6, duration: 250, onComplete: () => p.destroy() });
      });
    });
    s.time.delayedCall(200 + parts.length * 110, () => {
      sfx(s, 'boss_die', { vary: 0 });
      s.cameras.main.flash(600, 255, 220, 160);
      s.burst(this.hx, this.hy, AMBER, 50);
      s.tweens.add({
        targets: [this, this.halo],
        alpha: 0,
        duration: 700,
        onComplete: () => {
          this.halo.destroy();
          this.destroy();
        },
      });
    });
  }
}
