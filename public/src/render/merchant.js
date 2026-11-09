import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { MERCHANT } from '../content/merchant.js';

const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, DARK = 0x5a3a22, STONE = 0x9a948a;
const DIRT = [0x8a5a34, 0x76492a, 0x9a6a3a], TRENCH = [0x5a3a22, 0x4a2e1a];
const METAL = 0x9aa8b8, METAL2 = 0x7a8898, HULL = 0x4a5868, GLASS = 0x9fdcff;
const RUBBER = 0xe0a860; // las gomas de las caretas
// La llegada, paso a paso (s): vuela hasta el surco, lo recorre pegado al suelo, se posa, baja
// la rampa, sale él y monta su mercancía
const T = { fly: 2.2, glide: 4.8, land: 5.2, ramp: 5.7, out: 7.2, open: 7.7 };
const ease = (k) => k * k * (3 - 2 * k);
const out = (k) => 1 - (1 - k) * (1 - k);
const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const RAMP = { closed: -1.45, open: 0.78, len: 1.5 };
const HOVER = 0.62; // altura del ovni "conduciendo" por el surco

// El claro del comerciante en el bosque: el surco que dejó una nave al estrellarse (tierra
// levantada a los lados, piedras, árboles tumbados al principio y un montón de tierra al final) y
// su mesita plegable. Cuando viene: su ovni, disfrazado de coche con una careta gigante de cartón
// sujeta con dos gomas, entra volando desde fuera de cámara, baja al principio del surco, lo
// recorre pegado al suelo como si condujera y se para; baja la rampa y sale él, un alienígena
// disfrazado de humano con una careta plana y su goma, y saca la mercancía. Al irse, todo al
// revés. setPresent(on) lo pide; la animación avanza en update.
export class MerchantCamp extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const r = this.root;
        this.buildFurrow();
        // Mesita plegable junto a donde se pone él, y el cartel del camino (una de sus monedas de cartón)
        const S = MERCHANT.stall;
        this.table = { x: S.x - 1.3, z: S.z - 0.5 };
        for (const [dx, dz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) this.part(r, 0.08, 0.7, 0.08, 0x6a6a72, this.table.x + dx, 0.35, this.table.z + dz, false);
        this.part(r, 1.3, 0.08, 0.8, 0xf3ead2, this.table.x, 0.72, this.table.z);
        const P = { x: S.x - 3.2, z: S.z + 3.2 }; // (el cartel del camino)
        this.part(r, 0.14, 1.6, 0.14, WOOD2, P.x, 0.8, P.z);
        this.part(r, 0.9, 0.55, 0.1, WOOD, P.x, 1.45, P.z);
        this.part(r, 0.36, 0.36, 0.04, 0xc8955a, P.x, 1.45, P.z + 0.07, false);
        this.part(r, 0.26, 0.24, 0.02, 0xffd23f, P.x - 0.01, 1.46, P.z + 0.1, false);
        this.part(r, 0.05, 0.18, 0.02, 0x6a3a1a, P.x, 1.45, P.z + 0.115, false);

        // Mercancía sobre la mesa: un saco de grano, una cesta de tomates, tarros y una balanza
        this.goods = new THREE.Group();
        this.goods.position.set(this.table.x, 0.76, this.table.z);
        this.part(this.goods, 0.36, 0.34, 0.32, 0xe0c060, -0.4, 0.17, 0);
        this.part(this.goods, 0.24, 0.08, 0.24, 0xf6cf4a, -0.4, 0.37, 0, false);
        this.part(this.goods, 0.36, 0.16, 0.3, WOOD2, 0.05, 0.08, 0.05);
        for (const [x, z] of [[-0.03, -0.02], [0.12, 0.08], [0.05, 0.12]]) this.part(this.goods, 0.12, 0.12, 0.12, 0xe8352a, x, 0.2, z, false);
        for (const x of [0.36, 0.5]) this.part(this.goods, 0.1, 0.18, 0.1, 0x7dff4a, x, 0.09, -0.12);
        r.add(this.goods);

        // De noche: un farol junto a la mesa, una guirnalda de bombillas hasta el ovni y luz
        // cálida que los alumbra a él, a su puesto y al ovni (de día, apagado)
        const L0 = { x: this.table.x + 1.0, z: this.table.z - 0.6 };
        this.part(r, 0.12, 2.2, 0.12, WOOD2, L0.x, 1.1, L0.z);
        this.part(r, 0.5, 0.08, 0.08, WOOD2, L0.x - 0.2, 2.2, L0.z);
        this.lampMat = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });
        this.own(this.lampMat);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), this.lampMat);
        lamp.position.set(L0.x - 0.4, 1.95, L0.z);
        r.add(lamp);
        this.part(r, 0.34, 0.06, 0.34, DARK, L0.x - 0.4, 2.15, L0.z, false);
        this.bulbs = [];
        const U = MERCHANT.ufo;
        for (let i = 1; i <= 9; i++) {
            const k = i / 10, x = lerp(L0.x - 0.2, U.x - 1.2, k), z = lerp(L0.z, U.z + 0.6, k), y = 2.2 - Math.sin(k * Math.PI) * 0.5 + k * 0.2;
            const m = new THREE.MeshBasicMaterial({ color: 0x6a6050 });
            this.own(m);
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), m);
            b.position.set(x, y, z);
            r.add(b);
            this.bulbs.push({ m, mesh: b, c: [0xffe03a, 0xff6a5a, 0x7dff4a, 0x6ac8ff][i % 4] });
        }
        this.glow = new THREE.PointLight(0xffc070, 0, 11, 1.4);
        this.glow.position.set(S.x - 0.6, 3.2, S.z - 0.6);
        this.ufoGlow = new THREE.PointLight(0xb8ffb0, 0, 9, 1.4);
        this.ufoGlow.position.set(U.x, 3.4, U.z + 1.5);
        r.add(this.glow, this.ufoGlow);

        this.ufo = this.buildUfo();
        r.add(this.ufo);
        this.man = this.buildAlien();
        r.add(this.man);
        // Su primo (algunas visitas): otro alienígena, morado, con su careta, junto al puesto
        this.cousin = this.buildAlien(0xc08aff, 0x4a6a8a, 0x2a3a5a);
        this.cousin.position.set(S.x + 0.9, 0, S.z + 1.2);
        this.cousin.rotation.y = 0.3;
        this.cousin.visible = false;
        r.add(this.cousin);
        this.buildLevels();
        this.buildCollection();

        // El surco, los árboles tumbados, la mesa y el cartel no se mueven: en pocas mallas (lo que
        // sale por niveles y la colección, cada cosa por su lado: se muestran u ocultan)
        const keep = [this.ufo, this.man, this.cousin, this.goods, lamp, ...this.bulbs.map((b) => b.mesh), ...this.levels, ...Object.values(this.items), this.antennaTip];
        this.bake([r], keep);
        this.bake([...this.levels, ...Object.values(this.items).filter((g) => !g.spin)], [this.antennaTip, this.discoBall]);

        this.deal = -1;  // segundos de su baile de trato hecho (-1: no baila)
        this.step = 0;   // por dónde va la llegada (0 = no está; T.open = abierto)
        this.want = 0;   // a dónde va: T.open (llegar) o 0 (irse)
        this.dust = new THREE.Vector3(); // dónde levanta polvo al ir por el surco
        this.pose(0);
    }

    // Ancho del surco en x (estrecho al principio, donde tocó tierra; ancho al final)
    furrowWidth(x) {
        const F = MERCHANT.furrow, k = (F.from - x) / (F.from - F.to);
        return lerp(1.6, F.w, Math.min(1, Math.max(0, k)));
    }

    buildFurrow() {
        const r = this.root, F = MERCHANT.furrow;
        // El fondo del surco: tierra oscura y removida, más ancha hacia el final
        for (let x = F.to - 0.4, k = 0; x < F.from; x += 0.8, k++) {
            const w = this.furrowWidth(x);
            this.part(r, 0.84, 0.05, w, TRENCH[k % 2], x, 0.025, F.z + Math.sin(k * 1.7) * 0.08, false);
            this.part(r, 0.84, 0.06, w * 0.35, 0x3a2414, x, 0.04, F.z, false);
        }
        // Tierra levantada a los dos lados: más alta hacia el final, con matas y piedras encima
        let n = 0;
        for (let x = F.to - 0.6; x < F.from + 0.4; x += 0.75) {
            const w = this.furrowWidth(x), k = Math.min(1, Math.max(0, (F.from - x) / (F.from - F.to)));
            for (const s of [-1, 1]) {
                const h = lerp(0.25, 0.95, k) * (0.75 + ((n * 37) % 10) / 20);
                const z = F.z + s * (w / 2 + 0.35 + ((n * 13) % 5) * 0.05);
                const clod = this.part(r, 0.7 + ((n * 7) % 3) * 0.12, h, 0.6 + k * 0.3, DIRT[n % 3], x, h / 2, z);
                clod.rotation.y = ((n * 11) % 7) * 0.1 - 0.3;
                if (n % 3 === 0) this.part(r, 0.3, 0.2, 0.3, [0x4caf3c, 0x3d9a34][n % 2], x + 0.1, h + 0.1, z);
                if (n % 4 === 1) this.part(r, 0.32, 0.22, 0.26, STONE, x - 0.2, h + 0.08, z + s * 0.1).rotation.y = n;
                n++;
            }
        }
        // El montón de tierra que empujó la nave al pararse, al final del surco
        const P = { x: MERCHANT.ufo.x - 4.3, z: F.z - 0.2 };
        for (const [dx, dz, w, h, d] of [[0, 0, 1.4, 0.9, 3.4], [0.5, -0.6, 1.1, 0.6, 1.6], [0.4, 0.9, 1.0, 0.7, 1.4], [-0.5, 0.2, 0.9, 0.45, 2.6], [0.1, -1.6, 0.9, 0.5, 0.9], [0.2, 1.8, 0.8, 0.45, 0.9]]) {
            this.part(r, w, h, d, DIRT[(dx * 10 + dz * 3) & 1], P.x + dx, h / 2, P.z + dz);
        }
        this.part(r, 0.5, 0.3, 0.4, STONE, P.x - 0.3, 1.0, P.z + 0.3).rotation.y = 0.6;
        // Quemaduras alrededor del final
        for (const [dx, dz, s] of [[2.6, -2.2, 1.2], [1.2, 2.3, 0.9], [-1.4, 2.0, 0.8]]) this.part(r, s, 0.03, s * 0.8, 0x3a3028, MERCHANT.ufo.x + dx, 0.015, F.z + dz, false);
        // A los dos lados del surco, árboles inclinados hacia fuera: los tumbó a medias la onda
        // expansiva del aterrizaje (más cuanto más cerca del surco y del principio)
        let i = 0;
        for (let x = F.to + 0.8; x < F.from; x += 1.55, i++) { // (sin salirse de la parcela)
            for (const s of [-1, 1]) {
                const j = (i * 7 + (s > 0 ? 3 : 0)) % 5, d = F.w / 2 + 1.6 + j * 0.42 + (i % 2) * 0.3;
                const z = F.z + s * d, k = Math.min(1, Math.max(0, (x - F.to) / (F.from - F.to)));
                const tree = new THREE.Group(), sc = 0.8 + ((i * 3 + j) % 4) * 0.12;
                tree.position.set(x + (j - 2) * 0.18, 0, z);
                // Inclinado hacia el lado contrario al surco (eje x), con algo de giro propio
                tree.rotation.set(s * (0.32 + 0.4 * k + (3.6 - Math.min(3.6, d - F.w / 2 - 1)) * 0.05), (j - 2) * 0.12, (j - 2) * 0.05);
                tree.scale.setScalar(sc);
                this.part(tree, 0.3, 1.0, 0.3, 0x7a4f2a, 0, 0.5, 0);
                this.part(tree, 1.5, 0.9, 1.5, 0x3d9a34, 0, 1.35, 0).rotation.y = i * 0.7;
                this.part(tree, 1.05, 0.7, 1.05, 0x4caf3c, 0, 2.0, 0).rotation.y = i * 0.7 + 0.4;
                this.part(tree, 0.55, 0.4, 0.55, 0x5cc04a, 0, 2.5, 0);
                // La tierra levantada de la raíz, del lado del surco
                this.part(tree, 0.7, 0.18, 0.4, DIRT[(i + j) % 3], 0, 0.06, -s * 0.35);
                r.add(tree);
            }
        }
        // El cráter donde se paró: un anillo de tierra levantada con matas y piedras encima, abierto
        // por donde entra el surco y hacia el puesto
        const U = MERCHANT.ufo, R = MERCHANT.crater, S = MERCHANT.stall, ring = 52;
        for (let k = 0; k < ring; k++) {
            const a = (k / ring) * Math.PI * 2, x = U.x + Math.cos(a) * (R + 0.6), z = U.z + Math.sin(a) * (R + 0.6);
            if ((x > U.x && Math.abs(z - U.z) < F.w / 2 + 0.6) || Math.hypot(x - S.x, z - S.z) < 2.6) continue;
            const hh = 0.9 + ((k * 7) % 5) * 0.14;
            this.part(r, 1.3, hh, 1.1, DIRT[k % 3], x, hh / 2, z).rotation.y = -a;
            this.part(r, 0.9, 0.4, 0.8, DIRT[(k + 1) % 3], x + Math.cos(a) * 0.8, 0.2, z + Math.sin(a) * 0.8).rotation.y = -a;
            if (k % 3 === 0) this.part(r, 0.5, 0.3, 0.5, [0x4caf3c, 0x3d9a34][k % 2], x, hh + 0.12, z);
            if (k % 5 === 2) this.part(r, 0.42, 0.3, 0.36, STONE, x, hh + 0.1, z).rotation.y = k;
        }
        // El bosque tumbado en abanico a los dos lados del surco: troncos caídos hacia fuera, con
        // la raíz levantada y la copa aún verde (se abre según se aleja del principio)
        const FAN = MERCHANT.fan;
        for (let k = 0; k < 120; k++) {
            const h1 = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, h2 = Math.abs(Math.sin(k * 78.233) * 12543.21) % 1;
            const dx = 1.5 + h1 * (F.from - U.x - 2), x = U.x + dx, half = FAN.w + dx * FAN.open, s = k % 2 ? 1 : -1;
            const off = F.w / 2 + 1.4 + h2 * (half - F.w / 2 - 1.4), z = F.z + s * off;
            if (Math.hypot(x - U.x, z - U.z) < R + 1.6 || z < -29.4 || z > -0.6 || x > 59.4) continue;
            const a = s * (0.5 + h2 * 0.7), L = 2.4 + h1 * 1.6, g = new THREE.Group();
            g.position.set(x, 0, z);
            g.rotation.y = -a;
            this.part(g, 0.42, 0.4, L, 0x6a4424, 0, 0.22, s * L / 2);
            this.part(g, 0.9, 0.9, 0.5, 0x4a3426, 0, 0.45, 0); // la raíz levantada
            this.part(g, 1.3, 0.7, 1.2, [0x3d9a34, 0x4caf3c, 0x5a8a2a][k % 3], 0, 0.4, s * (L + 0.3));
            this.part(g, 0.9, 0.5, 0.9, [0x4caf3c, 0x5cc04a, 0x3d9a34][k % 3], 0.2, 0.75, s * (L + 0.1));
            r.add(g);
        }
        // Al principio, donde tocó tierra: dos árboles tumbados y sus tocones
        for (const [x, z, ry] of [[F.from - 1.5, F.z - F.w / 2 - 1.1, 0.5], [F.from - 2.2, F.z + F.w / 2 + 1.2, -0.4]]) {
            this.part(r, 0.4, 0.35, 0.4, 0x7a4f2a, x + 1.3, 0.17, z - Math.sin(ry) * 1.3);
            const log = new THREE.Group();
            log.position.set(x, 0.22, z);
            log.rotation.y = ry;
            this.part(log, 2.6, 0.32, 0.32, 0x7a4f2a, 0, 0, 0);
            this.part(log, 1.2, 0.8, 1.2, 0x3d9a34, -1.6, 0.3, 0);
            this.part(log, 0.8, 0.6, 0.9, 0x4caf3c, -2.2, 0.15, 0.3);
            r.add(log);
        }
    }

    // El ovni (el frente, hacia -x, es por donde avanza) con su careta de coche de perfil delante,
    // mirando a la cámara (+z), sujeta con dos gomas gigantes; la rampa sale por el frente
    buildUfo() {
        const g = new THREE.Group(), b = new THREE.Group();
        g.add(b);
        g.body = b;
        this.part(b, 3.2, 0.28, 3.2, METAL2, 0, 0.5, 0);
        this.part(b, 3.8, 0.2, 3.8, METAL, 0, 0.72, 0);
        this.part(b, 2.7, 0.28, 2.7, METAL, 0, 0.95, 0);
        this.part(b, 1.8, 0.22, 1.8, HULL, 0, 0.28, 0);
        this.part(b, 1.5, 0.8, 1.5, GLASS, 0, 1.45, 0);
        this.part(b, 1.0, 0.18, 1.0, 0xc4ecff, 0, 1.92, 0, false);
        g.lights = [];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            g.lights.push(this.part(b, 0.2, 0.15, 0.2, k % 2 ? 0xffe03a : 0xff3e5e, Math.sin(a) * 1.78, 0.72, Math.cos(a) * 1.78, false));
        }

        // La careta: un coche rojo de perfil (el morro hacia -x), de cartón, con su borde crema
        const m = new THREE.Group();
        m.position.set(0, 0, 2.08);
        b.add(m);
        const RED = 0xd8402e, CARD = 0xe8d8b0;
        this.part(m, 4.9, 0.95, 0.05, CARD, 0, 0.82, -0.03);        // cartón de detrás (asoma)
        this.part(m, 2.8, 0.85, 0.05, CARD, 0.25, 1.62, -0.03);
        this.part(m, 4.8, 0.85, 0.06, RED, 0, 0.82, 0);              // carrocería
        this.part(m, 2.6, 0.75, 0.06, RED, 0.25, 1.6, 0);             // cabina
        for (const x of [-0.42, 0.88]) this.part(m, 1.05, 0.5, 0.04, 0x9fdcff, x, 1.62, 0.04, false); // ventanillas
        this.part(m, 0.06, 0.75, 0.04, 0x8a2418, 0.25, 1.0, 0.04, false); // la puerta
        this.part(m, 0.2, 0.06, 0.04, 0x2a1a0e, 0.55, 1.08, 0.05, false); // su tirador
        this.part(m, 0.22, 0.2, 0.04, 0xffe680, -2.33, 0.95, 0.04, false); // faro
        this.part(m, 0.16, 0.2, 0.04, 0xff3e1a, 2.35, 0.95, 0.04, false);  // piloto
        for (const x of [-2.42, 2.42]) this.part(m, 0.12, 0.2, 0.08, 0xc8c8c8, x, 0.55, 0.02, false); // parachoques
        for (const x of [-1.5, 1.5]) {
            // Ruedas pintadas: octógono negro (dos cajas, una girada) y tapacubos
            this.part(m, 0.95, 0.95, 0.05, 0x2a2624, x, 0.42, 0.06);
            this.part(m, 0.95, 0.95, 0.05, 0x2a2624, x, 0.42, 0.06).rotation.z = Math.PI / 4;
            this.part(m, 0.38, 0.38, 0.04, 0xb8b8c0, x, 0.42, 0.1, false);
        }
        // Las gomas: un lazo alrededor del borde del platillo y otro alrededor de la cúpula, cada
        // uno desde los dos extremos de la careta hasta la parte de atrás
        const strap = (x1, z1, x2, z2, y) => {
            const len = Math.hypot(x2 - x1, z2 - z1);
            const s = this.part(b, len, 0.08, 0.08, RUBBER, (x1 + x2) / 2, y, (z1 + z2) / 2, false);
            s.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        };
        for (const [w, back, y, x0, x1] of [[2.0, 1.98, 0.86, -2.4, 2.4], [0.82, 0.82, 1.55, -1.05, 1.55]]) {
            strap(x0, 2.06, -w, -back * 0.4, y);
            strap(-w, -back * 0.4, -w * 0.6, -back, y);
            strap(-w * 0.6, -back, w * 0.6, -back, y);
            strap(w * 0.6, -back, w, -back * 0.4, y);
            strap(w, -back * 0.4, x1, 2.06, y);
        }

        // La rampa, por el frente (-x): gira desde el borde hasta tocar el suelo
        g.ramp = new THREE.Group();
        g.ramp.position.set(-1.75, 0.55, 0);
        b.add(g.ramp);
        this.part(g.ramp, RAMP.len, 0.08, 0.9, METAL2, -RAMP.len / 2, 0, 0);
        for (let k = 0; k < 4; k++) this.part(g.ramp, 0.06, 0.04, 0.8, HULL, -0.25 - k * 0.35, 0.05, 0, false);
        g.hatch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: 0x7dff4a }));
        this.own(g.hatch.material);
        g.hatch.position.set(-1.62, 0.78, 0);
        b.add(g.hatch);
        return g;
    }

    // Él: un alienígena verde disfrazado de humano. Gabardina, pantalón, zapatos y sombrero (con
    // las antenas asomando por arriba); la cabeza verde, enorme, con una careta plana de cara
    // humana delante sujeta con su goma
    buildAlien(SKIN = 0x7dff4a, COAT = 0x8a6a4a, COAT2 = 0x6a4f34) {
        const g = new THREE.Group(), HAT = 0x4a3a2a;
        for (const x of [-0.11, 0.11]) {
            this.part(g, 0.15, 0.42, 0.17, 0x3a3a4a, x, 0.26, 0);
            this.part(g, 0.18, 0.12, 0.26, 0x2a1a0e, x, 0.06, 0.04);
        }
        this.part(g, 0.5, 0.66, 0.32, COAT, 0, 0.8, 0);
        this.part(g, 0.52, 0.07, 0.34, COAT2, 0, 0.66, 0);
        this.part(g, 0.08, 0.5, 0.02, COAT2, 0, 0.82, 0.17, false);
        for (const y of [0.72, 0.9]) this.part(g, 0.05, 0.05, 0.02, 0xd9b04a, 0.07, y, 0.17, false);
        this.part(g, 0.16, 0.12, 0.3, SKIN, 0, 1.17, 0); // cuello verde
        g.arm = new THREE.Group();
        g.arm.position.set(0.32, 1.05, 0);
        this.part(g.arm, 0.13, 0.46, 0.14, COAT, 0, -0.23, 0);
        this.part(g.arm, 0.11, 0.12, 0.11, SKIN, 0, -0.5, 0, false);
        g.add(g.arm);
        this.part(g, 0.13, 0.46, 0.14, COAT, -0.32, 0.82, 0);
        this.part(g, 0.11, 0.12, 0.11, SKIN, -0.32, 0.55, 0, false);
        // La cabeza: verde, más grande que la de una persona
        this.part(g, 0.5, 0.46, 0.44, SKIN, 0, 1.45, 0);
        // La careta plana (más pequeña que la cabeza: se le ve el verde por los lados) con su cara
        // pintada: ojos, cejas, bigote, sonrisa y coloretes
        const mask = new THREE.Group();
        mask.position.set(0, 1.43, 0.24);
        g.add(mask);
        g.mask = mask;
        // Debajo de la careta, su cara de verdad: ojos negros enormes (solo se ve si se le cae)
        for (const x of [-0.11, 0.11]) this.part(g, 0.12, 0.14, 0.02, 0x0a0a0c, x, 1.47, 0.225, false);
        this.part(mask, 0.36, 0.4, 0.03, 0xf3c8a0, 0, 0, 0);
        for (const x of [-0.08, 0.08]) {
            this.part(mask, 0.05, 0.05, 0.02, 0x2a1a0e, x, 0.06, 0.02, false);
            this.part(mask, 0.09, 0.02, 0.02, 0x6a3a22, x, 0.12, 0.02, false);
            this.part(mask, 0.06, 0.04, 0.02, 0xff9fb0, x * 1.4, -0.03, 0.02, false);
        }
        this.part(mask, 0.18, 0.04, 0.02, 0x6a3a22, 0, -0.06, 0.02, false); // bigote
        g.smile = this.part(mask, 0.12, 0.025, 0.02, 0xc8402e, 0, -0.12, 0.02, false); // sonrisa (serio: recta y corta)
        // La goma alrededor de la cabeza
        for (const s of [-1, 1]) this.part(g, 0.03, 0.04, 0.44, 0x2a2a2a, s * 0.26, 1.45, 0, false);
        this.part(g, 0.52, 0.04, 0.03, 0x2a2a2a, 0, 1.45, -0.23, false);
        // Sombrero, con dos antenas que salen por arriba
        this.part(g, 0.66, 0.05, 0.62, HAT, 0, 1.7, 0);
        this.part(g, 0.4, 0.22, 0.38, HAT, 0, 1.83, 0);
        this.part(g, 0.42, 0.05, 0.4, 0xc8402e, 0, 1.75, 0, false);
        for (const x of [-0.1, 0.1]) {
            this.part(g, 0.03, 0.26, 0.03, SKIN, x, 2.05, 0, false);
            this.part(g, 0.08, 0.08, 0.08, 0xffe03a, x, 2.2, 0, false);
        }
        // De fiesta (las visitas raras): gorro de cumpleaños encima del sombrero y bufanda dorada
        g.party = new THREE.Group();
        g.add(g.party);
        [[0.32, 0xff5ab8], [0.24, 0x5af0ff], [0.16, 0xffe03a], [0.08, 0xff5ab8]].forEach(([w, c], i) => this.part(g.party, w, 0.14, w, c, 0, 2.0 + i * 0.14, 0));
        this.part(g.party, 0.12, 0.12, 0.12, 0xffffff, 0, 2.6, 0);
        this.part(g.party, 0.56, 0.1, 0.36, 0xffcc33, 0, 1.24, 0);
        this.part(g.party, 0.12, 0.34, 0.06, 0xffcc33, 0.16, 1.05, 0.18);
        g.party.visible = false;
        return g;
    }

    // El campamento crece con la confianza (setLevel): 2, un toldo de rayas sobre la mesa y un banco
    // que deja aquí; 3, el cartel encima del toldo y una caja olvidada; 4, su tienda de campaña
    // junto al ovni y una antena (parpadea cuando no está: llama a casa); 5, alfombra, banderines
    // y un sillón. Lo que deja (banco, caja, antena) se queda también cuando se va
    buildLevels() {
        const S = MERCHANT.stall, T0 = this.table, r = this.root;
        const lv = () => {
            const g = new THREE.Group();
            r.add(g);
            return g;
        };
        const g2 = lv(), g3 = lv(), g4 = lv(), g5 = lv();
        // 2: toldo (cuatro palos y la lona a rayas) y el banco
        for (const [dx, dz] of [[-0.95, -0.6], [0.95, -0.6], [-0.95, 0.6], [0.95, 0.6]]) this.part(g2, 0.1, 2.1, 0.1, WOOD2, T0.x + dx, 1.05, T0.z + dz);
        for (let i = 0; i < 6; i++) this.part(g2, 0.34, 0.08, 1.5, i % 2 ? 0xfff3d6 : 0xd84a3a, T0.x - 0.85 + i * 0.34, 2.14, T0.z);
        for (let i = 0; i < 6; i++) this.part(g2, 0.34, 0.18, 0.06, i % 2 ? 0xfff3d6 : 0xd84a3a, T0.x - 0.85 + i * 0.34, 2.02, T0.z + 0.76, false);
        const B = { x: S.x - 3.0, z: S.z + 1.0 };
        for (const dx of [-0.5, 0.5]) this.part(g2, 0.1, 0.4, 0.4, WOOD2, B.x + dx, 0.2, B.z);
        this.part(g2, 1.3, 0.1, 0.46, WOOD, B.x, 0.44, B.z);
        // 3: el cartel sobre el toldo (una moneda y "letras") y una caja olvidada con su paja
        this.part(g3, 1.8, 0.5, 0.1, WOOD, T0.x, 2.5, T0.z + 0.62);
        this.part(g3, 0.34, 0.34, 0.04, 0xffd23f, T0.x - 0.6, 2.5, T0.z + 0.69, false);
        for (let i = 0; i < 4; i++) this.part(g3, 0.16, 0.22, 0.03, 0x2a1a0e, T0.x - 0.2 + i * 0.24, 2.5, T0.z + 0.69, false);
        const C = { x: S.x + 1.8, z: S.z + 1.8 };
        this.part(g3, 0.6, 0.46, 0.5, 0xb8864a, C.x, 0.23, C.z);
        this.part(g3, 0.62, 0.06, 0.06, WOOD2, C.x, 0.3, C.z + 0.26, false);
        this.part(g3, 0.4, 0.08, 0.3, 0xf6cf4a, C.x + 0.05, 0.5, C.z, false);
        // 4: la tienda de campaña (escalonada) junto al ovni y la antena
        const K = { x: S.x + 0.4, z: S.z - 6.0 };
        for (let i = 0; i < 5; i++) this.part(g4, 2.2 - i * 0.42, 0.28, 1.8, i % 2 ? 0x7a5ab8 : 0x9a7ad8, K.x, 0.14 + i * 0.28, K.z);
        this.part(g4, 0.5, 0.7, 0.04, 0x2a1a3a, K.x, 0.35, K.z + 0.91, false);
        this.part(g4, 0.06, 0.6, 0.06, WOOD2, K.x, 1.6, K.z);
        const A = { x: S.x - 1.4, z: S.z - 3.2 };
        this.part(g4, 0.5, 0.2, 0.5, METAL2, A.x, 0.1, A.z);
        this.part(g4, 0.08, 2.2, 0.08, METAL, A.x, 1.2, A.z);
        for (const y of [1.4, 1.9]) this.part(g4, 0.6, 0.05, 0.05, METAL, A.x, y, A.z, false);
        this.antennaMat = new THREE.MeshBasicMaterial({ color: 0x3a6a3a });
        this.own(this.antennaMat);
        this.antennaTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), this.antennaMat);
        this.antennaTip.position.set(A.x, 2.38, A.z);
        g4.add(this.antennaTip);
        // 5: alfombra delante del puesto, banderines del toldo al farol y su sillón
        this.part(g5, 2.0, 0.03, 1.2, 0xb83a5a, S.x - 0.2, 0.02, S.z + 0.9, false);
        this.part(g5, 1.6, 0.035, 0.8, 0xffcc33, S.x - 0.2, 0.025, S.z + 0.9, false);
        for (let i = 0; i < 7; i++) {
            const k = i / 6, x = lerp(T0.x - 0.95, T0.x + 2.4, k), z = lerp(T0.z + 0.6, T0.z + 2.6, k), y = 2.0 - Math.sin(k * Math.PI) * 0.45;
            this.part(g5, 0.2, 0.24, 0.04, [0xff5ab8, 0x5af0ff, 0xffe03a, 0x7dff4a][i % 4], x, y, z, false);
        }
        this.part(g5, 0.1, 2.1, 0.1, WOOD2, T0.x + 2.4, 1.05, T0.z + 2.6);
        const Q = { x: S.x - 1.4, z: S.z + 0.2 };
        this.part(g5, 0.7, 0.3, 0.6, 0x5a8a4a, Q.x, 0.25, Q.z);
        this.part(g5, 0.7, 0.6, 0.14, 0x5a8a4a, Q.x, 0.6, Q.z - 0.28);
        for (const s of [-1, 1]) this.part(g5, 0.12, 0.42, 0.6, 0x4a7a3a, Q.x + s * 0.34, 0.4, Q.z);
        this.levels = [g2, g3, g4, g5];
        this.setLevel(1);
    }

    setLevel(lv) {
        this.level = lv;
        this.levels.forEach((g, i) => (g.visible = lv >= i + 2));
    }

    // Tu colección (lo que le compras o te regala): cada pieza en su sitio del claro (la chistera
    // va en el pato, en world/Life.js)
    buildCollection() {
        const S = MERCHANT.stall, r = this.root, items = {};
        const at = (id, x, z) => {
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            g.visible = false;
            r.add(g);
            items[id] = g;
            return g;
        };
        // Gnomo alienígena: verde, con gorro rojo
        let g = at('gnome', S.x + 1.0, S.z + 1.4);
        this.part(g, 0.3, 0.34, 0.24, 0x3a6ab8, 0, 0.17, 0);
        this.part(g, 0.26, 0.24, 0.24, 0x7dff4a, 0, 0.46, 0);
        for (const x of [-0.06, 0.06]) this.part(g, 0.06, 0.08, 0.02, 0x0a0a0c, x, 0.48, 0.13, false);
        this.part(g, 0.28, 0.12, 0.28, 0xd84a3a, 0, 0.64, 0);
        this.part(g, 0.16, 0.14, 0.16, 0xd84a3a, 0, 0.76, 0);
        this.part(g, 0.06, 0.1, 0.06, 0xd84a3a, 0, 0.88, 0, false);
        // Flamenco de plástico: rosa, sobre una pata
        g = at('flamingo', S.x - 2.0, S.z + 2.4);
        this.part(g, 0.04, 0.5, 0.04, 0x2a1a0e, 0, 0.25, 0, false);
        this.part(g, 0.42, 0.22, 0.2, 0xff8ab8, 0, 0.6, 0);
        this.part(g, 0.08, 0.36, 0.08, 0xff8ab8, 0.16, 0.86, 0);
        this.part(g, 0.16, 0.12, 0.12, 0xff8ab8, 0.2, 1.06, 0);
        this.part(g, 0.1, 0.05, 0.06, 0x2a1a0e, 0.31, 1.03, 0, false);
        // Bandera alienígena: mástil y bandera verde con su platillo
        g = at('banner', S.x + 2.2, S.z + 0.2);
        this.part(g, 0.1, 2.6, 0.1, METAL, 0, 1.3, 0);
        this.part(g, 0.9, 0.56, 0.04, 0x3aa83a, 0.5, 2.25, 0);
        this.part(g, 0.4, 0.1, 0.03, 0xd8e0e8, 0.5, 2.25, 0.03, false);
        this.part(g, 0.18, 0.1, 0.03, 0x9fdcff, 0.5, 2.33, 0.03, false);
        // Trofeo dorado sobre un tocón
        g = at('trophy', S.x + 0.2, S.z + 2.4);
        this.part(g, 0.5, 0.4, 0.5, WOOD2, 0, 0.2, 0);
        this.part(g, 0.3, 0.08, 0.3, 0xc8952a, 0, 0.44, 0);
        this.part(g, 0.08, 0.16, 0.08, 0xffd23f, 0, 0.56, 0, false);
        this.part(g, 0.3, 0.26, 0.3, 0xffd23f, 0, 0.77, 0);
        for (const s of [-1, 1]) this.part(g, 0.06, 0.14, 0.06, 0xffd23f, s * 0.2, 0.8, 0, false);
        // Bola de discoteca: colgada de un poste en L; gira y brilla de noche
        g = at('discoball', S.x - 2.4, S.z - 1.4);
        this.part(g, 0.1, 2.6, 0.1, WOOD2, 0, 1.3, 0);
        this.part(g, 0.7, 0.08, 0.08, WOOD2, 0.3, 2.6, 0);
        this.part(g, 0.02, 0.4, 0.02, 0x2a2a2a, 0.6, 2.38, 0, false);
        this.discoBall = new THREE.Group();
        this.discoBall.position.set(0.6, 2.02, 0);
        for (let i = 0; i < 8; i++) this.part(this.discoBall, 0.18, 0.18, 0.18, i % 3 ? 0xd8e0e8 : 0x9fdcff, ((i & 1) - 0.5) * 0.18, (((i >> 1) & 1) - 0.5) * 0.18, ((i >> 2) - 0.5) * 0.18, false);
        g.add(this.discoBall);
        // Estatua del mercader (de piedra, con su careta), al borde del cráter
        g = at('statue', S.x + 2.6, S.z - 6.2);
        this.part(g, 0.9, 0.5, 0.9, STONE, 0, 0.25, 0);
        const st = this.buildAlien(0xb8b2a8, 0xa8a298, 0x989288);
        st.position.y = 0.5;
        st.scale.setScalar(1.15);
        st.remove(st.party);
        g.add(st);
        this.items = items;
    }

    // Lo que tienes de la colección, a la vista
    setCollection(owned) {
        for (const [id, g] of Object.entries(this.items)) g.visible = owned.includes(id);
    }

    // Su ánimo: contento (baila de vez en cuando), tranquilo o serio (sin sonrisa, sin saludar)
    setMood(mood) {
        this.mood = mood;
        this.man.smile.scale.set(mood === 'serious' ? 0.6 : 1, mood === 'serious' ? 0.6 : mood === 'happy' ? 1.6 : 1, 1);
    }

    // ¿Viene su primo? (sale con él y se va con él)
    setCousin(on) {
        this.cousinOn = !!on;
    }

    get present() {
        return this.want > 0;
    }

    // Visita rara: el mercader, de fiesta
    setRare(on) {
        this.man.party.visible = !!on;
    }

    // ¿Abierto del todo? (para el cartel y los encargos)
    get open() {
        return this.step >= T.open;
    }

    // ¿Va por el surco? (levanta polvo)
    get gliding() {
        return this.step > T.fly && this.step < T.land && this.step !== this.want;
    }

    // Que venga (o se vaya). animate false: aparece (o desaparece) ya
    setPresent(on, animate = true) {
        this.want = on ? T.open : 0;
        if (animate) return;
        this.step = this.want;
        this.pose(this.step);
    }

    // Cómo está todo en el instante t de la llegada
    pose(t, time = 0) {
        const U = MERCHANT.ufo, F = MERCHANT.furrow, u = this.ufo;
        u.visible = t > 0.02;
        // Vuela desde fuera de cámara hasta el principio del surco, bajando
        const kf = seg(t, 0, T.fly), kg = seg(t, T.fly, T.glide), kl = seg(t, T.glide, T.land);
        const fx = lerp(U.from.x, F.from, out(kf)), fz = lerp(U.from.z, F.z, out(kf)), fy = lerp(U.from.y, HOVER, ease(kf));
        let x = fx, y = fy, z = fz;
        if (kf >= 1) {
            // Por el surco, pegado al suelo, frenando al final, con los botes de un coche
            x = lerp(F.from, U.x, out(kg));
            y = HOVER + Math.abs(Math.sin(x * 2.3)) * 0.06 * (1 - kg) - 0.12 * ease(kl);
            z = F.z;
        }
        u.position.set(x, y, z);
        // Inclinado mientras baja volando; recto al conducir
        u.rotation.z = -0.25 * (1 - kf) * kf * 4;
        u.body.scale.set(1 + Math.sin(kl * Math.PI) * 0.06, 1 - Math.sin(kl * Math.PI) * 0.08, 1 + Math.sin(kl * Math.PI) * 0.06);
        // Rampa y luz de la escotilla
        const kr = seg(t, T.land, T.ramp);
        u.ramp.rotation.z = lerp(RAMP.closed, RAMP.open, ease(kr));
        u.hatch.visible = kr > 0.05;
        // Él: baja por la rampa y va a su sitio
        const ko = seg(t, T.ramp, T.out), m = this.man, S = MERCHANT.stall;
        m.visible = t > T.ramp;
        const top = { x: U.x - 1.75, y: HOVER - 0.12 + 0.55, z: U.z }, foot = { x: U.x - 1.75 - RAMP.len * Math.cos(RAMP.open), y: 0, z: U.z };
        let mx, my, mz, face;
        if (ko < 0.35) {
            const k = ko / 0.35;
            mx = lerp(top.x, foot.x, k); my = lerp(top.y, foot.y, k); mz = top.z;
            face = -Math.PI / 2;
        } else {
            const k = ease((ko - 0.35) / 0.65);
            mx = lerp(foot.x, S.x, k); mz = lerp(foot.z, S.z, k); my = 0;
            face = ko < 0.95 ? Math.atan2(S.x - foot.x, S.z - foot.z) : Math.PI / 4;
        }
        const walking = ko > 0 && ko < 1;
        m.position.set(mx, my + (walking ? Math.abs(Math.sin(ko * 26)) * 0.06 : 0), mz);
        m.rotation.y = ko >= 1 ? Math.PI / 4 : face;
        // Su mercancía sale a la mesa
        const kg2 = seg(t, T.out, T.open);
        this.goods.visible = kg2 > 0;
        this.goods.scale.setScalar(kg2 > 0 ? Math.max(0.0001, back(kg2)) : 0.0001);
        this.dust.set(x + 1.2, 0.1, z);
    }

    // ¡Trato hecho! (al comprarle o venderle algo): su baile con la careta (ver update)
    celebrate() {
        if (!this.man.visible || this.deal >= 0) return false;
        this.manRy = this.man.rotation.y;
        this.deal = 0;
        return true;
    }

    update(dt, time, nightK = 0) {
        if (this.step !== this.want) {
            this.step = this.want > this.step ? Math.min(this.want, this.step + dt) : Math.max(this.want, this.step - dt * 1.4);
            this.pose(this.step, time);
        }
        // Luces de noche (solo con él aquí)
        const on = this.present ? Math.max(0, Math.min(1, (nightK - 0.25) / 0.5)) : 0;
        this.glow.intensity = on * 7 * (0.92 + Math.sin(time * 9) * 0.04);
        this.ufoGlow.intensity = on * 2.5;
        this.lampMat.color.setHex(on > 0.1 ? 0xffe9a0 : 0x8a7a5a);
        this.bulbs.forEach((b, i) => b.m.color.setHex(on > 0.1 && Math.sin(time * 4 + i * 1.3) > -0.5 ? b.c : 0x6a6050));
        const u = this.ufo;
        if (u.visible) {
            // Luces que parpadean (de noche, todas encendidas a la vez de vez en cuando) y un leve
            // vaivén cuando está posado
            u.lights.forEach((l, i) => (l.visible = nightK > 0.5 ? Math.sin(time * 3) > -0.6 : Math.sin(time * 8 + i * 0.8) > -0.2));
            if (this.step === this.want && this.open) u.body.position.y = Math.sin(time * 1.6) * 0.04;
        }
        // ¡Trato hecho! Da dos saltos girando, se le cae la careta (se le ve la cara de alienígena),
        // la caza al vuelo y se la vuelve a poner a toda prisa
        if (this.deal >= 0) {
            this.deal += dt;
            const t = this.deal, m = this.man, M = m.mask;
            const hop = (a, b) => (t > a && t < b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
            m.position.y = hop(0, 0.45) * 0.55 + hop(0.5, 0.95) * 0.75;
            m.rotation.y = this.manRy + (t < 0.95 ? (t / 0.95) * Math.PI * 2 : 0);
            m.arm.rotation.z = 2.6 + Math.sin(t * 22) * 0.4;
            // La careta: sale volando en el segundo salto, da vueltas y vuelve a su sitio
            const k = t < 0.55 ? 0 : t < 1.25 ? (t - 0.55) / 0.7 : 0;
            M.position.set(0, 1.43 + Math.sin(k * Math.PI) * 0.7, 0.24 + Math.sin(k * Math.PI) * 0.25);
            M.rotation.set(k * Math.PI * 4, 0, Math.sin(k * Math.PI) * 0.6);
            if (t > 1.45) {
                this.deal = -1;
                m.position.y = 0;
                m.rotation.y = this.manRy;
                M.position.set(0, 1.43, 0.24);
                M.rotation.set(0, 0, 0);
            }
            return;
        }
        // Él: respira y, abierto, saluda de vez en cuando (contento: además baila un rato cada poco;
        // serio: ni saluda)
        if (this.man.visible && this.open) {
            const m = this.man, dance = this.mood === 'happy' && Math.sin(time * 0.5) > 0.6;
            m.position.y = dance ? Math.abs(Math.sin(time * 8)) * 0.14 : Math.abs(Math.sin(time * 2)) * 0.02;
            m.rotation.y = Math.PI / 4 + (dance ? Math.sin(time * 4) * 0.5 : 0);
            m.rotation.z = dance ? Math.sin(time * 8) * 0.08 : 0;
            m.arm.rotation.z = dance ? 2.6 + Math.sin(time * 16) * 0.4 : this.mood !== 'serious' && Math.sin(time * 0.8) > 0.7 ? 2.4 + Math.sin(time * 10) * 0.35 : 0.1;
            m.mask.rotation.x = this.mood === 'serious' ? 0.15 : 0;
        }
        // Su primo: está mientras él está abierto; se balancea y mira a todos lados
        const c = this.cousin;
        c.visible = !!this.cousinOn && this.open;
        if (c.visible) {
            c.position.y = Math.abs(Math.sin(time * 2.4 + 1)) * 0.03;
            c.rotation.y = 0.3 + Math.sin(time * 0.7) * 0.6;
            c.arm.rotation.z = Math.sin(time * 0.6 + 2) > 0.8 ? 2.4 + Math.sin(time * 12) * 0.35 : 0.1;
        }
        // La antena: cuando no está, parpadea (llama a casa)
        if (this.antennaTip) this.antennaMat.color.setHex(!this.present && Math.sin(time * 5) > 0.3 ? 0x7dff4a : 0x3a6a3a);
        if (this.discoBall && this.items.discoball.visible) {
            this.discoBall.rotation.y = time * 1.5;
        }
        this.updateFx(dt);
    }
}
