# Arte do Kio

As folhas originais ficam em `art-src/` (5x5 quadros de 256 px, fundo transparente):

- `art-src/kio_idle.png`: parado (25 quadros)
- `art-src/kio_run.png`: correndo com a espada (25 quadros)

Depois de trocar ou adicionar uma folha, rode:

```bash
pip install pillow
python3 tools/process_sprites.py
```

O script recorta cada quadro, reduz para 192x192, alinha pelos pés e pelo
centro do corpo (para o personagem não tremer) e salva aqui em
`public/assets/`. O jogo mostra o Kio em escala 0.7 (cerca de 90 px de altura).

## Animações que ainda usam quadros emprestados

Hoje pulo, queda, dash e golpe reaproveitam quadros da corrida. Se você mandar
folhas no mesmo formato (5x5 de 256 px, virado para a direita), elas encaixam direto:

- `kio_jump`: subindo e caindo
- `kio_attack`: golpe de espada (de lado, para cima e para baixo)
- `kio_dash`: avanço
- `kio_hurt`: levando dano
- `kio_focus`: curando (concentrando a chama)

Para ligar uma folha nova: acrescente o nome em `SHEETS` no script, carregue em
`src/scenes/BootScene.js` e use em `animate()` de `src/objects/Player.js`.
