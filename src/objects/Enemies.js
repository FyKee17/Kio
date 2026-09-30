import Phaser from 'phaser';
import { FEET } from '../data/anims.js';
import { COMBAT, TILE } from '../config.js';
import { sfx } from '../audio/sfx.js';

const NAIL = COMBAT.nailDamage;

// Base: vida, piscar ao levar golpe, empurrão e morte com fragmentos de luz.
class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, key, { hp, geo, scale = 0.5, knock = 260 }) {
    super(scene, x, y, key, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(scale).setDepth(12);
    this.hp = hp * NAIL; // `hp` em golpes de espada; por dentro a vida usa a escala de dano
    this.maxHp = this.hp;
    this.geo = geo;
    this.knock = knock;
    this.stunUntil = 0;
    this.contact = true;
    this.alive = true;
  }

  // dmg: dano (espada = 5). opts.dot: queimadura (sem empurrão); opts.knock: {x, y} empurrão forte.
  hit(fromX, dir, dmg = NAIL, opts = {}) {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (opts.dot) {
      this.setTint(0xff9a4a);
      this.scene.time.delayedCall(90, () => this.active && this.clearTint());
    } else {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    }
    if (opts.knock && this.knock) {
      this.body.setVelocity(opts.knock.x * (this.knock / 260), opts.knock.y * (this.knock / 260));
      this.stunUntil = this.scene.time.now + 420;
    } else if (this.knock && !opts.dot) {
      const push = this.x < fromX ? -1 : 1;
      if (dir === 'side') this.body.setVelocityX(push * this.knock);
      if (dir === 'up') this.body.setVelocityY(-this.knock);
      if (dir === 'down') this.body.setVelocityY(this.knock);
      this.stunUntil = this.scene.time.now + 180;
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.onEnemyKilled(this);
      this.fling(fromX);
      this.destroy();
      return true;
    }
    return false;
  }

  // Corpo arremessado girando e apagando, como no Hollow Knight.
  fling(fromX) {
    const dir = this.x < fromX ? -1 : 1;
    const corpse = this.scene.add
      .image(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY)
      .setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX)
      .setDepth(this.depth)
      .setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => corpse.active && corpse.setTint(0x6f7fa6));
    this.scene.tweens.add({ targets: corpse, x: corpse.x + dir * 70, duration: 650, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: corpse, y: corpse.y - 50, duration: 220, ease: 'Quad.easeOut', yoyo: true });
    this.scene.tweens.add({
      targets: corpse,
      angle: dir * 160,
      alpha: 0,
      duration: 700,
      delay: 60,
      onComplete: () => corpse.destroy(),
    });
  }

  get stunned() {
    return this.scene.time.now < this.stunUntil;
  }
}

export class Crawler extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'beetle', { hp: 3, geo: 4, scale: 0.55 });
    this.setOrigin(0.5, FEET.beetle);
    // corpo sem a cauda de chama (quadro 208x112, pés na linha 102)
    this.body.setSize(130, 70).setOffset(44, 32);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.play('crawler-walk');
  }

  update() {
    if (!this.alive || this.stunned) return;
    const b = this.body;
    const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
    const ground = this.scene.isFloorAt(aheadX, b.bottom + 6);
    if ((this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left) || (b.blocked.down && !ground)) {
      this.dir *= -1;
    }
    b.setVelocityX(this.dir * 70);
    this.setFlipX(this.dir < 0);
  }
}

