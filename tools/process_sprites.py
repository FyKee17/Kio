"""Converte as folhas originais do Kio (5x5 quadros de 256px, fundo transparente)
em folhas prontas para o jogo: 192x192 por quadro, personagem alinhado pelos pés
e pelo centro do corpo, para não "tremer" entre quadros.

Uso:  python3 tools/process_sprites.py
Entrada: art-src/<nome>.png   Saída: public/assets/<nome>.png
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ['kio_idle', 'kio_run']
GRID = 5
OUT = 192          # tamanho do quadro de saída
SCALE = 0.75       # 256 -> 192
FEET_Y = 182       # linha dos pés dentro do quadro de saída
CENTER_X = OUT // 2


def body_anchor(frame):
    """Centro horizontal dos pixels escuros (corpo, sem chamas e espada) e base."""
    px = frame.load()
    w, h = frame.size
    sx = n = 0
    bottom = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            bottom = max(bottom, y)
            if (r + g + b) / 3 < 70:
                sx += x
                n += 1
    return (sx / n if n else w / 2), bottom


for name in SHEETS:
    src = Image.open(ROOT / 'art-src' / f'{name}.png').convert('RGBA')
    cell = src.width // GRID
    sheet = Image.new('RGBA', (OUT * GRID, OUT * GRID))
    for i in range(GRID * GRID):
        c, r = i % GRID, i // GRID
        frame = src.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell))
        frame = frame.resize((round(cell * SCALE),) * 2, Image.LANCZOS)
        cx, bottom = body_anchor(frame)
        dx = round(CENTER_X - cx)
        dy = round(FEET_Y - bottom)
        cell_img = Image.new('RGBA', (OUT, OUT))
        cell_img.alpha_composite(frame, (max(dx, 0), max(dy, 0)), (max(-dx, 0), max(-dy, 0)))
        sheet.paste(cell_img, (c * OUT, r * OUT))
    sheet.save(ROOT / 'public' / 'assets' / f'{name}.png', optimize=True)
    print('ok', name, sheet.size)
