import Phaser from 'phaser';
import { TILE, WIDTH, HEIGHT, COMBAT, MANA } from '../config.js';
import { BODY_FONT } from '../fonts.js';
import { MAP, AREAS, NPCS, TABLETS, ABILITIES, ELEMENTS, ARENAS, STORMS, RUINS_X } from '../data/world.js';
import { Controls, currentKeys, keyLabel } from '../controls.js';
import { Player } from '../objects/Player.js';
import { ENEMY_TYPES, Tornado, Vent } from '../objects/Enemies.js';
import { Ender } from '../objects/Ender.js';
import { Worm } from '../objects/Worm.js';
import { RuinKnight } from '../objects/RuinKnight.js';
import { Skills } from '../objects/Skills.js';
import { LAYER_H } from '../gfx/backdrop.js';
import { FEET } from '../data/anims.js';
import { writeSave, encodeBits, decodeBits } from '../save.js';
import { setupCamera, FIXED_X, FIXED_Y } from '../view.js';
import { sfx } from '../audio/sfx.js';
import { playMusic } from '../audio/music.js';

const REVEAL_RADIUS = 13;
const INTERACT_RANGE = 70;
const OLD_MAP_W = 140; // largura do mapa antes das Ruínas (saves antigos)

// Chefes: nome, subtítulo, cor da barra, música e a chave do save quando cai
export const BOSSES = {
  ender: { name: 'Ender', sub: 'Cavaleiro Espectral', color: 0xb45cff, music: 'boss', flag: 'bossDefeated' },
  worm: { name: 'Ixtara', sub: 'A Fome das Dunas', color: 0xffa040, music: 'worm', flag: 'wormDefeated', bar: 'bossbar-fill-worm' },
  knight: { name: 'Sarkon', sub: 'Cavaleiro das Ruínas', color: 0xffc070, music: 'knight', flag: 'knightDefeated', bar: 'bossbar-fill-knight' },
};

