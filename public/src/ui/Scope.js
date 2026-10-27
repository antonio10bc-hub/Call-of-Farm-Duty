// Mira telescópica: un canvas a la misma resolución baja que el juego (píxeles gordos), con
// el círculo de la lente, la cruz y las marcas, todo en tinta. Fuera de la lente, negro tinta.
const INK = '#2a1a0e';

export class Scope {
    constructor(el) {
        this.el = el;
        this.ctx = el.getContext('2d');
        this.w = 0;
        this.h = 0;
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
        // Cruz con hueco en el centro y marcas cada pocos píxeles
        ctx.fillStyle = INK;
        const gap = 4;
        ctx.fillRect(cx - R, cy, R - gap, 1);
        ctx.fillRect(cx + gap + 1, cy, R - gap, 1);
        ctx.fillRect(cx, cy - R, 1, R - gap);
        ctx.fillRect(cx, cy + gap + 1, 1, R - gap);
        for (let k = 1; k <= 4; k++) {
            const o = gap + k * Math.max(4, Math.floor(R / 8));
            ctx.fillRect(cx + o, cy - 1, 1, 3);
            ctx.fillRect(cx - o, cy - 1, 1, 3);
            ctx.fillRect(cx - 1, cy + o, 3, 1);
        }
        // Trazos gruesos en los extremos de la cruz
        ctx.fillRect(cx - R, cy - 1, Math.floor(R * 0.3), 3);
        ctx.fillRect(cx + R - Math.floor(R * 0.3), cy - 1, Math.floor(R * 0.3), 3);
        ctx.fillRect(cx - 1, cy + R - Math.floor(R * 0.3), 3, Math.floor(R * 0.3));
        // Punto central: rosa si se puede disparar, gris mientras se recarga el cerrojo
        ctx.fillStyle = ready ? '#ff3a2a' : '#a8957a';
        ctx.fillRect(cx - 1, cy - 1, 3, 3);
        this.ready = ready;
    }

    setReady(ready) {
        if (ready !== this.ready) this.draw(ready);
    }

    show(on) {
        this.el.classList.toggle('on', on);
    }
}