export class Flyer extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'moth', { hp: 3, geo: 5, knock: 340, scale: 0.6 });
    this.body.setAllowGravity(false);
    this.body.setCircle(38, 42, 26);
    this.home = new Phaser.Math.Vector2(x, y);
    this.t = Math.random() * 10;
    this.play('flyer-fly');
  }

  update(time, delta) {
    if (!this.alive) return;
    this.t += delta / 1000;
    const b = this.body;
    if (this.stunned) {
      b.velocity.scale(0.9);
      return;
    }
    const p = this.scene.player;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y - 40);
    let tx;
    let ty;
    if (dist < 380 && !p.dead) {
      tx = p.x;
      ty = p.y - 50;
    } else {
      tx = this.home.x + Math.cos(this.t * 0.8) * 40;
      ty = this.home.y + Math.sin(this.t * 1.6) * 20;
    }
    const ang = Math.atan2(ty - this.y, tx - this.x);
    const speed = dist < 380 ? 140 : 70;
    b.velocity.x = Phaser.Math.Linear(b.velocity.x, Math.cos(ang) * speed, 0.05);
    b.velocity.y = Phaser.Math.Linear(b.velocity.y, Math.sin(ang) * speed, 0.05);
    this.setFlipX(b.velocity.x < 0);
  }
}

export class Spitter extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'spitter', { hp: 4, geo: 6, knock: 0 });
    this.setOrigin(0.5, 1);
    this.body.setAllowGravity(false).setImmovable(true);
    this.body.setSize(70, 90).setOffset(21, 36);
    this.nextShot = scene.time.now + 1200 + Math.random() * 1000;
  }

  update(time) {
    if (!this.alive) return;
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dy = p.y - 40 - (this.y - 50);
    if (time > this.nextShot && Math.abs(dx) < 560 && Math.abs(dy) < 320 && !p.dead) {
      this.nextShot = time + 2400;
      this.setFrame(1);
      this.scene.time.delayedCall(350, () => {
        if (!this.alive) return;
        const ang = Math.atan2(p.y - 45 - (this.y - 45), p.x - this.x);
        this.scene.spawnOrb(this.x, this.y - 45, Math.cos(ang) * 230, Math.sin(ang) * 230);
      });
      this.scene.time.delayedCall(700, () => this.alive && this.setFrame(0));
    }
    this.setFlipX(dx < 0);
  }
}

// ---------------------------------------------------------------- Ruínas

// Pedrisco: montinho de arenito que anda devagar e pula em cima do Kio. Fácil.
export class Pebble extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'pebble', { hp: 2, geo: 3, scale: 0.5, knock: 300 });
    this.setOrigin(0.5, 128 / 140);
    this.body.setSize(100, 80).setOffset(35, 44);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextHop = 0;
    this.state = 'walk';
    this.play('pebble-walk');
  }

  update(time) {
    if (!this.alive || this.stunned) return;
    const b = this.body;
    const p = this.scene.player;
    const dx = p.x - this.x;
    if (this.state === 'crouch') return;
    if (this.state === 'air') {
      if (b.blocked.down && b.velocity.y >= 0) {
        this.state = 'walk';
        this.play('pebble-walk');
        this.scene.dust?.(this.x, this.y);
      }
      return;
    }
    if (time > this.nextHop && Math.abs(dx) < 260 && Math.abs(p.y - this.y) < 90 && b.blocked.down && !p.dead) {
      this.state = 'crouch';
      this.anims.stop();
      this.setFrame(4);
      b.setVelocityX(0);
      this.setFlipX(dx < 0);
      this.scene.time.delayedCall(380, () => {
        if (!this.alive) return;
        this.state = 'air';
        this.setFrame(5);
        b.setVelocity(Math.sign(dx) * 250, -620);
        this.nextHop = this.scene.time.now + 1600;
        sfx(this.scene, 'jump', { volume: 0.3, rate: 0.6 });
      });
      return;
    }
    const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
    const ground = this.scene.isFloorAt(aheadX, b.bottom + 6);
    if ((this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left) || (b.blocked.down && !ground)) this.dir *= -1;
    b.setVelocityX(this.dir * 55);
    this.setFlipX(this.dir < 0);
  }
}

