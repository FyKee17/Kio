# Kio

Um metroidvania 2D para o navegador, com o mundo interligado do *Hollow Knight*
e a floresta luminosa do *Ori*. Kio, uma chama azul dentro de um capuz, acorda
numa floresta que esqueceu o próprio nome e desce até a Raiz do mundo.

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

O jogo é desenhado na resolução real da tela (até 2x), então fica nítido em
monitores grandes e telas de celular. `?res=1` força a resolução base e
`?canvas` usa o renderizador Canvas (máquinas sem placa de vídeo).

## Som

- Músicas: *Hidden Clearing* (menu), *Sanctuary of Glowing Leaves* (mundo) e
  *Cursed Spectral Knight* (chefe), em `public/assets/music/`, com transição suave.
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

## O mundo

Cinco áreas ligadas, sem fases nem telas de carregamento:

- **Clareira do Despertar**: começo, primeiro santuário e a Vovó Musgo.
- **Bosque Luminoso**: centro do mapa. Galhos até a Copa e um poço até as Raízes.
- **Raízes Profundas**: cavernas com espinhos. Aqui está o **Passo Etéreo** (dash).
- **Copa Estrelada**: um fosso de espinhos que só se cruza com dash. Aqui está a
  **Chama Dupla** (pulo duplo) e, num lugar alto, um Coração de Musgo.
- **Santuário da Raiz**: atrás de um paredão que exige pulo duplo. Chefe: **Ender**, o Cavaleiro Espectral.

Santuários curam e salvam o jogo. Ao morrer, você volta ao último santuário.
Golpear inimigos enche a alma (círculo no canto), que cura uma chama de vida.
O mapa (M) vai se revelando conforme você explora.

## Onde mexer

| quero mudar... | arquivo |
|----------------|---------|
| forma do mundo | `tools/gen_world.py` → `python3 tools/gen_world.py > src/data/map.js` (ou edite `src/data/map.js` à mão) |
| falas, tábuas, áreas, habilidades, final | `src/data/world.js` |
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
