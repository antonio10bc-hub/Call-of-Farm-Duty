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
// la animación avanza en update. Con el poblado (level) crece la zona: nivel 1, un puesto de
// fruta, tiendas de lona, un pozo y farolas por el camino; nivel 2, una posada, una plaza con
// fuente, otro puesto, un establo con su caballo y banderas en la entrada.
export class MerchantCamp extends VoxelModel {
    constructor(outlineColor, level = 0) {
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

        // --- El poblado, por niveles ---
        this.lamps = [];
        this.levels = [null, this.buildLevel1(), this.buildLevel2()];
        this.level = -1;
        this.setLevel(level, false);

        this.step = 0;      // por dónde va la llegada (0 = no está; T.open = puesto abierto)
        this.want = 0;   // a dónde va: T.open (llegar) o 0 (irse)
        this.wheel = 0;
        this.pose(0);
    }

    // Un puesto con toldo de rayas (colores a y b) y su mercancía (cajas de colores)
    stall(g, x, z, a, b, goods) {
        for (const [dx, dz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) this.part(g, 0.14, 1.9, 0.14, WOOD2, x + dx, 0.95, z + dz);
        this.part(g, 2.2, 0.12, 1.1, WOOD, x, 0.85, z + 0.15);
        this.part(g, 2.2, 0.6, 0.1, WOOD2, x, 0.48, z + 0.66);
        for (let k = 0; k < 5; k++) this.part(g, 0.46, 0.08, 1.4, k % 2 ? a : b, x - 0.92 + k * 0.46, 2.0, z + 0.25).rotation.x = 0.22;
        goods.forEach((c, k) => this.part(g, 0.36, 0.26, 0.32, c, x - 0.7 + k * 0.48, 1.04, z + 0.15));
    }

    // Farola de hierro con su farol (de noche luce)
    lamp(g, x, z) {
        this.part(g, 0.12, 2.4, 0.12, 0x3a3a3a, x, 1.2, z);
        this.part(g, 0.5, 0.08, 0.08, 0x3a3a3a, x + 0.22, 2.35, z);
        this.part(g, 0.24, 0.3, 0.24, 0x2a2a2a, x + 0.44, 2.15, z);
        const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), new THREE.MeshBasicMaterial({ color: 0x8a6a2a }));
        this.own(glow.material);
        glow.position.set(x + 0.44, 2.15, z);
        g.add(glow);
        this.lamps.push(glow);
    }

    // Nivel 1 del poblado: puesto de fruta, dos tiendas de lona, el pozo, farolas por el camino,
    // barriles y sacos
    buildLevel1() {
        const g = new THREE.Group();
        this.stall(g, 44.5, -19.8, 0x5a9e32, CANVAS, [0xe8352a, 0xffd23f, 0x7ab83a, 0xf08a1e]);
        for (const [x, z, c] of [[35.2, -25.6, RED], [39.4, -26.2, 0x3a7ec8]]) {
            // Tienda de lona: dos faldones inclinados y el palo
            const t = new THREE.Group();
            t.position.set(x, 0, z);
            this.part(t, 2.2, 0.1, 1.5, c, 0, 0.9, -0.55).rotation.x = -0.75;
            this.part(t, 2.2, 0.1, 1.5, CANVAS, 0, 0.9, 0.55).rotation.x = 0.75;
            this.part(t, 0.1, 1.8, 0.1, WOOD2, 0, 0.9, 0);
            this.part(t, 2.0, 0.06, 0.06, WOOD2, 0, 1.45, 0);
            g.add(t);
        }
        // El pozo: anillo de piedra, agua, dos postes y su tejadillo
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            this.part(g, 0.5, 0.7, 0.3, STONE, 47 + Math.sin(a) * 0.65, 0.35, -9.5 + Math.cos(a) * 0.65).rotation.y = a;
        }
        this.part(g, 0.9, 0.06, 0.9, 0x3a7ec8, 47, 0.55, -9.5, false);
        for (const dx of [-0.75, 0.75]) this.part(g, 0.12, 1.7, 0.12, WOOD2, 47 + dx, 0.85, -9.5);
        this.part(g, 1.9, 0.12, 1.2, RED, 47, 1.75, -9.5).rotation.z = 0.0;
        this.part(g, 1.3, 0.08, 0.08, WOOD, 47, 1.4, -9.5);
        // Farolas a lo largo del camino
        for (const x of [35, 41, 47, 53]) this.lamp(g, x, -13.2);
        // Barriles y sacos
        for (const [x, z] of [[48.6, -20.4], [49.3, -20.9], [48.9, -19.6]]) this.part(g, 0.5, 0.65, 0.5, WOOD2, x, 0.33, z);
        for (const [x, z] of [[42.2, -21.2], [42.7, -21.5]]) this.part(g, 0.5, 0.4, 0.4, 0xe0c060, x, 0.2, z).rotation.y = x;
        // Balas de paja junto a las tiendas y un carro de mano
        for (const [x, z, r] of [[37.4, -23.4, 0.3], [38.3, -23.1, 1.2], [37.8, -22.6, 0.7]]) this.part(g, 0.9, 0.5, 0.6, 0xe0c060, x, 0.25, z).rotation.y = r;
        const cart = new THREE.Group();
        cart.position.set(50.5, 0, -17.6);
        cart.rotation.y = 0.5;
        this.part(cart, 1.4, 0.4, 0.9, WOOD, 0, 0.6, 0);
        for (const z of [-0.5, 0.5]) this.part(cart, 0.6, 0.6, 0.08, DARK, 0, 0.32, z);
        this.part(cart, 1.2, 0.06, 0.06, WOOD2, 1.2, 0.55, 0.25);
        this.part(cart, 0.5, 0.3, 0.5, 0xf08a1e, -0.2, 0.92, 0);
        g.add(cart);
        return g;
    }

    // Casita de pueblo: paredes, tejado a dos aguas, puerta y ventana
    cottage(g, x, z, ry, wall, roof) {
        const h = new THREE.Group();
        h.position.set(x, 0, z);
        h.rotation.y = ry;
        this.part(h, 2.6, 1.8, 2.4, wall, 0, 0.9, 0);
        this.part(h, 3, 0.18, 1.6, roof, 0, 2.2, -0.62).rotation.x = 0.62;
        this.part(h, 3, 0.18, 1.6, roof, 0, 2.2, 0.62).rotation.x = -0.62;
        this.part(h, 0.6, 1.1, 0.08, WOOD2, -0.5, 0.55, 1.22);
        this.part(h, 0.55, 0.5, 0.08, 0x9fdcff, 0.6, 1.05, 1.22);
        g.add(h);
    }

    // Nivel 2: la posada, la plaza con su fuente, otro puesto, el establo con un caballo y las
    // banderas de la entrada
    buildLevel2() {
        const g = new THREE.Group();
        // Posada: paredes encaladas, entramado de madera, tejado rojo, puerta, ventanas, chimenea y
        // su cartel colgado
        const inn = new THREE.Group();
        inn.position.set(54.5, 0, -22);
        this.part(inn, 5, 2.4, 4, 0xf3ead2, 0, 1.2, 0);
        for (const x of [-2.4, 2.4]) this.part(inn, 0.16, 2.4, 4.1, WOOD2, x, 1.2, 0);
        this.part(inn, 5.1, 0.16, 4.1, WOOD2, 0, 2.4, 0);
        const roofA = this.part(inn, 5.6, 0.2, 2.6, 0xb84a32, 0, 3.05, -1.05);
        roofA.rotation.x = 0.55;
        const roofB = this.part(inn, 5.6, 0.2, 2.6, 0xb84a32, 0, 3.05, 1.05);
        roofB.rotation.x = -0.55;
        this.part(inn, 0.9, 1.5, 0.1, WOOD2, 0, 0.75, 2.04);
        for (const x of [-1.6, 1.6]) this.part(inn, 0.8, 0.7, 0.1, 0x9fdcff, x, 1.4, 2.04);
        this.part(inn, 0.5, 1.2, 0.5, STONE, 1.8, 3.6, -0.6);
        this.part(inn, 0.08, 0.6, 0.08, DARK, -1.2, 2.2, 2.4);
        this.part(inn, 0.9, 0.55, 0.08, WOOD, -1.2, 1.75, 2.45);
        this.part(inn, 0.3, 0.3, 0.04, 0xffd23f, -1.2, 1.75, 2.5, false);
        g.add(inn);
        // Plaza: losas de piedra y la fuente con su chorro
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) this.part(g, 0.95, 0.06, 0.95, (i + j) % 2 ? 0xc8c0b0 : 0xb0a898, 45 + i, 0.03, -6.5 + j, false);
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            this.part(g, 0.7, 0.5, 0.35, STONE, 47 + Math.sin(a) * 1.1, 0.25, -5 + Math.cos(a) * 1.1).rotation.y = a;
        }
        this.part(g, 1.8, 0.06, 1.8, 0x3a7ec8, 47, 0.4, -5, false);
        this.part(g, 0.3, 1.2, 0.3, STONE, 47, 0.6, -5);
        this.jet = this.part(g, 0.18, 0.7, 0.18, 0x9fdcff, 47, 1.5, -5, false);
        // Otro puesto (de telas) y el establo con su caballo
        this.stall(g, 52, -9.5, 0x6a4a9a, 0xffd23f, [0xc8402e, 0x3a7ec8, 0xf3ead2, 0x5a9e32]);
        for (let k = 0; k <= 4; k++) this.part(g, 0.12, 0.9, 0.12, WOOD2, 34 + k * 1.2, 0.45, -3.2);
        for (let k = 0; k <= 3; k++) this.part(g, 0.12, 0.9, 0.12, WOOD2, 34, 0.45, -3.2 - k * 1.2);
        for (const y of [0.35, 0.7]) {
            this.part(g, 4.8, 0.08, 0.08, WOOD, 36.4, y, -3.2);
            this.part(g, 0.08, 0.08, 3.6, WOOD, 34, y, -5);
        }
        const horse = new THREE.Group();
        horse.position.set(37, 0, -5.4);
        horse.rotation.y = 0.4;
        this.part(horse, 1.5, 0.6, 0.55, 0x8a5a34, 0, 1.05, 0);
        for (const [x, z] of [[-0.55, -0.2], [-0.55, 0.2], [0.55, -0.2], [0.55, 0.2]]) this.part(horse, 0.16, 0.8, 0.16, 0x6a4024, x, 0.4, z);
        this.part(horse, 0.35, 0.7, 0.3, 0x8a5a34, 0.75, 1.45, 0).rotation.z = -0.5;
        this.part(horse, 0.55, 0.28, 0.3, 0x8a5a34, 1.05, 1.75, 0);
        this.part(horse, 0.12, 0.5, 0.32, 0x2a1a0e, 0.65, 1.55, 0).rotation.z = -0.5;
        this.part(horse, 0.1, 0.55, 0.1, 0x2a1a0e, -0.8, 0.95, 0).rotation.z = 0.5;
        g.add(horse);
        this.horse = horse;
        // Dos casitas, una hilera de árboles junto a la valla, flores delante de la posada y bancos
        // en la plaza
        this.cottage(g, 41, -8.2, 0, 0xe8d8b0, 0x6a7a9a);
        this.cottage(g, 56.6, -11.5, -Math.PI / 2, 0xf0e0c0, 0x8a5a34);
        for (const x of [37, 41.5, 46, 50.5, 55]) {
            this.part(g, 0.25, 1, 0.25, 0x7a4f2a, x, 0.5, -1.9);
            this.part(g, 1.3, 1, 1.3, x % 2 ? 0x4caf3c : 0x3d9a34, x, 1.4, -1.9);
        }
        for (let k = 0; k < 6; k++) this.part(g, 0.5, 0.18, 0.5, [0xff8fb0, 0xffe03a, 0xffffff][k % 3], 52.6 + k * 0.75, 0.12, -19.4, false);
        this.part(g, 4.6, 0.12, 0.6, 0x5a9e32, 54.4, 0.06, -19.4, false);
        for (const x of [44.2, 49.8]) {
            this.part(g, 1.4, 0.12, 0.45, WOOD, x, 0.45, -5);
            for (const dx of [-0.55, 0.55]) this.part(g, 0.12, 0.42, 0.4, WOOD2, x + dx, 0.21, -5);
        }
        // Banderas a la entrada del poblado, a los lados del camino
        this.flags = [];
        for (const z of [-12.6, -17.4]) {
            this.part(g, 0.12, 3, 0.12, WOOD, 31.6, 1.5, z);
            const cloth = new THREE.Group();
            cloth.position.set(31.6, 2.55, z);
            this.part(cloth, 0.05, 0.7, 1, z < -15 ? 0xffd23f : RED, 0, 0, 0.55);
            g.add(cloth);
            this.flags.push(cloth);
        }
        return g;
    }

    // El nivel del poblado: se ven sus construcciones (las nuevas aparecen con un bote)
    setLevel(level, animate = true) {
        this.level = level;
        this.levels.forEach((g, i) => {
            if (!g) return;
            const on = i <= level;
            if (on && !g.parent) {
                this.root.add(g);
                if (animate) g.userData.pop = 0;
            } else if (!on && g.parent) this.root.remove(g);
        });
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
        // De noche el farol luce (y parpadea un poco), y las farolas del poblado también
        this.glow.material.color.setHex(nightK > 0.3 && Math.sin(time * 9) > -0.8 ? 0xffe680 : 0x8a6a2a);
        for (const l of this.lamps) if (l.parent && l.parent.parent) l.material.color.setHex(nightK > 0.3 ? 0xffe680 : 0x8a6a2a);
        // Lo nuevo del poblado aparece con un bote
        for (const g of this.levels) {
            if (!g || g.userData.pop === undefined) continue;
            g.userData.pop = Math.min(1, g.userData.pop + dt * 1.8);
            const k = g.userData.pop, s = k >= 1 ? 1 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
            g.scale.set(1, Math.max(0.0001, s), 1);
            if (k >= 1) delete g.userData.pop;
        }
        if (this.jet && this.level >= 2) this.jet.scale.y = 0.8 + Math.abs(Math.sin(time * 5)) * 0.4;
        if (this.flags) for (const [i, f] of this.flags.entries()) f.rotation.y = Math.sin(time * 3 + i) * 0.35;
        if (this.horse && this.level >= 2) this.horse.rotation.y = 0.4 + Math.sin(time * 0.4) * 0.3;
        // Él: respira y, con el puesto abierto, saluda de vez en cuando
        if (this.man.visible) {
            this.man.position.y = Math.abs(Math.sin(time * 2)) * 0.02;
            this.arm.rotation.z = this.open && Math.sin(time * 0.8) > 0.7 ? 2.4 + Math.sin(time * 10) * 0.35 : 0.1;
        }
        this.updateFx(dt);
    }
}
