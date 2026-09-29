# Kio

Um jogo de plataforma 2D narrativo para o navegador. Kio acorda num mundo que
esqueceu tudo e junta lampejos de memória para descobrir quem é. O final muda
conforme quantos lampejos você encontrar.

Feito com [Phaser 3](https://phaser.io) + [Vite](https://vite.dev).

## Rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera a versão final em dist/ (dá pra hospedar em qualquer lugar estático)
```

## Controles

| ação | teclado | toque |
|------|---------|-------|
| andar | ← → ou A D | ◀ ▶ |
| pular (segure para ir mais alto) | Espaço, Z, ↑ ou W | ▲ |
| falar / entrar na porta | E, X ou Enter | E |
| descer de plataforma vazada | ↓ ou S | ▼ |
| avançar diálogo | Espaço ou E | tocar na caixa |

O progresso (fase atual, lampejos e conversas) é salvo no navegador.

## Onde mexer

| quero mudar... | arquivo |
|----------------|---------|
| mapas, falas, lampejos, finais | `src/data/levels.js` |
| arte (trocar placeholders pela sua) | `src/data/art.js` + `public/assets/LEIA-ME.md` |
| sensação do pulo/corrida | `src/config.js` (`PHYS`) |
| comportamento do Kio | `src/objects/Player.js` |
| regras da fase (morte, checkpoint, portas) | `src/scenes/GameScene.js` |
| caixa de diálogo, HUD, botões de toque | `src/ui/DialogueBox.js`, `src/scenes/UIScene.js` |

Os mapas são texto: `#` chão, `=` plataforma vazada, `^` espinho, `P` início,
`C` checkpoint, `M` lampejo, `N` personagem, `E` saída. A legenda completa está
no topo de `src/data/levels.js`.
