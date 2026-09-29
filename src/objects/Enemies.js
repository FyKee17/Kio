import Phaser from 'phaser';
import { FEET } from '../data/anims.js';

// Base: vida, piscar ao levar golpe, empurrão e morte com fragmentos de luz.
class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, key, { hp, geo, scale = 0.5, knock = 260 }) {
    super(scene, x, y, key, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(scale).setDepth(12);
    this.hp = hp;
    this.geo = geo;
    this.knock = knock;
    this.stunUntil = 0;
    this.contact = true;
    this.alive = true;
  }

  hit(fromX, dir) {
    if (!this.alive) return false;
    this.hp--;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    if (this.knock) {
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

export const ENEMY_TYPES = { c: Crawler, f: Flyer, s: Spitter };
