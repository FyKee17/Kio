import Phaser from 'phaser';
import { PHYS, COMBAT } from '../config.js';
import { FEET as FEET_LINES } from '../data/anims.js';

const SCALE = 0.68; // quadros de 224x208 -> Kio com ~90px de altura
const FEET = FEET_LINES.kio; // linha dos pés dentro do quadro
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

// O Kio é um corpo físico invisível (retângulo) + uma sprite que o acompanha.
// Assim dá para esticar/achatar a sprite sem mexer na colisão.
export class Player {
  constructor(scene, x, y, controls) {
    this.scene = scene;
    this.controls = controls;

    this.phys = scene.add.zone(x, y - 31, 28, 62);
    scene.physics.add.existing(this.phys);
    this.body = this.phys.body;
    this.body.setMaxVelocityY(PHYS.maxFall);

    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5fb4ff).setAlpha(0.35).setScale(1.6).setDepth(19);
    this.sprite = scene.add.sprite(x, y, 'kio_idle', 0).setOrigin(0.5, FEET).setScale(SCALE).setDepth(20);
    this.sprite.play('kio-idle');

    this.facing = 1;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.airJumpUsed = false;
    this.airDashUsed = false;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.attackReadyAt = 0;
    this.attack = null;
    this.hurtUntil = 0;
    this.invulnUntil = 0;
    this.healStart = 0;
    this.dropUntil = 0;
    this.frozen = false;
    this.dead = false;
    this.wasOnGround = true;
    this.lastGhost = 0;
    this.attackAnimUntil = 0;
    this.landUntil = 0;
    this.lastStep = 0;
    this.sitting = false;
  }

  get x() {
    return this.phys.x;
  }

  get y() {
    return this.body.bottom;
  }

  get onGround() {
    return this.body.blocked.down;
  }

  get dashing() {
    return this.scene.time.now < this.dashUntil;
  }

  get invulnerable() {
    return this.scene.time.now < this.invulnUntil || this.dashing;
  }

  setPosition(x, feetY) {
    this.body.reset(x, feetY - 31);
    this.syncSprite();
  }

  update(time, delta) {
    if (this.dead) return;
    const c = this.controls;
    if (this.sitting) {
      // sentado no santuário: qualquer comando levanta
      const p = c.pressed;
      if (!this.frozen && (p.left || p.right || p.jump || p.attack || p.dash || c.held.left || c.held.right)) this.stand();
      else return;
    }
    const b = this.body;
    const dt = delta / 1000;
    const onGround = this.onGround;
    const abilities = this.scene.state.abilities;
    const control = !this.frozen && time >= this.hurtUntil;

    if (onGround) {
      this.coyote = PHYS.coyoteMs;
      this.airJumpUsed = false;
      this.airDashUsed = false;
    } else {
      this.coyote -= delta;
    }
    this.buffer = control && c.pressed.jump ? PHYS.bufferMs : this.buffer - delta;

    // --- cura (segurar no chão, parado)
    const healing = control && onGround && c.held.heal && this.scene.canHeal();
    if (healing) {
      if (!this.healStart) this.healStart = time;
      if (time - this.healStart > COMBAT.healMs) {
        this.healStart = time;
        this.scene.completeHeal();
      }
    } else {
      this.healStart = 0;
    }

    // --- dash
    if (this.dashing) {
      b.setVelocity(this.facing * PHYS.dashSpeed, 0);
      if (time - this.lastGhost > 30) this.ghost(time);
    } else {
      if (!b.allowGravity) {
        b.setAllowGravity(true);
        b.setVelocityX(this.facing * PHYS.runSpeed * 0.6);
      }
      if (control && c.pressed.dash && abilities.dash && time >= this.dashReadyAt && (onGround || !this.airDashUsed)) {
        if (c.held.left) this.facing = -1;
        if (c.held.right) this.facing = 1;
        this.dashUntil = time + PHYS.dashMs;
        this.dashReadyAt = time + PHYS.dashCooldownMs;
        if (!onGround) this.airDashUsed = true;
        b.setAllowGravity(false);
        this.buffer = 0;
        this.scene.onPlayerDash(this);
      }
    }

    if (!this.dashing) {
      // --- andar
      const dir = control && !healing ? (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0) : 0;
      if (time >= this.hurtUntil) {
        let accel;
        if (dir !== 0) accel = onGround ? PHYS.accel : PHYS.airAccel;
        else accel = onGround ? PHYS.decel : PHYS.airAccel * 0.6;
        const speed = c.held.run ? PHYS.runSpeed : PHYS.walkSpeed;
        b.setVelocityX(approach(b.velocity.x, dir * speed, accel * dt));
      }
      if (dir !== 0 && !this.attack) this.facing = dir;

      // --- descer da plataforma: ↓ + pulo
      if (control && this.buffer > 0 && c.held.down && onGround && this.scene.standingOnPlatform(this)) {
        this.dropUntil = time + 250;
        this.buffer = 0;
      }

      // --- pulo, pulo no ar
      if (control && this.buffer > 0 && this.coyote > 0) {
        b.setVelocityY(-PHYS.jumpVelocity);
        this.buffer = 0;
        this.coyote = 0;
        this.jumping = true;
        this.squash(0.82, 1.18);
        this.scene.onPlayerJump?.(this);
      } else if (control && c.pressed.jump && !onGround && this.coyote <= 0 && abilities.doubleJump && !this.airJumpUsed) {
        b.setVelocityY(-PHYS.doubleJumpVelocity);
        this.airJumpUsed = true;
        this.jumping = true;
        this.buffer = 0;
        this.squash(0.8, 1.2);
        this.scene.onPlayerDoubleJump(this);
      }
      if (this.jumping && !c.held.jump && b.velocity.y < 0) {
        b.setVelocityY(b.velocity.y * PHYS.jumpCut);
        this.jumping = false;
      }
      if (b.velocity.y >= 0) this.jumping = false;

      // --- ataque
      if (control && c.pressed.attack && time >= this.attackReadyAt) {
        let dir = 'side';
        if (c.held.up) dir = 'up';
        else if (c.held.down && !onGround) dir = 'down';
        // o golpe para baixo fica ativo um pouco mais: quicar precisa ser gostoso
        const active = dir === 'down' ? COMBAT.attackActiveMs * 1.6 : COMBAT.attackActiveMs;
        this.attack = { dir, start: time, until: time + active, hits: new Set() };
        this.attackReadyAt = time + COMBAT.attackCooldownMs;
        this.scene.onPlayerAttack(this, dir);
        const anim = { side: 'kio-slash', up: 'kio-slash-up', down: 'kio-slash-down' }[dir];
        this.sprite.play(anim);
        this.attackAnimUntil = time + (dir === 'side' ? 210 : 190);
      }
    }
    if (this.attack && time > Math.max(this.attack.until, this.attack.start + 170)) this.attack = null;

    if (onGround && !this.wasOnGround) {
      this.squash(1.2, 0.84);
      this.landUntil = time + 150;
      this.scene.onPlayerLand(this);
    }
    this.wasOnGround = onGround;

    this.animate(time, onGround, healing);
    this.syncSprite();
  }

  // Retângulo de golpe ativo (coordenadas do mundo) ou null.
  attackRect(time) {
    const a = this.attack;
    if (!a || time > a.until) return null;
    const x = this.x;
    const y = this.y;
    if (a.dir === 'up') return new Phaser.Geom.Rectangle(x - 42, y - 160, 84, 100);
    if (a.dir === 'down') return new Phaser.Geom.Rectangle(x - 44, y - 20, 88, 110);
    return new Phaser.Geom.Rectangle(this.facing > 0 ? x + 4 : x - 104, y - 84, 100, 80);
  }

  pogo() {
    this.body.setVelocityY(-COMBAT.pogoVelocity);
    this.airJumpUsed = false;
    this.airDashUsed = false;
    this.jumping = false;
  }

  recoil() {
    if (this.onGround) this.body.setVelocityX(-this.facing * 220);
    else this.body.setVelocityX(-this.facing * 160);
  }

  hurt(fromX) {
    const now = this.scene.time.now;
    const dir = this.x < fromX ? -1 : 1;
    this.body.setAllowGravity(true);
    this.dashUntil = 0;
    this.body.setVelocity(dir * 420, -480);
    this.hurtUntil = now + COMBAT.hurtMs;
    this.invulnUntil = now + COMBAT.invulnMs;
    this.healStart = 0;
    this.attack = null;
  }

  // Senta no banco do santuário. seatX: meio do assento; floorY: chão.
  sit(seatX, floorY) {
    this.sitting = true;
    this.body.setVelocity(0, 0);
    this.body.reset(seatX, floorY - 31);
    this.attack = null;
    this.healStart = 0;
    const s = this.sprite;
    s.setFlipX(false);
    s.angle = 0;
    s.setAlpha(1);
    s.play('kio-sit');
    this.scene.tweens.killTweensOf(s);
    // desce no assento com um leve "afundar"
    s.setY(floorY - 2);
    // assento do banco fica ~35px acima do chão
    this.scene.tweens.add({ targets: s, y: floorY - 30, duration: 220, ease: 'Back.easeOut' });
    this.halo.setPosition(seatX - 14, floorY - 100);
  }

  stand() {
    this.sitting = false;
    this.sprite.play('kio-idle');
    this.squash(0.9, 1.12);
    this.syncSprite();
  }

  isDropping(time) {
    return time < this.dropUntil;
  }

  // Escolhe a animação pelo estado: dash, golpe, no ar (subindo/topo/caindo),
  // aterrissando, correndo, andando ou parado.
  animate(time, onGround, healing) {
    const s = this.sprite;
    const b = this.body;
    const vx = Math.abs(b.velocity.x);
    s.setFlipX(this.facing < 0);
    let tilt = 0;
    if (this.dashing) {
      s.anims.stop();
      s.setTexture('kio_run', 3);
      tilt = 6;
    } else if (time < this.hurtUntil) {
      s.anims.stop();
      s.setTexture('kio_jump', 4);
      tilt = -8;
    } else if (time < this.attackAnimUntil) {
      // a animação de golpe já está tocando
    } else if (!onGround) {
      if (b.velocity.y < -160) s.play('kio-rise', true);
      else if (b.velocity.y < 160) s.play('kio-apex', true);
      else s.play('kio-fall', true);
    } else if (time < this.landUntil && vx < 60) {
      s.play('kio-land', true);
    } else if (vx > 200) {
      s.play('kio-run', true);
      // a passada acompanha a velocidade real (acelerando/freando não "patina")
      s.anims.timeScale = Phaser.Math.Clamp(vx / PHYS.runSpeed, 0.75, 1);
      if (time - this.lastStep > 300) {
        this.lastStep = time;
        this.scene.onPlayerStep?.(this);
      }
    } else if (vx > 25) {
      s.play('kio-walk', true);
    } else {
      s.play('kio-idle', true);
    }
    if (s.anims.currentAnim?.key !== 'kio-run') s.anims.timeScale = 1;
    s.angle = tilt * this.facing;
    // piscar enquanto invulnerável depois de levar dano
    const inv = time < this.invulnUntil;
    s.setAlpha(inv && Math.floor(time / 70) % 2 === 0 ? 0.35 : 1);
    this.halo.setAlpha(healing ? 0.55 + 0.25 * Math.sin(time / 60) : 0.32);
    this.halo.setScale(healing ? 2.4 : 1.6);
  }

  syncSprite() {
    const x = this.x;
    const y = this.y;
    this.sprite.setPosition(x, y);
    this.halo.setPosition(x - 14 * this.facing, y - 78);
  }

  squash(sx, sy) {
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(SCALE * sx, SCALE * sy);
    this.scene.tweens.add({ targets: s, scaleX: SCALE, scaleY: SCALE, duration: 160, ease: 'Quad.easeOut' });
  }

  ghost(time) {
    this.lastGhost = time;
    const s = this.sprite;
    const g = this.scene.add
      .image(s.x, s.y, s.texture.key, s.frame.name)
      .setOrigin(s.originX, s.originY)
      .setScale(s.scaleX, s.scaleY)
      .setFlipX(s.flipX)
      .setTint(0x7cc8ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setDepth(18);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  setVisible(v) {
    this.sprite.setVisible(v);
    this.halo.setVisible(v);
  }
}
