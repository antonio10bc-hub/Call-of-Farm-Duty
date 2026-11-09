import * as THREE from 'three';
import { VoxelModel } from '../render/VoxelModel.js';
import { Ufo } from '../render/structures.js';
import { G, GN, cellX, cellZ, toXZ, VW, VH, groundAt } from './valley.js';

// Pequeñas sorpresas del mapa (todo en coordenadas del mundo):
//  - pájaros posados en el tejado del granero y de la casa, que picotean y de vez en cuando
//    revolotean y vuelven a posarse
//  - un ovni pequeño que cruza el cielo de vez en cuando y deja caer una moneda de oro
//  - el cofre del día: escondido en algún rincón del valle (cada día en uno), da oro al tocarlo
// tap(ray): lo que toca un rayo de la cámara (la moneda, el cofre o el pato del lacito)
const TEST = typeof location !== 'undefined' && /[?&]test/.test(location.search);
const today = () => new Date().toISOString().slice(0, 10);
const _v = new THREE.Vector3();

export class Extras extends VoxelModel {
    constructor(outlineColor, farm) {
        super(outlineColor);
        this.farm = farm;
        this.birds = [];
        this.perch(farm.byId.barn.root, [[-1.0, 0], [0.2, 0], [1.1, 0]], 4.82);
        const hb = new THREE.Box3().setFromObject(farm.byId.house.whole);
        farm.byId.house.root.updateMatrixWorld(true);
        const top = farm.byId.house.root.worldToLocal(_v.set(0, hb.max.y, 0)).y;
        this.perch(farm.byId.house.root, [[-0.5, 0], [0.6, 0]], top);
        // El ovni de paso y su moneda
        this.ufo = new Ufo(outlineColor, true);
        this.ufo.root.scale.setScalar(0.7);
        this.ufo.root.visible = false;
        this.root.add(this.ufo.root);
        this.coin = new THREE.Group();
        this.part(this.coin, 0.9, 0.9, 0.16, 0xffcc33, 0, 0, 0);
        this.part(this.coin, 0.56, 0.56, 0.2, 0xe0a020, 0, 0, 0, false);
        this.coin.visible = false;
        this.root.add(this.coin);
        this.fly = null;
        this.nextFly = TEST ? Infinity : 40 + Math.random() * 60;
        // El cofre del día
        this.chest = new THREE.Group();
        this.part(this.chest, 1.0, 0.6, 0.7, 0x8a5a34, 0, 0.3, 0);
        this.part(this.chest, 1.04, 0.1, 0.74, 0xffcc33, 0, 0.45, 0, false);
        this.lid = new THREE.Group();
        this.lid.position.set(0, 0.6, -0.35);
        this.chest.add(this.lid);
        this.part(this.lid, 1.0, 0.24, 0.7, 0x9a6a3a, 0, 0.12, 0.35);
        this.part(this.lid, 0.2, 0.2, 0.08, 0xffcc33, 0, 0.05, 0.72, false);
        this.chest.visible = false;
        this.root.add(this.chest);
        this.placeChest();
    }

    // Pájaros en fila sobre un tejado (en las coordenadas del edificio)
    perch(parent, spots, y) {
        for (const [x, z] of spots) {
            const g = new THREE.Group(), c = [0x3a4a6a, 0x8a3a2a, 0x4a3a2a][this.birds.length % 3];
            g.position.set(x, y, z);
            this.part(g, 0.26, 0.2, 0.18, c, 0, 0.1, 0);
            this.part(g, 0.14, 0.14, 0.14, c, 0.14, 0.24, 0);
            this.part(g, 0.08, 0.04, 0.06, 0xffcc33, 0.24, 0.22, 0, false);
            const wings = [-1, 1].map((s) => {
                const w = new THREE.Group();
                w.position.set(0, 0.16, s * 0.09);
                g.add(w);
                this.part(w, 0.18, 0.04, 0.16, c, -0.02, 0, s * 0.08, false);
                return w;
            });
            g.rotation.y = Math.random() * Math.PI * 2;
            parent.add(g);
            this.birds.push({ g, y, wings, t: Math.random() * 10, up: 0, next: 6 + Math.random() * 14 });
        }
    }

