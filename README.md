# Kio

Um metroidvania soulslike 2D para o navegador, com o mundo interligado do
*Hollow Knight* e a floresta luminosa do *Ori*. Kio, uma chama azul dentro de um
capuz, acorda numa floresta que esqueceu o próprio nome, desce até a Raiz do
mundo e, com um elemento novo (vento ou fogo), atravessa as Ruínas de um reino
de areia.

Feito com [Phaser 3](https://phaser.io) + [Vite](https://vite.dev). O cenário
inteiro (terreno orgânico, musgo brilhante, cogumelos, cipós, árvores ao fundo,
lua, névoa, inimigos, personagens) é desenhado em código quando o jogo carrega;
o Kio, a Vovó Musgo, o besouro, a mariposa e o Ender usam arte em arquivo.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # versão final em dist/ (hospeda em qualquer lugar estático)
```

## Controles

| ação | teclado e mouse | toque |
|------|-----------------|-------|
| andar | WASD (ou setas) | ◀ ▶ |
| correr | segurar Shift | (sempre corre) |
| pular / pulo duplo | Espaço (duas vezes no ar) | Pulo |
| atacar (segure W ou S para mirar; S no ar quica em inimigos e espinhos) | clique esquerdo (ou J) | Golpe |
| Passo Etéreo (dash) | Q | Dash |
| falar, ler, descansar | E | Falar |
| curar (gasta alma) | segurar E | Cura |
| descer de galho | S + Espaço | ▼ + Pulo |
| mapa | M ou Tab | Mapa |
| pausa (continuar, opções, menu) | Esc | Menu |
| habilidades do elemento | 1, 2, 3 | ícones embaixo |
| trocar de elemento (quando tiver os dois) | R | ícone do elemento |

Todas as teclas (menos Esc) podem ser trocadas em **Opções → Controles**; o
clique esquerdo sempre ataca e as setas sempre andam.

O jogo é desenhado na resolução real da tela (até 2x), então fica nítido em
monitores grandes e telas de celular. `?res=1` força a resolução base e
`?canvas` usa o renderizador Canvas (máquinas sem placa de vídeo).

## Som

- Músicas: *Hidden Clearing* (menu), *Sanctuary of Glowing Leaves* (mundo) e
  *Cursed Spectral Knight* (chefe), em `public/assets/music/`, com transição suave.
  As Ruínas, a Minhoca e o Cavaleiro já têm lugar para música própria (`ruins`,
  `worm`, `knight` em `src/audio/music.js`); enquanto não chegam, tocam a do
  mundo e a do chefe.
- Efeitos sonoros e as "vozes" dos personagens são sintetizados no código
  (`src/audio/sfx.js`), sem arquivos de áudio.
- Volume da música e dos efeitos em **Opções** (menu principal ou pausa).

## O chefe: Ender, o Cavaleiro Espectral

Ele decide o que fazer olhando a situação: distância, se o Kio está numa
plataforma (e há quanto tempo), se está levando combo, a própria vida e o que
acabou de fazer. Ataques: combo de espada, investida, salto que cai exatamente
onde o Kio está (inclusive nas plataformas) com raios de impacto e ondas de
choque que correm pelo chão e caem das plataformas, raios chamados do teto,
golpe para cima e uma explosão de contra-ataque quando apanha demais.
Abaixo de 30% de vida, solta orbes de energia que perseguem o Kio e seguem reto
quando chegam perto (dá para desviar). Comportamento em `src/objects/Ender.js`.

## Elementos

Depois de derrotar o Ender, a Raiz oferece dois elementos. O Kio levita, se
transforma (skin verde ou laranja) e o portão ao lado da arena se abre com uma
ventania. As habilidades gastam **mana** (barra embaixo da vida: enche batendo
e devagar com o tempo) e são liberadas uma a uma: a 1ª na escolha, a 2ª num
nicho escondido na Cidade Soterrada, a 3ª ao derrotar a Minhoca. No fim das
Ruínas, um altar dá o outro elemento (R troca entre os dois).

| | Vento | Fogo |
|---|---|---|
| 1 | Lâmina de Vento: corte que voa longe e atravessa (3s, 3 mana, 12) | Bola de Fogo: 12 + queimadura 2/s por 4s (4s, 3 mana) |
| 2 | Quebra-Chão: ondas de ar rasteiras para a frente (5,5s, 5 mana, 16) | Lâmina Ardente: espada em chamas por 1 min, +3 e queimadura (1 min, reserva 25% da mana) |
| 3 | Olho do Furacão: puxa, explode e arremessa (10s, 10 mana, 24) | Coroa de Brasas: até 3 brasas girando (5 + queimadura); na 5ª vítima explode (10 + queimadura por 9s) (15s, 5 mana) |

A espada tira 5 de dano (mesma escala das habilidades).

## Soulslike

- Ao morrer, os fragmentos de luz ficam onde você caiu (uma sombra do Kio,
  marcada no mapa com ✖). Vá até ela para recuperar. Morreu de novo antes? Perdeu.
- As Ruínas batem forte: o escudeiro e o Cavaleiro tiram 2 de vida por golpe.

## O mundo

Dez áreas ligadas, sem fases nem telas de carregamento:

- **Clareira do Despertar**: começo, primeiro santuário e a Vovó Musgo.
- **Bosque Luminoso**: centro do mapa. Galhos até a Copa e um poço até as Raízes.
- **Raízes Profundas**: cavernas com espinhos. Aqui está o **Passo Etéreo** (dash).
- **Copa Estrelada**: um fosso de espinhos que só se cruza com dash. Aqui está a
  **Chama Dupla** (pulo duplo) e, num lugar alto, um Coração de Musgo.
- **Santuário da Raiz**: atrás de um paredão que exige pulo duplo. Chefe: **Ender**, o Cavaleiro Espectral.

**As Ruínas** (atrás do portão, depois do Ender):

- **Portão dos Ventos**: santuário logo na entrada.
- **Mar de Dunas**: céu aberto ao entardecer, arqueiros nas colunas, pedriscos,
  redemoinhos de areia e uma tempestade no leste (rajadas empurram e a areia
  cobre a tela). A muralha no fim não se escala: o caminho é por baixo.
- **Cidade Soterrada**: ruas debaixo da areia, escudeiros, vapor quente e
  correntes de vapor que levantam o Kio (uma delas leva ao nicho da 2ª habilidade).
- **Ninho da Minhoca**: chefe **Ixtara, a Fome das Dunas**. Ela anda por baixo
  da areia (a poeira mostra onde), salta em arco, sai da parede numa investida
  rasteira, cospe pedras e, da fase 2 em diante, caça por baixo com erupções.
- **Cidadela Partida**: torre com o altar do outro elemento e, no alto, o chefe
  final **Sarkon, o Cavaleiro das Ruínas**: combos de espadão com ondas de areia,
  estocada de vento, salto, guarda que contra-ataca, gêiseres de vapor e, no
  fim, tempestade com redemoinhos.

Inimigos das Ruínas: **pedrisco** (fácil, pula em você), **arqueiro de arenito**
(puxa a corda devagar; pule ou dê dash; a espada rebate flechas) e **escudeiro
partido** (o escudo segura golpes de frente: bata por cima, pelas costas ou logo
depois da maçada; três golpes no escudo o desequilibram).

Santuários curam e salvam o jogo. Ao morrer, você volta ao último santuário
(e os fragmentos ficam para trás).
Golpear inimigos enche a alma (círculo no canto), que cura uma chama de vida.
O mapa (M) vai se revelando conforme você explora.

## Onde mexer

| quero mudar... | arquivo |
|----------------|---------|
| forma do mundo | `tools/gen_world.py` → `python3 tools/gen_world.py > src/data/map.js` (ou edite `src/data/map.js` à mão) |
| falas, tábuas, áreas, habilidades, elementos, final | `src/data/world.js` |
| habilidades de vento e fogo | `src/objects/Skills.js` |
| mana | `src/config.js` (`MANA`) |
| inimigos e perigos das Ruínas | `src/objects/Enemies.js` |
| a Minhoca / o Cavaleiro das Ruínas | `src/objects/Worm.js` / `src/objects/RuinKnight.js` |
| arte das Ruínas, skins | `src/gfx/ruins.js`, `src/gfx/skins.js` |
| sensação do pulo, dash, combate | `src/config.js` |
| visual do terreno e decoração | `src/gfx/terrain.js` |
| fundo (céu, lua, árvores, névoa) | `src/gfx/backdrop.js` |
| inimigos, personagens e objetos desenhados | `src/gfx/sprites.js` |
| comportamento dos inimigos | `src/objects/Enemies.js` |
| o chefe Ender (IA e efeitos) | `src/objects/Ender.js`, `src/gfx/fx.js` |
| menu principal | `src/scenes/TitleScene.js`, `src/gfx/title.js` |
| sons e músicas | `src/audio/` |
| arte (Kio, Vovó, besouro, mariposa, Ender) | `art-src/` + `tools/process_sprites.py` (veja `public/assets/LEIA-ME.md`) |
| quais quadros formam cada animação | `src/data/anims.js` |
