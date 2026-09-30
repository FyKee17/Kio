# Arte do jogo

As folhas originais ficam em `art-src/` (5x5 quadros, fundo transparente,
personagem virado para a direita):

| arquivo | o que é | usado como |
|---------|---------|------------|
| `kio_idle.png` | Kio parado | `kio-idle` |
| `kio_walk.png` | Kio andando | `kio-walk` (começo e fim da corrida) |
| `kio_run.png` | Kio correndo | `kio-run` |
| `kio_jump.png` | Kio pulando | `kio-rise`, `kio-apex`, `kio-fall`, `kio-land` |
| `kio_attack.png` | Kio golpeando | `kio-slash`, `kio-slash-up` |
| `npc_musgo.png` | Vovó Musgo | `npc_musgo-idle` |
| `beetle.png` | besouro rastejante | `crawler-walk` |
| `moth.png` | mariposa sombria | `flyer-fly` |
| `ender_idle.png`, `ender_walk.png`, `ender_jump.png`, `ender_attack.png` | Ender, o chefe | `ender-*` |
| (gerada) `kio_sit.png` | Kio sentado no santuário, montado pelo script a partir de `kio_idle` | `kio-sit` |

Depois de trocar ou adicionar uma folha, rode:

```bash
pip install pillow
python3 tools/process_sprites.py --preview
```

O script acha cada quadro pela coluna (funciona mesmo se as linhas da folha
estiverem desalinhadas), reduz, alinha pelos pés e pelo centro do corpo (ou pela
cabeça, no caso da mariposa) e salva aqui em `public/assets/`. Com `--preview`
ele também gera `art-src/preview/` com os quadros numerados, para você escolher
quais quadros entram em cada animação em `src/data/anims.js`.

## Para mandar uma folha nova

1. Coloque em `art-src/<nome>.png`.
2. Acrescente `<nome>` em `SHEETS` no `tools/process_sprites.py` (escala e tamanho do quadro).
3. Acrescente em `SHEETS` e `ANIMS` no `src/data/anims.js`.

Animações que ainda aproveitam outros quadros: dash (usa um quadro da corrida),
dano (quadro do pulo) e golpe para baixo (quadros da queda).

## Skins de elemento e inimigos das Ruínas

- As skins verde (Vento) e laranja (Fogo) do Kio são geradas quando o jogo
  carrega, repintando os tons azuis das folhas acima (`src/gfx/skins.js`).
  Se você mandar folhas próprias de cada skin, elas entram no lugar.
- Pedrisco, arqueiro, escudeiro, a Minhoca, o Cavaleiro das Ruínas, o redemoinho,
  o altar e o portão das Ruínas são desenhados em código (`src/gfx/ruins.js`).
  Dá para trocar qualquer um por uma folha sua do mesmo jeito que os outros.
