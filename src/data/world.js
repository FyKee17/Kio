// Conteúdo do mundo: legenda do mapa, áreas, personagens, tábuas e final.
//
// Legenda de src/data/map.js:
//   #  terra/rocha          =  galho (plataforma vazada; ↓ + pulo para descer)
//   ^  espinhos             |  portão da arena (fecha durante a luta)
//   P  início de jogo novo  B  santuário (descansar: cura e salva)
//   c  rastejante           f  mariposa sombria       s  bulbo cuspidor
//   K  chefe: Ender        g  depósito de fragmentos de luz
//   D  habilidade: Passo Etéreo (dash)   J  habilidade: Chama Dupla (pulo duplo)
//   H  Coração de Musgo (+1 de vida)     1-9  tábuas de lore (TABLETS)
//   m l e r  personagens (NPCS)

export { MAP } from './map.js';

// `dark`: quanto o fundo escurece nessa área (0 a 1)
export const AREAS = [
  { name: 'Clareira do Despertar', x: 0, y: 18, w: 41, h: 29, dark: 0.05 },
  { name: 'Bosque Luminoso', x: 41, y: 14, w: 52, h: 38, dark: 0 },
  { name: 'Raízes Profundas', x: 14, y: 52, w: 90, h: 12, dark: 0.6 },
  { name: 'Copa Estrelada', x: 12, y: 0, w: 88, h: 14, dark: 0 },
  { name: 'Santuário da Raiz', x: 93, y: 18, w: 47, h: 30, dark: 0.3 },
];

export const ABILITIES = {
  D: {
    key: 'dash',
    name: 'Passo Etéreo',
    text: 'A chama do Kio aprendeu a atravessar o vento.',
    hint: 'Aperte Q para avançar rápido, no chão ou no ar.',
  },
  J: {
    key: 'doubleJump',
    name: 'Chama Dupla',
    text: 'Uma segunda chama acende sob seus pés.',
    hint: 'Aperte Espaço de novo no ar para saltar outra vez.',
  },
};

export const TABLETS = {
  1: 'Quando a Lua Crescente caiu no rio, a floresta perdeu o sono. E quem não dorme, esquece.',
  2: 'As raízes guardam o que a copa esquece. Desça, pequeno. Desça até o silêncio ficar leve.',
  3: 'Da copa se vê o mundo inteiro. Mas é preciso duas chamas para alcançar o céu.',
  4: 'Aqui vigia Ender, o Cavaleiro Espectral. Ele guarda a Raiz de todos, até de quem veio salvá-la.',
  5: 'Os vaga-lumes eram cartas de amor entre árvores. Hoje voam em branco.',
};

