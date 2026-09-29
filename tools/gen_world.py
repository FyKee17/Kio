W, H = 140, 64
g = [['#'] * W for _ in range(H)]


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = c


def air(x0, y0, x1, y1):
    rect(x0, y0, x1, y1, '.')


def solid(x0, y0, x1, y1):
    rect(x0, y0, x1, y1, '#')


def plat(x0, x1, y):
    rect(x0, y, x1, y, '=')


def put(x, y, c):
    g[y][x] = c


# ---------------- A: Clareira do Despertar (piso y=44)
air(3, 26, 40, 43)
air(10, 22, 30, 25)       # teto mais alto no meio
air(14, 19, 24, 21)
solid(3, 26, 6, 30)       # saliências do teto
solid(33, 26, 40, 29)
solid(26, 41, 29, 43)     # morrinho
solid(27, 40, 28, 40)
plat(17, 22, 38)
plat(9, 13, 34)
put(5, 43, 'P')
put(9, 43, 'B')
put(15, 43, 'm')
put(22, 43, '1')
put(34, 43, 'g')
put(20, 37, 'c')

# ---------------- B: Bosque Luminoso (piso y=48)
air(41, 14, 92, 47)
air(38, 36, 40, 43)       # passagem A -> B
solid(41, 44, 43, 47)     # degrau na entrada (A piso 44 -> B piso 48)
solid(41, 14, 45, 20)     # cantos do teto
solid(80, 14, 92, 18)
# zigue-zague até o topo
plat(45, 50, 44)
plat(53, 58, 40)
plat(45, 50, 36)
plat(53, 58, 32)
plat(45, 50, 28)
plat(53, 58, 24)
plat(47, 57, 20)
plat(49, 55, 16)
# grande tronco com galhos
solid(66, 32, 69, 47)
solid(65, 44, 70, 47)
plat(61, 65, 36)
plat(70, 74, 44)
plat(71, 76, 40)
plat(70, 74, 36)
put(73, 47, 'l')
put(62, 29, 'f')
put(80, 30, 'f')
put(58, 47, 'c')
put(78, 47, 'c')
put(80, 47, 'g')
put(62, 47, '5')


# ---------------- C: Raízes Profundas (piso y=62)
air(18, 52, 100, 61)
solid(50, 52, 55, 54)
solid(66, 52, 70, 55)
solid(33, 52, 37, 53)
solid(92, 52, 100, 53)
# poço B -> C (depois de escavar as Raízes, senão a escavação apaga os galhos)
air(82, 48, 90, 51)
plat(82, 85, 59)          # degraus de 3 blocos: dá para subir de volta com folga
plat(87, 90, 56)
plat(82, 85, 53)
plat(86, 90, 50)
rect(44, 61, 48, 61, '^')
rect(60, 61, 63, 61, '^')
rect(74, 61, 76, 61, '^')
solid(18, 52, 19, 57)
put(22, 59, 'D')
put(27, 61, '2')
put(35, 61, 'g')
put(40, 61, 's')
put(70, 61, 's')
put(30, 61, 'c')
put(56, 61, 'c')
put(81, 61, 'e')
put(94, 61, 'B')

# ---------------- D: Copa Estrelada (piso y=12)
air(16, 3, 96, 11)
air(50, 12, 55, 13)       # buraco para o Bosque
air(31, 12, 40, 15)       # fosso que exige o Passo Etéreo
rect(31, 15, 40, 15, '^')
solid(16, 3, 20, 5)
solid(60, 3, 66, 4)
solid(90, 6, 96, 11)      # plataforma alta: precisa do pulo duplo
plat(72, 77, 8)
put(20, 10, 'J')
put(25, 11, '3')
put(60, 11, 'g')
put(93, 5, 'H')
put(44, 6, 'f')
put(70, 5, 'f')
put(82, 11, 'c')

# ---------------- E: Santuário da Raiz
air(93, 28, 104, 40)      # antecâmara, piso y=41 (7 acima do Bosque: pulo duplo)
solid(93, 41, 104, 47)
air(105, 22, 136, 40)     # arena
solid(105, 22, 108, 35)
solid(133, 22, 136, 30)
rect(105, 36, 105, 40, '|')
plat(111, 115, 36)
plat(126, 130, 36)
put(97, 40, 'B')
put(101, 40, '4')
put(124, 40, 'K')
put(133, 40, 'r')

# saída: python3 tools/gen_world.py > src/data/map.js
rows = [''.join(r) for r in g]
out = ['// Mapa do mundo, 1 caractere = 1 bloco de 32x32. Legenda em src/data/world.js.',
       '// Gerado por tools/gen_world.py (dá para editar aqui à mão também).',
       'export const MAP = [']
out += [f"  '{r}'," for r in rows]
out.append('];')
print('\n'.join(out))
