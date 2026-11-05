import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { clamp, damp } from '../core/math.js';
import { arsenalItem, DEFAULT_LOADOUT } from '../content/arsenal.js';

const METAL = 0x5c6068, METAL_DARK = 0x34373e, BRASS = 0xd9b04a;

// Rifle de francotirador voxel en primera persona: va pegado a la cámara, abajo a la derecha.
// Retrocede y se aplasta al disparar, se balancea al saltar de esquina y abre el cerrojo. Se
// monta con el equipo de la armería (setLoadout): la mirilla, el rifle y el cargador cambian
// cómo es (content/arsenal.js: look).
export class RifleModel extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.rest = new THREE.Vector3(0.24, -0.2, -0.6);
        this.root.scale.setScalar(0.38);
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
        const R = arsenalItem('rifle', loadout.rifle).look, S = arsenalItem('scope', loadout.scope).look, M = arsenalItem('mag', loadout.mag).look;
        // Culata y empuñadura
        this.part(g, 0.13, 0.15, 0.36, R.wood, 0, -0.03, 0.26);
        this.part(g, 0.11, 0.08, 0.18, R.wood2, 0, -0.13, 0.36);
        // Cajón de los mecanismos y guardamonte
        this.part(g, 0.12, 0.12, 0.3, R.metal, 0, 0, -0.02);
        this.part(g, 0.05, 0.08, 0.1, METAL_DARK, 0, -0.1, 0.04, false);
        if (R.rail) this.part(g, 0.08, 0.03, 0.5, METAL_DARK, 0, 0.075, -0.1, false);
        // Guardamanos y cañón (largo y grueso según el rifle), con su freno o su brillo
        const len = R.barrel, end = -0.27 - len;
        this.part(g, 0.11, 0.09, Math.min(0.42, len * 0.6), R.wood, 0, -0.02, -0.17 - Math.min(0.42, len * 0.6) / 2);
        this.part(g, R.thick, R.thick, len, METAL_DARK, 0, 0.03, -0.27 - len / 2);
        this.part(g, R.thick * 1.5, R.thick * 1.5, 0.08, R.brake ? METAL : R.metal, 0, 0.03, end);
        if (R.brake) for (const dz of [0.05, 0.12]) this.part(g, R.thick * 1.9, 0.03, 0.03, METAL_DARK, 0, 0.03, end + dz, false);
        if (R.glow) for (const dz of [0.15, 0.3, 0.45]) this.part(g, R.thick * 1.25, R.thick * 1.25, 0.04, R.glow, 0, 0.03, -0.27 - dz, false);
        // Mirilla: tubo con sus anillos (o el punto rojo abierto, o la caja de la nocturna)
        const sl = S.len, sr = S.r;
        if (S.open) {
            this.part(g, 0.12, 0.03, 0.14, S.body, 0, 0.08, -0.04);
            this.part(g, 0.12, 0.12, 0.03, S.body, 0, 0.14, -0.1);
            this.part(g, 0.06, 0.06, 0.02, S.glass, 0, 0.14, -0.08, false);
        } else {
            this.part(g, sr, sr, sl, S.body, 0, 0.13, -0.08);
            for (const z of [-0.08 - sl / 2 + 0.04, -0.08 + sl / 2 - 0.04]) this.part(g, sr * 1.35, sr * 1.35, 0.06, S.ring, 0, 0.13, z);
            this.part(g, sr * 0.8, sr * 0.8, 0.02, S.glass, 0, 0.13, -0.08 - sl / 2 - 0.01, false);
            if (S.box) this.part(g, 0.08, 0.08, 0.12, S.body, 0.08, 0.15, -0.02);
            for (const z of [-0.16, 0.04]) this.part(g, 0.04, 0.06, 0.04, METAL, 0, 0.08, z, false);
        }
        // Cargador: caja, curvo (ampliado), tambor o célula que brilla
        this.mag = new THREE.Group();
        this.mag.position.set(0, -0.08, -0.06);
        if (M.drum) {
            this.part(this.mag, M.w, M.h, M.d, M.color, 0, -M.h / 2, 0);
            this.part(this.mag, M.w * 1.1, M.h * 0.6, M.d * 1.1, METAL_DARK, 0, -M.h / 2, 0).rotation.x = Math.PI / 4;
        } else {
            const box = this.part(this.mag, M.w, M.h, M.d, M.color, 0, -M.h / 2, 0);
            if (M.bend) box.rotation.x = -0.25;
            if (M.glow) this.part(this.mag, M.w * 0.6, M.h * 0.7, 0.02, M.glow, 0, -M.h / 2, M.d / 2 + 0.01, false);
        }
        g.add(this.mag);
        // Cerrojo con su palanca
        this.bolt = this.part(g, 0.14, 0.04, 0.04, BRASS, 0.08, 0.04, 0.06, false);
        // Punta del cañón (de aquí salen las chispas)
        this.muzzle.position.set(0, 0.03, end - 0.06);
        g.add(this.muzzle);
    }

    reload(time) {
        this.reloadT = this.reloadLen = time;
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
        const x = this.rest.x + (0 - this.rest.x) * a, y = this.rest.y + (-0.055 - this.rest.y) * a, z = this.rest.z + (-0.36 - this.rest.z) * a;
        this.root.position.set(x + this.swayX * 0.1, y + this.swayY * 0.1 + bob * lag, z + k * 0.1);
        this.root.rotation.set(k * 0.35 + 0.04 * (1 - a), this.swayX * 0.25 + 0.32 * (1 - a), 0.06 * (1 - a) + this.swayX * 0.15);
        // Squash & stretch del disparo
        this.gun.scale.set(1 + k * 0.12, 1 + k * 0.12, 1 - k * 0.18);
        // Cerrojo: atrás y adelante tras cada disparo
        const b = this.boltT > 0.25 && this.boltT < 0.65 ? Math.sin(((this.boltT - 0.25) / 0.4) * Math.PI) : 0;
        this.bolt.position.z = 0.06 + b * 0.12;
        this.bolt.rotation.x = b * -0.8;
        this.root.rotation.z += -b * 0.15;
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
