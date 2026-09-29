import Phaser from 'phaser';

const K = Phaser.Input.Keyboard.KeyCodes;
const BINDINGS = {
  left: [K.LEFT, K.A],
  right: [K.RIGHT, K.D],
  down: [K.DOWN, K.S],
  jump: [K.SPACE, K.Z, K.UP, K.W],
  action: [K.E, K.X, K.ENTER],
};

// Junta teclado e botões de toque num único estado por quadro:
// `held.x` = segurando, `pressed.x` = apertou neste quadro.
export class Controls {
  constructor(scene) {
    this.keys = {};
    for (const [name, codes] of Object.entries(BINDINGS)) {
      this.keys[name] = codes.map((c) => scene.input.keyboard.addKey(c, true, false));
    }
    this.touch = { left: false, right: false, down: false, jump: false, action: false };
    this.held = {};
    this.pressed = {};
    for (const name of Object.keys(BINDINGS)) {
      this.held[name] = false;
      this.pressed[name] = false;
    }
  }

  update() {
    for (const name of Object.keys(BINDINGS)) {
      const now = this.touch[name] || this.keys[name].some((k) => k.isDown);
      this.pressed[name] = now && !this.held[name];
      this.held[name] = now;
    }
  }

  // Evita que o mesmo toque que fechou um diálogo vire um pulo.
  consume() {
    for (const name of Object.keys(BINDINGS)) this.pressed[name] = false;
  }
}
