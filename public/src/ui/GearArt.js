// Dibujos pixelados de la armería (de perfil), hechos con las mismas medidas y colores que el
// fusil en primera persona (content/arsenal.js: look). Cada uno, un canvas de W×H píxeles que se
// escala sin suavizar.
const W = 64, H = 32, INK = '#2a1a0e';
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const cache = new Map();

// Rectángulo con su borde de tinta (como los contornos del juego)
function block(ctx, x, y, w, h, c) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = hex(c);
    ctx.fillRect(x, y, w, h);
}

function flat(ctx, x, y, w, h, c) {
    ctx.fillStyle = hex(c);
    ctx.fillRect(x, y, w, h);
}

const DRAW = {
    // Mirilla: tubo con sus anillos y el cristal delante (o el punto rojo abierto, o la nocturna
    // con su caja)
    scope(ctx, L) {
        if (L.open) {
            block(ctx, 20, 20, 24, 4, L.body);
            block(ctx, 22, 9, 4, 12, L.body);
            block(ctx, 38, 9, 4, 12, L.body);
            flat(ctx, 27, 12, 10, 6, 0xd8f0ff);
            flat(ctx, 31, 14, 2, 2, L.glass);
            return;
        }
        const len = Math.round(L.len * 80), r = Math.round(L.r * 90), x = (W - len) >> 1, y = (H - r) >> 1;
        block(ctx, x, y, len, r, L.body);
        block(ctx, x - 1, y - 2, 4, r + 4, L.ring);
        block(ctx, x + len - 3, y - 2, 4, r + 4, L.ring);
        flat(ctx, x - 2, y + 1, 1, r - 2, L.glass);
        flat(ctx, x + 4, y + 1, len - 8, 1, 0xffffff);
        if (L.box) block(ctx, x + len - 14, y - 6, 8, 5, L.body);
        block(ctx, x + 8, y + r + 1, 3, 4, 0x5c6068);
        block(ctx, x + len - 12, y + r + 1, 3, 4, 0x5c6068);
    },
    // Rifle: culata, empuñadura, cajón, guardamanos y cañón (largo y grueso según el rifle)
    rifle(ctx, L) {
        const barrel = Math.round(L.barrel * 28), t = Math.max(2, Math.round(L.thick * 32)), x0 = 3;
        block(ctx, x0, 13, 13, 6, L.wood);
        block(ctx, x0 + 9, 18, 4, 6, L.wood2);
        block(ctx, x0 + 15, 12, 11, 6, L.metal);
        if (L.rail) block(ctx, x0 + 15, 10, 11, 1, 0x34373e);
        block(ctx, x0 + 26, 13, Math.min(12, barrel), 4, L.wood);
        block(ctx, x0 + 26, 14 - (t >> 1), barrel, t, 0x34373e);
        const end = x0 + 26 + barrel;
        block(ctx, end, 13 - (t >> 1), 3, t + 2, L.brake ? 0x5c6068 : L.metal);
        if (L.brake) for (const dx of [-3, -6]) flat(ctx, end + dx, 12 - (t >> 1), 1, t + 4, 0x2a2a2a);
        if (L.glow) for (const dx of [6, 12, 18]) flat(ctx, x0 + 26 + dx, 14 - (t >> 1), 2, t, L.glow);
        block(ctx, x0 + 17, 18, 3, 3, 0x34373e);
    },
    // Cargador: caja recta, curva (ampliado), tambor o célula que brilla
    mag(ctx, L) {
        const w = Math.round(L.d * 110), h = Math.round(L.h * 100), x = (W - w) >> 1, y = (H - h) >> 1;
        if (L.drum) {
            block(ctx, x + 2, y, w - 4, h, L.color);
            block(ctx, x, y + 3, w, h - 6, L.color);
            flat(ctx, x + (w >> 1) - 2, y + (h >> 1) - 2, 4, 4, 0x34373e);
            return;
        }
        if (L.bend) {
            // Curvo: cada franja un poco más adelantada
            ctx.fillStyle = INK;
            for (let k = 0; k < h; k += 3) ctx.fillRect(x - 1 + (k >> 2), y + k - 1, w + 2, 5);
            ctx.fillStyle = hex(L.color);
            for (let k = 0; k < h; k += 3) ctx.fillRect(x + (k >> 2), y + k, w, 3);
            return;
        }
        block(ctx, x, y, w, h, L.color);
        flat(ctx, x + 1, y + 1, 1, h - 2, 0x8a8a8a);
        if (L.glow) flat(ctx, x + 3, y + 3, w - 6, h - 6, L.glow);
        if (!L.glow) flat(ctx, x + 2, y + 2, w - 4, 2, 0xd9b04a);
    },
};

// URL del dibujo de una pieza (kind: scope, rifle o mag)
export function gearArt(kind, item) {
    const key = `${kind}:${item.id}`;
    if (cache.has(key)) return cache.get(key);
    const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = cv.getContext('2d');
    DRAW[kind](ctx, item.look);
    const url = cv.toDataURL();
    cache.set(key, url);
    return url;
}