const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

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
    this.explored = this.loadExplored();
    this.startedAt = this.time.now;
    this.fight = null; // id da arena em luta (ender, worm, knight)
    this.mana = this.state.element ? MANA.max * 0.6 : 0;
    this.burns = new Map();
    this.props = []; // redemoinhos e respiros de vapor
    this.bosses = {};
    this.arenas = {};
    for (const [id, a] of Object.entries(ARENAS)) this.arenas[id] = { id, left: a.left * TILE, right: a.right * TILE, top: a.top * TILE, floor: a.floor * TILE, tiles: a };
    this.gustUntil = 0;
    this.stormT = 0;
    this.biomeT = -1;

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
    this.bossFx = this.physics.add.group();
    this.createEntities();

    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y, this.controls);
    if (this.state.element) this.player.setElement(this.state.element, ELEMENTS[this.state.element]);
    this.skills = new Skills(this);
    this.lastSafe = { ...spawn };
    // ao continuar ou renascer, o Kio acorda sentado no santuário
    if (this.state.bench) this.sitAtBench(this.state.bench);
    this.createShade();

    this.physics.add.collider(this.player.phys, this.layer, null, (p, tile) =>
      tile.index === 1 ? !this.player.isDropping(this.time.now) && this.player.body.velocity.y >= 0 : true,
    );
    this.gateGroup = this.physics.add.staticGroup(this.gates.map((g) => g.img));
    const gateClosed = (a, b) => this.gateClosed((a.getData?.('gate') ? a : b).getData('gate'));
    this.physics.add.collider(this.player.phys, this.gateGroup, null, gateClosed);
    this.physics.add.collider(this.enemies, this.layer, null, (e, tile) => tile.index !== 1 || (e.body.velocity.y >= 0 && !e.ignorePlatforms));
    // choques andam pelo chão e pelas plataformas; orbes somem ao tocar a parede
    this.physics.add.collider(
      this.bossFx,
      this.layer,
      (h) => {
        const kind = h.getData('kind');
        if (kind === 'orb' || kind === 'rock' || h.body.blocked.left || h.body.blocked.right) this.popBossFx(h);
      },
      (h, tile) => h.body?.enable && (tile.index !== 1 || h.body.velocity.y >= 0),
    );
    this.physics.add.collider(this.bossFx, this.gateGroup, (a, b) => this.popBossFx(a.getData('gate') ? b : a), gateClosed);
    this.physics.add.overlap(this.player.phys, this.bossFx, (p, h) => {
      if (!h.body?.enable) return;
      this.damagePlayer(h.x);
      if (h.getData('kind') === 'orb' || h.getData('kind') === 'rock') this.popBossFx(h);
    });
    this.physics.add.collider(this.enemies, this.gateGroup, null, gateClosed);
    this.physics.add.collider(this.pickups, this.layer);
    this.physics.add.collider(this.hazards, this.layer, (h) => {
      if (h.getData('breaks') || h.body.blocked.left || h.body.blocked.right) this.popHazard(h);
    });
    this.physics.add.overlap(this.player.phys, this.enemies, (p, e) => e.contact && e.alive && this.damagePlayer(e.x));
    this.physics.add.overlap(this.player.phys, this.hazards, (p, h) => {
      if (!h.body?.enable) return;
      this.damagePlayer(h.x);
      if (h.getData('kind') === 'arrow') this.popHazard(h);
    });
    this.physics.add.overlap(this.player.phys, this.pickups, (p, g) => this.collectPickup(g));

    const cam = setupCamera(this, { world: true });
    cam.setBounds(0, 0, this.worldW, this.worldH);
    cam.startFollow(this.player.phys, true, 0.1, 0.1);
    cam.setRoundPixels(false);
    this.lookX = 0;
    this.lookY = 0;
    cam.fadeIn(700, 7, 11, 24);
    playMusic(this.player.x >= RUINS_X * TILE ? 'ruins' : 'world');

    this.scene.launch('HUD');
    this.hud = this.scene.get('HUD');
    this.hud.events.once('hud-ready', () => {
      this.hud.bind(this);
      this.refreshHud();
      this.hud.setElement(this.state.element, this.state.elements.length > 1);
      this.checkArea(true);
      if (this.registry.get('lostGeo')) {
        this.hud.toast(`Seus ${this.registry.get('lostGeo')} fragmentos ficaram onde você caiu.`);
        this.registry.set('lostGeo', 0);
      }
    });
    this.events.once('shutdown', () => this.scene.stop('HUD'));

    this.revealAround();
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.revealAround() });
    this.time.addEvent({ delay: 300, loop: true, callback: () => this.checkArea(false) });
  }

  // ---------------------------------------------------------------- mundo

  // Mapa explorado; saves de antes das Ruínas tinham o mapa mais estreito.
  loadExplored() {
    const bytes = Math.ceil((this.W * this.H) / 8);
    const oldW = this.state.mapW || OLD_MAP_W;
    if (oldW === this.W) return decodeBits(this.state.explored, bytes);
    const old = decodeBits(this.state.explored, Math.ceil((oldW * this.H) / 8));
    const out = new Uint8Array(bytes);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < Math.min(oldW, this.W); x++) {
        const i = y * oldW + x;
        if ((old[i >> 3] >> (i & 7)) & 1) {
          const j = y * this.W + x;
          out[j >> 3] |= 1 << (j & 7);
        }
      }
    }
    return out;
  }

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
      { s: mk('bg-far', -90), fx: 0.12, fy: 1, forest: true },
      { s: mk('bg-fog', -85).setAlpha(0.8), fx: 0.25, fy: 0, drift: 6, forest: true, a: 0.8 },
      { s: mk('bg-mid', -80), fx: 0.3, fy: 1, forest: true },
      // Ruínas: céu de entardecer, dunas e ruínas ao longe (aparecem depois do portão)
      { s: mk('bgd-far', -89), fx: 0.1, fy: 1, desert: true },
      { s: mk('bgd-haze', -84), fx: 0.22, fy: 0, drift: -14, desert: true, a: 0.9 },
      { s: mk('bgd-mid', -79), fx: 0.28, fy: 1, desert: true },
    ];
    this.desertSky = this.add.image(cx, cy, 'bgd-sky').setScrollFactor(0).setDepth(-99).setAlpha(0);
    this.darkness = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x03050c, 0).setScrollFactor(0).setDepth(-70);
    // tempestade de areia por cima de tudo (menos o HUD)
    this.storm = this.add.tileSprite(cx, cy, WIDTH, HEIGHT, 'sand-storm').setScrollFactor(0).setDepth(30).setAlpha(0);
    this.stormTint = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0xc08050, 0).setScrollFactor(0).setDepth(29);
    this.dim = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x02030a, 0).setScrollFactor(0).setDepth(19);
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
    // nas Ruínas: grãos de areia soprados
    this.motes = this.add.particles(0, 0, 'soft', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, WIDTH + 300, HEIGHT + 300) },
      lifespan: { min: 2500, max: 4500 },
      speedX: { min: -70, max: -20 },
      speedY: { min: -10, max: 14 },
      scale: { start: 0.22, end: 0.08 },
      alpha: { values: [0, 0.8, 0.8, 0] },
      tint: [0xffd9a0, 0xffb070, 0xfff0d0],
      blendMode: 'ADD',
      frequency: 70,
      emitting: false,
    });
    this.motes.setDepth(25);
  }

  // Floresta -> Ruínas: troca o fundo e as partículas conforme o x do Kio.
  updateBiome() {
    const x = this.player.x;
    const t = Phaser.Math.Clamp((x - (RUINS_X - 1) * TILE) / (8 * TILE), 0, 1);
    if (Math.abs(t - this.biomeT) < 0.001) return;
    this.biomeT = t;
    for (const l of this.layers) l.s.setAlpha((l.a ?? 1) * (l.desert ? t : 1 - t));
    this.rays.setVisible(t < 1);
    this.desertSky.setAlpha(t);
    this.fireflies.emitting = t < 0.5;
    this.motes.emitting = t >= 0.5;
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
          this.addBoss('ender', new Ender(this, cx, floor, this.arenas.ender));
        } else if (ch === 'W' && !st.wormDefeated) {
          this.addBoss('worm', new Worm(this, cx, floor, this.arenas.worm));
        } else if (ch === 'R' && !st.knightDefeated) {
          this.addBoss('knight', new RuinKnight(this, cx, floor, this.arenas.knight));
        } else if (ch === 't') {
          this.props.push(new Tornado(this, cx, floor));
        } else if (ch === 'v' || ch === 'u') {
          this.props.push(new Vent(this, cx, floor, ch === 'u'));
        } else if (ch === 'Z' && !st.collected.includes(id)) {
          this.createFloating(cx, ty * TILE + TILE / 2, 'ability', id, { skill: 2 });
        } else if (ch === 'X') {
          this.createAltar(cx, floor);
        } else if (ch === '}') {
          if (!this.ruinGate) {
            // porta de pedra de 5 blocos (a letra aparece em cada bloco da coluna)
            const img = this.add.image(cx, ty * TILE, 'ruin-gate').setOrigin(0.5, 0).setScale(0.5).setDepth(8);
            img.setData('gate', 'ruins');
            this.ruinGate = img;
            this.gates.push({ img, kind: 'ruins' });
            if (st.gateOpen) img.setVisible(false);
          }
        } else if (ch === '!') {
          const img = this.add.image(cx, ty * TILE + TILE / 2, 'gate').setScale(0.5).setDepth(8).setTint(0xffc080);
          const arena = this.arenaOfTile(tx, ty);
          img.setData('gate', `exit:${arena}`);
          this.gates.push({ img, kind: 'exit', arena });
          if (st[BOSSES[arena].flag]) img.setVisible(false);
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
          const arena = this.arenaOfTile(tx, ty);
          img.setData('gate', `fight:${arena}`);
          this.gates.push({ img, kind: 'fight', arena });
        }
      }
    }
    // a habilidade 3 aparece onde a Minhoca caiu (se já caiu e ainda não pegou)
    if (st.wormDefeated && !st.collected.includes('skill3')) this.spawnSkill3();
  }

  addBoss(id, boss) {
    boss.bossId = id;
    boss.isBoss = true;
    this.bosses[id] = boss;
    this.enemies.add(boss);
  }

  arenaOfTile(tx, ty) {
    for (const [id, a] of Object.entries(ARENAS)) if (tx >= a.left - 1 && tx <= a.right && ty >= a.top && ty <= a.floor) return id;
    return 'ender';
  }

  gateClosed(key) {
    if (!key) return false;
    if (key === 'ruins') return !this.state.gateOpen;
    const [kind, arena] = key.split(':');
    if (kind === 'fight') return this.fight === arena;
    return !this.state[BOSSES[arena].flag];
  }

  createAltar(x, floor) {
    this.add.image(x, floor, 'altar').setOrigin(0.5, 1).setScale(0.55).setDepth(5);
    this.altar = { x, y: floor - 112 };
    this.altarFlame = this.add.image(x, floor - 108, 'flame').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setDepth(6);
    this.altarLight = this.add.image(x, floor - 120, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0.5).setDepth(5);
    this.tweens.add({ targets: this.altarFlame, scaleY: 0.95, scaleX: 0.72, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.refreshAltar();
    this.addInteractable(x, floor, 'Tocar o altar', () => this.touchAltar());
  }

  // O altar mostra a cor do elemento que o Kio ainda não tem.
  refreshAltar() {
    if (!this.altarFlame) return;
    const st = this.state;
    const other = st.element === 'wind' ? 'fire' : st.element === 'fire' ? 'wind' : null;
    const has = other && st.elements.includes(other);
    const color = other ? ELEMENTS[other].color : 0xffffff;
    this.altarFlame.setTint(color).setAlpha(has ? 0.25 : 1);
    this.altarLight.setTint(color).setAlpha(has ? 0.15 : 0.5);
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
    const tint = data.skill && this.state.element ? ELEMENTS[this.state.element].color : key === 'heart' ? 0x6ff6e0 : 0x7cc8ff;
    if (data.skill) img.setTint(tint);
    const light = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(2.4).setAlpha(0.6).setDepth(8);
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

    this.updateWind(time, delta);
    p.update(time, delta);
    this.updateBiome();
    for (const pr of this.props) pr.update(time, delta);
    if (p.dead) return;
    this.skills.update(time, delta);
    this.updateBurns(time);
    const boss = this.fight && this.bosses[this.fight];
    if (boss?.active) boss.updateFx?.(time);
    else for (const h of [...this.bossFx.getChildren()]) this.popBossFx(h);
    this.hud?.updateSkills(this);
    this.checkShade();
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
    this.motes.setPosition(cam.worldView.x - 150, cam.worldView.y - 150);
  }

  // ------------------------------------------------------ vento e tempestade

  // Rajada: empurra o Kio na direção `dir` por `ms` (tempestades e o Cavaleiro).
  gust(dir, strength, ms) {
    this.gustDir = dir;
    this.gustStrength = strength;
    this.gustAt = this.time.now;
    this.gustUntil = this.time.now + ms;
    sfx(this, 'gust', { volume: 0.7 });
  }

  updateWind(time, delta) {
    const p = this.player;
    const tx = p.x / TILE;
    const ty = (p.y - 30) / TILE;
    const inStorm = STORMS.some((r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
    this.stormT = Phaser.Math.Linear(this.stormT, inStorm ? 1 : 0, 0.02);
    if (inStorm && time > this.gustUntil + 2600 + Math.random() * 3000) this.gust(-1, 170, 1500);
    let push = 0;
    let streak = 0;
    if (time < this.gustUntil) {
      const k = Math.sin(((time - this.gustAt) / (this.gustUntil - this.gustAt)) * Math.PI);
      push = this.gustDir * this.gustStrength * k;
      streak = k;
    }
    p.windPush = push;
    this.storm.setAlpha(this.stormT * (0.45 + streak * 0.4) + (this.fight === 'knight' ? streak * 0.5 : 0));
    this.storm.tilePositionX += (delta / 1000) * (260 + streak * 900) * (this.gustDir || -1) * -1;
    this.storm.tilePositionY = this.cameras.main.worldView.y * 0.3;
    this.stormTint.fillAlpha = this.stormT * 0.12 + streak * 0.08;
  }

  // ------------------------------------------------------------ combate

  resolveAttack(time) {
    const p = this.player;
    const rect = p.attackRect(time);
    if (!rect) return;
    const a = p.attack;
    let landed = false;
    const fire = this.skills.enchanted;

    for (const e of this.enemies.getChildren()) {
      if (!e.alive || a.hits.has(e)) continue;
      if (!this.enemyHitTest(e, rect)) continue;
      a.hits.add(e);
      landed = true;
      const c = this.enemyCenter(e);
      this.hitEffect(Phaser.Math.Clamp(c.x, rect.left, rect.right), Phaser.Math.Clamp(c.y, rect.top, rect.bottom), fire ? 0xffa040 : undefined);
      const dmg = COMBAT.nailDamage + (fire ? 3 : 0);
      const ok = this.damageEnemy(e, dmg, p.x, a.dir, { burn: fire ? { dps: 2, ms: 4000 } : null, nail: true });
      if (ok) {
        this.soul = Math.min(COMBAT.maxSoul, this.soul + COMBAT.soulPerHit);
        if (this.state.element) this.mana = Math.min(this.skills.capacity, this.mana + MANA.perHit);
      }
    }
    // a espada rebate flechas e pedras
    for (const h of this.hazards.getChildren()) {
      if (!h.active || !h.body?.enable || a.hits.has(h)) continue;
      if (!Phaser.Geom.Rectangle.Contains(rect, h.x, h.y)) continue;
      a.hits.add(h);
      sfx(this, 'clang', { volume: 0.4, rate: 1.6 });
      this.popHazard(h);
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

  enemyHitTest(e, rect) {
    if (e.hitTest) return e.hitTest(rect);
    return e.body?.enable !== false && Phaser.Geom.Intersects.RectangleToRectangle(rect, this.bodyRect(e.body));
  }

  enemyCenter(e) {
    if (e.center) return e.center();
    return { x: e.x, y: e.body ? e.body.center.y : e.y };
  }

  // Dano em inimigo (espada, habilidades, queimadura). Devolve false se o
  // golpe foi bloqueado por um escudo/guarda.
  damageEnemy(e, dmg, fromX, dir, opts = {}) {
    if (!e.alive) return false;
    if (!opts.dot && !opts.unblockable && !opts.knock && e.guards?.(fromX, dir)) {
      const c = this.enemyCenter(e);
      sfx(this, 'clang', { volume: 0.8 });
      this.burst(c.x + Math.sign(fromX - e.x) * 30, c.y, 0xffe0a0, 10);
      e.onBlocked?.();
      if (opts.nail) {
        this.player.body.setVelocityX(-this.player.facing * 340);
        this.hitStop(60);
      }
      return false;
    }
    if (e.isBoss && e.state === 'sleep') this.startBoss(e.bossId);
    if (!opts.dot) {
      sfx(this, e.isBoss ? 'boss_hit' : 'hit', { volume: opts.skill ? 0.7 : 1 });
      if (opts.fx) {
        const c = this.enemyCenter(e);
        this.hitEffect(c.x, c.y, opts.fx);
      }
    }
    const burn = opts.burn;
    e.hit(fromX, dir, dmg, opts);
    if (burn && e.alive) this.applyBurn(e, burn);
    return true;
  }

  // Queimadura: 2 de dano por segundo; pegar fogo de novo renova o tempo.
  applyBurn(e, { dps, ms }) {
    const now = this.time.now;
    const b = this.burns.get(e);
    if (b) {
      b.until = Math.max(b.until, now + ms);
      b.dps = Math.max(b.dps, dps);
    } else {
      this.burns.set(e, { until: now + ms, dps, next: now + 1000, fx: 0 });
    }
  }

  updateBurns(time) {
    for (const [e, b] of this.burns) {
      if (!e.alive || !e.active || time > b.until) {
        this.burns.delete(e);
        continue;
      }
      const c = this.enemyCenter(e);
      if (time > b.fx) {
        b.fx = time + 110;
        const f = this.add.image(c.x + Phaser.Math.Between(-24, 24), c.y + Phaser.Math.Between(-10, 30), 'flame').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(16);
        this.tweens.add({ targets: f, y: f.y - 40, alpha: 0, scaleX: 0.1, duration: 420, onComplete: () => f.destroy() });
      }
      if (time >= b.next) {
        b.next += 1000;
        sfx(this, 'burn', { volume: 0.35 });
        e.hit(e.x, 'none', b.dps, { dot: true });
      }
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
    if (this.skills?.enchanted) {
      s.setTint(0xffa040);
      sfx(this, 'fireball', { volume: 0.3, rate: 1.6 });
      this.burst(p.x + p.facing * 50, p.y - 46, 0xffa040, 8);
    }
    if (dir === 'up') s.setPosition(p.x, p.y - 118).setAngle(-90).setFlipY(p.facing < 0);
    else if (dir === 'down') s.setPosition(p.x, p.y + 30).setAngle(90).setFlipY(p.facing > 0);
    else s.setPosition(p.x + p.facing * 58, p.y - 46).setFlipX(p.facing < 0);
    this.tweens.add({ targets: s, alpha: 0, scaleX: 0.62, duration: 170, onComplete: () => s.destroy() });
  }

  onPlayerDash(p) {
    sfx(this, 'dash', { volume: 0.7 });
    this.burst(p.x - p.facing * 20, p.y - 40, p.ghostTint, 10);
  }

  onPlayerDoubleJump(p) {
    sfx(this, 'double_jump', { volume: 0.6 });
    const e = this.add.particles(p.x, p.y, 'soft', {
      speedX: { min: -120, max: 120 },
      speedY: { min: 20, max: 140 },
      lifespan: 380,
      scale: { start: 0.6, end: 0 },
      tint: [p.ghostTint, 0xdff4ff],
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
    const c = this.enemyCenter(e);
    this.burst(c.x, c.y, 0x9fdcff, e.isBoss ? 60 : 18);
    this.spawnGeo(c.x, c.y, e.geo);
    this.burns.delete(e);
    if (e.isBoss) this.bossDefeated(e.bossId);
  }

  spawnArrow(x, y, vx, vy) {
    sfx(this, 'arrow', { volume: 0.6 });
    const o = this.hazards.create(x, y, 'arrow').setScale(0.55).setDepth(15);
    o.body.setAllowGravity(false).setSize(40, 14).setOffset(60, 5);
    o.setVelocity(vx, vy);
    o.setRotation(Math.atan2(vy, vx));
    o.setData({ breaks: true, kind: 'arrow' });
    this.time.delayedCall(4500, () => o.active && this.popHazard(o));
  }

  tornadoHit(t, x) {
    const p = this.player;
    this.damagePlayer(x);
    if (p.dead || this.busy) return;
    // arremessa para cima e para o lado
    const dir = p.x < x ? -1 : 1;
    p.body.setVelocity(dir * 380, -900);
    sfx(this, 'tornado', { volume: 0.6 });
  }

  spawnArenaTornado(x, floor) {
    const t = new Tornado(this, x, floor);
    this.props.push(t);
    this.arenaProps = [...(this.arenaProps || []), t];
  }

  impactDust(x, y) {
    const e = this.add.particles(x, y - 4, 'soft', {
      speedX: { min: -220, max: 220 },
      speedY: { min: -200, max: -40 },
      gravityY: 600,
      lifespan: 600,
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.7, end: 0 },
      tint: this.player.x >= RUINS_X * TILE ? [0xe0b070, 0xc08a58] : [0x9fdcff, 0x6f8fb0],
      emitting: false,
    });
    e.setDepth(16);
    e.explode(16);
    this.time.delayedCall(700, () => e.destroy());
  }

  steamPuff(x, y) {
    const d = this.add.image(x, y, 'soft').setTint(0xffffff).setScale(0.6).setAlpha(0.5).setDepth(13);
    this.tweens.add({ targets: d, y: y - 40, scale: 1.4, alpha: 0, duration: 700, onComplete: () => d.destroy() });
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

  damagePlayer(fromX, amount = 1) {
    const p = this.player;
    if (p.invulnerable || p.dead || this.busy) return;
    this.health = Math.max(0, this.health - amount);
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
    // soulslike: os fragmentos ficam onde o Kio caiu (um só lugar: morrer de
    // novo antes de buscar perde os antigos)
    if (this.state.geo > 0) {
      this.state.shade = { x: this.lastSafe.x, y: this.lastSafe.y, geo: this.state.geo };
      this.registry.set('lostGeo', this.state.geo);
      this.state.geo = 0;
    }
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
    const skill = f.getData('skill');
    this.burst(f.x, f.y, 0xdff4ff, 40);
    f.getData('light').destroy();
    f.destroy();
    this.state.collected.push(id);
    this.cameras.main.flash(400, 200, 235, 255);
    if (skill) {
      this.state.skills = Math.max(this.state.skills, skill);
      this.saveProgress();
      this.hud.setElement(this.state.element, this.state.elements.length > 1);
      const names = this.state.elements.map((el) => ELEMENTS[el].skills[skill - 1].name).join(' / ');
      const def = ELEMENTS[this.state.element].skills[skill - 1];
      this.hud.showAbility(names, def.text, `Aperte ${keyLabel(currentKeys()[`skill${skill}`])} para usar (${def.mana ? `${def.mana} de mana` : '25% da mana'}, recarga de ${def.cd / 1000}s).`, ELEMENTS[this.state.element].color);
      return;
    }
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

  // ------------------------------------------------------------ chefes

  checkBossTrigger() {
    if (this.fight) return;
    const p = this.player;
    for (const [id, boss] of Object.entries(this.bosses)) {
      if (!boss.alive || boss.state !== 'sleep') continue;
      const a = this.arenas[id];
      if (p.x > a.left + 3 * TILE && p.x < a.right && p.y > a.top && p.y <= a.floor + 4) this.startBoss(id);
    }
  }

  startBoss(id) {
    if (this.fight) return;
    const boss = this.bosses[id];
    const info = BOSSES[id];
    const a = this.arenas[id];
    this.fight = id;
    sfx(this, 'gate', { vary: 0 });
    for (const g of this.gates) if (g.kind === 'fight' && g.arena === id) this.tweens.add({ targets: g.img, alpha: 1, duration: 300 });
    playMusic(info.music, { fadeMs: 800 });
    // câmera desliza e trava mostrando a arena inteira
    const cam = this.cameras.main;
    const cx = Phaser.Math.Clamp((a.left + a.right) / 2 - 16, WIDTH / 2, this.worldW - WIDTH / 2);
    const cy = Phaser.Math.Clamp((a.top + a.floor) / 2 + 64, HEIGHT / 2, this.worldH - HEIGHT / 2);
    cam.stopFollow();
    cam.pan(cx, cy, 700, 'Sine.easeInOut', false, (c, t) => {
      if (t < 1) return;
      cam.setBounds(cx - WIDTH / 2, cy - HEIGHT / 2, WIDTH, HEIGHT);
      cam.startFollow(this.player.phys, true, 0.1, 0.1);
    });
    this.hud.bossSetup(info);
    this.hud.bossIntro(info.name, info.sub, info.color);
    this.time.delayedCall(2700, () => this.fight === id && boss.alive && this.hud.bossBar(true, boss.hp / boss.maxHp));
    this.time.delayedCall(1500, () => boss.alive && boss.state === 'sleep' && boss.wake());
  }

  onBossHit(boss) {
    if (this.fight === boss.bossId) this.hud?.bossBar(true, Math.max(0, boss.hp) / boss.maxHp);
  }

  onBossPhase(phase) {
    this.hud?.bossPhase(phase);
  }

  // Morreu no meio da luta: a arena reabre e o chefe volta a dormir no lugar.
  resetFight() {
    this.fight = null;
  }

  bossDefeated(id) {
    const info = BOSSES[id];
    this.fight = null;
    this.state[info.flag] = true;
    this.hud.bossBar(false);
    this.hitStop(250);
    for (const t of this.arenaProps || []) t.destroy?.();
    this.arenaProps = [];
    this.props = this.props.filter((pr) => !pr.dead);
    this.time.delayedCall(1800, () => {
      for (const g of this.gates) {
        if (g.arena !== id) continue;
        if (g.kind === 'fight') this.tweens.add({ targets: g.img, alpha: 0, duration: 800 });
        if (g.kind === 'exit') this.tweens.add({ targets: g.img, alpha: 0, y: g.img.y - 40, duration: 900, onComplete: () => g.img.setVisible(false) });
      }
      sfx(this, 'gate', { vary: 0 });
      this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
      if (id === 'ender') {
        playMusic('world', { fadeMs: 3000 });
        this.tweens.add({ targets: this.raiz, alpha: 1, duration: 1500 });
        this.tweens.add({ targets: this.raizLight, alpha: 0.45, duration: 1500 });
        this.hud.toast('A Raiz desperta.');
      } else if (id === 'worm') {
        playMusic('ruins', { fadeMs: 3000 });
        this.spawnSkill3();
        this.hud.toast('A areia se acalma. Algo brilha no meio do Ninho.');
      } else if (id === 'knight') {
        this.knightEpilogue();
      }
    });
    this.saveProgress();
  }

  spawnSkill3() {
    const a = this.arenas.worm;
    this.createFloating((a.left + a.right) / 2, a.floor - 110, 'ability', 'skill3', { skill: 3 });
  }

  async knightEpilogue() {
    this.busy = true;
    this.player.frozen = true;
    await wait(this, 1200);
    await this.say([
      { who: '', text: 'A armadura cai vazia. Dentro dela, só areia e um sol partido, ainda morno.' },
      { who: 'Kio', text: 'Ele não guardava o rei. Guardava a lembrança dele.' },
      { who: '', text: 'O vento muda de direção pela primeira vez em muitas estações.' },
    ]);
    this.finishGame();
  }

  finishGame() {
    this.busy = true;
    this.player.frozen = true;
    this.saveProgress();
    this.cameras.main.fadeOut(2200, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End'));
  }

  // ------------------------------------------------------------ elementos

  // Conversa com a Raiz depois do Ender: escolher, transformar, abrir o portão.
  async elementCeremony() {
    const p = this.player;
    this.busy = true;
    p.frozen = true;
    const el = await this.hud.chooseElement();
    await this.transform(el);
    const st = this.state;
    st.element = el;
    st.elements = [el];
    st.skills = Math.max(st.skills, 1);
    this.mana = MANA.max;
    this.hud.setElement(el, false);
    this.refreshAltar();
    this.saveProgress();
    await this.say([...ELEMENTS[el].lines, { who: 'Raiz', text: 'Agora vá. O portão atrás de mim reconhece a sua cor.' }]);
    this.busy = true;
    p.frozen = true;
    await this.openRuinsGate();
    const def = ELEMENTS[el].skills[0];
    await this.hud.showAbility(def.name, def.text, `Aperte ${keyLabel(currentKeys().skill1)} para usar. Gasta mana (a barra embaixo da vida).`, ELEMENTS[el].color);
    this.busy = false;
    p.frozen = false;
  }

  // Transformação: o Kio levita, a cor gira em volta, clarão e a skin nova.
  async transform(el) {
    const p = this.player;
    const def = ELEMENTS[el];
    const cam = this.cameras.main;
    this.busy = true;
    p.frozen = true;
    p.floating = true;
    p.body.setAllowGravity(false);
    p.body.setVelocity(0, 0);
    p.sprite.play(p.anim('kio-idle'));
    const baseY = p.y;
    const x = p.x;
    const cy = () => p.y - 46;
    sfx(this, 'transform', { vary: 0 });
    this.tweens.add({ targets: this.dim, fillAlpha: 0.6, duration: 600 });
    const lift = { y: baseY };
    this.tweens.add({ targets: lift, y: baseY - 80, duration: 1500, ease: 'Sine.easeInOut', onUpdate: () => p.setPosition(x, lift.y) });
    const spiral = this.add.image(x, cy(), 'spiral').setBlendMode(Phaser.BlendModes.ADD).setTint(def.color).setScale(0.2).setAlpha(0).setDepth(19);
    this.tweens.add({ targets: spiral, alpha: 0.8, scale: 1.3, duration: 1500 });
    const spin = this.time.addEvent({ delay: 16, loop: true, callback: () => spiral.setPosition(x, cy()).setRotation(spiral.rotation - 0.12) });
    const swirl = this.add.particles(x, cy(), 'soft', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 230), quantity: 40 },
      moveToX: x,
      moveToY: baseY - 126,
      lifespan: 700,
      scale: { start: 0.7, end: 0.1 },
      tint: [def.color, def.light, 0xffffff],
      blendMode: 'ADD',
      frequency: 14,
    });
    swirl.setDepth(21);
    for (let i = 0; i < 3; i++) this.time.delayedCall(300 + i * 380, () => this.skills.ring(x, cy(), def.color, 1.4, 0.5));
    // a skin pisca entre a cor antiga e a nova, cada vez mais rápido
    const old = this.state.element;
    for (let i = 0; i < 9; i++) {
      this.time.delayedCall(700 + 1100 * (1 - Math.pow(0.78, i)), () => p.setElement(i % 2 ? old : el, i % 2 ? ELEMENTS[old] : def));
    }
    await wait(this, 1900);
    // clarão
    p.setElement(el, def);
    swirl.stop();
    spin.remove();
    cam.flash(500, (def.color >> 16) & 255, (def.color >> 8) & 255, def.color & 255);
    cam.shake(400, 0.01);
    sfx(this, 'gust', { vary: 0 });
    sfx(this, 'ability', { vary: 0, volume: 0.6 });
    this.skills.ring(x, cy(), def.color, 4, 0.7);
    this.skills.ring(x, cy(), 0xffffff, 2.6, 0.5);
    this.burst(x, cy(), def.color, 70);
    this.tweens.add({ targets: spiral, scale: 3, alpha: 0, duration: 600, onComplete: () => spiral.destroy() });
    p.halo.setScale(3.2).setAlpha(0.9);
    this.tweens.add({ targets: p.halo, scale: 1.6, alpha: 0.32, duration: 1200 });
    await wait(this, 700);
    this.tweens.add({ targets: lift, y: baseY, duration: 600, ease: 'Quad.easeIn', onUpdate: () => p.setPosition(x, lift.y) });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 800 });
    await wait(this, 620);
    this.time.delayedCall(800, () => swirl.destroy());
    p.floating = false;
    p.body.setAllowGravity(true);
    p.squash(1.2, 0.85);
    this.dust(p.x, p.y);
  }

  // O portão das Ruínas sobe e um vento muito forte entra na arena.
  async openRuinsGate() {
    const cam = this.cameras.main;
    const g = this.ruinGate;
    const p = this.player;
    if (!g) return;
    cam.stopFollow();
    cam.pan(g.x - 200, g.y + 60, 900, 'Sine.easeInOut');
    await wait(this, 1000);
    sfx(this, 'gate', { vary: 0 });
    sfx(this, 'rumble', { vary: 0 });
    cam.shake(1700, 0.006);
    const dustEvt = this.time.addEvent({ delay: 90, repeat: 16, callback: () => this.impactDust(g.x + Phaser.Math.Between(-20, 20), g.y + 160) });
    this.tweens.add({ targets: g, y: g.y - 170, duration: 1700, ease: 'Sine.easeIn' });
    await wait(this, 1700);
    dustEvt.remove();
    this.state.gateOpen = true;
    g.body && (g.body.enable = false);
    g.setVisible(false);
    // rajada: vento, areia e folhas atravessando a tela
    sfx(this, 'wind_long', { vary: 0 });
    sfx(this, 'gust', { vary: 0 });
    cam.shake(900, 0.008);
    const view = cam.worldView;
    const wind = this.add.particles(0, 0, 'soft', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(view.right, view.y, 40, view.height) },
      speedX: { min: -1600, max: -900 },
      speedY: { min: -60, max: 60 },
      lifespan: 1600,
      scaleX: { start: 1.6, end: 0.4 },
      scaleY: { start: 0.18, end: 0.08 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffffff, 0xffe0b0, 0xc8ffd8],
      blendMode: 'ADD',
      frequency: 8,
    });
    wind.setDepth(26);
    const sand = this.add.particles(0, 0, 'soft', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(view.right, view.y, 40, view.height) },
      speedX: { min: -900, max: -500 },
      speedY: { min: -80, max: 80 },
      lifespan: 2400,
      scale: { start: 0.3, end: 0.1 },
      tint: [0xe0b070, 0xffd9a0],
      frequency: 10,
    });
    sand.setDepth(26);
    this.gust(-1, 420, 2400);
    cam.pan(p.x, p.y - 60, 900, 'Sine.easeInOut', false, (c, t) => t >= 1 && cam.startFollow(p.phys, true, 0.1, 0.1));
    await wait(this, 2200);
    wind.stop();
    sand.stop();
    this.time.delayedCall(2500, () => (wind.destroy(), sand.destroy()));
    this.saveProgress();
    this.hud.toast('O caminho para as Ruínas está aberto.');
    await wait(this, 400);
  }

  async touchAltar() {
    const st = this.state;
    if (!st.element) return;
    const other = st.element === 'wind' ? 'fire' : 'wind';
    if (st.elements.includes(other)) {
      this.swapElement(true);
      return;
    }
    const p = this.player;
    this.busy = true;
    p.frozen = true;
    this.skills.clearElementFx();
    await this.transform(other);
    st.elements.push(other);
    st.element = other;
    this.hud.setElement(other, true);
    this.refreshAltar();
    this.saveProgress();
    const def = ELEMENTS[other];
    await this.hud.showAbility(`Elemento: ${def.name}`, 'A outra metade da chama acordou. As habilidades que você já liberou valem para os dois.', `Aperte ${keyLabel(currentKeys().element)} para trocar de elemento.`, def.color);
    this.busy = false;
    p.frozen = false;
  }

  swapElement(force) {
    const st = this.state;
    const now = this.time.now;
    if (st.elements.length < 2) {
      if (force) this.hud?.toast('Você só tem um elemento.');
      return;
    }
    if (now < this.skills.swapReadyAt) return;
    this.skills.swapReadyAt = now + 700;
    this.skills.clearElementFx();
    const next = st.element === 'wind' ? 'fire' : 'wind';
    st.element = next;
    const def = ELEMENTS[next];
    const p = this.player;
    p.setElement(next, def);
    this.mana = Math.min(this.mana, this.skills.capacity);
    sfx(this, next === 'fire' ? 'ignite' : 'gust', { volume: 0.6 });
    this.skills.ring(p.x, p.y - 46, def.color, 1.6, 0.35);
    this.burst(p.x, p.y - 46, def.color, 24);
    this.hud.setElement(next, true);
    this.refreshAltar();
  }

  // ------------------------------------------------------------ sombra (soulslike)

  createShade() {
    const sh = this.state.shade;
    if (!sh) return;
    const s = this.add.sprite(sh.x, sh.y, this.player.tex('kio_idle'), 0).setOrigin(0.5, 198 / 208).setScale(0.68).setDepth(17).setTintFill(0x120c22).setAlpha(0.82);
    s.play(this.player.anim('kio-idle'));
    const core = this.add.image(sh.x, sh.y - 50, 'shade-core').setScale(0.45).setDepth(18);
    const smoke = this.add.particles(sh.x, sh.y - 40, 'soft', {
      speedY: { min: -50, max: -15 },
      speedX: { min: -20, max: 20 },
      lifespan: 900,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: 0x1a1030,
      frequency: 80,
    });
    smoke.setDepth(16);
    this.tweens.add({ targets: [s, core], y: '-=10', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.shadeObj = { s, core, smoke, ...sh };
  }

  checkShade() {
    const o = this.shadeObj;
    if (!o) return;
    const p = this.player;
    if (Math.abs(p.x - o.x) < 46 && Math.abs(p.y - o.y) < 90) {
      this.shadeObj = null;
      this.state.geo += o.geo;
      this.state.shade = null;
      sfx(this, 'shade', { vary: 0 });
      sfx(this, 'geo', { volume: 0.6 });
      this.burst(o.x, o.y - 50, 0xffd98a, 40);
      this.cameras.main.flash(250, 255, 230, 170);
      o.smoke.destroy();
      this.tweens.add({ targets: [o.s, o.core], alpha: 0, scale: 0.2, duration: 400, onComplete: () => (o.s.destroy(), o.core.destroy()) });
      this.hud.toast(`Você recuperou ${o.geo} fragmentos de luz.`);
      this.saveProgress();
      this.refreshHud();
    }
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
    if (!this.fight && !this.busy) playMusic(this.player.x >= RUINS_X * TILE ? 'ruins' : 'world', { fadeMs: 2500 });
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
    this.state.mapW = this.W;
    this.state.playMs += this.time.now - this.startedAt;
    this.startedAt = this.time.now;
    writeSave(this.state);
  }

  refreshHud() {
    this.hud?.refresh({ health: this.health, maxHealth: this.state.maxHealth, soul: this.soul, geo: this.state.geo });
  }

  // ------------------------------------------------------------ efeitos

  hitEffect(x, y, tint) {
    const s = this.add.image(x, y, 'hitfx').setBlendMode(Phaser.BlendModes.ADD).setDepth(23).setAngle(Phaser.Math.Between(0, 90)).setScale(0.9);
    if (tint) s.setTint(tint);
    this.tweens.add({ targets: s, alpha: 0, scale: 1.3, duration: 130, onComplete: () => s.destroy() });
    this.burst(x, y, tint || 0xdff4ff, 6);
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
