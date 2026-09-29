import Phaser from 'phaser';
import { TILE, WIDTH, HEIGHT, ZOOM } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { Controls } from '../controls.js';
import { Player } from '../objects/Player.js';
import { writeSave } from '../save.js';

// Índices de quadro na folha `tiles`
const T = { GRASS: 0, DIRT: 1, PLATFORM: 2, SPIKES: 3 };
const TALK_RANGE = 28;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelIndex = data.level ?? 0;
    this.level = LEVELS[this.levelIndex];
    this.state = this.registry.get('state');
    this.state.level = this.levelIndex;
    writeSave(this.state);
  }

  create() {
    this.controls = new Controls(this);
    this.busy = false;

    const rows = this.parseMap(this.level.map);
    const worldW = rows[0].length * TILE;
    const worldH = rows.length * TILE;
    this.worldH = worldH;
    this.physics.world.setBounds(0, 0, worldW, worldH + 200);
    this.physics.world.checkCollision.down = false;

    this.createBackground();
    this.createTiles(rows);
    this.createEntities(rows);

    this.player = new Player(this, this.spawn.x, this.spawn.y, this.controls);
    this.player.on('land', () => this.dust(this.player.x, this.player.y));
    this.physics.add.collider(this.player, this.layer, null, (player, tile) => {
      if (tile.index !== T.PLATFORM) return true;
      return !player.isDropping(this.time.now);
    });

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(40, 30);
    cam.fadeIn(500, 13, 11, 20);

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');
    this.ui.events.once('ui-ready', () => {
      this.ui.bindControls(this.controls);
      this.ui.showLevelName(this.level.name);
      this.ui.setMemories(this.state.memories.length);
      if (!this.state.seenIntro.includes(this.levelIndex) && this.level.intro) {
        this.state.seenIntro.push(this.levelIndex);
        writeSave(this.state);
        this.say(this.level.intro);
      }
    });

    this.events.once('shutdown', () => this.scene.stop('UI'));
  }

  // --- construção da fase -------------------------------------------------

  parseMap(map) {
    const width = Math.max(...map.map((r) => r.length));
    return map.map((r) => r.padEnd(width, '.').split(''));
  }

  createBackground() {
    // Camadas presas à câmera; o deslocamento de textura faz o parallax.
    const make = (key) =>
      this.add
        .tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH / ZOOM, HEIGHT / ZOOM, key)
        .setScrollFactor(0)
        .setDepth(-10);
    this.bg = [
      { sprite: make('bg_sky'), factor: 0.05 },
      { sprite: make('bg_far'), factor: 0.2 },
      { sprite: make('bg_near'), factor: 0.45 },
    ];
  }

  createTiles(rows) {
    const data = rows.map((row, y) =>
      row.map((ch, x) => {
        if (ch === '#') return rows[y - 1]?.[x] === '#' ? T.DIRT : T.GRASS;
        if (ch === '=') return T.PLATFORM;
        if (ch === '^') return T.SPIKES;
        return -1;
      }),
    );
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layer = map.createLayer(0, tileset, 0, 0);
    this.layer.setCollision([T.GRASS, T.DIRT]);
    this.layer.forEachTile((tile) => {
      if (tile.index === T.PLATFORM) tile.setCollision(false, false, true, false);
    });
  }

  createEntities(rows) {
    this.memories = this.physics.add.staticGroup();
    this.checkpoints = [];
    this.npcs = [];
    this.door = null;
    let npcCount = 0;
    let memCount = 0;

    rows.forEach((row, ty) =>
      row.forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2;
        const bottom = (ty + 1) * TILE;
        if (ch === 'P') {
          this.spawn = { x: cx, y: bottom };
        } else if (ch === 'M') {
          const id = `${this.levelIndex}-${memCount}`;
          const text = this.level.memories[memCount++];
          if (this.state.memories.includes(id)) return;
          const m = this.memories.create(cx, ty * TILE + TILE / 2, 'memory').play('memory-spin');
          m.setData({ id, text });
          m.body.setCircle(5, 1, 1);
          this.tweens.add({ targets: m, y: m.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (ch === 'C') {
          const cp = this.add.sprite(cx, bottom, 'checkpoint', 0).setOrigin(0.5, 1);
          this.checkpoints.push(cp);
        } else if (ch === 'N') {
          const def = this.level.npcs[npcCount];
          const id = `${this.levelIndex}-${npcCount++}`;
          if (!def) return;
          const s = this.add.sprite(cx, bottom, def.art).setOrigin(0.5, 1).play(`${def.art}-idle`);
          const prompt = this.add.image(cx, bottom - s.height - 8, 'prompt').setVisible(false).setDepth(20);
          this.tweens.add({ targets: prompt, y: prompt.y - 3, duration: 450, yoyo: true, repeat: -1 });
          this.npcs.push({ sprite: s, def, id, prompt });
        } else if (ch === 'E') {
          const d = this.add.sprite(cx, bottom, 'door').setOrigin(0.5, 1).setDepth(-1);
          const prompt = this.add.image(cx, bottom - d.height - 8, 'prompt').setVisible(false).setDepth(20);
          this.tweens.add({ targets: prompt, y: prompt.y - 3, duration: 450, yoyo: true, repeat: -1 });
          this.door = { sprite: d, prompt };
        }
      }),
    );

    this.checkpoint = this.spawn;
  }

  // --- laço principal -------------------------------------------------------

  update(time, delta) {
    this.controls.update();
    const cam = this.cameras.main;
    for (const { sprite, factor } of this.bg) sprite.tilePositionX = cam.scrollX * factor;

    if (this.ui?.dialogue?.active) {
      if (this.controls.pressed.jump || this.controls.pressed.action) this.ui.dialogue.advance();
      this.player.freeze();
    } else if (!this.busy) {
      this.player.unfreeze();
    }

    this.player.update(time, delta);
    if (this.player.dead || this.busy) return;

    this.physics.overlap(this.player, this.memories, (p, m) => this.collect(m));
    this.checkHazards();
    this.checkCheckpoints();
    this.checkInteractions();
  }

  checkHazards() {
    const b = this.player.body;
    if (b.top > this.worldH) return this.die();
    // espinhos machucam só na metade de baixo do bloco
    const tiles = this.layer.getTilesWithinWorldXY(b.left + 2, b.top, b.width - 4, b.height);
    for (const t of tiles) {
      if (t.index === T.SPIKES && b.bottom > t.pixelY + TILE / 2) return this.die();
    }
  }

  checkCheckpoints() {
    for (const cp of this.checkpoints) {
      if (cp.frame.name === 1) continue;
      if (Math.abs(this.player.x - cp.x) < 10 && Math.abs(this.player.y - cp.y) < 20) {
        cp.setFrame(1);
        this.checkpoint = { x: cp.x, y: cp.y };
        this.burst(cp.x, cp.y - 26, 0xffd36e, 10);
      }
    }
  }

  checkInteractions() {
    const p = this.player;
    const near = (s) => Math.abs(p.x - s.x) < TALK_RANGE && Math.abs(p.y - s.y) < 24;

    let target = null;
    for (const npc of this.npcs) {
      const on = near(npc.sprite);
      npc.prompt.setVisible(on);
      if (on) target = npc;
    }
    const atDoor = this.door && near(this.door.sprite);
    if (this.door) this.door.prompt.setVisible(atDoor && !target);

    if (!this.controls.pressed.action) return;
    if (target) this.talk(target);
    else if (atDoor) this.exitLevel();
  }

  // --- ações -----------------------------------------------------------------

  say(lines) {
    this.controls.consume();
    return this.ui.dialogue.play(lines).then(() => this.controls.consume());
  }

  talk(npc) {
    npc.sprite.setFlipX(this.player.x < npc.sprite.x);
    const first = !this.state.talked.includes(npc.id);
    if (first) {
      this.state.talked.push(npc.id);
      writeSave(this.state);
    }
    this.say(first ? npc.def.lines : npc.def.repeat || npc.def.lines);
  }

  collect(m) {
    const id = m.getData('id');
    const text = m.getData('text');
    this.burst(m.x, m.y, 0x9ee7ff, 16);
    m.destroy();
    this.state.memories.push(id);
    writeSave(this.state);
    this.ui.setMemories(this.state.memories.length);
    this.cameras.main.flash(180, 158, 231, 255, false);
    if (text) this.say([{ who: '', text }]);
  }

  die() {
    const p = this.player;
    p.dead = true;
    p.body.setVelocity(0, 0);
    p.body.setAllowGravity(false);
    this.burst(p.x, p.y - 10, 0xe0584f, 14);
    p.setVisible(false);
    this.cameras.main.shake(180, 0.006);
    this.time.delayedCall(550, () => {
      p.setPosition(this.checkpoint.x, this.checkpoint.y);
      p.body.reset(this.checkpoint.x, this.checkpoint.y);
      p.body.setAllowGravity(true);
      p.setVisible(true);
      p.dead = false;
      p.squash(0.6, 1.4);
    });
  }

  exitLevel() {
    this.busy = true;
    this.player.freeze();
    this.player.body.setVelocityX(0);
    const next = this.levelIndex + 1;
    const cam = this.cameras.main;
    cam.fadeOut(600, 13, 11, 20);
    cam.once('camerafadeoutcomplete', () => {
      if (this.level.final || next >= LEVELS.length) this.scene.start('End');
      else this.scene.start('Game', { level: next });
    });
  }

  // --- efeitos ---------------------------------------------------------------

  burst(x, y, tint, quantity) {
    const e = this.add.particles(x, y, 'spark', {
      speed: { min: 30, max: 110 },
      lifespan: { min: 250, max: 550 },
      scale: { start: 1, end: 0 },
      tint,
      emitting: false,
    });
    e.setDepth(15);
    e.explode(quantity);
    this.time.delayedCall(700, () => e.destroy());
  }

  dust(x, y) {
    const e = this.add.particles(x, y, 'spark', {
      speedX: { min: -40, max: 40 },
      speedY: { min: -25, max: -5 },
      lifespan: 260,
      scale: { start: 0.8, end: 0 },
      tint: 0xd9d0c1,
      emitting: false,
    });
    e.explode(6);
    this.time.delayedCall(400, () => e.destroy());
  }
}
