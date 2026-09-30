W, H = 310, 64
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


# ================= AS RUÍNAS (depois do Ender, atrás do portão '}' da arena)
import math

# ---------------- F: Portão dos Ventos (piso y=41)
air(137, 36, 150, 40)
air(139, 33, 150, 35)
put(137, 36, '}'); put(137, 37, '}'); put(137, 38, '}'); put(137, 39, '}'); put(137, 40, '}')
put(144, 40, 'B')
put(149, 40, '6')

# ---------------- G: Mar de Dunas (céu aberto, piso ondulado ~40)
def ground(x):
    if x <= 156:
        return 41
    if 183 <= x <= 202:
        return 40
    v = 40 + 1.4 * math.sin((x - 151) / 6.5) + 0.9 * math.sin((x - 151) / 2.7 + 1.3)
    return int(round(max(38, min(42, v))))

for x in range(151, 232):
    air(x, 0, x, ground(x) - 1)
# colunas partidas (arqueiros no alto)
# coluna alta com degraus dos dois lados (dá para subir e descer)
solid(164, 34, 166, ground(165) - 1)
plat(160, 163, 37)
plat(167, 170, 37)
put(165, 33, 'q')
solid(177, 34, 178, ground(177) - 1)
plat(174, 181, 34)
put(177, 33, 'q')
# arco partido: colunas com degraus, laje por cima (o arqueiro fica nela)
solid(196, 34, 197, ground(196) - 1)
solid(206, 34, 207, ground(206) - 1)
plat(192, 195, 37)
plat(199, 203, 37)
plat(208, 211, 37)
plat(196, 207, 31)
put(202, 30, 'q')
solid(214, 34, 219, ground(216) - 1)
put(216, 33, 'q')
# muralha leste: não dá para passar por cima (o caminho é por baixo)
solid(232, 0, 235, 47)
for x in (158, 171, 183, 212, 226):
    put(x, ground(x) - 1, 'a')
for x in (172, 210, 223):
    put(x, ground(x) - 1, 't')
put(229, ground(229) - 1, 'g')
put(193, ground(193) - 1, 'g')
put(230, ground(230) - 1, '8')

# ---------------- H: Cidade Soterrada (piso y=62)
air(146, 48, 247, 61)
# buraco do deserto até a cidade, com degraus para voltar
air(186, 38, 189, 47)
plat(188, 191, 57)
plat(184, 187, 53)
plat(186, 189, 49)
plat(186, 189, 45)
# oeste: coração no alto
plat(152, 156, 56)
plat(147, 150, 52)
put(148, 50, 'H')
put(158, 61, 'a')
solid(165, 48, 167, 55)
solid(170, 58, 178, 61)
put(174, 57, 'k')
rect(179, 61, 183, 61, '^')
# correntes de vapor que levantam (u) até o nicho escondido da habilidade
air(189, 43, 198, 47)
air(199, 44, 208, 47)
solid(197, 48, 210, 49)
put(192, 61, 'u')
put(195, 61, 'u')
put(205, 47, 'Z')
# santuário soterrado
put(214, 61, 'B')
put(218, 61, '7')
put(207, 61, 'a')
# vapor quente (v) e escudeiros
put(224, 61, 'v')
put(230, 61, 'v')
solid(226, 55, 229, 56)
put(227, 54, 'q')
put(233, 61, 'k')
put(244, 61, 'g')

# ---------------- I: Ninho da Minhoca (arena, piso y=45)
air(236, 40, 243, 44)
solid(240, 45, 243, 47)
air(236, 45, 239, 47)      # o poço precisa estar aberto até o corredor
plat(236, 239, 58)
plat(236, 239, 54)
plat(236, 239, 50)
plat(236, 239, 45)
air(244, 24, 272, 44)
rect(243, 40, 243, 44, '|')
plat(251, 255, 38)
plat(262, 266, 38)
put(262, 44, 'W')
rect(273, 40, 273, 44, '!')
air(274, 40, 275, 44)

# ---------------- J: Cidadela Partida (salão, piso y=45) e arena do Cavaleiro (piso y=19)
air(276, 22, 307, 44)
plat(282, 287, 41)
plat(291, 296, 37)
plat(299, 304, 33)
plat(291, 296, 29)
plat(276, 287, 27)
plat(276, 279, 23)
air(276, 12, 279, 21)
plat(276, 279, 19)
rect(280, 14, 280, 18, '|')
air(281, 3, 307, 18)
plat(286, 290, 14)
plat(298, 302, 14)
put(301, 18, 'R')
put(297, 44, 'B')
put(302, 44, 'X')
put(305, 44, '9')
put(287, 44, 'k')
put(284, 40, 'a')
put(293, 36, 'q')
put(301, 32, 'q')
put(292, 44, 'v')

# saída: python3 tools/gen_world.py > src/data/map.js
rows = [''.join(r) for r in g]
out = ['// Mapa do mundo, 1 caractere = 1 bloco de 32x32. Legenda em src/data/world.js.',
       '// Gerado por tools/gen_world.py (dá para editar aqui à mão também).',
       'export const MAP = [']
out += [f"  '{r}'," for r in rows]
out.append('];')
print('\n'.join(out))
