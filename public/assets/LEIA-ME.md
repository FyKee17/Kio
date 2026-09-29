# Arte do Kio

Coloque aqui seus arquivos (PNG com fundo transparente) e aponte para eles em
`src/data/art.js`, trocando `file: null` por `file: 'assets/nome.png'`.
O que não tiver arquivo continua com o placeholder, então dá para trocar aos poucos.

Todas as folhas são **uma linha só**, quadros lado a lado, da esquerda para a direita.
O jogo é desenhado em 2x: um sprite de 16 px aparece com 32 px na tela.

| chave        | tamanho do quadro | quadros | o que vai em cada quadro |
|--------------|-------------------|---------|--------------------------|
| `kio`        | 16 x 24           | 8       | 0-1 parado, 2-5 correndo, 6 subindo, 7 caindo |
| `tiles`      | 16 x 16           | 4       | 0 grama (topo), 1 terra, 2 plataforma vazada, 3 espinhos |
| `memory`     | 12 x 12           | 4       | animação de giro do lampejo |
| `checkpoint` | 16 x 32           | 2       | 0 apagado, 1 aceso |
| `door`       | 24 x 32           | 1       | porta de saída |
| `npc_musgo`  | 20 x 24           | 2       | Vovó Musgo respirando |
| `npc_lume`   | 12 x 12           | 2       | Lume (vaga-lume) |
| `npc_eco`    | 20 x 32           | 2       | Eco (estátua) |
| `npc_raiz`   | 28 x 32           | 2       | Raiz |
| `bg_sky`     | 480 x 270         | 1       | céu (fundo mais distante) |
| `bg_far`     | 480 x 270         | 1       | morros distantes, com transparência em cima |
| `bg_near`    | 480 x 270         | 1       | morros próximos, com transparência em cima |

Os fundos se repetem na horizontal, então a borda esquerda precisa casar com a direita.

Quer mudar tamanho ou número de quadros? Ajuste `frameWidth`, `frameHeight`,
`frames` e as animações em `src/data/art.js`. A hitbox do Kio fica em
`src/objects/Player.js` (`body.setSize`).
