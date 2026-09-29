# Kio

Um metroidvania 2D para o navegador, com o mundo interligado do *Hollow Knight*
e a floresta luminosa do *Ori*. Kio, uma chama azul dentro de um capuz, acorda
numa floresta que esqueceu o próprio nome e desce até a Raiz do mundo.

Feito com [Phaser 3](https://phaser.io) + [Vite](https://vite.dev). O cenário
inteiro (terreno orgânico, musgo brilhante, cogumelos, cipós, árvores ao fundo,
lua, névoa, inimigos, personagens) é desenhado em código quando o jogo carrega;
só o Kio usa arte em arquivo.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # versão final em dist/ (hospeda em qualquer lugar estático)
```

## Controles

| ação | teclado | toque |
|------|---------|-------|
| andar | ← → ou A D | ◀ ▶ |
| pular (segure para ir mais alto) | Z, Espaço ou K | Pulo |
| golpear (segure ↑ ou ↓ para mirar; ↓ no ar quica em inimigos e espinhos) | X ou J | Golpe |
| Passo Etéreo (dash) | C, Shift ou L | Dash |
| curar (segure; gasta alma) | F ou Q | Cura |
| falar, ler, descansar | E ou ↑ | Falar |
| descer de galho | ↓ + pulo | ▼ + Pulo |
| mapa | M ou Tab | Mapa |

## O mundo

Cinco áreas ligadas, sem fases nem telas de carregamento:

- **Clareira do Despertar**: começo, primeiro santuário e a Vovó Musgo.
- **Bosque Luminoso**: centro do mapa. Galhos até a Copa e um poço até as Raízes.
- **Raízes Profundas**: cavernas com espinhos. Aqui está o **Passo Etéreo** (dash).
- **Copa Estrelada**: um fosso de espinhos que só se cruza com dash. Aqui está a
  **Chama Dupla** (pulo duplo) e, num lugar alto, um Coração de Musgo.
- **Santuário da Raiz**: atrás de um paredão que exige pulo duplo. Chefe: o **Guardião Oco**.

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
| comportamento dos inimigos e do chefe | `src/objects/Enemies.js` |
| sprites do Kio | `art-src/` + `tools/process_sprites.py` (veja `public/assets/LEIA-ME.md`) |
