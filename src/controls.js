import Phaser from 'phaser';
import { getOptions, onOptionChange } from './options.js';

const K = Phaser.Input.Keyboard.KeyCodes;

// Teclas padrão (trocáveis em Opções > Controles). Movimento WASD, Espaço pula
// (2x = pulo duplo), clique esquerdo sempre ataca, Q dash, E interage (segurar E
// cura), Shift corre, M mapa, Esc pausa. As setas também andam.
export const DEFAULT_KEYS = {
  left: 'A',
  right: 'D',
  up: 'W',
  down: 'S',
  jump: 'SPACE',
  attack: 'J',
  dash: 'Q',
  run: 'SHIFT',
  interact: 'E',
  map: 'M',
};

export const ACTION_LABELS = {
  left: 'Esquerda',
  right: 'Direita',
  up: 'Cima / mirar',
  down: 'Baixo / mirar',
  jump: 'Pular',
  attack: 'Atacar (+ clique)',
  dash: 'Dash',
  run: 'Correr',
  interact: 'Interagir / curar',
  map: 'Mapa',
};

// teclas extras fixas (não trocáveis)
const EXTRAS = { left: [K.LEFT], right: [K.RIGHT], up: [K.UP], down: [K.DOWN], map: [K.TAB] };

export function currentKeys() {
  return { ...DEFAULT_KEYS, ...(getOptions().keys || {}) };
}

export function bindings() {
  const keys = currentKeys();
  const out = { heal: [], pause: [K.ESC] };
  for (const action of Object.keys(DEFAULT_KEYS)) {
    out[action] = [K[keys[action]], ...(EXTRAS[action] || [])].filter((c) => c !== undefined);
  }
  return out;
}

const NAMES = { SPACE: 'Espaço', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt', ENTER: 'Enter', TAB: 'Tab', BACKSPACE: 'Backspace', UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', CAPS_LOCK: 'Caps' };
const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
export function keyLabel(name) {
  if (NAMES[name]) return NAMES[name];
  const d = DIGITS.indexOf(name);
  if (d >= 0) return String(d);
  return name.replace('NUMPAD_', 'Num ').replace(/_/g, ' ');
}

// nome da tecla (como em KeyCodes) a partir do código do evento
export function keyNameFromCode(keyCode) {
  return Object.keys(K).find((n) => K[n] === keyCode) || null;
}

const HEAL_HOLD_MS = 280; // segurar E por este tempo vira cura

// Junta teclado, mouse e botões de toque num único estado por quadro:
// `held.x` = segurando, `pressed.x` = apertou neste quadro.
export class Controls {
  constructor(scene) {
    this.scene = scene;
    this.bind();
    // trocou uma tecla nas opções (até pelo menu de pausa): vale na hora
    const off = onOptionChange((name) => name === 'keys' && this.bind());
    scene.events.once('shutdown', off);
    this.touch = {};
    this.held = {};
    this.pressed = {};
    for (const name of Object.keys(this.keys)) {
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

  bind() {
    const kb = this.scene.input.keyboard;
    for (const list of Object.values(this.keys || {})) for (const k of list) kb.removeKey(k, false);
    this.keys = {};
    for (const [name, codes] of Object.entries(bindings())) {
      this.keys[name] = codes.map((c) => kb.addKey(c, true, false));
    }
  }

  update() {
    const now = this.scene.time.now;
    for (const name of Object.keys(this.keys)) {
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
    for (const name of Object.keys(this.keys)) this.pressed[name] = false;
    this.interactSince = this.scene.time.now;
  }
}