// Arqueiro de arenito: mira, puxa a corda (dá para ver) e solta uma flecha
// não muito rápida. Pule ou use o dash para desviar; a espada rebate flechas.
export class Archer extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'archer', { hp: 3, geo: 7, scale: 0.5, knock: 90 });
    this.setOrigin(0.44, 228 / 240);
    this.body.setSize(70, 190).setOffset(55, 38);
    this.nextShot = scene.time.now + 1500 + Math.random() * 1200;
    this.aiming = false;
    this.play('archer-idle');
  }

  update(time) {
    if (!this.alive) return;
    const p = this.scene.player;
    const dx = p.x - this.x;
    const dy = p.y - 40 - (this.y - 68);
    if (!this.aiming) this.setFlipX(dx < 0);
    if (this.stunned) this.body.setVelocityX(this.body.velocity.x * 0.9);
    else this.body.setVelocityX(0);
    if (!this.aiming && time > this.nextShot && Math.abs(dx) < 720 && Math.abs(dy) < 420 && !p.dead) {
      this.aiming = true;
      this.anims.stop();
      this.setFrame(2);
      sfx(this.scene, 'bow_draw', { volume: 0.5 });
      this.scene.time.delayedCall(380, () => this.alive && this.setFrame(3));
      this.scene.time.delayedCall(850, () => {
        if (!this.alive) return;
        this.setFrame(4);
        const face = this.flipX ? -1 : 1;
        const sx = this.x + face * 38;
        const sy = this.y - 68;
        // mira onde o Kio está (sem adivinhar para onde vai)
        const ang = Math.atan2(p.y - 42 - sy, p.x - sx);
        const a = Phaser.Math.Clamp(ang, face > 0 ? -1.1 : Math.PI - 1.1, face > 0 ? 1.1 : Math.PI + 1.1);
        this.scene.spawnArrow(sx, sy, Math.cos(a) * 360, Math.sin(a) * 360);
        this.scene.time.delayedCall(350, () => {
          if (!this.alive) return;
          this.aiming = false;
          this.play('archer-idle');
        });
        this.nextShot = this.scene.time.now + 2300 + Math.random() * 700;
      });
    }
  }
}

