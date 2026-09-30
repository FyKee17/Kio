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
//
// As Ruínas (depois do Ender):
//   }  portão das Ruínas (abre depois de escolher o elemento)
//   a  pedrisco             q  arqueiro de arenito    k  escudeiro partido
//   t  redemoinho de areia  v  respiro de vapor quente  u  corrente de vapor (levanta)
//   W  chefe: a Minhoca     R  chefe: o Cavaleiro das Ruínas
//   Z  segunda habilidade do elemento   X  altar do outro elemento
//   !  portão de saída de arena (abre quando o chefe cai)

export { MAP } from './map.js';

// `dark`: quanto o fundo escurece nessa área (0 a 1)
export const AREAS = [
  { name: 'Clareira do Despertar', x: 0, y: 18, w: 41, h: 29, dark: 0.05 },
  { name: 'Bosque Luminoso', x: 41, y: 14, w: 52, h: 38, dark: 0 },
  { name: 'Raízes Profundas', x: 14, y: 52, w: 90, h: 12, dark: 0.6 },
  { name: 'Copa Estrelada', x: 12, y: 0, w: 88, h: 14, dark: 0 },
  { name: 'Santuário da Raiz', x: 93, y: 18, w: 44, h: 30, dark: 0.3 },
  // As Ruínas
  { name: 'Portão dos Ventos', x: 137, y: 28, w: 14, h: 18, dark: 0.2, ruins: true },
  { name: 'Cidade Soterrada', x: 146, y: 47, w: 102, h: 17, dark: 0.5, ruins: true },
  { name: 'Mar de Dunas', x: 151, y: 0, w: 85, h: 47, dark: 0, ruins: true, desert: true },
  { name: 'Ninho da Minhoca', x: 236, y: 20, w: 38, h: 27, dark: 0.25, ruins: true },
  { name: 'Cidadela Partida', x: 274, y: 0, w: 36, h: 48, dark: 0.3, ruins: true },
];

// A partir desta coluna o mundo vira ruína/deserto (terreno, fundo, partículas)
export const RUINS_X = 137;

// Tempestades de areia (em blocos): rajadas empurram e a areia cobre a tela
export const STORMS = [{ x0: 198, x1: 232, y0: 0, y1: 44 }];

// Arenas dos chefes (em blocos): de parede a parede, do teto ao chão
export const ARENAS = {
  ender: { left: 106, right: 137, top: 22, floor: 41 },
  worm: { left: 244, right: 273, top: 24, floor: 45 },
  knight: { left: 281, right: 308, top: 3, floor: 19 },
};

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
  6: 'Aqui começava o Reino de Areia. O vento era o mensageiro do rei; o fogo, a sua forja.',
  7: 'Quando o céu secou, a cidade desceu para baixo da areia. O vapor ainda sobe pelas ruas, procurando o céu.',
  8: 'Ninguém atravessa a muralha. Quem quer o leste, desce. A areia devolve o que engole, mas nunca inteiro.',
  9: 'O Cavaleiro jurou guardar o rei até o fim. O rei acabou. O juramento, não.',
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
      if (!state.element) {
        return {
          lines: [
            { who: 'Raiz', text: 'Você chegou, chama pequena. Eu esperei cada estação.' },
            { who: 'Kio', text: 'A Vovó Musgo disse que você lembraria de nós.' },
            { who: 'Raiz', text: 'Eu lembro. Lembro que a floresta não foi a única a esquecer.' },
            { who: 'Raiz', text: 'Atrás de mim dorme um reino de areia. O vento e o fogo de lá ainda procuram alguém para acender.' },
            { who: 'Raiz', text: 'Sua chama é pequena, mas aceita qualquer cor. Escolha a que vai levar para as Ruínas.' },
          ],
          effect: (scene) => scene.elementCeremony(),
        };
      }
      if (!state.knightDefeated) {
        return {
          lines: [
            { who: 'Raiz', text: 'O portão está aberto. Siga o vento até a Cidadela.' },
            { who: 'Raiz', text: 'Lá em cima, alguém ainda cumpre um juramento que ninguém mais lembra.' },
          ],
        };
      }
      return { lines: [{ who: 'Raiz', text: 'O vento voltou a soprar do jeito certo. Obrigada, Kio.' }] };
    },
  },
};

// Os dois elementos que a Raiz oferece. As 3 habilidades de cada um são
// liberadas uma a uma: a 1ª na escolha, a 2ª no nicho escondido da Cidade
// Soterrada (Z) e a 3ª ao derrotar a Minhoca. O altar (X) dá o outro elemento.
export const ELEMENTS = {
  wind: {
    name: 'Vento',
    color: 0x6dff8a,
    light: 0xc8ffd2,
    dark: 0x1f7a3a,
    css: '#7dff96',
    lines: [
      { who: 'Raiz', text: 'O vento. Leve, cortante, livre. Ele nunca fica, mas sempre volta.' },
      { who: 'Raiz', text: 'Ele vai te ensinar a cortar de longe. O resto, as Ruínas vão te mostrar.' },
    ],
    skills: [
      { name: 'Lâmina de Vento', text: 'Um corte de ar que voa longe e atravessa inimigos.', cd: 3000, mana: 3, dmg: 12 },
      { name: 'Quebra-Chão', text: 'Golpeia o chão e solta ondas de ar cortante para a frente.', cd: 5500, mana: 5, dmg: 16 },
      { name: 'Olho do Furacão', text: 'Um redemoinho gigante puxa os inimigos e explode numa onda que os arremessa.', cd: 10000, mana: 10, dmg: 24 },
    ],
  },
  fire: {
    name: 'Fogo',
    color: 0xff8a2a,
    light: 0xffe0a0,
    dark: 0x8a2a0a,
    css: '#ffa04a',
    lines: [
      { who: 'Raiz', text: 'O fogo. Quente, faminto, teimoso. Ele consome, mas também aquece quem está perto.' },
      { who: 'Raiz', text: 'Ele vai te ensinar a lançar chamas. O resto, as Ruínas vão te mostrar.' },
    ],
    skills: [
      { name: 'Bola de Fogo', text: 'Uma bola de fogo que queima o alvo por 4 segundos.', cd: 4000, mana: 3, dmg: 12 },
      { name: 'Lâmina Ardente', text: 'Sua espada pega fogo por 1 minuto: +3 de dano e queimadura. Reserva 25% da mana.', cd: 60000, mana: 0, dmg: 3 },
      { name: 'Coroa de Brasas', text: 'Brasas giram ao seu redor (até 3). Na 5ª vítima, cada uma explode.', cd: 15000, mana: 5, dmg: 5 },
    ],
  },
};

export const ENDING = [
  'O Cavaleiro das Ruínas ajoelha, e o juramento finalmente se desfaz em areia.',
  'O vento volta a soprar do jeito certo: do deserto para a floresta, levando o nome das coisas.',
  'A Vovó Musgo ri sozinha, sem saber por quê. O Eco diz uma palavra que é só dele.',
  'E o mundo, pela primeira vez em muitas estações, lembra. E lembra de você, Kio.',
];
