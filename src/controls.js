import Phaser from 'phaser';

const K = Phaser.Input.Keyboard.KeyCodes;
export const BINDINGS = {
  left: [K.LEFT, K.A],
  right: [K.RIGHT, K.D],
  up: [K.UP, K.W],
  down: [K.DOWN, K.S],
  jump: [K.SPACE, K.Z, K.K],
  attack: [K.X, K.J],
  dash: [K.C, K.SHIFT, K.L],
  heal: [K.F, K.Q],
  interact: [K.E, K.ENTER],
  map: [K.M, K.TAB],
};

// Junta teclado e botões de toque num único estado por quadro:
// `held.x` = segurando, `pressed.x` = apertou neste quadro.
export class Controls {
  constructor(scene) {
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
  }

  update() {
    for (const name of Object.keys(BINDINGS)) {
      // JustDown pega até um toque mais curto que um quadro (celular lento, dedo rápido)
      const tapped = this.keys[name].map((k) => Phaser.Input.Keyboard.JustDown(k)).some(Boolean);
      const now = this.touch[name] || this.keys[name].some((k) => k.isDown);
      this.pressed[name] = tapped || (now && !this.held[name]);
      this.held[name] = now || tapped;
    }
  }

  // Evita que o mesmo toque que fechou um diálogo vire um pulo ou ataque.
  consume() {
    for (const name of Object.keys(BINDINGS)) this.pressed[name] = false;
  }
}
