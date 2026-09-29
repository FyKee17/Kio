"""Converte as folhas originais (5x5 quadros, fundo transparente) em folhas
prontas para o jogo, com todos os quadros do mesmo tamanho e o personagem
alinhado (pelos pés ou pelo centro) para não "tremer" entre quadros.

Os quadros são achados por coluna (faixas verticais com conteúdo), então
funciona mesmo quando as linhas da folha original estão desalinhadas.

Uso:   pip install pillow && python3 tools/process_sprites.py
Entrada: art-src/<nome>.png     Saída: public/assets/<nome>.png
Com --preview, salva também art-src/preview/<nome>.png com os quadros numerados.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GRID = 5

# scale: redução aplicada; w/h: tamanho do quadro de saída;
# anchor 'feet' = pés em (w/2, h - 10) pelo centro do corpo escuro; 'center' = centro do desenho;
# 'head' = cabeça (ponta direita) num ponto fixo
SHEETS = {
    'kio_idle':   dict(scale=0.75, w=224, h=208, anchor='feet'),
    'kio_walk':   dict(scale=0.72, w=224, h=208, anchor='feet'),
    'kio_run':    dict(scale=0.75, w=224, h=208, anchor='feet'),
    'kio_jump':   dict(scale=0.75, w=224, h=208, anchor='feet'),
    'kio_attack': dict(scale=0.67, w=224, h=208, anchor='feet'),
    'npc_musgo':  dict(scale=0.75, w=192, h=176, anchor='feet'),
    'beetle':     dict(scale=0.75, w=208, h=112, anchor='feet'),
    # a mariposa vem com as poses embaralhadas: ordenamos da asa mais alta
    # para a mais baixa, assim a animação em vai-e-volta vira um bater de asas
    'moth':       dict(scale=0.75, w=160, h=128, anchor='head', sort='height'),
}


def find_frames(im):
    """Caixas (x0, y0, x1, y1) de cada quadro, em ordem de leitura."""
    alpha = im.getchannel('A').load()
    W, H = im.size
    cw = W // GRID
    found = []
    for c in range(GRID):
        rows = [any(alpha[x, y] > 40 for x in range(c * cw, (c + 1) * cw, 2)) for y in range(H)]
        segs, start = [], None
        for y, r in enumerate(rows + [False]):
            if r and start is None:
                start = y
            if not r and start is not None:
                segs.append([start, y])
                start = None
        merged = []
        for s in segs:
            if merged and s[0] - merged[-1][1] < 8:
                merged[-1][1] = s[1]
            else:
                merged.append(s)
        merged = [s for s in merged if s[1] - s[0] > 30]
        for r, (y0, y1) in enumerate(merged):
            found.append((r * GRID + c, (c * cw, y0, (c + 1) * cw, y1)))
    return [box for _, box in sorted(found)]


def anchor_point(frame, mode):
    px = frame.load()
    w, h = frame.size
    xs, ys, dark_x = [], [], []
    for y in range(h):
        for x in range(0, w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            xs.append(x)
            ys.append(y)
            if (r + g + b) / 3 < 70:
                dark_x.append(x)
    if mode == 'center':
        return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    if mode == 'head':
        # cabeça = parte mais à direita (o bicho olha para a direita)
        right = max(xs)
        head_ys = [y for x, y in zip(xs, ys) if x > right - 18]
        return right, sum(head_ys) / len(head_ys)
    cx = sum(dark_x) / len(dark_x) if dark_x else sum(xs) / len(xs)
    return cx, max(ys)


def process(name, cfg, preview):
    src = Image.open(ROOT / 'art-src' / f'{name}.png').convert('RGBA')
    boxes = find_frames(src)
    frames = []
    for box in boxes:
        f = src.crop(box)
        f = f.resize((round(f.width * cfg['scale']), round(f.height * cfg['scale'])), Image.LANCZOS)
        frames.append(f)
    if cfg.get('sort') == 'height':
        def height(f):
            bb = f.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
            return bb[3] - bb[1]
        frames.sort(key=height, reverse=True)
    w, h = cfg['w'], cfg['h']
    sheet = Image.new('RGBA', (w * GRID, h * GRID))
    for i, f in enumerate(frames):
        ax, ay = anchor_point(f, cfg['anchor'])
        tx, ty = {'feet': (w / 2, h - 10), 'center': (w / 2, h / 2), 'head': (w * 0.78, h * 0.4)}[cfg['anchor']]
        cell = Image.new('RGBA', (w, h))
        dx, dy = round(tx - ax), round(ty - ay)
        cell.alpha_composite(f, (max(dx, 0), max(dy, 0)), (max(-dx, 0), max(-dy, 0)))
        sheet.paste(cell, ((i % GRID) * w, (i // GRID) * h))
    out = ROOT / 'public' / 'assets' / f'{name}.png'
    sheet.save(out, optimize=True)
    print(f'ok {name}: {len(frames)} quadros de {w}x{h}')
    if preview:
        pv = Image.new('RGBA', sheet.size, (40, 44, 60, 255))
        pv.alpha_composite(sheet)
        d = ImageDraw.Draw(pv)
        for i in range(len(frames)):
            x, y = (i % GRID) * w, (i // GRID) * h
            d.rectangle([x, y, x + w - 1, y + h - 1], outline=(90, 100, 130))
            d.line([x, y + h - 10, x + w, y + h - 10], fill=(255, 80, 80))
            d.text((x + 4, y + 2), str(i), fill=(255, 255, 0))
        (ROOT / 'art-src' / 'preview').mkdir(exist_ok=True)
        pv.save(ROOT / 'art-src' / 'preview' / f'{name}.png')


def make_sit(preview):
    """Kio sentado, montado a partir dos quadros parados (não há folha própria):
    o tronco desce SIT_DROP px e só as botas ficam penduradas sob a túnica,
    como alguém sentado visto de frente. Mantém a respiração e a chama."""
    HEM, BOOTS, SIT_DROP = 176, 184, 14
    w, h = SHEETS['kio_idle']['w'], SHEETS['kio_idle']['h']
    idle = Image.open(ROOT / 'public' / 'assets' / 'kio_idle.png')
    out = Image.new('RGBA', idle.size)
    for i in range(GRID * GRID):
        box = ((i % GRID) * w, (i // GRID) * h, (i % GRID + 1) * w, (i // GRID + 1) * h)
        f = idle.crop(box)
        cell = Image.new('RGBA', (w, h))
        boots = f.crop((0, BOOTS, w, h))
        cell.alpha_composite(boots, (0, BOOTS + SIT_DROP - (BOOTS - HEM) - 2))
        upper = f.crop((0, 0, w, HEM))
        cell.alpha_composite(upper, (0, SIT_DROP))
        out.paste(cell, box[:2])
    out.save(ROOT / 'public' / 'assets' / 'kio_sit.png', optimize=True)
    print('ok kio_sit: montado a partir de kio_idle')
    if preview:
        pv = Image.new('RGBA', out.size, (40, 44, 60, 255))
        pv.alpha_composite(out)
        pv.save(ROOT / 'art-src' / 'preview' / 'kio_sit.png')


if __name__ == '__main__':
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    for name, cfg in SHEETS.items():
        if not only or name in only:
            process(name, cfg, '--preview' in sys.argv)
    if not only or 'kio_sit' in only or 'kio_idle' in only:
        make_sit('--preview' in sys.argv)
