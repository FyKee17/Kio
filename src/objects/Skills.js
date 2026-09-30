import Phaser from 'phaser';
import { MANA, TILE } from '../config.js';
import { ELEMENTS } from '../data/world.js';
import { sfx } from '../audio/sfx.js';

const ADD = Phaser.BlendModes.ADD;
const ENCHANT_MS = 60000;
const BURN = { dps: 2, ms: 4000 };

// Habilidades de elemento (teclas 1, 2 e 3; R troca de elemento).
//
// Vento: 1 Lâmina de Vento (voa longe e atravessa), 2 Quebra-Chão (ondas de ar
// rasteiras para a frente), 3 Olho do Furacão (puxa, explode e arremessa).
// Fogo: 1 Bola de Fogo (queima), 2 Lâmina Ardente (espada em chamas por 1 min,
// reserva 25% da mana), 3 Coroa de Brasas (até 3 brasas girando; a 5ª vítima
// de cada uma faz ela explodir).
export class Skills {
  constructor(scene) {
    this.scene = scene;
    this.readyAt = {}; // `${elemento}-${n}` -> hora em que volta
    this.shots = []; // projéteis em voo
    this.embers = []; // brasas girando em volta do Kio
    this.enchantUntil = 0;
    this.slamPending = 0;
    this.swapReadyAt = 0;
    this.orbitAngle = 0;
  }

  get element() {
    return this.scene.state.element;
  }

  get def() {
    return ELEMENTS[this.element];
  }

  get enchanted() {
    return this.element === 'fire' && this.scene.time.now < this.enchantUntil;
  }

  // Mana guardada pela Lâmina Ardente enquanto ela está acesa.
  get reserved() {
    return this.enchanted ? MANA.max * 0.25 : 0;
  }

  get capacity() {
    return MANA.max - this.reserved;
  }

  cooldown(n) {
    const key = `${this.element}-${n}`;
    const cd = this.def?.skills[n - 1].cd || 1;
    const left = Math.max(0, (this.readyAt[key] || 0) - this.scene.time.now);
    return { left, ratio: left / cd };
  }

  update(time, delta) {
    const s = this.scene;
    const c = s.controls;
    const dt = delta / 1000;
    if (this.element) {
      s.mana = Math.min(this.capacity, s.mana + MANA.regenPerSec * dt);
      if (!s.busy && !s.player.dead) {
        for (const n of [1, 2, 3]) if (c.pressed[`skill${n}`]) this.tryCast(n, time);
        if (c.pressed.element) s.swapElement();
      }
    }
    if (this.enchantUntil && time > this.enchantUntil) this.endEnchant();
    if (this.slamPending) this.checkSlam(time);
    this.updateShots(time, dt);
    this.updateEmbers(time, dt);
    this.updateEnchantFx(time);
  }

  // ------------------------------------------------------------ conjurar

  tryCast(n, time) {
    const s = this.scene;
    const p = s.player;
    const def = this.def;
    if (!def) return;
    const hud = s.hud;
    if (n > s.state.skills) {
      hud?.skillDenied(n, 'Ainda não liberada');
      return;
    }
    if (p.frozen || p.sitting || time < p.hurtUntil || time < p.lockUntil || p.dashing) return;
    const skill = def.skills[n - 1];
    const key = `${this.element}-${n}`;
    if (time < (this.readyAt[key] || 0)) {
      hud?.skillDenied(n);
      return;
    }
    if (this.element === 'fire' && n === 2 && this.enchanted) return;
    if (this.element === 'fire' && n === 3 && this.embers.length >= 3) {
      hud?.skillDenied(n, 'Já tem 3 brasas');
      return;
    }
    if (s.mana < skill.mana) {
      hud?.skillDenied(n, 'Mana insuficiente');
      return;
    }
    s.mana -= skill.mana;
    this.readyAt[key] = time + skill.cd;
    this[`${this.element}${n}`](time, skill);
    hud?.skillCast(n);
  }

  // ------------------------------------------------------------ vento

