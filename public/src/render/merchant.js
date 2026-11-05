import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { MERCHANT } from '../content/merchant.js';

const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, DARK = 0x5a3a22, CANVAS = 0xf3ead2, RED = 0xc8402e;
const STONE = 0x9a948a, ASH = 0x4a4038;
const T = { road: 2.6, park: 3.6, awning: 4.2, open: 4.8 }; // la llegada, paso a paso (s)
const ease = (k) => k * k * (3 - 2 * k);
const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// La zona del comerciante, en el claro junto a su camino. Siempre se ve que ha estado alguien:
// la estructura del puesto vacía, cajas viejas, una hoguera apagada con su círculo de piedras, las
// rodadas del carro y un poste con su cartel. Cuando viene: su carro entra por el camino y aparca
// en el claro, se despliega el toldo de rayas, sale la mercancía y él detrás del mostrador, y se
// enciende la hoguera (y de noche, el farol). Al irse, todo al revés. setPresent(on) lo pide;
// la animación avanza en update.
export class MerchantCamp extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const r = this.root, S = MERCHANT.stall, F = MERCHANT.fire;
        // --- Lo que queda siempre ---
        // Estructura del puesto: postes, mostrador y travesaño
        for (const [dx, dz] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]]) this.part(r, 0.16, 2.1, 0.16, WOOD2, S.x + dx, 1.05, S.z + dz);
        this.part(r, 2.8, 0.14, 1.2, WOOD, S.x, 0.9, S.z + 0.25);
        this.part(r, 2.8, 0.7, 0.12, WOOD2, S.x, 0.5, S.z + 0.82);
        this.part(r, 2.8, 0.1, 0.1, WOOD2, S.x, 2.1, S.z - 0.6);
        // Cajas viejas (una volcada) y un saco vacío
        this.part(r, 0.7, 0.55, 0.6, WOOD, 34.2, 0.28, -20.8).rotation.y = 0.3;
        this.part(r, 0.6, 0.5, 0.6, WOOD2, 34.4, 0.8, -20.7).rotation.y = -0.2;
        const tipped = this.part(r, 0.6, 0.5, 0.55, WOOD, 35.2, 0.22, -21.4);
        tipped.rotation.set(0.2, 0.9, 1.3);
        this.part(r, 0.5, 0.18, 0.4, 0xc8b48a, 33.8, 0.09, -19.6).rotation.y = 0.5;
        // Hoguera apagada: círculo de piedras, ceniza y dos troncos
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            this.part(r, 0.26, 0.18, 0.22, STONE, F.x + Math.sin(a) * 0.55, 0.09, F.z + Math.cos(a) * 0.55).rotation.y = a;
        }
        this.part(r, 0.7, 0.04, 0.7, ASH, F.x, 0.02, F.z, false);
        for (const a of [0.4, 2.2]) {
            const log = this.part(r, 0.7, 0.14, 0.14, DARK, F.x, 0.1, F.z);
            log.rotation.y = a;
        }
        // Rodadas del carro, del camino al claro
        for (const z of [-15.45, -14.55]) this.part(r, 9, 0.02, 0.12, 0xa8885a, 36.5, 0.01, z, false);
        for (const x of [39.1, 40.1]) this.part(r, 0.12, 0.02, 4.8, 0xa8885a, x, 0.01, -18, false);
        // Poste con su cartel junto al camino: una moneda de oro pintada
        this.part(r, 0.14, 1.6, 0.14, WOOD2, 32.6, 0.8, -13.4);
        this.part(r, 0.9, 0.55, 0.1, WOOD, 32.6, 1.45, -13.4);
        this.part(r, 0.32, 0.32, 0.04, 0xffd23f, 32.6, 1.45, -13.33, false);
        // Un barril y una bala de paja
        this.part(r, 0.5, 0.65, 0.5, WOOD2, 40.9, 0.33, -17.4);
        this.part(r, 0.9, 0.5, 0.6, 0xe0c060, 33.7, 0.25, -17.9).rotation.y = 0.4;

        // --- Lo que trae él ---
        this.wagon = this.buildWagon();
        r.add(this.wagon);
        // Toldo de rayas rojas y crema, inclinado hacia el camino
        this.awning = new THREE.Group();
        this.awning.position.set(S.x, 2.15, S.z - 0.6);
        for (let k = 0; k < 6; k++) {
            const st = this.part(this.awning, 0.52, 0.08, 1.7, k % 2 ? CANVAS : RED, -1.3 + k * 0.52, 0, 0.85);
            st.rotation.x = 0.22;
        }
        for (let k = 0; k < 6; k++) this.part(this.awning, 0.52, 0.22, 0.06, k % 2 ? RED : CANVAS, -1.3 + k * 0.52, -0.28, 1.68);
        r.add(this.awning);
        // Mercancía: sacos de grano, una cesta de tomates, tarros y una balanza
        this.goods = new THREE.Group();
        this.goods.position.set(S.x, 0.97, S.z + 0.25);
        this.part(this.goods, 0.45, 0.4, 0.4, 0xe0c060, -0.95, 0.2, 0);
        this.part(this.goods, 0.3, 0.1, 0.3, 0xf6cf4a, -0.95, 0.44, 0, false);
        this.part(this.goods, 0.55, 0.22, 0.4, WOOD2, -0.3, 0.11, 0.05);
        for (const [x, z] of [[-0.42, -0.05], [-0.2, 0.08], [-0.3, -0.1]]) this.part(this.goods, 0.17, 0.17, 0.17, 0xe8352a, x, 0.28, z, false);
        for (const x of [0.25, 0.45]) this.part(this.goods, 0.14, 0.24, 0.14, 0x9fdcff, x, 0.12, -0.1);
        this.part(this.goods, 0.06, 0.4, 0.06, DARK, 0.95, 0.2, 0);
        this.part(this.goods, 0.6, 0.04, 0.06, DARK, 0.95, 0.4, 0);
        for (const x of [0.7, 1.2]) this.part(this.goods, 0.2, 0.04, 0.2, 0xffd23f, x, 0.3, 0);
        r.add(this.goods);
        // Farol colgado del travesaño (de noche luce)
        this.lantern = new THREE.Group();
        this.lantern.position.set(S.x + 1.1, 1.75, S.z - 0.6);
        this.part(this.lantern, 0.04, 0.3, 0.04, DARK, 0, 0.2, 0, false);
        this.part(this.lantern, 0.22, 0.28, 0.22, DARK, 0, -0.08, 0);
        this.glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
        this.own(this.glow.material);
        this.glow.position.y = -0.08;
        this.lantern.add(this.glow);
        r.add(this.lantern);
        // Él: botas, pantalón, abrigo con botones dorados, brazos, cabeza y su sombrero de ala
        // ancha (sin cara, como todo en el juego), delante del puesto, de cara al camino (bajo el
        // toldo no se le vería desde arriba)
        this.man = this.buildMan();
        this.man.position.set(S.x + 1.9, 0, S.z + 1.4);
        this.man.rotation.y = 0.5;
        r.add(this.man);
        // Fuego de la hoguera
        this.flames = new THREE.Group();
        this.flames.position.set(F.x, 0.1, F.z);
        this.flameBits = [0xff9a1f, 0xffe03a, 0xff3e1a].map((c, i) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 - i * 0.06, 0.5 - i * 0.1, 0.3 - i * 0.06), new THREE.MeshBasicMaterial({ color: c }));
            this.own(m.material);
            m.position.y = 0.25;
            this.flames.add(m);
            return m;
        });
        r.add(this.flames);

        this.step = 0;      // por dónde va la llegada (0 = no está; T.open = puesto abierto)
        this.want = 0;   // a dónde va: T.open (llegar) o 0 (irse)
        this.wheel = 0;
        this.pose(0);
    }

    buildWagon() {
        const g = new THREE.Group(), body = new THREE.Group();
        g.add(body);
        // Caja de madera, lona arqueada (tres arcos), lanza y ruedas. El frente mira a +x
        this.part(body, 2.6, 0.55, 1.4, WOOD, 0, 0.75, 0);
        this.part(body, 2.7, 0.1, 1.5, WOOD2, 0, 1.05, 0);
        this.part(body, 2.4, 0.75, 1.4, CANVAS, 0, 1.45, 0);
        this.part(body, 2.4, 0.3, 1.0, CANVAS, 0, 1.95, 0);
        for (const x of [-1.05, 0, 1.05]) this.part(body, 0.1, 0.9, 1.5, 0xe0d4b4, x, 1.55, 0);
        this.part(body, 1.4, 0.08, 0.08, WOOD2, 1.95, 0.55, 0.3);
        this.part(body, 1.4, 0.08, 0.08, WOOD2, 1.95, 0.55, -0.3);
        // Su cartel: monedas
        this.part(body, 0.6, 0.4, 0.04, 0xffd23f, 0, 1.45, 0.72, false);
        g.wheels = [];
        for (const x of [-0.85, 0.85]) for (const z of [-0.75, 0.75]) {
            const w = new THREE.Group();
            w.position.set(x, 0.42, z);
            this.part(w, 0.8, 0.8, 0.1, DARK, 0, 0, 0);
            this.part(w, 0.12, 0.7, 0.12, WOOD, 0, 0, 0, false);
            body.add(w);
            g.wheels.push(w);
        }
        return g;
    }

    buildMan() {
        const g = new THREE.Group(), COAT = 0x2e7a8a, SKIN = 0xe8b48a, HAT = 0x6a3a22;
        for (const x of [-0.12, 0.12]) {
            this.part(g, 0.16, 0.5, 0.18, 0x5a4030, x, 0.3, 0);
            this.part(g, 0.18, 0.14, 0.24, 0x2a1a0e, x, 0.07, 0.03);
        }
        this.part(g, 0.52, 0.62, 0.32, COAT, 0, 0.86, 0);
        this.part(g, 0.54, 0.08, 0.34, 0x3a2a1a, 0, 0.6, 0);
        for (const y of [0.78, 0.98]) this.part(g, 0.06, 0.06, 0.02, 0xffd23f, 0, y, 0.17, false);
        this.arm = new THREE.Group();
        this.arm.position.set(0.32, 1.12, 0);
        this.part(this.arm, 0.13, 0.5, 0.14, COAT, 0, -0.25, 0);
        g.add(this.arm);
        this.part(g, 0.13, 0.5, 0.14, COAT, -0.32, 0.87, 0);
        this.part(g, 0.34, 0.32, 0.32, SKIN, 0, 1.33, 0);
        this.part(g, 0.7, 0.06, 0.7, HAT, 0, 1.5, 0);
        this.part(g, 0.36, 0.22, 0.36, HAT, 0, 1.62, 0);
        this.part(g, 0.38, 0.05, 0.38, 0xc8402e, 0, 1.54, 0, false);
        return g;
    }

    get present() {
        return this.want > 0;
    }

    // ¿Puesto abierto del todo? (para el cartel y el humo de la hoguera)
    get open() {
        return this.step >= T.open;
    }

    get fireLit() {
        return this.step > T.awning;
    }

    // Que venga (o se vaya). animate false: aparece (o desaparece) ya
    setPresent(on, animate = true) {
        this.want = on ? T.open : 0;
        if (animate) return;
        this.step = this.want;
        this.pose(this.step);
    }

    // Cómo está todo en el instante t de la llegada
    pose(t) {
        const W = MERCHANT.wagon, w = this.wagon;
        const a = ease(seg(t, 0, T.road)), b = ease(seg(t, T.road, T.park));
        w.visible = t > 0.02;
        w.position.set(W.from + (W.x - W.from) * a, 0, W.road + (W.z - W.road) * b);
        w.rotation.y = Math.PI - (Math.PI / 2) * b;
        const aw = seg(t, T.park, T.awning), op = seg(t, T.awning, T.open);
        this.awning.scale.set(1, Math.max(0.0001, aw > 0 ? back(aw) : 0), Math.max(0.0001, aw));
        this.awning.visible = aw > 0;
        const s = op > 0 ? back(op) : 0.0001;
        this.goods.scale.setScalar(s);
        this.man.scale.setScalar(s);
        this.goods.visible = this.man.visible = op > 0;
        this.flames.visible = this.lantern.visible = t > T.awning;
    }

    update(dt, time, nightK = 0) {
        if (this.step !== this.want) {
            const before = this.step;
            this.step = this.want > this.step ? Math.min(this.want, this.step + dt) : Math.max(this.want, this.step - dt * 1.4);
            this.wheel += Math.abs(this.step - before) * (this.step < T.park ? 7 : 2);
            for (const wh of this.wagon.wheels) wh.rotation.z = -this.wheel;
            this.pose(this.step);
        }
        if (this.flames.visible) {
            this.flameBits.forEach((m, i) => {
                const f = 0.8 + Math.abs(Math.sin(time * (9 + i * 3) + i)) * 0.4;
                m.scale.set(f, f * (1 + i * 0.2), f);
                m.rotation.y = time * (1 + i);
            });
        }
        // De noche el farol luce (y parpadea un poco)
        this.glow.material.color.setHex(nightK > 0.3 && Math.sin(time * 9) > -0.8 ? 0xffe680 : 0x8a6a2a);
        // Él: respira y, con el puesto abierto, saluda de vez en cuando
        if (this.man.visible) {
            this.man.position.y = Math.abs(Math.sin(time * 2)) * 0.02;
            this.arm.rotation.z = this.open && Math.sin(time * 0.8) > 0.7 ? 2.4 + Math.sin(time * 10) * 0.35 : 0.1;
        }
        this.updateFx(dt);
    }
}
