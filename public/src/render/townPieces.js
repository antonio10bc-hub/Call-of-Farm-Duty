import * as THREE from 'three';

// Las piezas del pueblo de los mercaderes: cada objeto de la tienda (content/merchants.js: DECOR) es
// una familia de piezas con variantes (v), a escala de juguete para que se lean con el pueblo
// entero en pantalla. build(m, g, v, A) dibuja la variante v en g (en el suelo, mirando a +z) con
// las cajas de m (m.part, m.lit); A(o, fn) anima o (se queda aparte, sin juntar): fn(o, t) cada
// fotograma con t en segundos (cada pieza, con su desfase). round: su rayo de luz es redondo.
const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, DARK = 0x5a3a22, STONE = 0x9a948a, STONE2 = 0x7e786e, METAL = 0x9aa8b8, METAL2 = 0x7a8898;
const GLASS = 0x9fdcff, CREAM = 0xfff3d6, INK = 0x2a1a0e, RED = 0xd8402e, GOLD = 0xffd23f, GOLD2 = 0xd8a830;
const GREENS = [0x4caf3c, 0x3d9a34, 0x5ab83f, 0x2f8a2c];
const ALIEN = [0xb87dff, 0x5af0ff, 0x7dff4a, 0xff7ae0];
const pick = (list, v) => list[((v % list.length) + list.length) % list.length];
const sin = Math.sin;

// (una caja girada: la mitad de cosas son tablas o techos inclinados)
function tilt(mesh, x = 0, y = 0, z = 0) {
    mesh.rotation.set(x, y, z);
    return mesh;
}
// Un árbol de copa redonda (la base de árboles, frutales y la arboleda)
function roundTree(m, g, x, z, s, crown, trunk = WOOD2, extra = null) {
    m.part(g, 0.34 * s, 1.4 * s, 0.34 * s, trunk, x, 0.7 * s, z);
    m.part(g, 1.7 * s, 1.1 * s, 1.7 * s, crown, x, 1.85 * s, z);
    m.part(g, 1.2 * s, 0.7 * s, 1.2 * s, crown, x, 2.7 * s, z).rotation.y = 0.4;
    if (extra) extra(x, z, s);
}