  // Lâmina de Vento: meia-lua que voa longe e atravessa inimigos.
  wind1(time, skill) {
    const s = this.scene;
    const p = s.player;
    const f = p.facing;
    this.castPose(260);
    sfx(s, 'wind_slash', { volume: 0.8 });
    const img = s.add.image(p.x + f * 40, p.y - 46, 'windblade').setBlendMode(ADD).setTint(this.def.color).setScale(0.2, 0.5).setDepth(22).setFlipX(f < 0);
    s.tweens.add({ targets: img, scaleX: 0.62, scaleY: 0.62, duration: 120 });
    this.shots.push({ kind: 'blade', img, vx: f * 950, vy: 0, dist: 0, max: 950, dmg: skill.dmg, hits: new Set(), pierce: true, trailAt: 0 });
    p.body.setVelocityX(-f * 120);
  }

  // Quebra-Chão: no ar, mergulha; no chão, bate e solta ondas rasteiras.
  wind2(time, skill) {
    const s = this.scene;
    const p = s.player;
    this.slamSkill = skill;
    if (p.onGround) {
      this.slam(time);
    } else {
      this.slamPending = time + 900;
      p.lockUntil = time + 900;
      p.body.setVelocity(0, 1500);
      p.sprite.play(p.anim('kio-slash-down'));
      p.attackAnimUntil = time + 900;
      sfx(s, 'dash', { volume: 0.6, rate: 0.7 });
    }
  }

  checkSlam(time) {
    const p = this.scene.player;
    if (p.onGround) {
      this.slamPending = 0;
      this.slam(time);
    } else if (time > this.slamPending) {
      this.slamPending = 0;
      p.lockUntil = 0;
    } else {
      p.body.setVelocityY(Math.max(p.body.velocity.y, 1200));
    }
  }

  slam(time) {
    const s = this.scene;
    const p = s.player;
    const f = p.facing;
    const color = this.def.color;
    p.lockUntil = time + 320;
    p.body.setVelocityX(0);
    p.sprite.play(p.anim('kio-slash'));
    p.attackAnimUntil = time + 300;
    p.squash(1.25, 0.8);
    sfx(s, 'slam', { volume: 0.6, rate: 1.5 });
    sfx(s, 'wind_slash', { volume: 0.7, rate: 0.8 });
    s.cameras.main.shake(180, 0.006);
    this.ring(p.x, p.y - 10, color, 0.9, 0.35);
    s.impactDust?.(p.x, p.y);
    const hits = new Set();
    // três ondas em sequência, cada uma um pouco mais lenta
    [0, 130, 260].forEach((delay, i) => {
      s.time.delayedCall(delay, () => {
        if (!s.player) return;
        const img = s.add.image(p.x + f * 30, p.y, 'airwave').setOrigin(0.5, 1).setBlendMode(ADD).setTint(color).setScale(0.62 - i * 0.06).setDepth(22).setFlipX(f < 0);
        this.shots.push({ kind: 'wave', img, vx: f * (760 - i * 90), vy: 0, dist: 0, max: 560, dmg: this.slamSkill.dmg, hits, pierce: true, floorY: p.y, trailAt: 0, knock: { x: f * 260, y: -380 } });
      });
    });
  }

