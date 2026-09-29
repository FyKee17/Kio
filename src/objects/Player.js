import Phaser from 'phaser';
import { PHYS } from '../config.js';

const approach = (value, target, step) =>
  value < target ? Math.min(value + step, target) : Math.max(value - step, target);

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, controls) {
    super(scene, x, y, 'kio', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.controls = controls;
    this.setOrigin(0.5, 1);
    this.body.setSize(10, 20).setOffset(3, 4);
    this.setDepth(10);

    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.frozen = false;
    this.dead = false;
    this.dropUntil = 0;
    this.wasOnGround = true;
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(time, delta) {
    if (this.dead) return;
    const c = this.controls;
    const b = this.body;
    const dt = delta / 1000;
    const onGround = this.onGround;
    const active = !this.frozen;

    this.coyote = onGround ? PHYS.coyoteMs : this.coyote - delta;
    this.buffer = active && c.pressed.jump ? PHYS.bufferMs : this.buffer - delta;

    // ↓ em cima de plataforma vazada: atravessa
    if (active && c.pressed.down && onGround) this.dropUntil = time + 220;

    const dir = active ? (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0) : 0;
    let accel;
    if (dir !== 0) accel = onGround ? PHYS.accel : PHYS.airAccel;
    else accel = onGround ? PHYS.decel : PHYS.airAccel * 0.5;
    b.setVelocityX(approach(b.velocity.x, dir * PHYS.runSpeed, accel * dt));
    if (dir !== 0) this.setFlipX(dir < 0);

    if (this.buffer > 0 && this.coyote > 0) {
      b.setVelocityY(-PHYS.jumpVelocity);
      this.buffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.squash(0.8, 1.2);
      this.emit('jump');
    }
    if (this.jumping && !c.held.jump && b.velocity.y < 0) {
      b.setVelocityY(b.velocity.y * PHYS.jumpCut);
      this.jumping = false;
    }
    if (b.velocity.y >= 0) this.jumping = false;
    if (b.velocity.y > PHYS.maxFall) b.setVelocityY(PHYS.maxFall);

    if (onGround && !this.wasOnGround) {
      this.squash(1.25, 0.8);
      this.emit('land');
    }
    this.wasOnGround = onGround;

    if (!onGround) this.anims.play(b.velocity.y < 0 ? 'kio-jump' : 'kio-fall', true);
    else if (Math.abs(b.velocity.x) > 10) this.anims.play('kio-run', true);
    else this.anims.play('kio-idle', true);
  }

  isDropping(time) {
    return time < this.dropUntil;
  }

  squash(sx, sy) {
    this.scene.tweens.killTweensOf(this);
    this.setScale(sx, sy);
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 140, ease: 'Quad.easeOut' });
  }

  freeze() {
    this.frozen = true;
    this.buffer = 0;
  }

  unfreeze() {
    this.frozen = false;
    this.buffer = 0;
  }
}
