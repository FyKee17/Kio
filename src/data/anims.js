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
  beetle: { frameWidth: 208, frameHeight: 112 },
  moth: { frameWidth: 160, frameHeight: 128 },
};

// Linha dos pés dentro do quadro (o script põe os pés 10px acima da base)
export const FEET = {
  kio: 198 / 208,
  npc_musgo: 166 / 176,
  beetle: 102 / 112,
};

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const ANIMS = [
  // Kio
  { key: 'kio-idle', sheet: 'kio_idle', frames: range(0, 24), rate: 14, repeat: -1 },
  { key: 'kio-walk', sheet: 'kio_walk', frames: range(0, 24), rate: 28, repeat: -1 },
  { key: 'kio-run', sheet: 'kio_run', frames: range(0, 24), rate: 32, repeat: -1 },
  { key: 'kio-rise', sheet: 'kio_jump', frames: [7, 8], rate: 12, repeat: 0 },
  { key: 'kio-apex', sheet: 'kio_jump', frames: [9, 10, 11, 12, 13], rate: 16, repeat: 0 },
  { key: 'kio-fall', sheet: 'kio_jump', frames: [14, 15, 16, 17, 18], rate: 12, repeat: -1 },
  { key: 'kio-land', sheet: 'kio_jump', frames: [19, 20, 21, 22], rate: 26, repeat: 0 },
  { key: 'kio-slash', sheet: 'kio_attack', frames: [10, 11, 12, 13, 14, 16, 18], rate: 34, repeat: 0 },
  { key: 'kio-slash-up', sheet: 'kio_attack', frames: [6, 7, 8, 9, 9], rate: 26, repeat: 0 },
  { key: 'kio-sit', sheet: 'kio_sit', frames: range(0, 24), rate: 12, repeat: -1 },
  { key: 'kio-slash-down', sheet: 'kio_jump', frames: [14, 15, 16], rate: 20, repeat: 0 },
  // Vovó Musgo (respira e pisca)
  { key: 'npc_musgo-idle', sheet: 'npc_musgo', frames: range(0, 24), rate: 10, repeat: -1 },
  // Besouro rastejante
  { key: 'crawler-walk', sheet: 'beetle', frames: range(0, 24), rate: 22, repeat: -1 },
  // Mariposa: as poses vêm ordenadas da asa mais alta para a mais baixa;
  // esta sequência sobe e desce as asas como um bater contínuo
  { key: 'flyer-fly', sheet: 'moth', frames: [0, 5, 12, 17, 11, 20, 21, 19, 13, 14, 9], rate: 16, repeat: -1 },
];