    // Un sitio para el cofre de hoy: una celda de alguna parcela, siempre la misma ese día
    placeChest() {
        if (TEST) return;
        let done = '';
        try { done = localStorage.getItem('cofd-chest') || ''; } catch { /* sin almacenamiento */ }
        if (done === today()) return;
        const seed = [...today()].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7), cells = [];
        for (let k = 0; k < GN * GN; k += 7) if (G.inside[k] && !G.water[k] && G.reg[k] >= 0) cells.push(k);
        const k = cells[seed % cells.length], x = cellX(k) + 0.3, z = cellZ(k) - 0.3;
        this.chest.position.set(x, groundAt(x, z), z);
        this.chest.rotation.y = (seed % 8) * 0.8;
        this.chest.visible = true;
        this.lid.rotation.x = 0;
    }

    tap(ray) {
        if (this.coin.visible && this.fly && this.fly.landed && ray.intersectObject(this.coin, true).length) return 'coin';
        if (this.chest.visible && !this.chestOpen && ray.intersectObject(this.chest, true).length) return 'chest';
        const duck = this.farm.life.ducks[0];
        if (duck && ray.intersectObject(duck.g, true).length) return 'duck';
        return null;
    }

    takeCoin() {
        this.coin.visible = false;
        this.fly.landed = false;
        return this.coin.position.clone();
    }

    openChest() {
        this.chestOpen = 0.001;
        try { localStorage.setItem('cofd-chest', today()); } catch { /* sin almacenamiento */ }
        return this.chest.position.clone();
    }

    update(dt, time, onSparkle) {
        // Pájaros: picotean, se giran y a veces revolotean y vuelven a posarse
        for (const b of this.birds) {
            b.t += dt;
            if ((b.next -= dt) <= 0) {
                b.up = 1.4;
                b.next = 8 + Math.random() * 16;
            }
            b.up = Math.max(0, b.up - dt);
            const fl = b.up > 0, h = fl ? Math.sin((1 - b.up / 1.4) * Math.PI) * 1.2 : Math.abs(Math.sin(b.t * 2)) < 0.1 ? 0.04 : 0;
            b.g.position.y = b.y + h;
            b.g.rotation.z = !fl && Math.sin(b.t * 1.3) > 0.85 ? -0.4 : 0; // (picotea)
            if (fl) b.g.rotation.y += dt * 3;
            for (const [i, w] of b.wings.entries()) w.rotation.x = fl ? Math.sin(time * 30) * 0.9 * (i ? 1 : -1) : 0;
        }
        // El ovni de paso: cruza la pantalla de lado a lado; a medio camino suelta la moneda
        if (!this.fly && (this.nextFly -= dt) <= 0) {
            const v = 50 + Math.random() * (VH - 70);
            this.fly = { t: 0, v, drop: 0.3 + Math.random() * 0.4, dropped: false, landed: false, y0: 0, life: 0 };
            this.ufo.root.visible = true;
        }
        if (this.fly) {
            const F = this.fly;
            F.t += dt / 14;
            if (F.t < 1) {
                const [x, z] = toXZ(-20 + F.t * (VW + 40), F.v);
                this.ufo.root.position.set(x, 15 + Math.sin(F.t * 20) * 0.4, z);
                this.ufo.update(dt, time);
                if (!F.dropped && F.t > F.drop) {
                    F.dropped = true;
                    this.coin.position.set(x, 14, z);
                    F.ground = groundAt(x, z) + 0.6;
                    this.coin.visible = true;
                }
            } else this.ufo.root.visible = false;
            if (F.dropped && !F.landed && this.coin.visible) {
                this.coin.position.y = Math.max(F.ground, this.coin.position.y - dt * 9);
                if (this.coin.position.y <= F.ground) F.landed = true;
            }
            if (this.coin.visible) {
                this.coin.rotation.y += dt * 3;
                if (F.landed && (F.life += dt) > 60) this.coin.visible = false; // (si nadie la coge, se va)
                if (F.landed && onSparkle && Math.random() < dt * 3) onSparkle(this.coin.position);
            }
            if (F.t >= 1 && !this.coin.visible) {
                this.fly = null;
                this.nextFly = 90 + Math.random() * 90;
            }
        }
        // El cofre: brilla un poco; abierto, la tapa sube y se va
        if (this.chest.visible) {
            if (this.chestOpen) {
                this.chestOpen += dt;
                this.lid.rotation.x = -Math.min(1.6, this.chestOpen * 4);
                if (this.chestOpen > 2.5) this.chest.visible = false;
            } else if (onSparkle && Math.random() < dt * 1.5) onSparkle(this.chest.position);
        }
        this.updateFx(dt);
    }
}