  // Olho do Furacão: o Kio sobe no meio do redemoinho, puxa todo mundo e explode.
  wind3(time, skill) {
    const s = this.scene;
    const p = s.player;
    const color = this.def.color;
    const spinMs = 850;
    p.floating = true;
    p.lockUntil = time + spinMs + 250;
    p.invulnUntil = Math.max(p.invulnUntil, time + spinMs + 250);
    p.body.setAllowGravity(false);
    p.body.setVelocity(0, -90);
    p.sprite.play(p.anim('kio-apex'));
    sfx(s, 'tornado', { volume: 0.9 });
    const cx = () => p.x;
    const cy = () => p.y - 46;
    const spiral = s.add.image(cx(), cy(), 'spiral').setBlendMode(ADD).setTint(color).setScale(0.2).setAlpha(0.9).setDepth(23);
    const spiral2 = s.add.image(cx(), cy(), 'spiral').setBlendMode(ADD).setTint(this.def.light).setScale(0.1).setAlpha(0.6).setDepth(23);
    s.tweens.add({ targets: spiral, scale: 1.5, duration: spinMs, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: spiral2, scale: 1.0, duration: spinMs, ease: 'Cubic.easeOut' });
    const swirl = s.add.particles(0, 0, 'soft', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 190), quantity: 24 },
      speed: 0,
      lifespan: 500,
      scale: { start: 0.5, end: 0 },
      tint: [color, this.def.light, 0xffffff],
      blendMode: 'ADD',
      frequency: 12,
    });
    swirl.setDepth(23);
    const moveFx = s.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        spiral.setPosition(cx(), cy()).rotation -= 0.35;
        spiral2.setPosition(cx(), cy()).rotation += 0.5;
        swirl.setPosition(cx(), cy());
        // puxa os inimigos comuns para o olho do furacão
        for (const e of s.enemies.getChildren()) {
          if (!e.alive || e.isBoss || !e.body?.enable) continue;
          const dx = cx() - e.x;
          const dy = cy() - e.body.center.y;
          const d = Math.hypot(dx, dy);
          if (d < 360 && d > 40) {
            e.body.velocity.x = Phaser.Math.Linear(e.body.velocity.x, (dx / d) * 320, 0.2);
            if (!e.body.allowGravity || e.body.blocked.down) e.body.velocity.y = Phaser.Math.Linear(e.body.velocity.y, (dy / d) * 240, 0.2);
            e.stunUntil = s.time.now + 100;
          }
        }
      },
    });
    s.time.delayedCall(spinMs, () => {
      moveFx.remove();
      swirl.stop();
      s.time.delayedCall(600, () => swirl.destroy());
      s.tweens.add({ targets: [spiral, spiral2], scale: 2.4, alpha: 0, duration: 260, onComplete: () => (spiral.destroy(), spiral2.destroy()) });
      if (!s.player || p.dead) return;
      const x = cx();
      const y = cy();
      sfx(s, 'gust', { volume: 1 });
      s.cameras.main.shake(260, 0.012);
      s.cameras.main.flash(160, 180, 255, 200);
      this.ring(x, y, color, 3.4, 0.4);
      this.ring(x, y, this.def.light, 2.4, 0.3);
      s.burst(x, y, color, 40);
      for (const e of s.enemies.getChildren()) {
        if (!e.alive) continue;
        const ec = s.enemyCenter(e);
        const d = Math.hypot(ec.x - x, ec.y - y);
        if (d > 340) continue;
        const dir = Math.sign(ec.x - x) || p.facing;
        s.damageEnemy(e, skill.dmg, x, 'side', { knock: { x: dir * 780, y: -460 }, skill: true, fx: color });
      }
      p.floating = false;
      p.body.setAllowGravity(true);
    });
  }

  // ------------------------------------------------------------ fogo

  fire1(time, skill) {
    const s = this.scene;
    const p = s.player;
    const f = p.facing;
    this.castPose(240);
    sfx(s, 'fireball', { volume: 0.8 });
    const img = s.add.image(p.x + f * 44, p.y - 50, 'fireball').setBlendMode(ADD).setScale(0.3).setDepth(22);
    s.tweens.add({ targets: img, scale: 0.62, duration: 120 });
    const trail = s.add.particles(0, 0, 'flame', {
      follow: img,
      speedX: { min: -f * 60, max: -f * 160 },
      speedY: { min: -60, max: 20 },
      lifespan: 320,
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD',
      frequency: 18,
    });
    trail.setDepth(21);
    this.shots.push({ kind: 'fireball', img, trail, vx: f * 760, vy: 0, dist: 0, max: 1050, dmg: skill.dmg, hits: new Set(), pierce: false, burn: BURN, trailAt: 0, wobble: Math.random() * 6 });
  }

  fire2(time) {
    const s = this.scene;
    const p = s.player;
    this.enchantUntil = time + ENCHANT_MS;
    s.mana = Math.min(s.mana, this.capacity);
    p.lockUntil = time + 420;
    p.body.setVelocityX(0);
    p.sprite.play(p.anim('kio-slash-up'));
    p.attackAnimUntil = time + 400;
    sfx(s, 'ignite', { volume: 0.9 });
    this.ring(p.x, p.y - 50, 0xff8a2a, 1.4, 0.35);
    s.burst(p.x + p.facing * 30, p.y - 60, 0xffb040, 30);
    this.enchantFx = s.add.particles(0, 0, 'flame', {
      speedY: { min: -120, max: -40 },
      speedX: { min: -30, max: 30 },
      lifespan: 360,
      scale: { start: 0.38, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD',
      frequency: 45,
    });
    this.enchantFx.setDepth(21);
    s.hud?.toast('Lâmina Ardente: 1 minuto de fogo na espada.');
  }

  endEnchant() {
    this.enchantUntil = 0;
    this.enchantFx?.destroy();
    this.enchantFx = null;
  }

  updateEnchantFx(time) {
    if (!this.enchantFx) return;
    const p = this.scene.player;
    this.enchantFx.setPosition(p.x + p.facing * 26, p.y - 46);
    if (!this.enchanted) this.endEnchant();
    else if (this.enchantUntil - time < 5000) this.enchantFx.frequency = Math.floor(time / 200) % 2 ? 45 : 140; // piscando: está acabando
  }

  fire3() {
    const s = this.scene;
    const p = s.player;
    sfx(s, 'ignite', { volume: 0.7, rate: 1.3 });
    const img = s.add.image(p.x, p.y - 46, 'fireball').setBlendMode(ADD).setScale(0.1).setDepth(22);
    s.tweens.add({ targets: img, scale: 0.42, duration: 200, ease: 'Back.easeOut' });
    this.embers.push({ img, hits: 0, cool: new Map() });
    this.ring(p.x, p.y - 46, 0xff8a2a, 0.9, 0.3);
  }

  updateEmbers(time, dt) {
    if (!this.embers.length) return;
    const s = this.scene;
    const p = s.player;
    this.orbitAngle += dt * 3.2;
    const n = this.embers.length;
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const em = this.embers[i];
      const a = this.orbitAngle + (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * 74;
      const y = p.y - 46 + Math.sin(a) * 54;
      em.img.setPosition(x, y).setScale(0.4 + Math.sin(time / 90 + i) * 0.04);
      em.img.setVisible(!p.dead && p.sprite.visible);
      if (Math.random() < 0.3) this.spark(x, y, 0xffa040);
      for (const e of s.enemies.getChildren()) {
        if (!e.alive || (em.cool.get(e) || 0) > time) continue;
        if (!s.enemyHitTest(e, new Phaser.Geom.Rectangle(x - 20, y - 20, 40, 40))) continue;
        em.cool.set(e, time + 600);
        em.hits++;
        if (em.hits >= 5) {
          this.explodeEmber(em);
          this.embers.splice(i, 1);
          break;
        }
        s.damageEnemy(e, 5, x, 'none', { burn: BURN, skill: true, fx: 0xffa040, noKnock: true });
      }
    }
  }

  explodeEmber(em) {
    const s = this.scene;
    const { x, y } = em.img;
    em.img.destroy();
    sfx(s, 'explode', { volume: 0.9 });
    s.cameras.main.shake(160, 0.007);
    this.ring(x, y, 0xff8a2a, 1.3, 0.35);
    this.ring(x, y, 0xffe0a0, 0.9, 0.25);
    s.burst(x, y, 0xffa040, 36);
    for (const e of s.enemies.getChildren()) {
      if (!e.alive) continue;
      const c = s.enemyCenter(e);
      if (Math.hypot(c.x - x, c.y - y) > 140) continue;
      s.damageEnemy(e, 10, x, 'side', { burn: { dps: 2, ms: 9000 }, skill: true, fx: 0xffa040 });
    }
  }

  clearElementFx() {
    this.endEnchant();
    for (const em of this.embers) {
      this.scene.burst(em.img.x, em.img.y, 0xffa040, 8);
      em.img.destroy();
    }
    this.embers = [];
  }

  // ------------------------------------------------------------ projéteis

  updateShots(time, dt) {
    const s = this.scene;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      const img = sh.img;
      const step = sh.vx * dt;
      img.x += step;
      img.y += sh.vy * dt;
      sh.dist += Math.abs(step);
      let dead = sh.dist > sh.max;
      if (sh.kind === 'fireball') {
        img.y += Math.sin(time / 60 + sh.wobble) * 0.6;
        img.rotation += dt * 8;
      }
      if (sh.kind === 'wave') {
        // a onda anda rente ao chão: acaba num buraco ou numa parede
        const ahead = img.x + Math.sign(sh.vx) * 20;
        if (!s.isFloorAt(ahead, sh.floorY + 6) || s.cellAt(ahead, sh.floorY - 20) === '#') dead = true;
        img.setAlpha(1 - sh.dist / sh.max * 0.6);
      } else if (s.cellAt(img.x + Math.sign(sh.vx) * 16, img.y) === '#') {
        dead = true;
      }
      if (time > sh.trailAt) {
        sh.trailAt = time + 30;
        if (sh.kind !== 'fireball') this.afterimage(img);
      }
      if (!dead) {
        const b = img.getBounds();
        const rect = sh.kind === 'wave' ? new Phaser.Geom.Rectangle(b.x + 10, b.y + 10, b.width - 20, b.height - 10) : new Phaser.Geom.Rectangle(b.x + b.width * 0.2, b.y + b.height * 0.15, b.width * 0.6, b.height * 0.7);
        for (const e of s.enemies.getChildren()) {
          if (!e.alive || sh.hits.has(e)) continue;
          if (!s.enemyHitTest(e, rect)) continue;
          sh.hits.add(e);
          s.damageEnemy(e, sh.dmg, img.x - Math.sign(sh.vx) * 40, 'side', { burn: sh.burn, knock: sh.knock, skill: true, fx: sh.kind === 'fireball' ? 0xffa040 : this.def?.color });
          if (!sh.pierce) {
            dead = true;
            break;
          }
        }
        // a lâmina de vento corta flechas e pedras no caminho
        if (sh.kind === 'blade') for (const h of s.hazards.getChildren()) if (h.active && Phaser.Geom.Rectangle.Contains(rect, h.x, h.y)) s.popHazard(h);
      }
      if (dead) {
        this.shots.splice(i, 1);
        if (sh.kind === 'fireball') {
          sfx(s, 'explode', { volume: 0.5, rate: 1.4 });
          s.burst(img.x, img.y, 0xffa040, 18);
          this.ring(img.x, img.y, 0xff8a2a, 0.6, 0.25);
          sh.trail.stop();
          s.time.delayedCall(400, () => sh.trail.destroy());
        } else {
          s.burst(img.x, img.y - (sh.kind === 'wave' ? 20 : 0), this.def?.color || 0xffffff, 8);
        }
        s.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.3, duration: 120, onComplete: () => img.destroy() });
      }
    }
  }

  // ------------------------------------------------------------ efeitos

  castPose(ms) {
    const p = this.scene.player;
    const time = this.scene.time.now;
    p.sprite.play(p.anim('kio-slash'));
    p.attackAnimUntil = time + ms;
    p.lockUntil = time + ms * 0.6;
  }

  ring(x, y, color, scale, ms) {
    const s = this.scene;
    const r = s.add.image(x, y, 'ring').setBlendMode(ADD).setTint(color).setScale(0.1).setDepth(23);
    s.tweens.add({ targets: r, scale, alpha: 0, duration: ms * 1000, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  afterimage(img) {
    const s = this.scene;
    const g = s.add.image(img.x, img.y, img.texture.key).setOrigin(img.originX, img.originY).setBlendMode(ADD).setTint(img.tintTopLeft).setScale(img.scaleX, img.scaleY).setFlipX(img.flipX).setAlpha(0.35).setDepth(21);
    s.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  spark(x, y, color) {
    const s = this.scene;
    const d = s.add.image(x + Phaser.Math.Between(-6, 6), y, 'soft').setBlendMode(ADD).setTint(color).setScale(0.35).setDepth(21);
    s.tweens.add({ targets: d, y: y - 24, alpha: 0, scale: 0.05, duration: 380, onComplete: () => d.destroy() });
  }
}

export { BURN, TILE };
