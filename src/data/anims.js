// Folhas de arte (geradas por tools/process_sprites.py) e as animações montadas
// a partir delas. Os números são os quadros da folha, lidos da esquerda para a
// direita e de cima para baixo (veja art-src/preview/ com --preview).

export const SHEETS = {
  kio_idle: { frameWidth: 224, frameHeight: 208 },
  kio_walk: { frameWidth: 224, frameHeight: 208 },
  kio_run: { frameWidth: 224, frameHeight: 208 },
  kio_jump: { frameWidth: 224, frameHeight: 208 },
  kio_attack: { frameWidth: 224, frameHeight: 208 },
  kio_sit: { frameWidth: 224, frameHeight: 208 }, // montada a partir de kio_idle pelo script
  npc_musgo: { frameWidth: 192, frameHeight: 176 },
  kio_idle_hd: { frameWidth: 288, frameHeight: 272 },
  npc_musgo_hd: { frameWidth: 256, frameHeight: 240 },
  ender_idle: { frameWidth: 320, frameHeight: 280 },
  ender_walk: { frameWidth: 320, frameHeight: 280 },
  ender_jump: { frameWidth: 320, frameHeight: 280 },
  ender_attack: { frameWidth: 320, frameHeight: 280 },
  beetle: { frameWidth: 208, frameHeight: 112 },
  moth: { frameWidth: 160, frameHeight: 128 },
};

// Linha dos pés dentro do quadro (o script põe os pés 10px acima da base)
export const FEET = {
  kio: 198 / 208,
  npc_musgo: 166 / 176,
  beetle: 102 / 112,
  ender: 270 / 280,
};

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const ANIMS = [
  // Kio
  { key: 'kio-idle', sheet: 'kio_idle', frames: range(0, 24), rate: 14, repeat: -1 },
  { key: 'kio-walk', sheet: 'kio_walk', frames: range(0, 24), rate: 28, repeat: -1 },
  { key: 'kio-run', sheet: 'kio_run', frames: range(0, 24), rate: 20, repeat: -1 }, // passada calma, casando com a velocidade
  { key: 'kio-rise', sheet: 'kio_jump', frames: [7, 8], rate: 12, repeat: 0 },
  { key: 'kio-apex', sheet: 'kio_jump', frames: [9, 10, 11, 12, 13], rate: 16, repeat: 0 },
  { key: 'kio-fall', sheet: 'kio_jump', frames: [14, 15, 16, 17, 18], rate: 12, repeat: -1 },
  { key: 'kio-land', sheet: 'kio_jump', frames: [19, 20, 21, 22], rate: 26, repeat: 0 },
  { key: 'kio-slash', sheet: 'kio_attack', frames: [10, 11, 12, 13, 14, 16, 18], rate: 34, repeat: 0 },
  { key: 'kio-slash-up', sheet: 'kio_attack', frames: [6, 7, 8, 9, 9], rate: 26, repeat: 0 },
  { key: 'kio-sit', sheet: 'kio_sit', frames: range(0, 24), rate: 12, repeat: -1 },
  { key: 'kio-slash-down', sheet: 'kio_jump', frames: [14, 15, 16], rate: 20, repeat: 0 },
  { key: 'kio-idle-hd', sheet: 'kio_idle_hd', frames: range(0, 24), rate: 14, repeat: -1 },
  { key: 'musgo-idle-hd', sheet: 'npc_musgo_hd', frames: range(0, 24), rate: 10, repeat: -1 },
  // Vovó Musgo (respira e pisca)
  { key: 'npc_musgo-idle', sheet: 'npc_musgo', frames: range(0, 24), rate: 10, repeat: -1 },
  // Besouro rastejante
  { key: 'crawler-walk', sheet: 'beetle', frames: range(0, 24), rate: 22, repeat: -1 },
  // Mariposa: as poses vêm ordenadas da asa mais alta para a mais baixa;
  // esta sequência sobe e desce as asas como um bater contínuo
  { key: 'flyer-fly', sheet: 'moth', frames: [0, 5, 12, 17, 11, 20, 21, 19, 13, 14, 9], rate: 16, repeat: -1 },
  // Ender, o chefe
  { key: 'ender-idle', sheet: 'ender_idle', frames: range(0, 24), rate: 12, repeat: -1 },
  { key: 'ender-walk', sheet: 'ender_walk', frames: range(0, 24), rate: 26, repeat: -1 },
  { key: 'ender-crouch', sheet: 'ender_jump', frames: [3, 4, 5], rate: 14, repeat: 0 },
  { key: 'ender-rise', sheet: 'ender_jump', frames: [13, 14], rate: 10, repeat: 0 },
  { key: 'ender-air', sheet: 'ender_jump', frames: [0, 1, 2, 1], rate: 10, repeat: -1 },
  { key: 'ender-land', sheet: 'ender_jump', frames: [11, 12, 18, 19], rate: 14, repeat: 0 },
  { key: 'ender-windup', sheet: 'ender_attack', frames: [2, 3, 4, 5, 6], rate: 14, repeat: 0 },
  { key: 'ender-slash', sheet: 'ender_attack', frames: [7, 8, 9], rate: 18, repeat: 0 },
  { key: 'ender-recover', sheet: 'ender_attack', frames: range(10, 19), rate: 18, repeat: 0 },
  { key: 'ender-raise', sheet: 'ender_attack', frames: [3, 4, 5], rate: 10, repeat: 0 },
];
