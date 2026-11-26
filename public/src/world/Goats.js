import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { rayBox, easeOutBack } from '../core/math.js';
import { buildGoat, animateGoat } from '../render/goat.js';
import { CROPS } from '../content/crops.js';

// El risco de las cabras (el campo de tiro del queso): montículos de rocas de formas distintas
// por todo el campo (más cuanto más nivel tiene la parcela) y cabras que no paran de saltar de uno
// a otro, a veces con voltereta, y de dar botes en lo alto. Las rocas tapan la vista y paran la
// bala (wall): si una cabra se pone detrás, toca cambiar de torre. Al darle a una cabra suelta su
// queso y se va de un salto enorme.
const _d = new THREE.Object3D();
const _c = new THREE.Color();
const r = (a) => a[0] + Math.random() * (a[1] - a[0]);
const smooth = (k) => k * k * (3 - 2 * k);

export class Goats {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.outlineColor = outlineColor;
        this.list = [];
        this.boxes = []; // las piedras de los montículos: [x0, y0, z0, x1, y1, z1]
        this.perches = []; // los sitios a los que saltan (lo alto de cada montículo y el suelo entre ellos)
        this.meshes = [];
        this.rise = 0;
    }

    // Pone count cabras en el campo f (SniperField) con sus montículos
    spawn(count, f) {
        this.clear();
        const R = CROPS.pumpkin;
        this.f = f;
        this.rise = 0;
        // Montículos: más cuanto más cabras (o sea, cuanto más nivel); cada uno de 1 a 4 piedras
        // apiladas, de anchos y altos distintos, alguna con musgo encima
        const n = Math.max(5, Math.min(30, Math.round(4 + count * 0.65))), mounds = [], stones = [];
        for (let i = 0; i < n; i++) {
            const { x, z } = f.freeSpot(mounds, 3.2);
            mounds.push({ x, z });
            const layers = 1 + ((Math.random() * 3.4) | 0);
            let y = 0, w = 1.5 + Math.random() * 1.3, d = 1.3 + Math.random() * 1.3, ox = 0, oz = 0;
            for (let k = 0; k < layers; k++) {
                const h = 0.45 + Math.random() * (k === 0 ? 0.7 : 0.5);
                stones.push({ x: x + ox, y: y + h / 2, z: z + oz, sx: w, sy: h, sz: d, color: R.rocks[(i + k) % R.rocks.length] });
                y += h;
                // (la de encima, más pequeña y algo corrida)
                ox += (Math.random() - 0.5) * w * 0.3;
                oz += (Math.random() - 0.5) * d * 0.3;
                w *= 0.6 + Math.random() * 0.2;
                d *= 0.6 + Math.random() * 0.2;
            }
            const top = stones[stones.length - 1];
            if (Math.random() < 0.45) stones.push({ x: top.x, y: y + 0.04, z: top.z, sx: top.sx * 0.7, sy: 0.08, sz: top.sz * 0.7, color: R.moss, deco: true });
            // Piedrecitas sueltas al pie
            for (let k = 0; k < 2; k++) {
                const a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.25;
                stones.push({ x: x + Math.sin(a) * 1.4, y: s / 2, z: z + Math.cos(a) * 1.4, sx: s, sy: s, sz: s * 1.2, color: R.rocks[(i + k + 1) % R.rocks.length], deco: true });
            }
            this.perches.push({ x: top.x, y, z: top.z, high: true });
        }
        // El suelo entre montículos también vale para aterrizar (desde ahí no se las ve tan bien)
        for (let i = 0; i < Math.ceil(n / 2); i++) {
            const { x, z } = f.freeSpot([...mounds, ...this.perches], 2);
            this.perches.push({ x, y: 0, z, high: false });
        }
        this.boxes = stones.filter((s) => !s.deco).map((s) => [s.x - s.sx / 2, 0, s.z - s.sz / 2, s.x + s.sx / 2, s.y + s.sy / 2, s.z + s.sz / 2]);
        // Las piedras: una malla instanciada con su contorno
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), stones.length), hull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.outlineColor), stones.length);
        stones.forEach((s, i) => mesh.setColorAt(i, _c.setHex(s.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)));
        for (const m of [mesh, hull]) {
            m.frustumCulled = false;
            this.root.add(m);
            this.meshes.push(m);
        }
        this.stones = stones;
        this.layoutStones(0.0001);
        // Las cabras: cada una en un montículo distinto (si hay)
        const ink = outline(this.outlineColor);
        for (let i = 0; i < count; i++) {
            const p = this.perches[i % n], goat = buildGoat(ink);
            goat.g.scale.setScalar(0.0001);
            this.root.add(goat.g);
            const s = { kind: 'goat', mod: this, goat, perch: p, x: p.x, y: p.y + 0.6, z: p.z, cx: p.x, cz: p.z, hb: [0.42, 0.42, 0.42], ry: Math.random() * 6.3, jump: null, wait: Math.random() * 1.5, out: 0,
                alive: true, landed: false, grow: -0.6 - i * Math.min(0.1, 2.4 / count), flash: 0, dying: 0 };
            this.list.push(s);
            f.targets.push(s);
        }
    }

    layoutStones(k) {
        const [mesh, hull] = this.meshes;
        this.stones.forEach((s, i) => {
            _d.position.set(s.x, s.y * k, s.z);
            _d.scale.set(s.sx, Math.max(0.0001, s.sy * k), s.sz);
            _d.updateMatrix();
            mesh.setMatrixAt(i, _d.matrix);
            _d.scale.set(s.sx + OUTLINE * 2, Math.max(0.0001, s.sy * k) + OUTLINE * 2, s.sz + OUTLINE * 2);
            _d.updateMatrix();
            hull.setMatrixAt(i, _d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = hull.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ¿Dónde para la bala una roca? (t, o Infinity)
    wall(origin, dir) {
        let best = Infinity;
        for (const b of this.boxes) {
            const t = rayBox(origin, dir, ...b);
            if (t !== null && t < best) best = t;
        }
        return best;
    }

    hittable(s) {
        return s.alive && s.landed && !s.gone;
    }

    // Otro sitio al que saltar: cerca (ni pegado ni lejísimos) y, si puede, libre
    pick(s) {
        const busy = new Set(this.list.filter((o) => o !== s && o.alive).map((o) => (o.jump ? o.jump.to : o.perch)));
        const near = this.perches.filter((p) => p !== s.perch && !busy.has(p) && Math.hypot(p.x - s.perch.x, p.z - s.perch.z) < 8);
        const pool = near.length ? near : this.perches.filter((p) => p !== s.perch);
        return pool[(Math.random() * pool.length) | 0] || s.perch;
    }

    // Salta a to (o bota en el sitio si es el mismo): con su arco, y a veces con voltereta
    leap(s, to) {
        const from = s.perch, d = Math.hypot(to.x - from.x, to.z - from.z), same = to === from;
        const flip = Math.random() < CROPS.pumpkin.flip ? (Math.random() < 0.5 ? -1 : 1) * Math.PI * 2 : 0;
        s.jump = { from, to, t: 0, T: same ? 0.45 + (flip ? 0.15 : 0) : 0.5 + d * 0.07, h: same ? (flip ? 1.1 : 0.5) : 0.9 + d * 0.16, flip, spin: !flip && Math.random() < 0.15 ? Math.PI * 2 : 0, ry0: s.ry };
        if (!same) s.ry = Math.atan2(to.x - from.x, to.z - from.z);
        s.jump.ry1 = s.ry;
    }

    update(dt, time) {
        if (this.rise < 1) {
            this.rise = Math.min(1, this.rise + dt * 1.6);
            this.layoutStones(easeOutBack(this.rise));
        }
        const H = CROPS.pumpkin.hop;
        for (const s of this.list) {
            const c = s.goat;
            c.g.visible = !s.gone && s.out < 1;
            if (!c.g.visible) continue;
            let air = 0, flip = 0, px = s.perch.x, py = s.perch.y, pz = s.perch.z, ry = s.ry;
            if (!s.alive) {
                // Recogida: de un salto enorme se va del campo, dando vueltas, y desaparece
                s.out = Math.min(1, s.out + dt * 1.4);
                const k = s.out;
                px = s.x;
                pz = s.z;
                py = (s.y - 0.6) + dt * 14 * (1 - k);
                air = 1;
                flip = k * Math.PI * 4;
                c.g.position.set(px, py, pz);
                c.g.scale.setScalar(Math.max(0.0001, 1.15 * (1 - k * k)));
                animateGoat(c, dt, time, air, flip);
                s.y = py + 0.6;
                continue;
            }
            if (s.landed) {
                if (!s.jump && (s.wait -= dt) <= 0) this.leap(s, Math.random() < 0.3 ? s.perch : this.pick(s));
                const J = s.jump;
                if (J) {
                    J.t += dt;
                    const k = Math.min(1, J.t / J.T);
                    px = J.from.x + (J.to.x - J.from.x) * k;
                    pz = J.from.z + (J.to.z - J.from.z) * k;
                    py = J.from.y + (J.to.y - J.from.y) * k + 4 * J.h * k * (1 - k);
                    air = Math.min(1, k * 5, (1 - k) * 5);
                    flip = J.flip * smooth(k);
                    ry = J.ry0 + Math.atan2(Math.sin(J.ry1 - J.ry0), Math.cos(J.ry1 - J.ry0)) * Math.min(1, k * 4) + J.spin * smooth(k);
                    if (k >= 1) {
                        s.perch = J.to;
                        s.jump = null;
                        s.wait = r(H);
                        s.cx = J.to.x;
                        s.cz = J.to.z;
                        if (this.f && this.f.onBoing) this.f.onBoing(s);
                        if (J.flip && Math.random() < 0.5 && this.f && this.f.onBleat) this.f.onBleat(s);
                    }
                } else if (Math.random() < dt * 0.5) s.ry += (Math.random() - 0.5) * 2; // (mira a otro lado)
            }
            const g = s.landed ? 1 : s.g || 0.0001;
            c.g.position.set(px, py, pz);
            c.g.rotation.y = ry;
            c.g.scale.setScalar(g * 1.15 * (1 + s.flash * 0.25));
            animateGoat(c, dt, time, air, flip);
            s.x = px;
            s.y = py + 0.62;
            s.z = pz;
        }
    }

    clear() {
        for (const s of this.list) this.root.remove(s.goat.g);
        for (const m of this.meshes) {
            this.root.remove(m);
            m.dispose();
            m.material.dispose();
        }
        this.meshes = [];
        this.list.length = 0;
        this.boxes = [];
        this.perches = [];
        this.stones = [];
    }
}
