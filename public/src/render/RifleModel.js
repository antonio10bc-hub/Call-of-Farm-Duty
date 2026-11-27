import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { clamp, damp } from '../core/math.js';
import { arsenalItem, DEFAULT_LOADOUT } from '../content/arsenal.js';
import { WONDER_LOOK } from './wonder.js';

const METAL = 0x5c6068, METAL_DARK = 0x34373e, BRASS = 0xd9b04a;

// Las piezas del fusil con un equipo { scope, rifle, mag } dentro de g (model: el VoxelModel que
// pone las piezas con su contorno). only: solo una pieza ('rifle', 'scope' o 'mag'), para los
// dibujos de la armería. Devuelve { mag, bolt, end } (end: la punta del cañón)
export function buildGun(model, g, loadout = DEFAULT_LOADOUT, only = null) {
    const R = arsenalItem('rifle', loadout.rifle).look, S = arsenalItem('scope', loadout.scope).look, M = arsenalItem('mag', loadout.mag).look;
    const len = R.barrel, end = -0.27 - len;
    let bolt = new THREE.Object3D();
    const type = R.type || 'rifle';
    if (!only || only === 'rifle') {
        if (type === 'pistol') {
            // Pistola: corredera, empuñadura y cañón corto (el revólver, con su tambor)
            model.part(g, 0.1, 0.1, 0.38, R.metal, 0, 0.02, -0.1);
            model.part(g, 0.09, 0.22, 0.11, R.wood, 0, -0.13, 0.06).rotation.x = -0.18;
            model.part(g, 0.05, 0.06, 0.08, METAL_DARK, 0, -0.07, -0.04, false);
            if (R.cylinder) model.part(g, 0.13, 0.12, 0.12, R.wood2, 0, 0.01, -0.02);
            model.part(g, R.thick, R.thick, len, METAL_DARK, 0, 0.03, -0.29 - len / 2);
            model.part(g, 0.03, 0.04, 0.03, R.wood2, 0, 0.09, -0.27, false);
        } else {
            // Culata (corta en el subfusil) y empuñadura; sin culata, solo el puño bajo el cajón
            if (R.nostock) model.part(g, 0.09, 0.2, 0.1, R.wood2, 0, -0.14, 0.1).rotation.x = -0.18;
            else {
                model.part(g, 0.13, 0.15, R.short ? 0.18 : 0.36, R.wood, 0, -0.03, R.short ? 0.17 : 0.26);
                model.part(g, 0.11, 0.08, 0.18, R.wood2, 0, -0.13, 0.36);
            }
            // Cajón de los mecanismos y guardamonte
            model.part(g, 0.12, 0.12, 0.3, R.metal, 0, 0, -0.02);
            model.part(g, 0.05, 0.08, 0.1, METAL_DARK, 0, -0.1, 0.04, false);
            if (R.rail) model.part(g, 0.08, 0.03, 0.5, METAL_DARK, 0, 0.075, -0.1, false);
            if (R.handle) for (const z of [-0.12, 0.08]) model.part(g, 0.04, 0.08, 0.04, METAL_DARK, 0, 0.1, z, false);
            // Guardamanos y cañón (largo y grueso según el arma), con su freno o su brillo
            const hg = Math.min(0.42, len * 0.6);
            if (R.pump) model.part(g, 0.1, 0.08, 0.24, R.wood, 0, -0.06, -0.3 - len * 0.3);
            else model.part(g, 0.11, 0.09, hg, R.wood, 0, -0.02, -0.17 - hg / 2);
            for (const x of R.double ? [-R.thick * 0.6, R.thick * 0.6] : [0]) model.part(g, R.thick, R.thick, len, METAL_DARK, x, 0.03, -0.27 - len / 2);
            if (R.pump) model.part(g, R.thick * 0.8, R.thick * 0.8, len * 0.8, METAL, 0, -0.03, -0.27 - len * 0.4, false); // (el tubo de los cartuchos)
            if (!R.double) model.part(g, R.thick * 1.5, R.thick * 1.5, 0.08, R.brake ? METAL : R.metal, 0, 0.03, end);
            if (R.brake) for (const dz of [0.05, 0.12]) model.part(g, R.thick * 1.9, 0.03, 0.03, METAL_DARK, 0, 0.03, end + dz, false);
            if (R.glow) for (const dz of [0.15, 0.3, 0.45]) model.part(g, R.thick * 1.25, R.thick * 1.25, 0.04, R.glow, 0, 0.03, -0.27 - dz, false);
            // (la camisa del cañón, con sus agujeros; la empuñadura delantera; la caja de la cinta
            // al costado con los cartuchos que entran al cajón)
            if (R.shroud) {
                const sl = len * 0.55;
                model.part(g, R.thick * 1.7, R.thick * 1.7, sl, METAL, 0, 0.03, -0.29 - sl / 2);
                for (let k = 0; k < 3; k++) for (const s of [-1, 1]) model.part(g, 0.005, R.thick * 0.6, 0.04, METAL_DARK, s * R.thick * 0.86, 0.03, -0.33 - k * sl * 0.3, false);
            }
            if (R.foregrip) model.part(g, 0.06, 0.14, 0.06, METAL_DARK, 0, -0.12, -0.2);
            if (R.belt) {
                model.part(g, 0.12, 0.16, 0.2, 0x5a6a3a, -0.14, -0.1, -0.04);
                for (let k = 0; k < 3; k++) model.part(g, 0.05, 0.03, 0.035, BRASS, -0.08 + k * 0.02, -0.01 + k * 0.025, -0.04, false);
            }
            // (el bípode de la ametralladora, abierto bajo el cañón)
            if (R.bipod) for (const s of [-1, 1]) model.part(g, 0.025, 0.2, 0.025, METAL_DARK, s * 0.05, -0.08, end + 0.12, false).rotation.z = s * 0.3;
        }
        // Cerrojo con su palanca (la corredera, en la pistola)
        bolt = model.part(g, 0.14, 0.04, 0.04, BRASS, type === 'pistol' ? 0.06 : 0.08, 0.04, 0.06, false);
    }
    // Altura de lo que se mira al apuntar (el centro de la mirilla, o el alza sin ella)
    const top = type === 'pistol' ? 0.07 : 0.06;
    let sight = 0.13;
    if (S.none) {
        // Sin mirilla: alza (dos postes con su muesca) atrás y punto de mira en la boca
        sight = top + 0.045;
        if (!only || only === 'rifle' || only === 'scope') {
            const rz = type === 'pistol' ? 0.06 : 0.08, fz = type === 'pistol' ? -0.26 : end + 0.06, bt = type === 'pistol' ? top : 0.03 + R.thick / 2;
            model.part(g, 0.08, 0.02, 0.03, METAL_DARK, 0, top + 0.01, rz, false);
            for (const x of [-0.028, 0.028]) model.part(g, 0.022, 0.05, 0.03, METAL_DARK, x, top + 0.035, rz, false);
            model.part(g, 0.018, sight - bt + 0.005, 0.025, METAL_DARK, 0, (sight + bt) / 2, fz, false);
        }
    }
    if (!S.none && (!only || only === 'scope')) {
        // Mirilla: tubo con sus anillos; el punto rojo, un marco abierto; el ACOG, un tubo corto
        // hueco (se mira a través); la nocturna, con su caja
        const sl = S.len, sr = S.r;
        if (S.open) {
            // (el marco, sin contorno: que no tape lo que se ve a través)
            model.part(g, 0.12, 0.03, 0.16, S.body, 0, 0.08, -0.06);
            for (const x of [-0.055, 0.055]) model.part(g, 0.02, 0.13, 0.03, S.body, x, 0.145, -0.1, false);
            model.part(g, 0.13, 0.02, 0.03, S.body, 0, 0.205, -0.1, false);
            if (only) model.part(g, 0.06, 0.06, 0.01, S.glass, 0, 0.145, -0.1, false); // (en su dibujo, el cristal rojo)
            if (S.hood) model.part(g, 0.13, 0.03, 0.12, S.body, 0, 0.205, -0.04, false); // (la holográfica: caja con techo)
        } else if (S.acog) {
            const zc = -0.08, w = 0.018, cy = 0.18; // (alto: que el cajón del arma no asome dentro)
            for (const s of [-1, 1]) {
                model.part(g, sr * 2, w, sl, S.body, 0, cy + s * (sr - w / 2), zc, !!only);
                model.part(g, w, sr * 2, sl, S.body, s * (sr - w / 2), cy, zc, !!only);
            }
            for (const z of [zc - sl / 2 + 0.02, zc + sl / 2 - 0.02]) for (const s of [-1, 1]) {
                model.part(g, sr * 2.3, 0.03, 0.04, S.ring, 0, cy + s * (sr + 0.01), z, false);
                model.part(g, 0.03, sr * 2.3, 0.04, S.ring, s * (sr + 0.01), cy, z, false);
            }
            model.part(g, 0.04, 0.04, 0.06, S.glass, 0, cy + sr + 0.04, zc + 0.04, false); // (la fibra que ilumina la retícula)
            for (const z of [-0.16, 0.04]) model.part(g, 0.04, 0.04, 0.04, METAL, 0, 0.07, z, false);
        } else {
            model.part(g, sr, sr, sl, S.body, 0, 0.13, -0.08);
            for (const z of [-0.08 - sl / 2 + 0.04, -0.08 + sl / 2 - 0.04]) model.part(g, sr * 1.35, sr * 1.35, 0.06, S.ring, 0, 0.13, z);
            model.part(g, sr * 0.8, sr * 0.8, 0.02, S.glass, 0, 0.13, -0.08 - sl / 2 - 0.01, false);
            if (S.box) model.part(g, 0.08, 0.08, 0.12, S.body, 0.08, 0.15, -0.02);
            for (const z of [-0.16, 0.04]) model.part(g, 0.04, 0.06, 0.04, METAL, 0, 0.08, z, false);
        }
        if (S.open) sight = 0.145;
        if (S.acog) sight = 0.18;
    }
    // Cargador: caja, curvo (ampliado), tambor o célula que brilla
    const mag = new THREE.Group();
    if (type === 'pistol') mag.position.set(0, -0.12, 0.08);
    else mag.position.set(0, -0.08, -0.06);
    if (!only || only === 'mag') {
        if (M.drum) {
            model.part(mag, M.w, M.h, M.d, M.color, 0, -M.h / 2, 0);
            model.part(mag, M.w * 1.1, M.h * 0.6, M.d * 1.1, METAL_DARK, 0, -M.h / 2, 0).rotation.x = Math.PI / 4;
        } else {
            const box = model.part(mag, M.w, M.h, M.d, M.color, 0, -M.h / 2, 0);
            if (M.bend) box.rotation.x = -0.25;
            if (M.dual) {
                // (el doble: otro cargador al lado, pegado con cinta)
                model.part(mag, M.w, M.h, M.d, M.color, M.w + 0.01, -M.h / 2 - 0.02, 0);
                model.part(mag, M.w * 2 + 0.03, 0.03, M.d * 1.05, 0x8a7a4a, M.w / 2, -M.h * 0.55, 0, false);
            }
            if (M.box) model.part(mag, M.w * 0.3, 0.02, M.d * 0.5, BRASS, 0, 0.005, 0, false); // (la cinta asomando)
            if (M.glow) model.part(mag, M.w * 0.6, M.h * 0.7, 0.02, M.glow, 0, -M.h / 2, M.d / 2 + 0.01, false);
        }
    }
    g.add(mag);
    return { mag, bolt, end, sight, optic: arsenalItem('scope', loadout.scope).optic || 'tube' };
}