// Escudeiro Partido: armadura rachada, escudo-torre e maça. O escudo segura
// golpes pela frente; ataque pelas costas, por cima ou logo depois da maçada.
export class Squire extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'squire', { hp: 9, geo: 14, scale: 0.5, knock: 50 });
    this.setOrigin(130 / 280, 266 / 280);
    this.body.setSize(100, 220).setOffset(80, 46);
    this.face = Math.random() < 0.5 ? -1 : 1;
    this.state = 'patrol';
    this.stateUntil = 0;
    this.turnAt = 0;
    this.swingHit = false;
    this.blocks = 0;
    this.play('squire-walk');
  }

  // O escudo fica na frente dele: bloqueia golpes vindos desse lado.
  guards(fromX, dir) {
    if (dir === 'down') return false;
    if (this.state === 'swing' || this.state === 'recover' || this.state === 'stagger') return false;
    return Math.sign(fromX - this.x) === this.face;
  }

  onBlocked() {
    this.blocks++;
    this.setFrame(4);
    this.stateUntil = Math.max(this.stateUntil, this.scene.time.now + 250);
    // três golpes no escudo seguidos: ele perde o equilíbrio
    if (this.blocks >= 3) {
      this.blocks = 0;
      this.setState('stagger', 900);
    }
  }

  setState(st, ms) {
    this.state = st;
    this.stateUntil = this.scene.time.now + ms;
    this.anims.stop();
    const frame = { guard: 4, windup: 5, swing: 6, recover: 6, stagger: 7 }[st];
    if (frame !== undefined) this.setFrame(frame);
    else this.play('squire-walk', true);
  }

  update(time) {
    if (!this.alive) return;
    const b = this.body;
    const p = this.scene.player;
    const dx = p.x - this.x;
    const near = Math.abs(dx) < 520 && Math.abs(p.y - this.y) < 140 && !p.dead;
    const angry = this.hp < this.maxHp / 2;
    this.setFlipX(this.face < 0);
    if (this.stunned) return;

    if (this.state === 'windup' && time > this.stateUntil) {
      this.setState('swing', 220);
      this.swingHit = false;
      sfx(this.scene, 'boss_swing', { volume: 0.6, rate: 1.2 });
      b.setVelocityX(this.face * 160);
    } else if (this.state === 'swing') {
      const x = this.face > 0 ? this.x + 10 : this.x - 130;
      this.meleeCheck(x, this.y - 120, 120, 120);
      if (time > this.stateUntil) {
        this.setState('recover', angry ? 520 : 750);
        this.scene.impactDust?.(this.x + this.face * 70, this.y);
        sfx(this.scene, 'land', { volume: 0.7, rate: 0.6 });
      }
    } else if (this.state === 'recover' || this.state === 'stagger') {
      b.setVelocityX(0);
      if (time > this.stateUntil) this.setState(near ? 'guard' : 'patrol', 0);
    } else if (this.state !== 'windup') {
      if (near) {
        // vira devagar: dá para passar por trás dele com o dash
        if (Math.sign(dx) !== this.face) {
          if (!this.turnAt) this.turnAt = time + (angry ? 320 : 520);
          if (time > this.turnAt) {
            this.face = Math.sign(dx);
            this.turnAt = 0;
          }
        } else this.turnAt = 0;
        if (Math.abs(dx) < 150 && Math.sign(dx) === this.face) {
          b.setVelocityX(0);
          this.setState('windup', angry ? 420 : 560);
          return;
        }
        this.state = 'guard';
        b.setVelocityX(this.face * (angry ? 110 : 80));
        if (this.anims.currentAnim?.key !== 'squire-walk' || !this.anims.isPlaying) this.play('squire-walk', true);
      } else {
        this.state = 'patrol';
        const aheadX = this.face > 0 ? b.right + 4 : b.left - 4;
        const ground = this.scene.isFloorAt(aheadX, b.bottom + 6);
        if ((this.face > 0 && b.blocked.right) || (this.face < 0 && b.blocked.left) || (b.blocked.down && !ground)) this.face *= -1;
        b.setVelocityX(this.face * 45);
        if (!this.anims.isPlaying) this.play('squire-walk', true);
      }
    }
    if (angry && Math.random() < 0.04) this.scene.steamPuff?.(this.x - this.face * 20, this.y - 90);
  }

  meleeCheck(x, y, w, h) {
    if (this.swingHit) return;
    const pb = this.scene.player.body;
    if (Phaser.Geom.Intersects.RectangleToRectangle(new Phaser.Geom.Rectangle(x, y, w, h), new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height))) {
      this.swingHit = true;
      this.scene.damagePlayer(this.x, 2);
    }
  }
}

export const ENEMY_TYPES = { c: Crawler, f: Flyer, s: Spitter, a: Pebble, q: Archer, k: Squire };

// ---------------------------------------------------------------- perigos

// Redemoinho de areia: vai e volta; quem encosta leva dano e é arremessado.
export class Tornado {
  constructor(scene, x, floor) {
    this.scene = scene;
    this.home = x;
    this.floor = floor;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.sprite = scene.add.sprite(x, floor + 6, 'tornado').setOrigin(0.5, 1).setScale(0.62).setDepth(17).setAlpha(0.9).play('tornado-spin');
    this.sprite.anims.setProgress(Math.random());
    this.nextHit = 0;
    this.dust = scene.add.particles(0, 0, 'soft', {
      speedX: { min: -60, max: 60 },
      speedY: { min: -120, max: -30 },
      lifespan: 600,
      scale: { start: 0.45, end: 0 },
      tint: [0xe0b070, 0xc08a58],
      alpha: { start: 0.6, end: 0 },
      frequency: 60,
    });
    this.dust.setDepth(16);
  }

  destroy() {
    this.dead = true;
    this.scene.burst?.(this.sprite.x, this.floor - 60, 0xe0b070, 20);
    this.sprite.destroy();
    this.dust.destroy();
  }

