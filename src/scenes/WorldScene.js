import Phaser from 'phaser';
import { TILE, WIDTH, HEIGHT, COMBAT } from '../config.js';
import { BODY_FONT } from '../fonts.js';
import { MAP, AREAS, NPCS, TABLETS, ABILITIES } from '../data/world.js';
import { Controls } from '../controls.js';
import { Player } from '../objects/Player.js';
import { ENEMY_TYPES } from '../objects/Enemies.js';
import { Ender } from '../objects/Ender.js';
import { LAYER_H } from '../gfx/backdrop.js';
import { FEET } from '../data/anims.js';
import { writeSave, encodeBits, decodeBits } from '../save.js';
import { setupCamera, FIXED_X, FIXED_Y } from '../view.js';
import { sfx } from '../audio/sfx.js';
import { playMusic } from '../audio/music.js';

const REVEAL_RADIUS = 13;
const INTERACT_RANGE = 70;

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    this.state = this.registry.get('state');
    this.grid = MAP;
    this.W = MAP[0].length;
    this.H = MAP.length;
    this.worldW = this.W * TILE;
    this.worldH = this.H * TILE;
    this.health = this.state.maxHealth;
    this.soul = 0;
    this.busy = false;
    this.mapOpen = false;
    this.explored = decodeBits(this.state.explored, Math.ceil((this.W * this.H) / 8));
    this.startedAt = this.time.now;
    this.fightingBoss = false;

    this.controls = new Controls(this);
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    this.createBackdrop();
    this.createCollision();
    this.createTerrainArt();
    this.createAmbience();

    this.enemies = this.add.group({ runChildUpdate: true });
    this.hazards = this.physics.add.group({ allowGravity: false });
    this.pickups = this.physics.add.group();
    this.interactables = [];
    this.deposits = [];
    this.gates = [];
    // arena do Ender (em pixels): entre o portão e a parede direita, do teto ao chão
    this.arena = { left: 106 * TILE, right: 137 * TILE, top: 22 * TILE, floor: 41 * TILE };
    this.bossFx = this.physics.add.group();
    this.createEntities();

    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y, this.controls);
    this.lastSafe = { ...spawn };
    // ao continuar ou renascer, o Kio acorda sentado no santuário
    if (this.state.bench) this.sitAtBench(this.state.bench);

    this.physics.add.collider(this.player.phys, this.layer, null, (p, tile) =>
      tile.index === 1 ? !this.player.isDropping(this.time.now) && this.player.body.velocity.y >= 0 : true,
    );
    this.gateGroup = this.physics.add.staticGroup(this.gates.map((g) => g.img));
    this.physics.add.collider(this.player.phys, this.gateGroup, null, () => this.fightingBoss);
    this.physics.add.collider(this.enemies, this.layer, null, (e, tile) => tile.index !== 1 || (e.body.velocity.y >= 0 && !e.ignorePlatforms));
    // choques andam pelo chão e pelas plataformas; orbes somem ao tocar a parede
    this.physics.add.collider(
      this.bossFx,
      this.layer,
      (h) => {
        if (h.getData('kind') === 'orb' || h.body.blocked.left || h.body.blocked.right) this.popBossFx(h);
      },
      (h, tile) => h.body?.enable && (tile.index !== 1 || h.body.velocity.y >= 0),
    );
    this.physics.add.collider(this.bossFx, this.gateGroup, (h) => this.popBossFx(h), () => this.fightingBoss);
    this.physics.add.overlap(this.player.phys, this.bossFx, (p, h) => {
      this.damagePlayer(h.x);
      if (h.getData('kind') === 'orb') this.popBossFx(h);
    });
    this.physics.add.collider(this.enemies, this.gateGroup, null, () => this.fightingBoss);
    this.physics.add.collider(this.pickups, this.layer);
    this.physics.add.collider(this.hazards, this.layer, (h) => {
      if (h.getData('breaks') || h.body.blocked.left || h.body.blocked.right) this.popHazard(h);
    });
    this.physics.add.overlap(this.player.phys, this.enemies, (p, e) => e.contact && e.alive && this.damagePlayer(e.x));
    this.physics.add.overlap(this.player.phys, this.hazards, (p, h) => this.damagePlayer(h.x));
    this.physics.add.overlap(this.player.phys, this.pickups, (p, g) => this.collectPickup(g));

    const cam = setupCamera(this, { world: true });
    cam.setBounds(0, 0, this.worldW, this.worldH);
    cam.startFollow(this.player.phys, true, 0.1, 0.1);
    cam.setRoundPixels(false);
    this.lookX = 0;
    this.lookY = 0;
    cam.fadeIn(700, 7, 11, 24);
    playMusic('world');

    this.scene.launch('HUD');
    this.hud = this.scene.get('HUD');
    this.hud.events.once('hud-ready', () => {
      this.hud.bind(this);
      this.refreshHud();
      this.checkArea(true);
    });
    this.events.once('shutdown', () => this.scene.stop('HUD'));

    this.revealAround();
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.revealAround() });
    this.time.addEvent({ delay: 300, loop: true, callback: () => this.checkArea(false) });
  }

  // ---------------------------------------------------------------- mundo

  cell(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return '#';
    return this.grid[ty][tx];
  }

  cellAt(x, y) {
    return this.cell(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  isFloorAt(x, y) {
    const c = this.cellAt(x, y);
    return c === '#' || c === '=';
  }

  standingOnPlatform(p) {
    return this.cellAt(p.x, p.y + 4) === '=' && this.cellAt(p.x, p.y + 4 + TILE) !== '#';
  }

  spawnPoint() {
    let key = this.state.bench;
    if (!key) {
      for (let ty = 0; ty < this.H; ty++) {
        const tx = this.grid[ty].indexOf('P');
        if (tx >= 0) key = `${tx},${ty}`;
      }
    }
    const [tx, ty] = key.split(',').map(Number);
    return { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
  }

  createCollision() {
    const data = this.grid.map((row) => [...row].map((c) => (c === '#' ? 0 : c === '=' ? 1 : -1)));
    if (!this.textures.exists('coltiles')) {
      const t = this.textures.createCanvas('coltiles', TILE * 2, TILE);
      t.refresh();
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage('coltiles', 'coltiles', TILE, TILE, 0, 0);
    this.layer = map.createLayer(0, tiles, 0, 0).setVisible(false);
    this.layer.setCollision(0);
    this.layer.forEachTile((t) => {
      if (t.index === 1) t.setCollision(false, false, true, false);
    });
  }

  createBackdrop() {
    // presos à tela: posição lógica + deslocamento do zoom (ver view.js)
    const cx = WIDTH / 2 + FIXED_X;
    const cy = HEIGHT / 2 + FIXED_Y;
    const mk = (key, depth) => this.add.tileSprite(cx, cy, WIDTH, HEIGHT, key).setScrollFactor(0).setDepth(depth);
    this.add.image(cx, cy, 'bg-sky').setScrollFactor(0).setDepth(-100);
    this.rays = this.add.image(cx, cy, 'bg-rays').setScrollFactor(0).setDepth(-95).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.rays, alpha: 0.45, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.layers = [
      { s: mk('bg-far', -90), fx: 0.12, fy: 1 },
      { s: mk('bg-fog', -85).setAlpha(0.8), fx: 0.25, fy: 0, drift: 6 },
      { s: mk('bg-mid', -80), fx: 0.3, fy: 1 },
    ];
    this.darkness = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x03050c, 0).setScrollFactor(0).setDepth(-70);
  }

  createTerrainArt() {
    const terrain = this.registry.get('terrain');
    for (const c of terrain.chunks) this.add.image(c.x, c.y, c.key).setOrigin(0).setDepth(0);
    for (const l of terrain.lights) {
      const g = this.add
        .image(l.x, l.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(Phaser.Display.Color.HexStringToColor(l.color).color)
        .setScale((l.radius * 2) / 128)
        .setAlpha(l.strength)
        .setDepth(1);
      this.tweens.add({
        targets: g,
        alpha: l.strength * 0.45,
        duration: Phaser.Math.Between(1400, 3200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  createAmbience() {
    this.fireflies = this.add.particles(0, 0, 'soft', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, WIDTH + 300, HEIGHT + 300) },
      lifespan: { min: 4000, max: 7000 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -22, max: 6 },
      scale: { start: 0.35, end: 0.1 },
      alpha: { values: [0, 0.9, 0.9, 0] },
      tint: [0x6ff6e0, 0x6ff6e0, 0xc28dff, 0xffd98a],
      blendMode: 'ADD',
      frequency: 90,
    });
    this.fireflies.setDepth(25);
  }

  // ------------------------------------------------------------- entidades

  createEntities() {
    const st = this.state;
    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        const ch = this.grid[ty][tx];
        const cx = tx * TILE + TILE / 2;
        const floor = (ty + 1) * TILE;
        const id = `${ch}:${tx},${ty}`;
        if (ENEMY_TYPES[ch]) {
          const E = ENEMY_TYPES[ch];
          this.enemies.add(new E(this, cx, ch === 'f' ? floor - TILE / 2 : floor));
        } else if (ch === 'K' && !st.bossDefeated) {
          this.boss = new Ender(this, cx, floor, this.arena);
          this.enemies.add(this.boss);
        } else if (ch === 'B') {
          this.add.image(cx, floor, 'bench').setOrigin(0.5, 1).setScale(0.7).setDepth(5);
          const light = this.add.image(cx - 41, floor - 90, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7cc8ff).setScale(1.8).setAlpha(0.5).setDepth(6);
          this.tweens.add({ targets: light, alpha: 0.3, duration: 1300, yoyo: true, repeat: -1 });
          this.addInteractable(cx, floor, 'Descansar', () => this.rest(`${tx},${ty}`));
          this.benchSpots = [...(this.benchSpots || []), { tx, ty }];
        } else if (/[1-9]/.test(ch)) {
          this.add.image(cx, floor, 'tablet').setOrigin(0.5, 1).setScale(0.5).setDepth(5);
          this.addInteractable(cx, floor, 'Ler', () => this.readTablet(ch));
        } else if (NPCS[ch]) {
          this.createNpc(ch, cx, floor);
        } else if (ch === 'g' && !st.collected.includes(id)) {
          const img = this.add.image(cx, floor, 'deposit').setOrigin(0.5, 1).setScale(0.55).setDepth(5);
          this.deposits.push({ img, hp: 4, id });
        } else if (ABILITIES[ch] && !st.collected.includes(id)) {
          this.createFloating(cx, ty * TILE + TILE / 2, 'ability', id, { ability: ch });
        } else if (ch === 'H' && !st.collected.includes(id)) {
          this.createFloating(cx, ty * TILE + TILE / 2, 'heart', id, { heart: true });
        } else if (ch === '|') {
          const img = this.add.image(cx, ty * TILE + TILE / 2, 'gate').setScale(0.5).setDepth(8).setAlpha(0);
          this.gates.push({ img });
        }
      }
    }
  }

  createNpc(ch, x, floor) {
    const def = NPCS[ch];
    const s = this.add.sprite(x, floor, def.art).setOrigin(0.5, 1).setScale(0.5).setDepth(6).play(`${def.art}-idle`);
    if (ch === 'm') {
      // Vovó Musgo (arte em folha): lanterninha verde acesa na mão
      s.setOrigin(0.5, FEET.npc_musgo).setScale(0.55);
      const lamp = this.add.image(x + 14, floor - 28, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8ff8a).setScale(1.1).setAlpha(0.5).setDepth(7);
      this.tweens.add({ targets: lamp, alpha: 0.25, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (ch === 'l') {
      s.setOrigin(0.5, 0.5).setY(floor - 40);
      this.tweens.add({ targets: s, y: floor - 50, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (ch === 'r') {
      this.raiz = s;
      s.setAlpha(this.state.bossDefeated ? 1 : 0.45);
      this.raizLight = this.add.image(x, floor - 120, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc28dff).setScale(4).setAlpha(this.state.bossDefeated ? 0.45 : 0.08).setDepth(5);
    }
    this.addInteractable(x, floor, 'Falar', () => this.talkTo(ch, s));
  }

  createFloating(x, y, key, id, data) {
    const img = this.physics.add.image(x, y, key).setScale(0.5).setDepth(9);
    img.body.setAllowGravity(false);
    img.setData({ id, ...data });
    this.tweens.add({ targets: img, y: y - 10, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const light = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(key === 'heart' ? 0x6ff6e0 : 0x7cc8ff).setScale(2.4).setAlpha(0.6).setDepth(8);
    img.setData('light', light);
    this.floatings = [...(this.floatings || []), img];
  }

  addInteractable(x, y, label, action) {
    const prompt = this.add
      .text(x, y - 120, `E  ${label}`, { fontFamily: BODY_FONT, fontSize: '18px', fontStyle: '700', color: '#e6f4ff' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6, false, true)
      .setDepth(40)
      .setAlpha(0);
    this.interactables.push({ x, y, prompt, action });
  }

  // ------------------------------------------------------------ laço

  update(time, delta) {
    this.controls.update();
    const c = this.controls;
    const p = this.player;
    this.updateCamera(delta);

    if (c.pressed.pause && this.hud?.ready && !this.hud.modal && !this.mapOpen && !this.busy) {
      this.hud.togglePause();
      return;
    }
    if (this.hud?.ready) {
      if (this.hud.modal) {
        if (c.pressed.jump || c.pressed.attack || c.pressed.interact) this.hud.advance();
        p.frozen = true;
      } else if (c.pressed.map && !this.busy && !this.mapOpen) {
        this.toggleMap();
        return;
      } else if (!this.busy && !this.mapOpen) {
        p.frozen = false;
      }
    }
    if (this.mapOpen) {
      if (c.pressed.map || c.pressed.jump || c.pressed.attack) this.toggleMap();
      return;
    }

    p.update(time, delta);
    if (p.dead) return;

    if (this.boss?.active) this.boss.updateFx(time);
    else for (const h of [...this.bossFx.getChildren()]) this.popBossFx(h);
    this.resolveAttack(time);
    this.checkThorns();
    this.trackSafeGround();
    this.checkInteractables();
    this.checkFloatings();
    this.checkBossTrigger();
    this.magnetGeo();
    if (p.y > this.worldH + 100) this.hazardRespawn();
  }

  updateCamera(delta) {
    const cam = this.cameras.main;
    const p = this.player;
    const c = this.controls;
    // olha um pouco à frente e para cima/baixo quando parado segurando ↑/↓
    const idle = p.onGround && Math.abs(p.body.velocity.x) < 10;
    this.lookHold = idle && (c.held.up || c.held.down) && !c.held.attack ? (this.lookHold || 0) + delta : 0;
    const targetY = this.lookHold > 450 ? (c.held.up ? 170 : -170) : 60;
    const targetX = -p.facing * 70;
    this.lookX = Phaser.Math.Linear(this.lookX, targetX, 0.03);
    this.lookY = Phaser.Math.Linear(this.lookY, targetY, 0.05);
    cam.setFollowOffset(this.lookX, this.lookY);

    const maxScrollY = Math.max(1, this.worldH - HEIGHT);
    for (const l of this.layers) {
      l.s.tilePositionX = cam.worldView.x * l.fx + (l.drift ? (this.time.now / 1000) * l.drift : 0);
      if (l.fy) l.s.tilePositionY = (cam.worldView.y / maxScrollY) * (LAYER_H - HEIGHT);
    }
    this.fireflies.setPosition(cam.worldView.x - 150, cam.worldView.y - 150);
  }

  // ------------------------------------------------------------ combate

  resolveAttack(time) {
    const p = this.player;
    const rect = p.attackRect(time);
    if (!rect) return;
    const a = p.attack;
    let landed = false;

    for (const e of this.enemies.getChildren()) {
      if (!e.alive || a.hits.has(e)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, this.bodyRect(e.body))) continue;
      a.hits.add(e);
      landed = true;
      this.hitEffect(Phaser.Math.Clamp(e.x, rect.left, rect.right), Phaser.Math.Clamp(e.body.center.y, rect.top, rect.bottom));
      if (e === this.boss && this.boss.state === 'sleep') this.startBoss();
      sfx(this, e === this.boss ? 'boss_hit' : 'hit');
      e.hit(p.x, a.dir);
      this.soul = Math.min(COMBAT.maxSoul, this.soul + COMBAT.soulPerHit);
    }
    for (const d of this.deposits) {
      if (!d.img.active || a.hits.has(d)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, d.img.getBounds())) continue;
      a.hits.add(d);
      landed = true;
      this.hitDeposit(d);
    }
    if (a.dir === 'down' && !a.pogoed && this.rectTouchesThorns(rect)) {
      a.pogoed = true;
      p.pogo();
      sfx(this, 'pogo');
      this.hitEffect(p.x, p.y + 30);
    }
    if (landed) {
      if (a.dir === 'down' && !a.pogoed) {
        a.pogoed = true;
        p.pogo();
      } else if (a.dir === 'side' && !a.recoiled) {
        a.recoiled = true;
        p.recoil();
      }
      this.hitStop(45);
      this.refreshHud();
    }
  }

  bodyRect(b) {
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  rectTouchesThorns(r) {
    for (let y = r.top; y <= r.bottom; y += TILE / 2) {
      for (let x = r.left; x <= r.right; x += TILE / 2) {
        if (this.cellAt(x, y) === '^') return true;
      }
    }
    return false;
  }

  hitDeposit(d) {
    sfx(this, 'pop', { rate: 1.3 });
    d.hp--;
    this.tweens.add({ targets: d.img, x: d.img.x + 4, duration: 40, yoyo: true, repeat: 2 });
    this.spawnGeo(d.img.x, d.img.y - 30, d.hp > 0 ? 3 : 8);
    if (d.hp <= 0) {
      this.burst(d.img.x, d.img.y - 20, 0xffd98a, 24);
      d.img.destroy();
      this.state.collected.push(d.id);
    }
  }

  onPlayerAttack(p, dir) {
    sfx(this, dir === 'up' ? 'slash_up' : 'slash', { volume: 0.7 });
    const s = this.add.image(0, 0, 'slash').setBlendMode(Phaser.BlendModes.ADD).setDepth(22).setScale(0.55);
    if (dir === 'up') s.setPosition(p.x, p.y - 118).setAngle(-90).setFlipY(p.facing < 0);
    else if (dir === 'down') s.setPosition(p.x, p.y + 30).setAngle(90).setFlipY(p.facing > 0);
    else s.setPosition(p.x + p.facing * 58, p.y - 46).setFlipX(p.facing < 0);
    this.tweens.add({ targets: s, alpha: 0, scaleX: 0.62, duration: 170, onComplete: () => s.destroy() });
  }

  onPlayerDash(p) {
    sfx(this, 'dash', { volume: 0.7 });
    this.burst(p.x - p.facing * 20, p.y - 40, 0x7cc8ff, 10);
  }

  onPlayerDoubleJump(p) {
    sfx(this, 'double_jump', { volume: 0.6 });
    const e = this.add.particles(p.x, p.y, 'soft', {
      speedX: { min: -120, max: 120 },
      speedY: { min: 20, max: 140 },
      lifespan: 380,
      scale: { start: 0.6, end: 0 },
      tint: [0x7cc8ff, 0xdff4ff],
      blendMode: 'ADD',
      emitting: false,
    });
    e.setDepth(21);
    e.explode(18);
    this.time.delayedCall(500, () => e.destroy());
  }

  onPlayerStep(p) {
    sfx(this, 'step', { volume: 0.18, vary: 0.2 });
    const e = this.add.particles(p.x - p.facing * 10, p.y, 'soft', {
      speedX: { min: -30, max: 30 },
      speedY: { min: -30, max: -5 },
      lifespan: 280,
      scale: { start: 0.25, end: 0 },
      tint: 0x9fdcff,
      alpha: { start: 0.45, end: 0 },
      emitting: false,
    });
    e.setDepth(21);
    e.explode(3);
    this.time.delayedCall(350, () => e.destroy());
  }

  onPlayerJump() {
    sfx(this, 'jump', { volume: 0.5 });
  }

  onPlayerLand(p) {
    sfx(this, 'land', { volume: 0.45 });
    if (p.body.velocity.y >= 0) this.dust(p.x, p.y);
  }

  onEnemyKilled(e) {
    sfx(this, 'kill', { volume: 0.8 });
    this.burst(e.x, e.body.center.y, 0x9fdcff, e === this.boss ? 60 : 18);
    this.spawnGeo(e.x, e.body.center.y, e.geo);
    if (e === this.boss) this.bossDefeated();
  }

  onBossHit(boss) {
    this.hud?.bossBar(true, boss.hp / boss.maxHp);
  }

  spawnOrb(x, y, vx, vy) {
    sfx(this, 'spit', { volume: 0.6 });
    const o = this.hazards.create(x, y, 'orb').setScale(0.9).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    o.body.setAllowGravity(false).setCircle(10, 14, 14);
    o.setVelocity(vx, vy);
    o.setData('breaks', true);
    this.time.delayedCall(4000, () => o.active && this.popHazard(o));
  }

  popBossFx(h) {
    if (!h.active || !h.body?.enable) return;
    this.burst(h.x, h.y - (h.getData('kind') === 'shock' ? 20 : 0), 0xc28dff, 10);
    this.retire(h);
  }

  // Remove um objeto com física sem quebrar a checagem de colisão em andamento:
  // desliga o corpo agora e destrói no próximo quadro.
  retire(obj) {
    obj.body.enable = false;
    obj.setVisible(false);
    this.time.delayedCall(0, () => obj.destroy());
  }

  popHazard(h) {
    if (!h.active || !h.body?.enable) return;
    sfx(this, 'pop', { volume: 0.4 });
    this.burst(h.x, h.y, 0xd9a8ff, 8);
    this.retire(h);
  }

  damagePlayer(fromX) {
    const p = this.player;
    if (p.invulnerable || p.dead || this.busy) return;
    this.health--;
    sfx(this, 'hurt');
    p.hurt(fromX);
    this.cameras.main.shake(160, 0.008);
    this.hud?.flashDamage();
    this.hitStop(110);
    this.refreshHud();
    if (this.health <= 0) this.die();
  }

  hitStop(ms) {
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  checkThorns() {
    const b = this.player.body;
    if (this.busy) return;
    for (let x = b.left + 4; x <= b.right - 4; x += 10) {
      for (let y = b.top; y <= b.bottom; y += 10) {
        if (this.cellAt(x, y) === '^' && y % TILE > 12) {
          this.hazardRespawn(true);
          return;
        }
      }
    }
  }

  trackSafeGround() {
    const p = this.player;
    if (!p.onGround || p.dashing) return;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor((p.y - 4) / TILE);
    for (let dx = -2; dx <= 2; dx++) if (this.cell(tx + dx, ty) === '^' || this.cell(tx + dx, ty + 1) === '^') return;
    const under = this.cell(tx, ty + 1);
    if (under === '#' || under === '=') this.lastSafe = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
  }

  // Espinhos (e cair fora do mapa): perde 1 de vida e volta para o último chão seguro.
  hazardRespawn(damage = false) {
    const p = this.player;
    if (this.busy) return;
    if (damage) {
      this.health--;
      sfx(this, 'hurt');
      this.hud?.flashDamage();
      this.refreshHud();
      if (this.health <= 0) return this.die();
    }
    this.busy = true;
    p.frozen = true;
    this.burst(p.x, p.y - 40, 0x7cc8ff, 14);
    p.setVisible(false);
    p.body.setVelocity(0, 0);
    p.body.setAllowGravity(false);
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.time.delayedCall(320, () => {
      p.setPosition(this.lastSafe.x, this.lastSafe.y);
      p.body.setAllowGravity(true);
      p.setVisible(true);
      p.invulnUntil = this.time.now + 900;
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.busy = false;
      p.frozen = false;
    });
  }

  die() {
    const p = this.player;
    p.dead = true;
    this.busy = true;
    p.body.setVelocity(0, 0).setAllowGravity(false);
    this.burst(p.x, p.y - 40, 0x7cc8ff, 40);
    p.setVisible(false);
    this.state.deaths++;
    this.saveProgress();
    this.cameras.main.shake(300, 0.01);
    this.time.delayedCall(700, () => {
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
    });
  }

  canHeal() {
    return this.soul >= COMBAT.healCost && this.health < this.state.maxHealth;
  }

  completeHeal() {
    sfx(this, 'heal', { volume: 0.7, vary: 0 });
    this.soul -= COMBAT.healCost;
    this.health++;
    this.burst(this.player.x, this.player.y - 60, 0xdff4ff, 16);
    this.refreshHud();
  }

  // ------------------------------------------------------------ coleta

  spawnGeo(x, y, n) {
    for (let i = 0; i < n; i++) {
      const g = this.pickups.create(x, y, 'geo').setDepth(14);
      g.setVelocity(Phaser.Math.Between(-160, 160), Phaser.Math.Between(-420, -200));
      g.setBounce(0.45).setDragX(120);
      g.body.setSize(20, 20);
      g.setData('geo', 1);
    }
  }

  collectPickup(g) {
    sfx(this, 'geo', { volume: 0.35, vary: 0.12 });
    if (!g.active) return;
    this.state.geo += g.getData('geo') || 0;
    const s = this.add.image(g.x, g.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd98a).setScale(0.4).setDepth(15);
    this.tweens.add({ targets: s, alpha: 0, scale: 0.8, duration: 200, onComplete: () => s.destroy() });
    g.destroy();
    this.refreshHud();
  }

  magnetGeo() {
    const p = this.player;
    for (const g of this.pickups.getChildren()) {
      const dx = p.x - g.x;
      const dy = p.y - 40 - g.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && g.body.velocity.y >= -50) {
        g.body.setAllowGravity(false);
        g.setVelocity((dx / d) * 420, (dy / d) * 420);
      }
    }
  }

  checkFloatings() {
    const p = this.player;
    for (const f of this.floatings || []) {
      if (!f.active) continue;
      if (Math.abs(f.x - p.x) < 40 && Math.abs(f.y - (p.y - 40)) < 60) this.acquire(f);
    }
  }

  acquire(f) {
    sfx(this, 'ability', { vary: 0 });
    const id = f.getData('id');
    const abilityKey = f.getData('ability');
    this.burst(f.x, f.y, 0xdff4ff, 40);
    f.getData('light').destroy();
    f.destroy();
    this.state.collected.push(id);
    this.cameras.main.flash(400, 200, 235, 255);
    if (abilityKey) {
      const def = ABILITIES[abilityKey];
      this.state.abilities[def.key] = true;
      this.saveProgress();
      this.hud.showAbility(def.name, def.text, def.hint);
    } else {
      this.gainHeart();
      this.saveProgress();
      this.hud.showAbility('Coração de Musgo', 'Sua chama ficou mais forte.', 'Vida máxima +1.');
    }
  }

  gainHeart() {
    this.state.maxHealth++;
    this.health = this.state.maxHealth;
    this.refreshHud();
  }

  // --------------------------------------------------------- interação

  checkInteractables() {
    const p = this.player;
    let best = null;
    let bestD = INTERACT_RANGE;
    for (const it of this.interactables) {
      const d = Math.abs(it.x - p.x);
      if (d < bestD && Math.abs(it.y - p.y) < 70) {
        best = it;
        bestD = d;
      }
    }
    for (const it of this.interactables) {
      const target = it === best && !this.hud?.modal && !p.sitting ? 1 : 0;
      it.prompt.alpha = Phaser.Math.Linear(it.prompt.alpha, target, 0.2);
    }
    if (best && p.onGround && !p.frozen && !p.sitting && this.time.now > (this.talkCooldown || 0) && this.controls.pressed.interact) {
      best.action();
    }
  }

  say(lines) {
    this.controls.consume();
    return this.hud.say(lines).then(() => {
      this.controls.consume();
      this.talkCooldown = this.time.now + 450; // o mesmo E que fechou não reabre a conversa
    });
  }

  talkTo(ch, sprite) {
    const def = NPCS[ch];
    sprite.setFlipX(this.player.x < sprite.x && ch !== 'r');
    const { lines, effect } = def.talk(this.state);
    const first = !this.state.talked.includes(ch);
    this.say(lines).then(() => {
      if (first && (ch !== 'r' || this.state.bossDefeated)) this.state.talked.push(ch);
      effect?.(this);
      this.refreshHud();
    });
  }

  readTablet(n) {
    if (!this.state.read.includes(n)) this.state.read.push(n);
    this.say([{ who: '', text: TABLETS[n] }]);
  }

  // Senta no banco (cura, salva) — como no Hollow Knight.
  sitAtBench(key) {
    const [tx, ty] = key.split(',').map(Number);
    this.player.sit(tx * TILE + TILE / 2 + 17, (ty + 1) * TILE);
  }

  rest(key) {
    sfx(this, 'rest', { volume: 0.6, vary: 0 });
    this.sitAtBench(key);
    this.state.bench = key;
    this.health = this.state.maxHealth;
    this.saveProgress();
    this.refreshHud();
    this.burst(this.player.x, this.player.y - 40, 0x7cc8ff, 20);
    this.hud.toast('Você descansou. Jogo salvo.');
  }

  // ------------------------------------------------------------ chefe

  checkBossTrigger() {
    if (!this.boss || !this.boss.alive || this.boss.state !== 'sleep') return;
    if (this.player.x > 110 * TILE && this.player.y > 22 * TILE) this.startBoss();
  }

  startBoss() {
    if (this.fightingBoss) return;
    this.fightingBoss = true;
    sfx(this, 'gate', { vary: 0 });
    for (const g of this.gates) this.tweens.add({ targets: g.img, alpha: 1, duration: 300 });
    playMusic('boss', { fadeMs: 800 });
    // câmera desliza e trava mostrando a arena inteira
    const cam = this.cameras.main;
    const cx = (this.arena.left + this.arena.right) / 2 - 16;
    const cy = (this.arena.top + this.arena.floor) / 2 + 64; // chão mais alto na tela, livre da barra
    cam.stopFollow();
    cam.pan(cx, cy, 700, 'Sine.easeInOut', false, (c, t) => {
      if (t < 1) return;
      cam.setBounds(cx - WIDTH / 2, cy - HEIGHT / 2, WIDTH, HEIGHT);
      cam.startFollow(this.player.phys, true, 0.1, 0.1);
    });
    this.hud.bossIntro('Ender', 'Cavaleiro Espectral');
    this.time.delayedCall(2700, () => this.fightingBoss && this.hud.bossBar(true, this.boss.hp / this.boss.maxHp));
    this.time.delayedCall(1500, () => this.boss?.alive && this.boss.state === 'sleep' && this.boss.wake());
  }

  onBossHit(boss) {
    this.hud?.bossBar(true, boss.hp / boss.maxHp);
  }

  onBossPhase(phase) {
    this.hud?.bossPhase(phase);
  }

  bossDefeated() {
    this.fightingBoss = false;
    this.state.bossDefeated = true;
    this.hud.bossBar(false);
    this.hitStop(250);
    this.time.delayedCall(1800, () => {
      for (const g of this.gates) this.tweens.add({ targets: g.img, alpha: 0, duration: 800 });
      sfx(this, 'gate', { vary: 0 });
      this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
      playMusic('world', { fadeMs: 3000 });
      this.tweens.add({ targets: this.raiz, alpha: 1, duration: 1500 });
      this.tweens.add({ targets: this.raizLight, alpha: 0.45, duration: 1500 });
      this.hud.toast('A Raiz desperta.');
    });
    this.saveProgress();
  }

  finishGame() {
    this.busy = true;
    this.player.frozen = true;
    this.saveProgress();
    this.cameras.main.fadeOut(2200, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End'));
  }

  // ------------------------------------------------------------ mapa, áreas

  revealAround() {
    if (!this.player) return;
    const cx = Math.floor(this.player.x / TILE);
    const cy = Math.floor((this.player.y - 30) / TILE);
    const r = REVEAL_RADIUS;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r - 6; x <= cx + r + 6; x++) {
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const dx = (x - cx) / (r + 6);
        const dy = (y - cy) / r;
        if (dx * dx + dy * dy > 1) continue;
        const i = y * this.W + x;
        this.explored[i >> 3] |= 1 << (i & 7);
      }
    }
  }

  isExplored(tx, ty) {
    const i = ty * this.W + tx;
    return (this.explored[i >> 3] >> (i & 7)) & 1;
  }

  checkArea(force) {
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor((this.player.y - 30) / TILE);
    const area = AREAS.find((a) => tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h);
    if (area) {
      this.tweens.add({ targets: this.darkness, fillAlpha: area.dark, duration: 900 });
      if (area !== this.area || force) {
        this.area = area;
        this.hud?.showArea(area.name);
      }
    }
  }

  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.player.frozen = this.mapOpen;
    if (this.mapOpen) this.physics.world.pause();
    else this.physics.world.resume();
    this.hud.showMap(this.mapOpen);
  }

  // ------------------------------------------------------------ salvar

  saveProgress() {
    this.state.explored = encodeBits(this.explored);
    this.state.playMs += this.time.now - this.startedAt;
    this.startedAt = this.time.now;
    writeSave(this.state);
  }

  refreshHud() {
    this.hud?.refresh({ health: this.health, maxHealth: this.state.maxHealth, soul: this.soul, geo: this.state.geo });
  }

  // ------------------------------------------------------------ efeitos

  hitEffect(x, y) {
    const s = this.add.image(x, y, 'hitfx').setBlendMode(Phaser.BlendModes.ADD).setDepth(23).setAngle(Phaser.Math.Between(0, 90)).setScale(0.9);
    this.tweens.add({ targets: s, alpha: 0, scale: 1.3, duration: 130, onComplete: () => s.destroy() });
    this.burst(x, y, 0xdff4ff, 6);
  }

  burst(x, y, tint, quantity) {
    const e = this.add.particles(x, y, 'soft', {
      speed: { min: 60, max: 260 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.5, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    });
    e.setDepth(24);
    e.explode(quantity);
    this.time.delayedCall(800, () => e.destroy());
  }

  dust(x, y) {
    const e = this.add.particles(x, y, 'soft', {
      speedX: { min: -80, max: 80 },
      speedY: { min: -50, max: -10 },
      lifespan: 350,
      scale: { start: 0.35, end: 0 },
      tint: 0x9fdcff,
      alpha: { start: 0.6, end: 0 },
      emitting: false,
    });
    e.setDepth(21);
    e.explode(8);
    this.time.delayedCall(500, () => e.destroy());
  }
}