// Rifle de francotirador voxel en primera persona: va pegado a la cámara, abajo a la derecha.
// Retrocede y se aplasta al disparar, se balancea al saltar de esquina y abre el cerrojo. Se
// monta con el equipo de la armería (setLoadout): la mirilla, el rifle y el cargador cambian
// cómo es (content/arsenal.js: look).
export class RifleModel extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.rest = new THREE.Vector3(0.24, -0.2, -0.6);
        this.root.scale.setScalar(0.38);
        this.outlineW = 0.022; // (contorno fino: pegada a la cara, el grueso tapaba la mirilla)
        this.root.position.copy(this.rest);
        this.gun = new THREE.Group();
        this.root.add(this.gun);
        this.muzzle = new THREE.Object3D();
        this.setLoadout(DEFAULT_LOADOUT);

        this.kick = 0;
        this.boltT = 0;
        this.swayX = 0;
        this.swayY = 0;
        this.reloadT = 0; // recarga en curso: el cargador baja y vuelve a subir
        this.reloadLen = 1;
    }

    // Monta el fusil con el equipo { scope, rifle, mag }
    setLoadout(loadout = DEFAULT_LOADOUT) {
        const key = `${loadout.scope}|${loadout.rifle}|${loadout.mag}`;
        if (key === this.key) return;
        this.key = key;
        const g = this.gun;
        for (const c of [...g.children]) g.remove(c);
        const parts = buildGun(this, g, loadout);
        this.mag = parts.mag;
        this.bolt = parts.bolt;
        // Punta del cañón (de aquí salen las chispas); al apuntar, la mirilla a la altura del ojo
        this.muzzle.position.set(0, 0.03, parts.end - 0.06);
        g.add(this.muzzle);
        // (con el visor de francotirador se oculta al llegar; con las demás se mira a través de
        // la mirilla o por el alza, un poco más lejos de la cara)
        this.adsY = -parts.sight * this.root.scale.y - (parts.optic === 'iron' ? 0.006 : 0);
        this.adsZ = parts.optic === 'tube' ? -0.36 : parts.optic === 'iron' ? -0.58 : -0.62;
        this.adsX = 0;
    }

    // El arma de la caja sorpresa en vez del fusil (render/wonder.js); setLoadout lo devuelve
    setSpecial(id) {
        this.key = `special:${id}`;
        const g = this.gun, L = WONDER_LOOK[id];
        for (const c of [...g.children]) g.remove(c);
        for (const [w, h, d, color, x, y, z, glow] of L.parts) this.part(g, w, h, d, color, x, y, z, !glow);
        // (el cerrojo y el cargador de la animación del fusil, sin pieza a la vista)
        this.mag = new THREE.Group();
        this.bolt = new THREE.Object3D();
        g.add(this.mag, this.bolt);
        this.muzzle.position.set(0, 0.02, L.muzzle);
        g.add(this.muzzle);
        // al apuntar, su propia mira (alza y punto de mira) a la altura del ojo
        this.adsY = -L.sight * this.root.scale.y - 0.012;
        this.adsZ = -0.68; // (más lejos de la cara: que no tape media pantalla)
        this.adsX = -(L.sightX || 0) * this.root.scale.x;
    }

    reload(time) {
        this.reloadT = this.reloadLen = time;
    }

    // Cambio de arma: la que se va baja girando hacia un lado y se queda abajo (swapOut); la
    // nueva sube desde abajo con un giro (swapIn; rack: y se le monta el cerrojo)
    swapOut() {
        this.swap = { t: 0, dir: -1 };
    }

    swapIn(rack = false) {
        this.swap = { t: 0, dir: 1 };
        if (rack) {
            this.boltT = -0.15;
            this.boltSpeed = 0.8;
        }
    }

    // speed: lo deprisa que va el cerrojo (1 = el de serie; más con su mejora)
    fire(speed = 1) {
        this.kick = 1;
        this.boltT = 0;
        this.boltSpeed = speed;
    }

    // dx, dy: cuánto se ha girado la vista este frame (el rifle se queda un poco atrás, con
    // inercia); bob: balanceo vertical; ads: 0 = en la cadera, 1 = pegado al ojo para apuntar
    update(dt, dx = 0, dy = 0, bob = 0, ads = 0) {
        this.kick = Math.max(0, this.kick - dt * 5);
        this.boltT += dt * (this.boltSpeed || 1);
        const lag = 1 - ads * 0.8;
        this.swayX = damp(this.swayX, clamp(-dx * 8, -0.6, 0.6) * lag, 9, dt);
        this.swayY = damp(this.swayY, clamp(dy * 8, -0.6, 0.6) * lag, 9, dt);
        const k = this.kick * this.kick;
        // Al apuntar sube al centro, con la mira a la altura del ojo
        const a = ads * ads * (3 - 2 * ads);
        const x = this.rest.x + (this.adsX - this.rest.x) * a, y = this.rest.y + (this.adsY - this.rest.y) * a, z = this.rest.z + (this.adsZ - this.rest.z) * a;
        this.root.position.set(x + this.swayX * 0.1, y + this.swayY * 0.1 + bob * lag, z + k * 0.1);
        this.root.rotation.set(k * 0.35 + 0.04 * (1 - a), this.swayX * 0.25 + 0.32 * (1 - a), 0.06 * (1 - a) + this.swayX * 0.15);
        // Squash & stretch del disparo
        this.gun.scale.set(1 + k * 0.12, 1 + k * 0.12, 1 - k * 0.18);
        // Cerrojo: atrás y adelante tras cada disparo
        const b = this.boltT > 0.25 && this.boltT < 0.65 ? Math.sin(((this.boltT - 0.25) / 0.4) * Math.PI) : 0;
        this.bolt.position.z = 0.06 + b * 0.12;
        this.bolt.rotation.x = b * -0.8;
        this.root.rotation.z += -b * 0.15;
        if (this.swap) {
            const W = this.swap;
            W.t += dt;
            if (W.dir < 0) {
                const k = Math.min(1, W.t / 0.3), e = k * k;
                this.root.position.y -= e * 0.5;
                this.root.position.x += e * 0.15;
                this.root.rotation.z -= e * 1.2;
                this.root.rotation.x -= e * 0.6;
            } else {
                const k = Math.min(1, W.t / 0.45), e = 1 - (1 - k) ** 3;
                this.root.position.y -= (1 - e) * 0.5;
                this.root.rotation.z += (1 - e) * 1.0;
                this.root.rotation.x += Math.sin(k * Math.PI) * 0.3;
                if (k >= 1) this.swap = null;
            }
        }
        // Recarga: el cargador baja, sale y vuelve a entrar; el arma se ladea
        if (this.reloadT > 0) {
            this.reloadT = Math.max(0, this.reloadT - dt);
            const r = Math.sin((1 - this.reloadT / this.reloadLen) * Math.PI);
            this.mag.position.y = -0.08 - r * 0.35;
            this.root.rotation.z += r * 0.35;
            this.root.rotation.x += r * 0.15;
        } else this.mag.position.y = -0.08;
        this.updateFx(dt);
    }
}
