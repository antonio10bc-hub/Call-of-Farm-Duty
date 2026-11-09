import { G, cellIndex, toXZ, toUV, VW, VH } from '../world/valley.js';

// Mini-mapa en una esquina: el valle visto como en la pantalla (montañas arriba), cada parcela del
// color de lo que tiene (las que no son tuyas, más apagadas), el agua y el monte; encima, el
// rectángulo de lo que se ve. Tocarlo lleva la cámara a ese sitio.
//   colorOf(ri): el color de una zona y si es tuya ([r, g, b, tuya])
const SIZE = 104;

export class Minimap {
    constructor(canvas, colorOf) {
        this.cv = canvas;
        this.cv.width = this.cv.height = SIZE;
        this.ctx = canvas.getContext('2d');
        this.colorOf = colorOf;
        this.base = this.ctx.createImageData(SIZE, SIZE);
    }

    // Vuelve a pintar el fondo (al empezar y cuando cambia una parcela)
    paint() {
        const D = this.base.data, m = 6;
        for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
            const u = -m + ((px + 0.5) / SIZE) * (VW + 2 * m), v = -m * 3 + ((py + 0.5) / SIZE) * (VH + 4 * m);
            const [x, z] = toXZ(u, v), k = cellIndex(x, z), o = (py * SIZE + px) * 4;
            let c = [116, 184, 72];
            if (k >= 0 && G.inside[k]) {
                const h = G.h[k], r = G.reg[k];
                if (G.water[k]) c = [74, 168, 224];
                else if (r >= 0) {
                    const [cr, cg, cb, mine] = this.colorOf(r);
                    c = mine ? [cr, cg, cb] : [cr * 0.55, cg * 0.55, cb * 0.6];
                } else c = h > 47 ? [244, 246, 250] : h > 30 ? [140, 140, 150] : h > 18 ? [150, 106, 62] : [88, 140, 64];
            }
            D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
        }
        this.m = m;
    }

    // De un punto del mundo al mini-mapa (y al revés)
    toPx(x, z) {
        const [u, v] = toUV(x, z), m = this.m;
        return [((u + m) / (VW + 2 * m)) * SIZE, ((v + m * 3) / (VH + 4 * m)) * SIZE];
    }

    toWorld(px, py) {
        const m = this.m, u = -m + (px / SIZE) * (VW + 2 * m), v = -m * 3 + (py / SIZE) * (VH + 4 * m);
        return toXZ(u, v);
    }

    // La vista: el sitio que mira la cámara y lo que abarca (half: medio ancho, en casillas)
    draw(fx, fz, half, depth) {
        const c = this.ctx;
        c.putImageData(this.base, 0, 0);
        const [px, py] = this.toPx(fx, fz), s = SIZE / (VW + 2 * this.m);
        const w = Math.max(6, half * 2 * s), h = Math.max(6, depth * 2 * s);
        c.strokeStyle = '#2a1a0e';
        c.lineWidth = 3;
        c.strokeRect(Math.round(px - w / 2), Math.round(py - h / 2), Math.round(w), Math.round(h));
        c.strokeStyle = '#fff3d6';
        c.lineWidth = 1;
        c.strokeRect(Math.round(px - w / 2), Math.round(py - h / 2), Math.round(w), Math.round(h));
    }
}
