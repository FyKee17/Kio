import Phaser from 'phaser';

const K = Phaser.Input.Keyboard.KeyCodes;

// Movimento WASD, Espaço pula (2x = pulo duplo), clique esquerdo ataca,
// Q dash, E interage (segurar E cura), Shift corre, M mapa, Esc pausa.
// Setas também andam, para quem preferir.
export const BINDINGS = {
  left: [K.A, K.LEFT],
  right: [K.D, K.RIGHT],
  up: [K.W, K.UP],
  down: [K.S, K.DOWN],
  jump: [K.SPACE],
  attack: [K.J],
  dash: [K.Q],
  run: [K.SHIFT],
  interact: [K.E],
  heal: [],
  map: [K.M, K.TAB],
  pause: [K.ESC],
};

const HEAL_HOLD_MS = 280; // segurar E por este tempo vira cura

// Junta teclado, mouse e botões de toque num único estado por quadro:
// `held.x` = segurando, `pressed.x` = apertou neste quadro.
export class Controls {
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    for (const [name, codes] of Object.entries(BINDINGS)) {
      this.keys[name] = codes.map((c) => scene.input.keyboard.addKey(c, true, false));
    }
    this.touch = {};
    this.held = {};
    this.pressed = {};
    for (const name of Object.keys(BINDINGS)) {
      this.touch[name] = false;
      this.held[name] = false;
      this.pressed[name] = false;
    }
    this.isTouch = scene.sys.game.device.input.touch && !scene.sys.game.device.os.desktop;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.interactSince = 0;

    // clique esquerdo = ataque (no celular quem ataca é o botão de toque)
    scene.input.on('pointerdown', (p) => {
      if (p.wasTouch || !p.leftButtonDown()) return;
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    scene.input.on('pointerup', (p) => {
      if (!p.wasTouch) this.mouseDown = false;
    });
  }

  update() {
    const now = this.scene.time.now;
    for (const name of Object.keys(BINDINGS)) {
      // JustDown pega até um toque mais curto que um quadro
      let tapped = this.keys[name].map((k) => Phaser.Input.Keyboard.JustDown(k)).some(Boolean);
      let now_ = this.touch[name] || this.keys[name].some((k) => k.isDown);
      if (name === 'attack') {
        tapped = tapped || this.mouseClicked;
        now_ = now_ || this.mouseDown;
      }
      if (name === 'heal') {
        // segurar E (sem soltar) vira cura; o botão de toque "Cura" também
        now_ = this.touch.heal || (this.held.interact && now - this.interactSince > HEAL_HOLD_MS);
        tapped = false;
      }
      this.pressed[name] = tapped || (now_ && !this.held[name]);
      this.held[name] = now_ || tapped;
      if (name === 'interact' && this.pressed.interact) this.interactSince = now;
    }
    this.mouseClicked = false;
    // no celular não há Shift: corre sempre
    if (this.isTouch) this.held.run = true;
  }

  // Evita que o mesmo toque que fechou um diálogo vire um pulo ou ataque.
  consume() {
    for (const name of Object.keys(BINDINGS)) this.pressed[name] = false;
    this.interactSince = this.scene.time.now;
  }
}