  update(time, delta) {
    if (this.dead) return;
    const s = this.sprite;
    const range = 5 * TILE;
    s.x += this.dir * 70 * (delta / 1000);
    const aheadX = s.x + this.dir * 40;
    if (Math.abs(s.x - this.home) > range || this.scene.cellAt(aheadX, this.floor - 10) === '#' || !this.scene.isFloorAt(aheadX, this.floor + 6)) this.dir *= -1;
    s.setScale(0.62 + Math.sin(time / 180) * 0.03, 0.62);
    this.dust.setPosition(s.x, this.floor - 4);
    const p = this.scene.player;
    if (time > this.nextHit && !p.dead && Math.abs(p.x - s.x) < 34 && p.y > this.floor - 170 && p.y - 60 < this.floor) {
      this.nextHit = time + 1200;
      this.scene.tornadoHit(this, s.x);
    }
  }
}

// Respiro de vapor. Quente ('v'): ciclo de espera, aviso e jato que queima.
// Corrente ('u'): jato contínuo que levanta o Kio até o teto.
export class Vent {
  constructor(scene, x, floor, lift) {
    this.scene = scene;
    this.x = x;
    this.floor = floor;
    this.lift = lift;
    scene.add.image(x, floor + 2, lift ? 'vent-lift' : 'vent-hot').setOrigin(0.5, 1).setScale(0.6).setDepth(6);
    // altura do jato: até o teto, no máximo 20 blocos (quente: 4)
    let top = floor - TILE;
    const max = lift ? 20 : 4;
    for (let i = 0; i < max && scene.cellAt(x, top - TILE / 2) !== '#'; i++) top -= TILE;
    this.top = lift ? top : floor - 4 * TILE;
    this.phase = lift ? 'on' : 'idle';
    this.phaseUntil = scene.time.now + Math.random() * 2000;
    const height = floor - this.top;
    this.steam = scene.add.particles(x, floor - 6, 'soft', {
      speedY: lift ? { min: -620, max: -420 } : { min: -520, max: -360 },
      speedX: { min: -30, max: 30 },
      lifespan: (height / 480) * 1000,
      scale: { start: lift ? 0.9 : 1.1, end: 2.2 },
      alpha: { start: lift ? 0.35 : 0.5, end: 0 },
      tint: lift ? [0xdffcff, 0x9ff0ff] : [0xffffff, 0xffd0b0],
      frequency: lift ? 40 : 25,
      emitting: lift,
      blendMode: lift ? 'ADD' : 'NORMAL',
    });
    this.steam.setDepth(18);
    this.wisp = scene.add.particles(x, floor - 6, 'soft', {
      speedY: { min: -80, max: -40 },
      speedX: { min: -15, max: 15 },
      lifespan: 900,
      scale: { start: 0.4, end: 0.9 },
      alpha: { start: 0.25, end: 0 },
      tint: 0xffe8d8,
      frequency: 180,
    });
    this.wisp.setDepth(17);
    this.nextHit = 0;
  }

  inColumn(p) {
    return Math.abs(p.x - this.x) < 38 && p.y > this.top && p.y - 60 < this.floor;
  }

  update(time, delta) {
    const p = this.scene.player;
    if (this.lift) {
      if (this.inColumn(p) && !p.dead) p.updraft(delta, this.top);
      return;
    }
    if (time > this.phaseUntil) {
      if (this.phase === 'idle') {
        this.phase = 'warn';
        this.phaseUntil = time + 650;
        this.wisp.frequency = 40;
        if (this.near(p)) sfx(this.scene, 'steam_warn', { volume: 0.4 });
      } else if (this.phase === 'warn') {
        this.phase = 'on';
        this.phaseUntil = time + 1300;
        this.steam.start();
        if (this.near(p)) sfx(this.scene, 'steam', { volume: 0.6 });
      } else {
        this.phase = 'idle';
        this.phaseUntil = time + 2300;
        this.steam.stop();
        this.wisp.frequency = 180;
      }
    }
    if (this.phase === 'on' && time > this.nextHit && this.inColumn(p) && !p.dead) {
      this.nextHit = time + 900;
      this.scene.damagePlayer(this.x);
    }
  }

  near(p) {
    return Math.abs(p.x - this.x) < 900 && Math.abs(p.y - this.floor) < 500;
  }
}
