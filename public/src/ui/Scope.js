// Mira telescópica: un canvas a la misma resolución baja que el juego (píxeles gordos), con
// el círculo de la lente, la retícula y las marcas, todo en tinta. Fuera de la lente, negro tinta.
// La retícula depende de la mirilla (lens): cross (cruz con marcas), dot (solo el punto rojo con
// su aro), chevron (una V invertida), mil (cruz fina llena de puntos de medida) o night (cruz y
// la lente teñida de verde).
const INK = '#2a1a0e';

export class Scope {
    constructor(el) {
        this.el = el;
        this.ctx = el.getContext('2d');
        this.w = 0;
        this.h = 0;
        this.lens = 'cross';
    }

    setLens(lens) {
        if (lens === this.lens) return;
        this.lens = lens;
        this.draw(this.ready !== false);
    }

    resize(w, h, cssW, cssH) {
        this.w = w;
        this.h = h;
        this.el.width = w;
        this.el.height = h;
        this.el.style.width = `${cssW}px`;
        this.el.style.height = `${cssH}px`;
        this.draw();
    }

    draw(ready = true) {
        const { ctx, w, h } = this;
        if (!w) return;
        const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
        const R = Math.floor(Math.min(w, h) * 0.44);
        const img = ctx.createImageData(w, h);
        const d = img.data;
        // Tinta fuera, anillo de madera y un brillo arriba a la izquierda dentro de la lente
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
            const i = (y * w + x) * 4;
            let c = null;
            if (r > R + 3) c = [42, 26, 14, 255];
            else if (r > R) c = [90, 58, 34, 255];
            else if (r > R - 1) c = [42, 26, 14, 255];
            else if (r > R - 4 && dx + dy < -R * 0.9) c = [255, 255, 255, 70];
            if (c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; }
        }
        ctx.putImageData(img, 0, 0);
        const L = this.lens;
        if (L === 'night') {
            // Lente teñida de verde (de noche se ve como de día: lo hace main.js con la luz)
            ctx.fillStyle = 'rgba(90, 255, 90, 0.22)';
            ctx.beginPath();
            ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = L === 'night' ? '#0e3a0e' : INK;
        const gap = 4;
        if (L === 'dot') {
            // Solo un aro fino y el punto
            for (let a = 0; a < 64; a++) {
                const t = (a / 64) * Math.PI * 2;
                ctx.fillRect(Math.round(cx + Math.cos(t) * 9), Math.round(cy + Math.sin(t) * 9), 1, 1);
            }
        } else if (L === 'chevron') {
            // V invertida bajo el centro y una línea horizontal fina
            for (let k = 0; k < 8; k++) {
                ctx.fillRect(cx - k, cy + k, 1, 2);
                ctx.fillRect(cx + k, cy + k, 1, 2);
            }
            ctx.fillRect(cx - R, cy, R - 12, 1);
            ctx.fillRect(cx + 12, cy, R - 12, 1);
            ctx.fillRect(cx, cy + 14, 1, R - 14);
        } else {
            // Cruz con hueco en el centro y marcas (en la de largo alcance, muchas y finas)
            ctx.fillRect(cx - R, cy, R - gap, 1);
            ctx.fillRect(cx + gap + 1, cy, R - gap, 1);
            ctx.fillRect(cx, cy - R, 1, R - gap);
            ctx.fillRect(cx, cy + gap + 1, 1, R - gap);
            const n = L === 'mil' ? 10 : 4, step = L === 'mil' ? Math.max(3, Math.floor(R / 12)) : Math.max(4, Math.floor(R / 8));
            for (let k = 1; k <= n; k++) {
                const o = gap + k * step;
                ctx.fillRect(cx + o - (L === 'mil' ? 1 : 0), cy - 1, L === 'mil' ? 2 : 1, L === 'mil' ? 2 : 3);
                ctx.fillRect(cx - o, cy - 1, L === 'mil' ? 2 : 1, L === 'mil' ? 2 : 3);
                ctx.fillRect(cx - 1, cy + o, L === 'mil' ? 2 : 3, L === 'mil' ? 2 : 1);
                if (L === 'mil') ctx.fillRect(cx - 1, cy - o, 2, 2);
            }
            if (L !== 'mil') {
                // Trazos gruesos en los extremos de la cruz
                ctx.fillRect(cx - R, cy - 1, Math.floor(R * 0.3), 3);
                ctx.fillRect(cx + R - Math.floor(R * 0.3), cy - 1, Math.floor(R * 0.3), 3);
                ctx.fillRect(cx - 1, cy + R - Math.floor(R * 0.3), 3, Math.floor(R * 0.3));
            }
        }
        // Punto central: rojo si se puede disparar, gris mientras se recarga
        ctx.fillStyle = ready ? '#ff3a2a' : '#a8957a';
        const dot = L === 'dot' ? 5 : 3;
        ctx.fillRect(cx - (dot >> 1), cy - (dot >> 1), dot, dot);
        this.ready = ready;
    }

    setReady(ready) {
        if (ready !== this.ready) this.draw(ready);
    }

    show(on) {
        this.el.classList.toggle('on', on);
    }
}
