import * as THREE from 'three';
import { box, outline } from '../render/materials.js';
import { buildBox, buildWonder, boxIcon } from '../render/wonder.js';
import { BOX, WONDER } from '../content/mysterybox.js';

const rand = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();
const FIRE = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a];
const GREEN = [0xffffff, 0xd8ffb0, 0x7dff4a, 0x3ec82a];
const SIZE = 0.55; // la caja en la plataforma de la torre (más pequeña, para que quepa)
const GUN = 0.65;  // y las armas que giran encima (de cerca se verían enormes)

// La caja sorpresa en el campo de tiro (content/mysterybox.js) y los disparos de sus armas.
//   estados: null (no hay) → idle (esperando en su torre) → spin (abierta, las armas girando) →
//   give (el arma sube hacia ti) → close (se cierra y se va); si nadie la abre, se va sola.
// La caja solo se abre disparándole desde su torre. El arma que toca la monta el francotirador
// (sniper.giveSpecial) hasta gastar su munición.
export class MysteryBox {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.ink = outline(sniper.theme.outline);
        this.model = buildBox(this.ink);
        this.icon = boxIcon();
        this.icon.scale.setScalar(2.2);
        // Rayo de luz azul hasta el cielo (como en Black Ops), aditivo
        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        this.beam.position.y = 20;
        this.holder = new THREE.Group();
        this.holder.add(this.model, this.icon, this.beam);
        this.icon.position.y = 2.2;
        this.guns = WONDER.map((w) => {
            const g = buildWonder(w.id, this.ink);
            g.visible = false;
            this.holder.add(g);
            return g;
        });
        this.root.add(this.holder);
        this.shots = []; // proyectiles en vuelo (cohetes, rayos, virotes)
        this.reset();
    }

    reset() {
        this.state = null;
        this.holder.visible = false;
        this.next = rand(BOX.first[0], BOX.first[1]);
        this.tower = -1;
        for (const s of this.shots) this.root.remove(s.mesh);
        this.shots = [];
    }

    // Aparece en una torre que no es la tuya: arriba, en su plataforma, a los pies de donde se
    // pone el tirador (un poco hacia el campo, para que desde las otras torres se vea entre la
    // barandilla), con su rayo de luz y su «?» encima
    spawn() {
        const sn = this.sn, f = sn.field, n = f.towers.length;
        const towers = [...Array(n).keys()].filter((i) => i !== sn.corner);
        const i = towers[(Math.random() * towers.length) | 0], t = f.towers[i];
        const dx = f.cx - t.x, dz = f.cz - t.z, d = Math.hypot(dx, dz) || 1;
        this.tower = i;
        // (en la esquina de la plataforma que da al campo: lo más lejos de los ojos que cabe)
        const cl = (v) => Math.max(-0.6, Math.min(0.6, v));
        this.holder.position.set(t.x + cl((dx / d) * 1.1), t.floor + 0.08, t.z + cl((dz / d) * 1.1));
        this.holder.rotation.y = Math.atan2(-dx, -dz); // de cara al tirador (la tapa se abre hacia el campo)
        this.holder.visible = true;
        this.holder.scale.setScalar(0.0001);
        this.model.lid.rotation.x = 0;
        this.beam.visible = this.icon.visible = true;
        for (const g of this.guns) g.visible = false;
        this.state = 'idle';
        this.t = 0;
        this.pop = 0;
        sn.particles.burst(this.holder.position.x, this.holder.position.y + 0.5, this.holder.position.z, 30, [0x9fdcff, 0xffffff], { speed: 2, up: 3, size: 0.1, ttl: 0.7 });
        sn.hooks.sfx.play('secret');
        if (sn.hooks.onBox) sn.hooks.onBox('spawn');
        return i;
    }

    // ¿La bala da a la caja? (en la caja, esperando): { t, near } (near: desde su misma torre)
    hit(origin, dir) {
        if (this.state !== 'idle' || this.pop < 0.9) return null;
        const p = this.holder.position, r = 0.75 * SIZE;
        const t = rayBox(origin, dir, p.x - r, p.y, p.z - r, p.x + r, p.y + 0.75 * SIZE, p.z + r);
        if (t === null) return null;
        return { t, near: this.sn.corner === this.tower && !this.sn.move };
    }

    // Abierta: la tapa sube, el rayo se apaga y empiezan a girar las armas
    open() {
        this.state = 'spin';
        this.t = 0;
        this.flip = 0;
        this.shown = (Math.random() * WONDER.length) | 0;
        this.pick = (Math.random() * WONDER.length) | 0;
        this.icon.visible = this.beam.visible = false;
        this.sn.hooks.sfx.play('unlock');
        if (this.sn.hooks.onBox) this.sn.hooks.onBox('open');
    }

    get weapon() {
        return WONDER[this.pick];
    }

    update(dt, time) {
        const sn = this.sn;
        this.updateShots(dt);
        if (!this.state) {
            // Solo cosechando (ni en el desbloqueo, ni en el prólogo, ni con el campo acabado)
            if (sn.crop && !sn.unlocking && !sn.magic && sn.ending < 0 && !sn.special && (this.next -= dt) <= 0) this.spawn();
            return;
        }
        this.t += dt;
        this.pop = Math.min(1, this.pop + dt * 2.5);
        const k = this.pop, s = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
        if (this.state !== 'close') this.holder.scale.setScalar(Math.max(0.0001, s * SIZE));
        this.icon.position.y = 2.2 + Math.sin(time * 3) * 0.15;
        this.beam.material.opacity = 0.18 + Math.sin(time * 5) * 0.05;
        // Ya en su torre, el rayo y el «?» sobran (y taparían la vista)
        const here = sn.corner === this.tower && !sn.move;
        if (this.state === 'idle') this.beam.visible = this.icon.visible = !here;
        if (this.state === 'idle') {
            if (this.t > BOX.stay || sn.ending >= 0) this.leave();
            return;
        }
        if (this.state === 'spin') {
            this.model.lid.rotation.x = -Math.min(1.9, this.t * 6);
            // Las armas cambian cada vez más despacio y la última es la que toca
            const k2 = Math.min(1, this.t / BOX.spin), gap = 0.06 + k2 * k2 * 0.42;
            if ((this.flip -= dt) <= 0 && k2 < 1) {
                this.flip = gap;
                this.shown = (this.shown + 1 + ((Math.random() * (WONDER.length - 1)) | 0)) % WONDER.length;
                sn.hooks.sfx.play('tick');
            }
            if (k2 >= 1) this.shown = this.pick;
            // (de perfil hacia la cámara: el cañón, cruzado delante)
            const p = this.holder.position, face = Math.atan2(sn.pos.x - p.x, sn.pos.z - p.z) - this.holder.rotation.y;
            this.guns.forEach((g, i) => {
                g.visible = i === this.shown;
                g.position.set(0, 0.75 + k2 * 0.3, 0);
                g.scale.setScalar(GUN);
                g.rotation.set(0, face + Math.PI / 2 + Math.sin(time * 2) * 0.25, 0);
            });
            if (this.t >= BOX.spin + 0.5) {
                this.state = 'give';
                this.t = 0;
                sn.hooks.sfx.play('achievement');
            }
            return;
        }
        if (this.state === 'give') {
            // El arma sube y vuela hacia el tirador; al llegar, es suya
            const g = this.guns[this.pick], e = Math.min(1, this.t / 0.5);
            this.holder.worldToLocal(_v.copy(sn.pos));
            g.position.lerpVectors(new THREE.Vector3(0, 1.05, 0), _v, e * e);
            g.rotation.y += dt * 12;
            if (e >= 1) {
                g.visible = false;
                sn.giveSpecial(this.weapon);
                this.leave();
            }
            return;
        }
        if (this.state === 'close') {
            this.holder.scale.setScalar(Math.max(0.0001, (1 - this.t / 0.4) * SIZE));
            this.holder.rotation.y += dt * 8;
            if (this.t >= 0.4) {
                this.holder.visible = false;
                this.state = null;
                this.tower = -1;
                this.next = rand(BOX.every[0], BOX.every[1]);
            }
        }
    }

    // Se va (con o sin abrirla): da vueltas y se encoge en una nube de chispas
    leave() {
        const p = this.holder.position;
        this.sn.particles.burst(p.x, p.y + 0.5, p.z, 30, [0x9fdcff, 0xffffff, 0xfff3d6], { speed: 2.5, up: 3, size: 0.1, ttl: 0.7 });
        this.state = 'close';
        this.t = 0;
        for (const g of this.guns) g.visible = false;
        if (this.sn.hooks.onBox) this.sn.hooks.onBox('gone');
    }

    // ---------- Disparos de las armas de la caja (proyectiles) ----------
    // Sale de la boca hacia donde se apunta y revienta donde da (blancos, alienígenas, ovnis o
    // el suelo). El virote de la ballesta se clava, pita y revienta a los fuse s
    launch(w, origin, dir, muzzle) {
        const sn = this.sn, f = sn.field;
        const hits = f.raycast(origin, dir), ufo = sn.flyers.hit(origin, dir), alien = sn.walkers.hit(origin, dir);
        let t = dir.y < -1e-3 ? Math.min(80, -origin.y / dir.y) : 80, flyer = null;
        if (hits.length) t = Math.min(t, hits[0].t);
        if (alien) t = Math.min(t, alien.t);
        if (ufo && ufo.t < t) {
            t = ufo.t;
            flyer = ufo.flyer;
        }
        const to = origin.clone().addScaledVector(dir, t), g = new THREE.Group();
        if (w.mode === 'rocket') {
            this.part(g, 0.14, 0.14, 0.5, 0x6a7a5a);
            this.part(g, 0.1, 0.1, 0.12, 0xc8402e, 0, 0, -0.3);
            for (const r of [0, Math.PI / 2]) this.part(g, 0.3, 0.03, 0.12, 0x3a3a3a, 0, 0, 0.22).rotation.z = r;
        } else if (w.mode === 'ray') {
            const b = new THREE.Mesh(box(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({ color: 0x7dff4a }));
            const c = new THREE.Mesh(box(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            g.add(b, c);
            b.rotation.set(0.6, 0.6, 0);
        } else {
            this.part(g, 0.04, 0.04, 0.7, 0x7a4f2a);
            this.part(g, 0.1, 0.1, 0.12, 0xc8402e, 0, 0, -0.36);
        }
        g.position.copy(muzzle);
        g.lookAt(to);
        g.rotateY(Math.PI); // (las piezas miran a -z)
        this.root.add(g);
        this.shots.push({ w, mesh: g, from: muzzle.clone(), to, len: muzzle.distanceTo(to), d: 0, flyer, fuse: -1, trail: 0 });
    }

    part(g, w, h, d, color, x = 0, y = 0, z = 0) {
        const m = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color }));
        m.scale.set(w, h, d);
        m.position.set(x, y, z);
        g.add(m);
        return m;
    }

    updateShots(dt) {
        const sn = this.sn;
        this.shots = this.shots.filter((s) => {
            const p = s.mesh.position;
            if (s.fuse >= 0) {
                // Virote clavado: parpadea y pita hasta reventar
                s.fuse -= dt;
                s.mesh.visible = Math.sin(s.fuse * 30) > -0.3;
                if (s.fuse > 0) return true;
                this.boom(s);
                return false;
            }
            s.d = Math.min(s.len, s.d + s.w.speed * dt);
            p.lerpVectors(s.from, s.to, s.d / (s.len || 1));
            if (s.w.mode === 'ray') s.mesh.rotation.z += dt * 12;
            if ((s.trail -= dt) <= 0) {
                s.trail = 0.02;
                const cols = s.w.mode === 'ray' ? GREEN : s.w.mode === 'rocket' ? [0xffe03a, 0xff9a1f, 0x7a7068] : [0xc8c0b0];
                sn.particles.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.1 + Math.random() * 0.1, 0.4, cols[(Math.random() * cols.length) | 0], -0.5);
            }
            if (s.d < s.len) return true;
            if (s.w.mode === 'bolt') {
                s.fuse = s.w.fuse;
                sn.hooks.sfx.play('tick');
                return true;
            }
            this.boom(s);
            return false;
        });
    }

    // ¡Pum! Donde llegó: si era un ovni, cae; y en el suelo, la explosión que recoge lo de
    // alrededor y abate a los alienígenas (verde la de la pistola de rayos)
    boom(s) {
        const sn = this.sn, p = s.mesh.position;
        this.root.remove(s.mesh);
        if (s.flyer && !s.flyer.falling) {
            sn.flyers.shoot(s.flyer);
            if (sn.hooks.onHitMarker) sn.hooks.onHitMarker();
        }
        if (s.w.mode === 'ray') sn.particles.burst(p.x, Math.max(0.3, p.y), p.z, 40, GREEN, { speed: 5, up: 4, size: 0.12, ttl: 0.6 });
        else sn.particles.burst(p.x, Math.max(0.3, p.y), p.z, 30, FIRE, { speed: 6, up: 5, size: 0.14, ttl: 0.6 });
        sn.blast(p.x, p.z, s.w.radius, s.w.mode === 'rocket' ? 1.3 : 0.8);
    }
}

// Rayo contra caja alineada con los ejes (método de las franjas). Devuelve t o null.
function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    for (const [oa, da, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
        if (Math.abs(da) < 1e-9) {
            if (oa < lo || oa > hi) return null;
            continue;
        }
        let t0 = (lo - oa) / da, t1 = (hi - oa) / da;
        if (t0 > t1) [t0, t1] = [t1, t0];
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmin > tmax) return null;
    }
    return tmin;
}