// Cada NPC recebe o estado do jogo e devolve as falas da vez.
// `effect` (opcional) roda quando a conversa termina.
export const NPCS = {
  m: {
    name: 'Vovó Musgo',
    art: 'npc_musgo',
    talk(state) {
      if (!state.talked.includes('m')) {
        return {
          lines: [
            { who: 'Vovó Musgo', text: 'Uma chama azul... fazia tantas estações que eu não via uma acordar.' },
            { who: 'Vovó Musgo', text: 'Esta floresta esqueceu o próprio nome, sabe? As árvores dormem de olhos abertos.' },
            { who: 'Vovó Musgo', text: 'Lá no fundo do mundo mora a Raiz. Se alguém pode lembrar de nós, é ela.' },
            { who: 'Vovó Musgo', text: 'Descanse nos santuários quando cansar. Eles guardam seus passos.' },
            { who: 'Vovó Musgo', text: 'E me traga fragmentos de luz. Com 60 deles eu teço algo que vai te ajudar.' },
          ],
        };
      }
      if (!state.collected.includes('musgo-heart') && state.geo >= 60) {
        return {
          lines: [
            { who: 'Vovó Musgo', text: 'Sessenta fragmentos! Me dá aqui, que a agulha já está esperando.' },
            { who: 'Vovó Musgo', text: 'Pronto. Um coração de musgo, costurado com luz. Cuide bem dele.' },
          ],
          effect: (scene) => {
            state.geo -= 60;
            state.collected.push('musgo-heart');
            scene.gainHeart();
          },
        };
      }
      if (!state.collected.includes('musgo-heart')) {
        return { lines: [{ who: 'Vovó Musgo', text: `Com 60 fragmentos de luz eu teço um coração novo. Você tem ${state.geo}.` }] };
      }
      return { lines: [{ who: 'Vovó Musgo', text: 'Siga pelo Bosque, pequeno. As árvores mais velhas sabem o caminho.' }] };
    },
  },
  l: {
    name: 'Lume',
    art: 'npc_lume',
    talk(state) {
      if (!state.abilities.dash) {
        return {
          lines: [
            { who: 'Lume', text: 'Psiu! Aqui! Sou a Lume. Era vaga-lume... hoje sou só vaga.' },
            { who: 'Lume', text: 'Viu aquele fosso de espinhos lá na Copa? Ninguém cruza pulando.' },
            { who: 'Lume', text: 'Dizem que nas Raízes Profundas, lá pra esquerda, dorme um passo que corre mais que o vento.' },
            { who: 'Lume', text: 'O poço fica aqui do lado. É só se jogar. Coragem é cair e confiar.' },
          ],
        };
      }
      if (!state.abilities.doubleJump) {
        return {
          lines: [
            { who: 'Lume', text: 'Você brilhou diferente agora! Achou o passo, né?' },
            { who: 'Lume', text: 'Suba pelos galhos até a Copa. Depois do fosso tem uma segunda chama esperando.' },
          ],
        };
      }
      return {
        lines: [
          { who: 'Lume', text: 'Duas chamas! Agora aquele paredão à direita do Bosque não é nada.' },
          { who: 'Lume', text: 'Lá em cima fica o Santuário da Raiz. E o Ender, o cavaleiro de chamas roxas. Vai com cuidado.' },
        ],
      };
    },
  },
  e: {
    name: 'Eco',
    art: 'npc_eco',
    talk(state) {
      if (!state.talked.includes('e')) {
        return {
          lines: [
            { who: 'Eco', text: '...quem é você? ...é você?' },
            { who: 'Eco', text: 'Eu sou o que sobrou das vozes. Guardo o que os outros dizem, nada é meu.' },
            { who: 'Eco', text: 'Alguém disse, uma vez: "a chama pequena é a última memória do mundo". ...do mundo.' },
          ],
        };
      }
      return { lines: [{ who: 'Eco', text: '...descanse no santuário ao lado. ...ao lado.' }] };
    },
  },
  r: {
    name: 'Raiz',
    art: 'npc_raiz',
    talk(state) {
      if (!state.bossDefeated) return { lines: [{ who: 'Raiz', text: '...' }] };
      return {
        lines: [
          { who: 'Raiz', text: 'Você chegou, chama pequena. Eu esperei cada estação.' },
          { who: 'Kio', text: 'A Vovó Musgo disse que você lembraria de nós.' },
          { who: 'Raiz', text: 'Quando o mundo esqueceu, escondeu o que restava em algo pequeno o bastante para ninguém notar.' },
          { who: 'Raiz', text: 'Uma chama azul, dentro de um capuz. Você é a memória do mundo, Kio.' },
          { who: 'Raiz', text: 'Encoste sua chama em mim. Deixa a floresta lembrar.' },
        ],
        effect: (scene) => scene.finishGame(),
      };
    },
  },
};

export const ENDING = [
  'A chama azul desce pelas raízes, galho por galho, folha por folha.',
  'Os cogumelos acendem. Os vaga-lumes lembram as cartas que carregavam.',
  'A Vovó Musgo ri sozinha, sem saber por quê. O Eco diz uma palavra que é só dele.',
  'E a floresta, pela primeira vez em muitas estações, dorme. E sonha com você.',
];