export const PIECES = {
    // ---------------- La plaza ----------------
    // La fuente dorada: tres tazas, chorros que suben y caen, el agua que brilla y la bola de arriba
    // que gira y late
    fountain: {
        n: 1, round: true,
        build(m, g, v, A) {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                m.part(g, 1.0, 0.6, 0.5, i % 2 ? 0xe8c050 : GOLD2, Math.cos(a) * 2.3, 0.3, Math.sin(a) * 2.3).rotation.y = -a;
            }
            const pool = m.part(g, 4.2, 0.08, 4.2, 0x5ac8ff, 0, 0.5, 0, false);
            A(pool, (o, t) => (o.position.y = 0.5 + sin(t * 2) * 0.02));
            m.part(g, 0.7, 1.4, 0.7, 0xe8c050, 0, 1.2, 0);
            m.part(g, 2.2, 0.26, 2.2, GOLD, 0, 1.95, 0);
            m.part(g, 1.9, 0.06, 1.9, 0x8ad8ff, 0, 2.1, 0, false);
            m.part(g, 0.4, 0.9, 0.4, 0xe8c050, 0, 2.5, 0);
            m.part(g, 1.1, 0.2, 1.1, GOLD, 0, 3.0, 0);
            const top = new THREE.Group();
            top.position.y = 3.5;
            g.add(top);
            m.lit(top, 0.6, 0.6, 0.6, 0x7dff4a, 0, 0, 0);
            for (let k = 0; k < 4; k++) m.part(top, 0.14, 0.14, 0.9, GOLD, 0, 0, 0).rotation.set(0, (k * Math.PI) / 4, 0.6);
            A(top, (o, t) => { o.rotation.y = t * 1.2; o.position.y = 3.5 + sin(t * 2.4) * 0.15; o.scale.setScalar(1 + sin(t * 4) * 0.08); });
            // Los chorros: gotas que salen del centro y caen a la taza de abajo
            for (let k = 0; k < 12; k++) {
                const a = (k / 12) * Math.PI * 2, d = m.part(g, 0.16, 0.16, 0.16, 0xc8f0ff, 0, 2, 0, false), ph = k / 12;
                A(d, (o, t) => {
                    const u = (t * 0.7 + ph) % 1, r = 0.5 + u * 1.5;
                    o.position.set(Math.cos(a) * r, 2.3 + sin(u * Math.PI) * 1.1 - u * 1.7, Math.sin(a) * r);
                });
            }
        },
    },
    // La estatua de los mercaderes, con un aro de luz que gira encima
    statue: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 2.0, 0.9, 2.0, STONE, 0, 0.45, 0);
            m.part(g, 1.7, 0.2, 1.7, STONE2, 0, 1.0, 0);
            for (const [x, s] of [[-0.45, 1.25], [0.45, 1.4]]) {
                const st = m.alien(0xd8d2c8, 0xc8c2b8, 0xb8b2a8);
                st.position.set(x, 1.1, 0);
                st.scale.setScalar(s);
                g.add(st);
            }
            const halo = new THREE.Group();
            halo.position.y = 3.6;
            g.add(halo);
            for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m.lit(halo, 0.2, 0.2, 0.2, GOLD, Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); }
            A(halo, (o, t) => { o.rotation.y = t * 0.8; o.position.y = 3.6 + sin(t * 1.6) * 0.12; });
        },
    },
    // El trofeo dorado: la copa gira despacio sobre su peana y suben chispas
    trophy: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 1.4, 1.0, 1.4, WOOD2, 0, 0.5, 0);
            m.part(g, 1.0, 0.16, 1.0, 0xc8952a, 0, 1.08, 0);
            const cup = new THREE.Group();
            cup.position.y = 1.16;
            g.add(cup);
            m.part(cup, 0.2, 0.5, 0.2, GOLD, 0, 0.25, 0, false);
            m.part(cup, 0.9, 0.7, 0.9, GOLD, 0, 0.85, 0);
            m.part(cup, 1.1, 0.14, 1.1, 0xffe680, 0, 1.24, 0);
            for (const s of [-1, 1]) m.part(cup, 0.16, 0.5, 0.16, GOLD, s * 0.62, 0.95, 0, false);
            m.lit(cup, 0.24, 0.24, 0.24, 0xfff6b0, 0, 1.55, 0);
            A(cup, (o, t) => (o.rotation.y = t * 0.9));
            const sp = m.part(g, 0.12, 0.12, 0.12, 0xfff6b0, 0.6, 2, 0.3, false);
            A(sp, (o, t) => { const u = (t * 0.6) % 1; o.position.set(sin(t * 3) * 0.6, 1.6 + u * 1.6, Math.cos(t * 3) * 0.6); o.scale.setScalar(1 - u); });
        },
    },
    // El cucurucho gigante, que da vueltas en lo alto de su poste
    cone: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 1.0, 0.3, 1.0, STONE, 0, 0.15, 0);
            m.part(g, 0.2, 2.6, 0.2, 0xfff3d6, 0, 1.4, 0);
            const c = new THREE.Group();
            c.position.y = 2.7;
            g.add(c);
            [[0.3, 0.4], [0.55, 0.4], [0.8, 0.4]].forEach(([w, h], i) => m.part(c, w, h, w, 0xd8a04a, 0, i * 0.4, 0));
            m.part(c, 1.2, 0.6, 1.2, 0xffb8d8, 0, 1.4, 0);
            m.part(c, 1.0, 0.5, 1.0, CREAM, 0, 1.9, 0);
            m.part(c, 0.7, 0.4, 0.7, 0x8a4a2a, 0, 2.3, 0);
            m.lit(c, 0.22, 0.22, 0.22, 0xff3e5e, 0, 2.6, 0);
            A(c, (o, t) => (o.rotation.y = t * 0.7));
        },
    },
    // El poste a todas partes, con su veleta girando arriba
    signpost: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 0.9, 0.2, 0.9, STONE, 0, 0.1, 0);
            m.part(g, 0.2, 3.4, 0.2, WOOD2, 0, 1.8, 0);
            [[0.4, 0xf3ead2], [-0.7, GOLD], [1.3, 0x7dff9a], [2.6, 0xff9ab8]].forEach(([ry, c], i) => {
                m.part(g, 1.5, 0.34, 0.08, c, Math.cos(ry) * 0.7, 3.0 - i * 0.45, -Math.sin(ry) * 0.7).rotation.y = ry;
            });
            const vane = new THREE.Group();
            vane.position.y = 3.6;
            g.add(vane);
            m.part(vane, 1.0, 0.08, 0.08, METAL, 0, 0, 0);
            m.part(vane, 0.3, 0.3, 0.06, RED, 0.45, 0, 0);
            A(vane, (o, t) => (o.rotation.y = sin(t * 0.5) * 1.6));
        },
    },
    // El telescopio, que barre el cielo buscando su planeta
    telescope: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 1.4, 0.2, 1.4, STONE, 0, 0.1, 0);
            for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [0, 0.45]]) m.part(g, 0.1, 1.6, 0.1, DARK, x, 0.9, z);
            const head = new THREE.Group();
            head.position.y = 1.75;
            g.add(head);
            const tube = m.part(head, 2.2, 0.42, 0.42, 0xb8862a, 0.2, 0, 0);
            tube.rotation.z = 0.55;
            m.part(tube, 0.5, 0.52, 0.52, 0x8a5a1a, 1.0, 0, 0);
            m.lit(tube, 0.06, 0.36, 0.36, GLASS, 1.27, 0, 0);
            A(head, (o, t) => (o.rotation.y = sin(t * 0.35) * 1.2));
        },
    },
    // El árbol alienígena gigante: copa morada a capas que se mece y frutos de luz que flotan
    tree: {
        n: 1, round: true,
        build(m, g, v, A) {
            m.part(g, 0.8, 3.4, 0.8, 0xd8c8f0, 0, 1.7, 0);
            for (const [x, z] of [[-0.6, 0], [0.6, 0.2], [0, -0.6]]) tilt(m.part(g, 0.3, 0.9, 0.3, 0xd8c8f0, x * 0.7, 0.4, z * 0.7), 0, 0, x * 0.5);
            const top = new THREE.Group();
            top.position.y = 3.4;
            g.add(top);
            for (const [y, w, c] of [[0.2, 3.4, 0x8a5ad8], [0.8, 2.6, 0x9a6ae8], [1.35, 1.6, 0xb87dff]]) m.part(top, w, 0.6, w, c, 0, y, 0);
            A(top, (o, t) => { o.rotation.z = sin(t * 0.8) * 0.04; o.rotation.x = sin(t * 0.6) * 0.03; });
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2, f = m.lit(g, 0.3, 0.3, 0.3, pick([0xff7ae0, 0x5af0ff, GOLD], i), Math.cos(a) * 1.6, 3.0, Math.sin(a) * 1.6);
                A(f, (o, t) => (o.position.y = 3.0 + sin(t * 1.5 + i) * 0.25));
            }
        },
    },
    // La bola de discoteca: cuelga de un arco, gira y suelta destellos
    discoball: {
        n: 1,
        build(m, g, v, A) {
            for (const x of [-1.2, 1.2]) m.part(g, 0.2, 3.8, 0.2, 0x3a3a4a, x, 1.9, 0);
            m.part(g, 2.6, 0.2, 0.2, 0x3a3a4a, 0, 3.8, 0);
            m.part(g, 0.06, 0.6, 0.06, 0x3a3a4a, 0, 3.4, 0, false);
            const b = new THREE.Group();
            b.position.y = 2.75;
            g.add(b);
            for (let i = 0; i < 27; i++) {
                const x = (i % 3) - 1, y = Math.floor(i / 3) % 3 - 1, z = Math.floor(i / 9) - 1;
                if (Math.abs(x) + Math.abs(y) + Math.abs(z) === 3) continue; // (las esquinas fuera: casi redonda)
                m.part(b, 0.3, 0.3, 0.3, (i * 7) % 3 ? 0xd8e0e8 : 0x9fdcff, x * 0.3, y * 0.3, z * 0.3, false);
            }
            A(b, (o, t) => (o.rotation.y = t * 1.8));
            for (let k = 0; k < 4; k++) {
                const s = m.lit(g, 0.16, 0.16, 0.16, pick(ALIEN, k), 0, 2.75, 0);
                A(s, (o, t) => { const a = t * 1.8 + k * 1.57; o.position.set(Math.cos(a) * 0.75, 2.75 + sin(t * 3 + k) * 0.2, Math.sin(a) * 0.75); o.visible = sin(t * 6 + k * 2) > -0.2; });
            }
        },
    },
    // Los parterres del corro de la fuente (cada uno de sus colores)
    flowers: {
        n: 5,
        build(m, g, v) {
            const cols = [[0xff7ae0, 0x5af0ff, GOLD], [0xff5a5a, CREAM, 0xffb020], [0xb87dff, 0x7dff4a, 0x5af0ff], [GOLD, 0xff7ae0, CREAM], [0x5af0ff, 0xb87dff, 0xff5a5a]][v % 5];
            m.part(g, 2.0, 0.34, 1.1, STONE2, 0, 0.17, 0);
            m.part(g, 1.8, 0.1, 0.9, 0x5a3a22, 0, 0.38, 0, false);
            for (let i = 0; i < 9; i++) {
                const x = -0.75 + i * 0.19, z = i % 2 ? 0.22 : -0.22;
                m.part(g, 0.06, 0.4, 0.06, 0x3ac87a, x, 0.6, z, false);
                m.part(g, 0.24, 0.2, 0.24, cols[i % 3], x, 0.85, z, false);
            }
        },
    },
    // ---------------- Alrededor de la plaza ----------------
    // Un poste de las guirnaldas (las bombillas, de poste a poste, las pone la plaza)
    lightPole: {
        n: 1,
        build(m, g) {
            m.part(g, 0.16, 3.0, 0.16, WOOD2, 0, 1.5, 0);
            m.part(g, 0.3, 0.12, 0.3, WOOD2, 0, 3.0, 0);
        },
    },
    // Los setos de fuera de la plaza: recortados de varias formas
    hedges: {
        n: 4,
        build(m, g, v) {
            if (v === 0) { m.part(g, 1.6, 1.0, 0.9, 0x3d8a2c, 0, 0.5, 0); m.part(g, 1.4, 0.2, 0.7, 0x4caf3c, 0, 1.05, 0, false); }
            else if (v === 1) { m.part(g, 0.5, 0.3, 0.5, STONE2, 0, 0.15, 0); m.part(g, 0.2, 0.6, 0.2, WOOD2, 0, 0.5, 0); m.part(g, 1.1, 1.0, 1.1, 0x4caf3c, 0, 1.2, 0); m.part(g, 0.8, 0.3, 0.8, 0x5ab83f, 0, 1.8, 0, false); }
            else if (v === 2) { m.part(g, 0.5, 0.3, 0.5, STONE2, 0, 0.15, 0); for (let i = 0; i < 3; i++) m.part(g, 1.1 - i * 0.32, 0.55, 1.1 - i * 0.32, GREENS[i], 0, 0.55 + i * 0.5, 0); }
            else { m.part(g, 1.6, 0.8, 0.8, 0x3d8a2c, 0, 0.4, 0); for (const x of [-0.5, 0.5]) m.part(g, 0.5, 0.5, 0.5, 0x5ab83f, x, 1.05, 0); }
        },
    },
    // ---------------- Las calles ----------------
    lamp: {
        n: 3,
        build(m, g, v) {
            if (v === 0) {
                m.part(g, 0.4, 0.3, 0.4, 0x3a3a4a, 0, 0.15, 0);
                m.part(g, 0.16, 3.2, 0.16, 0x3a3a4a, 0, 1.75, 0);
                m.part(g, 0.7, 0.12, 0.14, 0x3a3a4a, 0, 3.3, 0.25);
                m.lit(g, 0.42, 0.36, 0.42, 0xfff0a0, 0, 3.12, 0.55);
                m.part(g, 0.5, 0.1, 0.5, 0x3a3a4a, 0, 3.35, 0.55);
            } else if (v === 1) {
                m.part(g, 0.14, 3.4, 0.14, METAL2, 0, 1.7, 0);
                for (const s of [-1, 1]) { m.part(g, 0.6, 0.08, 0.1, METAL2, s * 0.3, 3.3, 0); m.lit(g, 0.34, 0.3, 0.34, 0xfff0a0, s * 0.6, 3.15, 0); }
            } else {
                m.part(g, 0.18, 3.0, 0.18, 0x4a5868, 0, 1.5, 0);
                m.lit(g, 0.6, 0.6, 0.6, 0x7dff4a, 0, 3.3, 0);
                m.part(g, 0.8, 0.1, 0.8, 0x4a5868, 0, 3.65, 0);
            }
        },
    },
    flag: {
        n: 4,
        build(m, g, v, A) {
            m.part(g, 0.5, 0.3, 0.5, STONE, 0, 0.15, 0);
            m.part(g, 0.14, 4.0, 0.14, METAL, 0, 2.0, 0);
            m.lit(g, 0.2, 0.2, 0.2, GOLD, 0, 4.05, 0);
            const cloth = new THREE.Group();
            cloth.position.set(0, 3.4, 0);
            g.add(cloth);
            const [c1, c2] = [[0x3aa83a, 0xd8e0e8], [0x8a5ad8, 0x7dff4a], [RED, GOLD], [0x3a8ad8, CREAM]][v % 4];
            m.part(cloth, 0.06, 0.9, 1.5, c1, 0, 0, 0.78);
            m.part(cloth, 0.07, 0.3, 0.5, c2, 0, 0, 0.78, false);
            A(cloth, (o, t) => (o.rotation.y = sin(t * 2.2) * 0.35));
        },
    },
    bench: {
        n: 3,
        build(m, g, v) {
            if (v === 0) {
                for (const x of [-0.75, 0.75]) m.part(g, 0.14, 0.5, 0.6, DARK, x, 0.25, 0);
                for (const z of [-0.16, 0.16]) m.part(g, 1.9, 0.1, 0.24, WOOD, 0, 0.55, z);
                m.part(g, 1.9, 0.5, 0.1, WOOD, 0, 0.9, -0.3);
            } else if (v === 1) {
                for (const x of [-0.75, 0.75]) m.part(g, 0.1, 0.9, 0.6, 0x3a3a4a, x, 0.45, 0);
                m.part(g, 1.9, 0.12, 0.6, 0x3a8a6a, 0, 0.52, 0);
                m.part(g, 1.9, 0.5, 0.1, 0x3a8a6a, 0, 0.88, -0.28);
            } else {
                m.part(g, 2.0, 0.5, 0.7, STONE, 0, 0.25, 0);
                m.part(g, 1.7, 0.12, 0.5, WOOD, 0, 0.56, 0);
            }
        },
    },
    planter: {
        n: 3,
        build(m, g, v) {
            if (v === 0) {
                m.part(g, 0.9, 0.7, 0.9, 0xc8a07a, 0, 0.35, 0);
                m.part(g, 1.0, 1.0, 1.0, 0x4caf3c, 0, 1.1, 0);
                m.part(g, 0.6, 0.4, 0.6, 0x5ab83f, 0, 1.75, 0, false);
            } else if (v === 1) {
                m.part(g, 1.4, 0.6, 0.7, STONE2, 0, 0.3, 0);
                for (let i = 0; i < 5; i++) m.part(g, 0.24, 0.24, 0.24, pick([0xff7ae0, GOLD, 0x5af0ff, 0xff5a5a], i), -0.5 + i * 0.25, 0.75, (i % 2 - 0.5) * 0.2, false);
            } else {
                m.part(g, 0.8, 0.5, 0.8, 0x8a5a3a, 0, 0.25, 0);
                m.part(g, 0.2, 1.6, 0.2, 0x3d8a2c, 0, 1.2, 0);
                for (let i = 0; i < 3; i++) m.part(g, 0.7 - i * 0.15, 0.3, 0.7 - i * 0.15, 0x5ab83f, 0, 1.0 + i * 0.45, 0);
            }
        },
    },
    // El mobiliario urbano: boca de incendio, papelera, cabina, quiosco de prensa
    hydrant: {
        n: 4,
        build(m, g, v) {
            if (v === 0) {
                m.part(g, 0.5, 0.7, 0.5, 0xd8402e, 0, 0.35, 0);
                m.part(g, 0.36, 0.24, 0.36, 0xd8402e, 0, 0.82, 0);
                m.part(g, 0.8, 0.16, 0.2, 0xb8301e, 0, 0.5, 0, false);
            } else if (v === 1) {
                m.part(g, 0.6, 0.9, 0.6, 0x3a8a4a, 0, 0.45, 0);
                m.part(g, 0.66, 0.1, 0.66, 0x2a6a3a, 0, 0.95, 0);
            } else if (v === 2) {
                m.part(g, 1.0, 2.4, 1.0, RED, 0, 1.2, 0);
                m.part(g, 0.8, 1.5, 0.06, GLASS, 0, 1.3, 0.5);
                m.lit(g, 0.6, 0.2, 0.06, CREAM, 0, 2.2, 0.52);
            } else {
                m.part(g, 1.2, 1.4, 0.8, 0x3a6ab8, 0, 0.7, 0);
                m.part(g, 1.4, 0.14, 1.0, 0x2a4a88, 0, 1.47, 0);
                m.part(g, 0.9, 0.5, 0.06, CREAM, 0, 0.9, 0.42, false);
            }
        },
    },
    busstop: {
        n: 2,
        build(m, g, v) {
            const c = v ? 0x3aa86a : 0x3a8ad8;
            for (const x of [-1.2, 1.2]) m.part(g, 0.12, 2.6, 0.12, METAL2, x, 1.3, -0.45);
            m.part(g, 2.8, 0.16, 1.3, c, 0, 2.65, 0);
            m.part(g, 2.5, 1.6, 0.08, GLASS, 0, 1.25, -0.55);
            m.part(g, 1.9, 0.12, 0.5, WOOD, 0, 0.65, -0.2);
            m.part(g, 0.1, 3.2, 0.1, METAL2, 1.65, 1.6, 0.3);
            m.part(g, 0.7, 0.7, 0.08, GOLD, 1.65, 3.1, 0.3);
            m.part(g, 0.36, 0.36, 0.1, INK, 1.65, 3.1, 0.33, false);
        },
    },
    billboard: {
        n: 4,
        build(m, g, v, A) {
            for (const x of [-1.5, 1.5]) m.part(g, 0.18, 3.2, 0.18, DARK, x, 1.6, 0);
            m.part(g, 3.8, 1.9, 0.18, CREAM, 0, 3.6, 0);
            const bg = [0xff7ae0, 0x5af0ff, 0x7dff4a, GOLD][v % 4];
            m.part(g, 3.4, 1.5, 0.06, bg, 0, 3.6, 0.11, false);
            // (el anuncio: un ovni, un tomate, un cucurucho o una vaca)
            if (v === 0) { m.part(g, 1.4, 0.3, 0.05, METAL, -0.6, 3.6, 0.16, false); m.part(g, 0.6, 0.3, 0.05, GLASS, -0.6, 3.85, 0.16, false); }
            else if (v === 1) { m.part(g, 0.8, 0.7, 0.05, RED, -0.8, 3.6, 0.16, false); m.part(g, 0.3, 0.16, 0.05, 0x3a8a2a, -0.8, 4.0, 0.16, false); }
            else if (v === 2) { m.part(g, 0.4, 0.8, 0.05, 0xd8a04a, -0.8, 3.4, 0.16, false); m.part(g, 0.7, 0.5, 0.05, 0xffb8d8, -0.8, 3.95, 0.16, false); }
            else { m.part(g, 1.0, 0.6, 0.05, CREAM, -0.7, 3.6, 0.16, false); m.part(g, 0.3, 0.3, 0.05, INK, -0.8, 3.65, 0.17, false); }
            for (let i = 0; i < 3; i++) m.part(g, 1.2, 0.14, 0.05, INK, 0.7, 4.0 - i * 0.35, 0.16, false);
            const bulbs = new THREE.Group();
            g.add(bulbs);
            for (let i = 0; i < 6; i++) m.lit(bulbs, 0.14, 0.14, 0.14, GOLD, -1.6 + i * 0.64, 4.62, 0.12);
            A(bulbs, (o, t) => (o.visible = sin(t * 4) > -0.4));
        },
    },
    mailbox: {
        n: 3,
        build(m, g, v) {
            if (v === 0) {
                m.part(g, 0.12, 1.1, 0.12, WOOD2, 0, 0.55, 0);
                m.part(g, 0.5, 0.42, 0.8, 0x3a6ab8, 0, 1.25, 0);
                m.part(g, 0.06, 0.4, 0.14, RED, 0.28, 1.4, -0.2, false);
            } else if (v === 1) {
                m.part(g, 0.7, 1.4, 0.7, RED, 0, 0.7, 0);
                m.part(g, 0.8, 0.2, 0.8, 0xa82a1e, 0, 1.5, 0);
                m.part(g, 0.4, 0.06, 0.06, INK, 0, 1.1, 0.36, false);
            } else {
                m.part(g, 0.2, 0.8, 0.2, 0x4a5868, 0, 0.4, 0);
                m.part(g, 0.8, 0.8, 0.8, 0x7dff9a, 0, 1.2, 0);
                m.lit(g, 0.3, 0.1, 0.06, 0x5af0ff, 0, 1.3, 0.42);
            }
        },
    },
    // La jardinera de pie (la de la calle) y la de la ventana (la de las casas)
    flowerbox: {
        n: 3,
        build(m, g, v) {
            for (const x of [-0.5, 0.5]) m.part(g, 0.12, 0.6, 0.12, WOOD2, x, 0.3, 0);
            m.part(g, 1.3, 0.36, 0.5, pick([0xa8642e, 0x3a8a6a, 0x3a6ab8], v), 0, 0.75, 0);
            for (let i = 0; i < 5; i++) m.part(g, 0.22, 0.22, 0.22, pick([0xff7ae0, GOLD, 0xff5a5a, 0x5af0ff, CREAM], i + v), -0.44 + i * 0.22, 1.05, 0, false);
        },
    },
    windowbox: {
        n: 3,
        build(m, g, v) {
            m.part(g, 0.7, 0.16, 0.22, pick([0xa8642e, 0x3a8a6a, CREAM], v), 0, 0, 0);
            for (const [x, c] of [[-0.22, 0xff7ae0], [0, GOLD], [0.22, 0xff5a5a]]) m.part(g, 0.16, 0.16, 0.16, pick([c, 0x5af0ff], v), x, 0.14, 0, false);
        },
    },
    // Los puestos del mercado: toldos de colores y su género
    stand: {
        n: 4,
        build(m, g, v) {
            const c = pick([0xc8402e, 0x3a8ad8, 0x5aa83a, 0x8a5ad8], v);
            for (const [x, z] of [[-1.0, -0.6], [1.0, -0.6], [-1.0, 0.6], [1.0, 0.6]]) m.part(g, 0.12, 2.4, 0.12, WOOD2, x, 1.2, z);
            m.part(g, 2.2, 0.8, 1.2, WOOD, 0, 0.6, 0.1);
            for (let i = 0; i < 5; i++) m.part(g, 0.48, 0.12, 1.6, i % 2 ? CREAM : c, -0.96 + i * 0.48, 2.45 - Math.abs(i - 2) * 0.05, 0);
            const goods = [[0xe8352a, GOLD, 0x7dff4a], [0xffb020, 0xff7ab8, CREAM], [0x9ad04a, 0xd8a04a, RED], [0x5af0ff, 0xb87dff, GOLD]][v % 4];
            for (let i = 0; i < 4; i++) m.part(g, 0.36, 0.3, 0.36, goods[i % 3], -0.66 + i * 0.44, 1.15, 0.2, false);
            m.part(g, 0.8, 0.3, 0.06, CREAM, 0, 2.1, 0.62, false);
        },
    },
    // ---------------- Por todo el pueblo ----------------
    // Los árboles: redondos, pinos, abedules, alienígenas y de flores
    woods: {
        n: 6,
        build(m, g, v, A) {
            const top = new THREE.Group();
            g.add(top);
            const s = 1.05 + (v % 3) * 0.12;
            if (v % 6 === 0) roundTree(m, top, 0, 0, s, pick(GREENS, v));
            else if (v % 6 === 1) {
                m.part(top, 0.3, 1.0, 0.3, WOOD2, 0, 0.5, 0);
                for (let i = 0; i < 4; i++) m.part(top, 2.0 - i * 0.45, 0.8, 2.0 - i * 0.45, i % 2 ? 0x2f7a3a : 0x3a8a4a, 0, 1.2 + i * 0.75, 0).rotation.y = i * 0.4;
            } else if (v % 6 === 2) {
                m.part(top, 0.3, 2.4, 0.3, 0xf0ece0, 0, 1.2, 0);
                for (let i = 0; i < 3; i++) m.part(top, 0.32, 0.06, 0.06, INK, 0, 0.5 + i * 0.6, 0.16, false);
                m.part(top, 1.4, 1.4, 1.4, 0x9ad04a, 0, 2.7, 0);
                m.part(top, 1.0, 0.6, 1.0, 0xb8e05a, 0, 3.5, 0);
            } else if (v % 6 === 3) {
                m.part(top, 0.34, 2.0, 0.34, 0xd8c8f0, 0, 1.0, 0);
                m.part(top, 1.8, 0.7, 1.8, pick([0x8a5ad8, 0x3ac8b0], v), 0, 2.2, 0);
                m.part(top, 1.2, 0.5, 1.2, pick([0xb87dff, 0x5af0ff], v), 0, 2.8, 0);
                m.lit(top, 0.24, 0.24, 0.24, pick(ALIEN, v), 0.7, 1.8, 0.4);
            } else if (v % 6 === 4) roundTree(m, top, 0, 0, s, 0xff9ac8, WOOD2, (x, z, k) => { for (let i = 0; i < 4; i++) m.part(top, 0.2, 0.2, 0.2, CREAM, x + (i - 1.5) * 0.4 * k, 2.2 * k, z + 0.86 * k, false); });
            else {
                m.part(top, 0.3, 1.4, 0.3, WOOD2, 0, 0.7, 0);
                for (const [x, z, y] of [[-0.6, 0, 1.6], [0.6, 0.2, 1.8], [0, -0.5, 2.3]]) m.part(top, 1.3, 1.1, 1.3, pick(GREENS, v + x * 4), x, y, z);
            }
            A(top, (o, t) => (o.rotation.z = sin(t * 0.9) * 0.025));
        },
    },
    // Las plantas alienígenas que brillan
    shrubs: {
        n: 4,
        build(m, g, v, A) {
            const c = pick(ALIEN, v);
            if (v % 4 === 0) {
                for (const [x, z, s] of [[-0.5, 0, 1.0], [0.45, 0.25, 0.8], [0, -0.5, 0.7]]) { m.part(g, s, s * 0.8, s, 0x3a8a6a, x, s * 0.4, z); }
            } else if (v % 4 === 1) {
                for (let i = 0; i < 5; i++) tilt(m.part(g, 0.2, 1.4, 0.2, 0x3ac87a, Math.cos(i * 1.26) * 0.3, 0.7, Math.sin(i * 1.26) * 0.3), Math.sin(i * 1.26) * 0.4, 0, -Math.cos(i * 1.26) * 0.4);
            } else if (v % 4 === 2) {
                m.part(g, 0.3, 1.0, 0.3, 0x3a8a6a, 0, 0.5, 0);
                for (let i = 0; i < 4; i++) m.part(g, 1.0, 0.1, 0.3, 0x5ac88a, 0, 0.5 + i * 0.2, 0).rotation.y = i * 0.8;
            } else {
                m.part(g, 1.2, 0.5, 1.2, 0x3a8a6a, 0, 0.25, 0);
                m.part(g, 0.6, 0.9, 0.6, 0x4aa87a, 0, 0.9, 0);
            }
            const bulbs = new THREE.Group();
            g.add(bulbs);
            for (let i = 0; i < 3; i++) m.lit(bulbs, 0.3, 0.3, 0.3, c, Math.cos(i * 2.1) * 0.45, 1.2 + (i % 2) * 0.3, Math.sin(i * 2.1) * 0.45);
            A(bulbs, (o, t) => o.scale.setScalar(1 + sin(t * 2.5) * 0.18));
        },
    },
    // Las heladerías: quiosco, carrito y furgoneta (con un cucurucho que gira)
    kiosk: {
        n: 3,
        build(m, g, v, A) {
            const pink = 0xff7ab8;
            if (v === 0) {
                m.part(g, 2.4, 1.5, 1.8, CREAM, 0, 0.75, 0);
                m.part(g, 1.8, 0.6, 0.08, GLASS, 0, 1.1, 0.92);
                for (let i = 0; i < 5; i++) m.part(g, 0.56, 0.14, 2.3, i % 2 ? CREAM : pink, -1.12 + i * 0.56, 2.0 - Math.abs(i - 2) * 0.05, 0.25);
            } else if (v === 1) {
                m.part(g, 1.8, 1.0, 1.0, pink, 0, 0.75, 0);
                for (const x of [-0.6, 0.6]) m.part(g, 0.14, 0.5, 0.5, 0x3a3a4a, x, 0.25, 0.4);
                m.part(g, 0.1, 2.0, 0.1, WOOD2, 0.6, 2.0, 0);
                m.part(g, 2.0, 0.14, 2.0, CREAM, 0.6, 3.0, 0);
            } else {
                m.part(g, 3.0, 1.6, 1.6, CREAM, 0, 1.0, 0);
                m.part(g, 1.0, 0.8, 1.5, pink, 1.1, 1.2, 0);
                m.part(g, 0.7, 0.5, 0.06, GLASS, 1.2, 1.4, 0.78);
                m.part(g, 1.4, 0.7, 0.06, 0x3a3a4a, -0.4, 1.3, 0.8);
                for (const x of [-1.0, 1.0]) for (const z of [-0.75, 0.75]) m.part(g, 0.5, 0.5, 0.2, 0x2e2a28, x, 0.25, z);
            }
            const ic = new THREE.Group();
            ic.position.set(v === 1 ? -0.4 : 0, v === 2 ? 1.9 : v === 1 ? 1.4 : 2.1, 0);
            g.add(ic);
            m.part(ic, 0.3, 0.5, 0.3, 0xd8a04a, 0, 0.25, 0);
            m.part(ic, 0.5, 0.4, 0.5, pick([0xffb8d8, 0x9fdcff, CREAM], v), 0, 0.7, 0);
            A(ic, (o, t) => (o.rotation.y = t * 1.4));
        },
    },
    // Las terrazas: mesas con su sombrilla y sillas
    parasols: {
        n: 4, round: true,
        build(m, g, v) {
            const c = pick([0xc8402e, 0x3a8ad8, 0x5aa83a, GOLD], v);
            m.part(g, 0.9, 0.08, 0.9, CREAM, 0, 0.8, 0);
            m.part(g, 0.12, 0.8, 0.12, DARK, 0, 0.4, 0);
            m.part(g, 0.08, 1.8, 0.08, DARK, 0, 1.6, 0, false);
            m.part(g, 2.4, 0.16, 2.4, c, 0, 2.55, 0);
            m.part(g, 1.6, 0.16, 1.6, CREAM, 0, 2.7, 0, false);
            m.part(g, 0.7, 0.14, 0.7, c, 0, 2.82, 0);
            for (const [x, z] of [[-0.9, 0], [0.9, 0], [0, 0.9]]) {
                m.part(g, 0.5, 0.08, 0.5, 0x3a8ad8, x, 0.48, z);
                m.part(g, 0.08, 0.48, 0.08, DARK, x, 0.24, z, false);
            }
        },
    },
    // Los pozos: de piedra, de madera y alienígena (el cubo sube y baja)
    well: {
        n: 3, round: true,
        build(m, g, v, A) {
            const wall = v === 1 ? WOOD : v === 2 ? 0x4a5868 : STONE;
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                m.part(g, 0.6, 0.9, 0.4, i % 2 ? wall : v === 2 ? 0x3a4858 : STONE2, Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85).rotation.y = -a;
            }
            m.part(g, 1.3, 0.06, 1.3, v === 2 ? 0x7dff4a : 0x4aa8e0, 0, 0.75, 0, false);
            for (const x of [-0.95, 0.95]) m.part(g, 0.16, 2.0, 0.16, WOOD2, x, 1.4, 0);
            if (v === 2) m.lit(g, 2.2, 0.3, 1.4, 0x5af0ff, 0, 2.5, 0);
            else { tilt(m.part(g, 2.4, 0.2, 0.9, v ? 0x5a8a3a : 0x8a4a2a, 0, 2.5, -0.3), 0.45); tilt(m.part(g, 2.4, 0.2, 0.9, v ? 0x5a8a3a : 0x8a4a2a, 0, 2.5, 0.3), -0.45); }
            m.part(g, 1.9, 0.1, 0.1, WOOD2, 0, 2.0, 0, false);
            const bucket = m.part(g, 0.36, 0.36, 0.36, v === 2 ? 0x7dff4a : WOOD, 0, 1.4, 0);
            A(bucket, (o, t) => (o.position.y = 1.2 + (sin(t * 0.8) * 0.5 + 0.5) * 0.6));
        },
    },
    // Las parabólicas grandes del campo (giran despacio buscando señal)
    dish: {
        n: 2, round: true,
        build(m, g, v, A) {
            m.part(g, 1.2, 0.5, 1.2, METAL2, 0, 0.25, 0);
            m.part(g, 0.24, 1.8, 0.24, METAL2, 0, 1.4, 0);
            const head = new THREE.Group();
            head.position.y = 2.3;
            g.add(head);
            const d = new THREE.Group();
            d.rotation.x = -0.7;
            head.add(d);
            m.part(d, 2.4, 0.2, 2.4, v ? CREAM : 0xd8e0e8, 0, 0, 0);
            m.part(d, 1.6, 0.14, 1.6, v ? 0xff9ab8 : 0xc8d0d8, 0, 0.14, 0, false);
            m.part(d, 0.1, 1.0, 0.1, METAL2, 0, 0.55, 0, false);
            m.lit(d, 0.24, 0.24, 0.24, 0xff5a5a, 0, 1.05, 0);
            A(head, (o, t) => (o.rotation.y = sin(t * 0.25) * 1.4));
        },
    },
    // Una parabólica pequeña (la de los tejados)
    roofDish: {
        n: 1,
        build(m, g) {
            m.part(g, 0.08, 0.5, 0.08, METAL2, 0, 0.25, 0);
            tilt(m.part(g, 0.7, 0.08, 0.7, 0xd8e0e8, 0, 0.55, 0.08), -0.6);
            m.part(g, 0.1, 0.1, 0.1, 0xff5a5a, 0, 0.8, 0.28, false);
        },
    },
    // La gasolinera (su cartel de precios da vueltas)
    gas: {
        n: 1,
        build(m, g, v, A) {
            m.part(g, 7.0, 0.1, 4.6, 0x9a948a, 0, 0.05, 0, false);
            for (const x of [-2.8, 2.8]) for (const z of [-1.6, 1.6]) m.part(g, 0.24, 3.0, 0.24, 0xe8e0d0, x, 1.5, z);
            m.part(g, 6.6, 0.4, 4.2, CREAM, 0, 3.15, 0);
            m.part(g, 6.7, 0.18, 4.3, RED, 0, 2.92, 0, false);
            for (const x of [-1.3, 1.3]) {
                m.part(g, 0.7, 1.3, 0.5, RED, x, 0.65, 0);
                m.part(g, 0.5, 0.36, 0.06, INK, x, 0.95, 0.27, false);
                m.part(g, 0.08, 0.6, 0.08, 0x3a3a4a, x + 0.42, 0.7, 0, false);
            }
            m.part(g, 2.6, 2.0, 1.6, 0xe8e0d0, 0, 1.0, -3.0);
            m.part(g, 1.2, 0.7, 0.06, GLASS, 0, 1.1, -2.18);
            m.part(g, 2.8, 0.2, 1.8, RED, 0, 2.1, -3.0);
            m.part(g, 0.2, 4.4, 0.2, DARK, 4.0, 2.2, 1.9);
            const sign = new THREE.Group();
            sign.position.set(4.0, 4.6, 1.9);
            g.add(sign);
            m.part(sign, 1.4, 1.2, 0.2, GOLD, 0, 0, 0);
            m.lit(sign, 1.0, 0.24, 0.06, RED, 0, 0.25, 0.12);
            m.lit(sign, 1.0, 0.24, 0.06, RED, 0, -0.15, -0.12);
            A(sign, (o, t) => (o.rotation.y = t * 0.6));
        },
    },
    // Las mercancías: cajas, barriles, sacos y palés
    crates: {
        n: 4,
        build(m, g, v) {
            if (v === 0) { m.part(g, 0.9, 0.9, 0.9, WOOD, 0, 0.45, 0); m.part(g, 0.7, 0.7, 0.7, 0xb8864a, 0.15, 1.25, 0.05).rotation.y = 0.3; m.part(g, 0.7, 0.7, 0.7, WOOD, 0.9, 0.35, 0.3); }
            else if (v === 1) { for (const [x, z] of [[0, 0], [0.75, 0.2], [0.3, 0.75]]) { m.part(g, 0.65, 1.0, 0.65, 0x8a4a2a, x, 0.5, z); m.part(g, 0.7, 0.08, 0.7, 0x3a3a4a, x, 0.75, z, false); } }
            else if (v === 2) { for (const [x, z, y] of [[0, 0, 0.3], [0.6, 0.1, 0.3], [0.3, 0.05, 0.75]]) m.part(g, 0.6, 0.55, 0.8, 0xe8d8a8, x, y, z); }
            else { m.part(g, 1.4, 0.2, 1.2, WOOD2, 0, 0.1, 0); for (const [x, c] of [[-0.35, 0x3a6ab8], [0.35, RED]]) m.part(g, 0.6, 0.8, 1.0, c, x, 0.6, 0); }
        },
    },
    // Los cobertizos: de herramientas, invernadero y garaje con su tractor
    sheds: {
        n: 3,
        build(m, g, v) {
            if (v === 0) {
                m.part(g, 2.2, 1.5, 1.8, 0xa8642e, 0, 0.75, 0);
                tilt(m.part(g, 2.4, 0.2, 1.2, 0x5a8a3a, 0, 1.75, -0.42), 0.5);
                tilt(m.part(g, 2.4, 0.2, 1.2, 0x5a8a3a, 0, 1.75, 0.42), -0.5);
                m.part(g, 0.7, 1.1, 0.06, DARK, 0.4, 0.55, 0.92);
            } else if (v === 1) {
                m.part(g, 2.4, 0.3, 1.8, STONE2, 0, 0.15, 0);
                m.part(g, 2.2, 1.4, 1.6, 0xc8f0ff, 0, 1.0, 0);
                tilt(m.part(g, 2.3, 0.12, 1.0, 0xb8e8ff, 0, 1.9, -0.36), 0.6);
                tilt(m.part(g, 2.3, 0.12, 1.0, 0xb8e8ff, 0, 1.9, 0.36), -0.6);
                for (let i = 0; i < 4; i++) m.part(g, 0.3, 0.4, 0.3, GREENS[i], -0.75 + i * 0.5, 0.5, 0, false);
            } else {
                m.part(g, 2.6, 1.8, 2.2, RED, 0, 0.9, 0);
                m.part(g, 2.8, 0.3, 2.4, CREAM, 0, 1.95, 0);
                m.part(g, 1.6, 1.4, 0.06, DARK, 0, 0.7, 1.12);
                m.part(g, 0.9, 0.7, 1.3, 0x3aa83a, 0, 0.6, 1.9);
                for (const [x, s] of [[-0.45, 0.7], [0.45, 0.45]]) m.part(g, 0.2, s, s, 0x2e2a28, x, s / 2, 1.6 + (s > 0.5 ? -0.2 : 0.4));
            }
        },
    },
    // Los cristales espaciales: flotan y giran sobre su roca
    crystal: {
        n: 4,
        build(m, g, v, A) {
            const c = pick([0x9f7aff, 0x5af0ff, 0xff7ae0, 0x7dff4a], v);
            m.part(g, 1.3, 0.4, 1.3, STONE2, 0, 0.2, 0);
            for (const [x, z, h, r] of [[0.35, 0.2, 1.2, -0.4], [-0.35, -0.1, 0.9, 0.6]]) {
                const k = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), m.glow(c));
                k.position.set(x, 0.4 + h / 2, z);
                k.rotation.set(0.15, r, 0.2);
                g.add(k);
            }
            const big = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), m.glow(c));
            big.position.y = 2.2;
            g.add(big);
            A(big, (o, t) => { o.rotation.y = t * 0.9; o.position.y = 2.2 + sin(t * 1.6) * 0.25; });
        },
    },
    // Las setas gigantes, de varios tipos (las motas brillan)
    mushrooms: {
        n: 4,
        build(m, g, v, A) {
            const caps = [[0xff5a5a, CREAM], [0x8a5ad8, 0x7dff4a], [0xffb020, CREAM], [0x3ac8b0, 0xff7ae0]][v % 4];
            const glow = new THREE.Group();
            g.add(glow);
            for (const [x, z, s] of [[0, 0, 1.5], [0.85, 0.3, 0.9], [-0.7, 0.35, 1.0]]) {
                m.part(g, 0.3 * s, 1.0 * s, 0.3 * s, 0xf3ead2, x, 0.5 * s, z);
                m.part(g, 1.1 * s, 0.4 * s, 1.1 * s, caps[0], x, 1.1 * s, z);
                m.part(g, 0.7 * s, 0.2 * s, 0.7 * s, caps[0], x, 1.38 * s, z);
                m.lit(glow, 0.16, 0.08, 0.16, caps[1], x + 0.25 * s, 1.5 * s, z + 0.1 * s);
                m.lit(glow, 0.16, 0.08, 0.16, caps[1], x - 0.2 * s, 1.5 * s, z - 0.2 * s);
            }
            A(glow, (o, t) => (o.visible = sin(t * 1.5) > -0.6));
        },
    },
    // El camping: tiendas de varios tipos, cada una con su hoguerita
    tents: {
        n: 4,
        build(m, g, v, A) {
            const c = pick([0xd8402e, 0x3a8ad8, 0xffb020, 0x5aa83a, 0x8a5ad8], v);
            if (v % 3 === 0) for (let i = 0; i < 4; i++) m.part(g, 2.4 - i * 0.56, 0.4, 2.0, c, 0, 0.2 + i * 0.4, 0);
            else if (v % 3 === 1) { for (let i = 0; i < 4; i++) m.part(g, 2.0 - i * 0.48, 0.5, 2.0 - i * 0.48, c, 0, 0.25 + i * 0.5, 0); m.part(g, 0.08, 0.8, 0.08, WOOD2, 0, 2.3, 0, false); }
            else { m.part(g, 2.2, 0.8, 2.0, c, 0, 0.4, 0); m.part(g, 1.6, 0.5, 1.8, c, 0, 1.05, 0); m.part(g, 0.6, 0.3, 1.6, c, 0, 1.4, 0); }
            m.part(g, 0.5, 0.8, 0.06, INK, 0, 0.45, 1.02, false);
            for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m.part(g, 0.2, 0.16, 0.2, STONE, Math.cos(a) * 0.35, 0.08, 1.9 + Math.sin(a) * 0.35); }
            const fire = new THREE.Group();
            fire.position.set(0, 0.1, 1.9);
            g.add(fire);
            m.lit(fire, 0.3, 0.5, 0.3, 0xff8a2a, 0, 0.25, 0);
            m.lit(fire, 0.16, 0.36, 0.16, GOLD, 0, 0.45, 0);
            A(fire, (o, t) => o.scale.set(1, 0.8 + Math.abs(sin(t * 9)) * 0.5, 1));
        },
    },
    // Los molinos: de aspas, de bombeo y una turbina alienígena
    mill: {
        n: 3,
        build(m, g, v, A) {
            const sail = new THREE.Group();
            g.add(sail);
            if (v === 0) {
                for (let i = 0; i < 4; i++) m.part(g, 1.8 - i * 0.3, 1.0, 1.8 - i * 0.3, i % 2 ? CREAM : 0xe0d4b4, 0, 0.5 + i * 1.0, 0);
                m.part(g, 1.3, 0.6, 1.3, RED, 0, 4.3, 0);
                sail.position.set(0, 3.6, 0.8);
                for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.rotation.z = (k * Math.PI) / 2; m.part(b, 0.16, 2.2, 0.06, WOOD2, 0, 1.1, 0); m.part(b, 0.6, 1.6, 0.05, CREAM, 0.36, 1.3, 0.03); sail.add(b); }
                A(sail, (o, t) => (o.rotation.z = t * 1.2));
            } else if (v === 1) {
                for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) tilt(m.part(g, 0.12, 4.4, 0.12, METAL2, x * 0.6, 2.2, z * 0.6), z * 0.12, 0, -x * 0.12);
                m.part(g, 0.6, 0.3, 0.6, METAL2, 0, 4.4, 0);
                sail.position.set(0, 4.5, 0.5);
                for (let k = 0; k < 12; k++) { const b = new THREE.Group(); b.rotation.z = (k * Math.PI) / 6; m.part(b, 0.24, 1.2, 0.04, k % 2 ? 0xd8e0e8 : RED, 0, 0.75, 0); sail.add(b); }
                A(sail, (o, t) => (o.rotation.z = t * 2.4));
                m.part(g, 0.6, 0.8, 0.6, WOOD, 0.9, 0.4, 0.4);
            } else {
                m.part(g, 0.4, 5.0, 0.4, 0xd8e0e8, 0, 2.5, 0);
                m.part(g, 0.7, 0.7, 1.2, 0xd8e0e8, 0, 5.1, 0);
                m.lit(g, 0.3, 0.3, 0.3, 0x7dff4a, 0, 5.6, -0.3);
                sail.position.set(0, 5.1, 0.7);
                for (let k = 0; k < 3; k++) { const b = new THREE.Group(); b.rotation.z = (k * Math.PI * 2) / 3; m.part(b, 0.3, 2.8, 0.08, 0xd8e0e8, 0, 1.4, 0); sail.add(b); }
                A(sail, (o, t) => (o.rotation.z = t * 1.6));
            }
        },
    },
    // Las calabazas alienígenas: bancales con calabazas de varios colores y tamaños (alguna con cara)
    pumpkins: {
        n: 3,
        build(m, g, v, A) {
            m.part(g, 2.8, 0.14, 2.2, 0x6a4a2a, 0, 0.07, 0, false);
            const cols = [[0x9ad04a, 0xffb020], [0xff8a2a, 0x9ad04a], [0xb87dff, 0xffb020]][v % 3];
            [[-0.8, -0.5, 1.0], [0.6, -0.6, 0.7], [-0.3, 0.5, 0.8], [0.8, 0.5, 1.2], [0.1, -0.05, 0.6]].forEach(([x, z, s], i) => {
                m.part(g, 0.9 * s, 0.65 * s, 0.85 * s, cols[i % 2], x, 0.33 * s + 0.1, z);
                m.part(g, 0.1, 0.24, 0.1, 0x5a7a2a, x, 0.75 * s + 0.1, z, false);
                if (i === 3) {
                    const face = new THREE.Group();
                    g.add(face);
                    m.lit(face, 0.18 * s, 0.14 * s, 0.04, GOLD, x - 0.16 * s, 0.4 * s + 0.1, z + 0.44 * s);
                    m.lit(face, 0.18 * s, 0.14 * s, 0.04, GOLD, x + 0.16 * s, 0.4 * s + 0.1, z + 0.44 * s);
                    A(face, (o, t) => (o.visible = sin(t * 0.7) > -0.5));
                }
            });
        },
    },
    // Los espantapájaros alienígenas (se mecen con el viento)
    scarecrow: {
        n: 3,
        build(m, g, v, A) {
            const body = new THREE.Group();
            g.add(body);
            m.part(body, 0.16, 2.6, 0.16, WOOD2, 0, 1.3, 0);
            m.part(body, 1.9, 0.14, 0.14, WOOD2, 0, 2.0, 0);
            m.part(body, 0.9, 1.0, 0.44, pick([0x8a5ad8, 0x3a8ad8, RED], v), 0, 1.85, 0);
            m.part(body, 0.6, 0.55, 0.5, pick([0x7dff4a, 0x5af0ff, 0xff7ae0], v), 0, 2.65, 0);
            m.part(body, 0.46, 0.46, 0.06, 0xf3c8a0, 0, 2.65, 0.27, false);
            m.part(body, 0.9, 0.1, 0.9, 0xe8c050, 0, 2.95, 0);
            m.part(body, 0.5, 0.36, 0.5, 0xe8c050, 0, 3.15, 0);
            A(body, (o, t) => (o.rotation.z = sin(t * 1.1) * 0.06));
        },
    },
    // Los huertos: bancales de lechugas, zanahorias, maíz o girasoles
    gardens: {
        n: 4,
        build(m, g, v) {
            m.part(g, 3.2, 0.12, 2.6, 0x6a4a2a, 0, 0.06, 0, false);
            for (let i = 0; i < 4; i++) {
                const x = -1.2 + i * 0.8;
                m.part(g, 0.6, 0.14, 2.4, 0x8a5a3a, x, 0.12, 0, false);
                for (let j = 0; j < 4; j++) {
                    const z = -0.9 + j * 0.6;
                    if (v === 0) m.part(g, 0.46, 0.36, 0.46, j % 2 ? 0x7ac83a : 0x9ad84a, x, 0.36, z, false);
                    else if (v === 1) { m.part(g, 0.2, 0.3, 0.2, 0xff8a2a, x, 0.3, z, false); m.part(g, 0.3, 0.3, 0.3, 0x5aa83a, x, 0.55, z, false); }
                    else if (v === 2) { m.part(g, 0.14, 1.6, 0.14, 0x5aa83a, x, 0.9, z, false); m.part(g, 0.2, 0.4, 0.2, GOLD, x + 0.1, 1.2, z, false); }
                    else { m.part(g, 0.1, 1.4, 0.1, 0x5aa83a, x, 0.8, z, false); m.part(g, 0.46, 0.46, 0.1, GOLD, x, 1.6, z + 0.06); m.part(g, 0.2, 0.2, 0.06, 0x6a3a1a, x, 1.6, z + 0.12, false); }
                }
            }
        },
    },
    // Los frutales: manzanos, naranjos y cerezos
    orchards: {
        n: 3,
        build(m, g, v, A) {
            const fruit = [0xe8352a, 0xffb020, 0xff5a8a][v % 3];
            for (let i = 0; i < 4; i++) {
                const x = i % 2 ? 1.0 : -1.0, z = i < 2 ? -1.0 : 1.0, t = new THREE.Group();
                g.add(t);
                roundTree(m, t, x, z, 0.85, v === 2 ? 0xff9ac8 : pick(GREENS, i), WOOD2, (px, pz, s) => {
                    for (let k = 0; k < 3; k++) m.part(t, 0.22, 0.22, 0.22, fruit, px + (k - 1) * 0.45 * s, 1.6 * s, pz + 0.86 * s, false);
                });
                A(t, (o, tt) => (o.rotation.z = sin(tt * 0.9 + i) * 0.015));
            }
        },
    },
    // Las pacas de heno: redondas, cuadradas y un almiar
    haystacks: {
        n: 3,
        build(m, g, v) {
            if (v === 0) for (const [x, z] of [[0, 0], [1.1, 0.4]]) { m.part(g, 1.0, 1.1, 1.1, 0xe0c060, x, 0.55, z); m.part(g, 1.04, 0.9, 0.9, 0xd0b050, x, 0.55, z, false); }
            else if (v === 1) { for (const [x, y] of [[-0.5, 0.35], [0.5, 0.35], [0, 1.05]]) m.part(g, 0.9, 0.7, 1.4, 0xe8c868, x, y, 0); }
            else { m.part(g, 1.6, 1.0, 1.6, 0xe0c060, 0, 0.5, 0); m.part(g, 1.2, 0.6, 1.2, 0xd0b050, 0, 1.3, 0); m.part(g, 0.6, 0.4, 0.6, 0xe0c060, 0, 1.8, 0); }
        },
    },
    // Las figuras de jardín: gnomo, rana, pato, búho, gato alien y caracol (alguna se mueve)
    gnome: {
        n: 6,
        build(m, g, v, A) {
            const f = new THREE.Group();
            g.add(f);
            if (v === 0) {
                m.part(f, 0.5, 0.56, 0.4, 0x3a6ab8, 0, 0.28, 0);
                m.part(f, 0.44, 0.4, 0.4, 0x7dff4a, 0, 0.76, 0);
                m.part(f, 0.3, 0.2, 0.06, CREAM, 0, 0.62, 0.21, false);
                m.part(f, 0.48, 0.2, 0.48, RED, 0, 1.06, 0);
                m.part(f, 0.28, 0.26, 0.28, RED, 0, 1.28, 0);
            } else if (v === 1) {
                m.part(f, 0.8, 0.5, 0.7, 0x5ac83a, 0, 0.25, 0);
                for (const x of [-0.22, 0.22]) { m.part(f, 0.2, 0.2, 0.2, CREAM, x, 0.6, 0.2); m.part(f, 0.08, 0.08, 0.04, INK, x, 0.62, 0.31, false); }
            } else if (v === 2) {
                m.part(f, 0.7, 0.5, 0.5, GOLD, 0, 0.25, 0);
                m.part(f, 0.36, 0.4, 0.36, GOLD, 0, 0.66, 0.16);
                m.part(f, 0.2, 0.1, 0.2, 0xff8a2a, 0, 0.62, 0.42, false);
            } else if (v === 3) {
                m.part(f, 0.6, 0.8, 0.5, 0x8a5a3a, 0, 0.4, 0);
                for (const x of [-0.15, 0.15]) m.part(f, 0.18, 0.18, 0.06, GOLD, x, 0.62, 0.26, false);
                for (const x of [-0.2, 0.2]) m.part(f, 0.1, 0.2, 0.1, 0x6a4a2a, x, 0.9, 0, false);
            } else if (v === 4) {
                m.part(f, 0.6, 0.6, 0.5, 0xb87dff, 0, 0.3, 0);
                m.part(f, 0.5, 0.44, 0.44, 0xb87dff, 0, 0.82, 0.05);
                for (const x of [-0.16, 0.16]) m.part(f, 0.1, 0.2, 0.1, 0xb87dff, x, 1.12, 0, false);
                m.part(f, 0.1, 0.5, 0.1, 0xb87dff, 0, 0.4, -0.32, false);
            } else {
                m.part(f, 0.9, 0.3, 0.4, 0xd8c890, 0, 0.15, 0);
                m.part(f, 0.6, 0.6, 0.3, 0xff9a5a, -0.1, 0.55, 0);
                for (const x of [0.28, 0.42]) m.part(f, 0.06, 0.3, 0.06, 0xd8c890, x, 0.45, 0, false);
            }
            if (v % 2 === 0) A(f, (o, t) => (o.rotation.y = sin(t * 0.8) * 0.4));
            else A(f, (o, t) => (o.position.y = Math.max(0, sin(t * 2.5)) * 0.12));
        },
    },
    // Las aves de plástico: flamencos, cisnes, garzas y pelícanos (cabecean)
    flamingo: {
        n: 4,
        build(m, g, v, A) {
            const c = [0xff8ab8, CREAM, 0x9fc8e8, 0xf3ead2][v % 4];
            m.part(g, 0.06, 0.8, 0.06, INK, 0, 0.4, 0, false);
            if (v !== 1) m.part(g, 0.06, 0.8, 0.06, INK, 0.12, 0.4, 0, false);
            m.part(g, 0.7, 0.38, 0.34, c, 0, 0.95, 0);
            const neck = new THREE.Group();
            neck.position.set(0.28, 1.05, 0);
            g.add(neck);
            m.part(neck, 0.12, 0.66, 0.12, c, 0, 0.33, 0);
            m.part(neck, 0.26, 0.2, 0.18, c, 0.08, 0.7, 0);
            m.part(neck, 0.24, 0.08, 0.08, v === 3 ? GOLD : INK, 0.26, 0.66, 0, false);
            A(neck, (o, t) => (o.rotation.z = -Math.max(0, sin(t * 1.3)) * 0.9));
        },
    },
    // Los parques infantiles: columpios, tobogán, balancín y tiovivo
    swings: {
        n: 4,
        build(m, g, v, A) {
            if (v === 0) {
                for (const x of [-1.5, 1.5]) for (const z of [-0.6, 0.6]) tilt(m.part(g, 0.14, 2.8, 0.14, RED, x, 1.4, z * 0.7), z * 0.35);
                m.part(g, 3.2, 0.16, 0.16, RED, 0, 2.7, 0);
                for (const x of [-0.7, 0.7]) {
                    const s = new THREE.Group();
                    s.position.set(x, 2.65, 0);
                    g.add(s);
                    for (const dz of [-0.16, 0.16]) m.part(s, 0.04, 1.9, 0.04, 0x3a3a4a, 0, -0.95, dz, false);
                    m.part(s, 0.7, 0.08, 0.46, 0x3a8ad8, 0, -1.9, 0);
                    A(s, (o, t) => (o.rotation.x = sin(t * 2 + x) * 0.5));
                }
            } else if (v === 1) {
                for (let i = 0; i < 5; i++) m.part(g, 0.8, 0.12, 0.3, GOLD, -1.2, 0.4 + i * 0.4, -0.3 + i * 0.1);
                for (const x of [-1.6, -0.8]) m.part(g, 0.12, 2.2, 0.12, METAL2, x, 1.1, 0.5);
                m.part(g, 1.0, 0.12, 1.0, GOLD, -1.2, 2.2, 0.5);
                tilt(m.part(g, 0.9, 0.1, 3.0, RED, -0.2, 1.2, 0.5), 0, Math.PI / 2, -0.75);
            } else if (v === 2) {
                m.part(g, 0.4, 0.6, 0.4, METAL2, 0, 0.3, 0);
                const b = new THREE.Group();
                b.position.y = 0.65;
                g.add(b);
                m.part(b, 3.2, 0.14, 0.4, GOLD, 0, 0, 0);
                for (const x of [-1.4, 1.4]) m.part(b, 0.1, 0.4, 0.4, RED, x, 0.25, 0);
                A(b, (o, t) => (o.rotation.z = sin(t * 1.6) * 0.25));
            } else {
                const r = new THREE.Group();
                g.add(r);
                m.part(r, 2.6, 0.2, 2.6, 0x3a8ad8, 0, 0.3, 0);
                m.part(r, 0.2, 1.6, 0.2, METAL2, 0, 1.1, 0);
                for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; m.part(r, 0.08, 1.2, 0.08, METAL2, Math.cos(a) * 1.0, 0.9, Math.sin(a) * 1.0); }
                m.part(r, 2.0, 0.14, 2.0, RED, 0, 1.6, 0);
                A(r, (o, t) => (o.rotation.y = t * 0.9));
            }
        },
    },
    // Los pajareros: bebederos, casitas de pájaros en su poste y comederos (con su pájaro que salta)
    birdbath: {
        n: 3,
        build(m, g, v, A) {
            if (v === 0) {
                m.part(g, 0.3, 1.0, 0.3, STONE, 0, 0.5, 0);
                m.part(g, 1.2, 0.18, 1.2, STONE, 0, 1.08, 0);
                m.part(g, 0.9, 0.05, 0.9, 0x5ac8ff, 0, 1.18, 0, false);
            } else if (v === 1) {
                m.part(g, 0.14, 2.2, 0.14, WOOD2, 0, 1.1, 0);
                m.part(g, 0.7, 0.7, 0.7, pick([RED, 0x3a8ad8, GOLD], v), 0, 2.5, 0);
                tilt(m.part(g, 0.9, 0.1, 0.55, WOOD2, 0, 2.95, -0.2), 0.5);
                tilt(m.part(g, 0.9, 0.1, 0.55, WOOD2, 0, 2.95, 0.2), -0.5);
                m.part(g, 0.2, 0.2, 0.04, INK, 0, 2.5, 0.36, false);
            } else {
                m.part(g, 0.12, 1.6, 0.12, METAL2, 0, 0.8, 0);
                m.part(g, 0.8, 0.1, 0.8, GLASS, 0, 1.6, 0);
                m.part(g, 0.5, 0.5, 0.5, GOLD, 0, 1.9, 0);
            }
            const bird = m.part(g, 0.24, 0.2, 0.36, pick([0x3a8ad8, 0xff5a5a, GOLD], v), 0.3, 1.3, 0);
            const y0 = v === 1 ? 2.95 : v === 2 ? 2.25 : 1.3;
            A(bird, (o, t) => { o.position.y = y0 + Math.max(0, sin(t * 3)) * 0.25; o.rotation.y = Math.floor(t) * 0.9; });
        },
    },
    // Las vallas blancas de las parcelas (w × d)
    fences: {
        n: 1,
        build(m, g, v, A, w = 3, d = 3) {
            for (const [len, x, z, ry] of [[w, 0, -d / 2, 0], [w, 0, d / 2, 0], [d, -w / 2, 0, Math.PI / 2], [d, w / 2, 0, Math.PI / 2]]) {
                const n = Math.max(2, Math.round(len / 0.6)), f = new THREE.Group();
                f.position.set(x, 0, z);
                f.rotation.y = ry;
                for (let i = 0; i <= n; i++) m.part(f, 0.1, 0.7, 0.1, 0xf3ead2, -len / 2 + (i * len) / n, 0.35, 0, false);
                for (const y of [0.28, 0.56]) m.part(f, len, 0.06, 0.05, 0xf3ead2, 0, y, 0, false);
                g.add(f);
            }
        },
    },
    // ---------------- Los regalos de la nave madre ----------------
    arch: {
        n: 1,
        build(m, g, v, A) {
            for (const x of [-1.8, 1.8]) for (let k = 0; k < 5; k++) m.part(g, 0.6, 0.8, 0.6, 0x9fdcff, x - Math.sign(x) * k * 0.14, 0.4 + k * 0.8, 0);
            for (let k = 0; k < 7; k++) m.part(g, 0.7, 0.5, 0.6, 0x9fdcff, -1.5 + k * 0.5, 4.2 + Math.sin((k / 6) * Math.PI) * 0.5, 0);
            const gem = m.lit(g, 0.5, 0.5, 0.5, 0xff7ae0, 0, 5.1, 0);
            A(gem, (o, t) => { o.rotation.y = t * 2; o.scale.setScalar(1 + sin(t * 3) * 0.2); });
        },
    },
    totem: {
        n: 1,
        build(m, g, v, A) {
            const top = new THREE.Group();
            g.add(top);
            [[0x8a5ad8, 1.3], [0x3ac8b0, 1.15], [0xff7ae0, 1.2], [0x7dff4a, 1.0]].forEach(([c, w], k) => {
                const seg = new THREE.Group();
                seg.position.y = 0.5 + k * 1.0;
                top.add(seg);
                m.part(seg, w, 1.0, w, c, 0, 0, 0);
                for (const x of [-0.22, 0.22]) m.lit(seg, 0.2, 0.2, 0.05, GOLD, x, 0.12, w / 2 + 0.03);
                A(seg, (o, t) => (o.rotation.y = sin(t * 0.6 + k * 1.3) * 0.5));
            });
            for (const s of [-1, 1]) m.part(g, 1.0, 0.2, 0.3, 0x8a5ad8, s * 0.9, 3.4, 0);
        },
    },
    holo: {
        n: 1, round: true,
        build(m, g, v, A) {
            m.part(g, 1.5, 0.6, 1.5, 0x4a5868, 0, 0.3, 0);
            m.lit(g, 1.0, 0.08, 1.0, 0x5af0ff, 0, 0.64, 0);
            const p = new THREE.Group();
            p.position.y = 2.4;
            g.add(p);
            const mat = m.holo();
            for (const [w, y] of [[0.9, 0.7], [1.5, 0.25], [1.5, -0.25], [0.9, -0.7]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, w), mat); b.position.y = y; p.add(b); }
            A(p, (o, t) => { o.rotation.y = t * 0.8; o.position.y = 2.4 + sin(t * 1.4) * 0.15; });
        },
    },
    rocket: {
        n: 1,
        build(m, g, v, A) {
            const r = new THREE.Group();
            g.add(r);
            for (const s of [-1, 1]) m.part(r, 0.3, 1.3, 0.9, RED, s * 0.65, 0.65, 0);
            for (let k = 0; k < 4; k++) m.part(r, 1.0 - k * 0.16, 1.1, 1.0 - k * 0.16, k % 2 ? 0xf3ead2 : 0xd8e0e8, 0, 0.9 + k * 1.1, 0);
            m.part(r, 0.4, 0.7, 0.4, RED, 0, 5.1, 0);
            m.lit(r, 0.4, 0.4, 0.06, GLASS, 0, 3.0, 0.48);
            const fl = new THREE.Group();
            r.add(fl);
            m.lit(fl, 0.5, 0.5, 0.5, 0xff8a2a, 0, 0.15, 0);
            A(r, (o, t) => (o.position.y = 0.25 + sin(t * 1.3) * 0.2));
            A(fl, (o, t) => o.scale.set(1, 0.6 + Math.abs(sin(t * 12)) * 0.8, 1));
        },
    },
    pond: {
        n: 1, round: true,
        build(m, g, v, A) {
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * Math.PI * 2;
                m.part(g, 0.7, 0.34, 0.5, STONE, Math.cos(a) * 1.75, 0.17, Math.sin(a) * 1.75).rotation.y = -a;
            }
            const w = m.lit(g, 3.0, 0.08, 3.0, 0x7dff9a, 0, 0.14, 0);
            A(w, (o, t) => o.scale.set(1 + sin(t * 2) * 0.03, 1, 1 + sin(t * 2) * 0.03));
            for (const [x, z] of [[-0.6, 0.3], [0.55, -0.45]]) m.part(g, 0.6, 0.08, 0.5, 0x3a8a6a, x, 0.22, z, false);
            const fish = m.lit(g, 0.3, 0.12, 0.16, 0xff8a2a, 0, 0.22, 0);
            A(fish, (o, t) => { o.position.set(Math.cos(t * 0.8) * 0.8, 0.22, Math.sin(t * 0.8) * 0.8); o.rotation.y = -t * 0.8; });
        },
    },
    saucer: {
        n: 1, round: true,
        build(m, g, v, A) {
            m.part(g, 0.2, 1.6, 0.2, 0x3a3a4a, 0, 0.8, 0);
            const p = new THREE.Group();
            p.position.y = 2.0;
            g.add(p);
            m.part(p, 2.4, 0.24, 2.4, METAL, 0, 0, 0);
            m.part(p, 1.6, 0.3, 1.6, METAL2, 0, -0.2, 0);
            m.part(p, 0.9, 0.6, 0.9, GLASS, 0, 0.4, 0);
            for (let k = 0; k < 8; k++) m.lit(p, 0.18, 0.12, 0.18, k % 2 ? GOLD : 0xff3e5e, Math.cos(k * 0.785) * 1.1, 0, Math.sin(k * 0.785) * 1.1);
            A(p, (o, t) => { o.rotation.y = t * 1.2; o.position.y = 2.0 + sin(t * 1.5) * 0.2; o.rotation.z = sin(t * 0.9) * 0.1; });
        },
    },
};
