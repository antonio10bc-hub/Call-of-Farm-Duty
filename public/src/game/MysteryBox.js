import * as THREE from 'three';
import { box, outline } from '../render/materials.js';
import { buildBox, buildWonder, boxIcon } from '../render/wonder.js';
import { BOX, WONDER } from '../content/mysterybox.js';

const rand = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();
const FIRE = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a];
const GREEN = [0xffffff, 0xd8ffb0, 0x7dff4a, 0x3ec82a];
const GOLD = [0xffffff, 0xfff3b0, 0xffe03a, 0xffb02a];
const BLUE = [0xffffff, 0x9fdcff, 0x5ab4ff];
const SIZE = 0.55; // la caja en su plataforma de la torre (más pequeña, para que quepa)
const GUN = 0.65;  // y las armas que giran encima (de cerca se verían enormes)

// La caja sorpresa en el campo de tiro (content/mysterybox.js) y los disparos de sus armas.
//   estados: null (no hay) → idle (esperando en su torre) → spin (abierta, las armas girando) →
//   give (el arma sube hacia ti) → close (se cierra y se va); si nadie la abre, se va sola.
// Sale en la plataforma pequeña de la barandilla izquierda de una torre (Tower: ledge). Al
// abrirse: fogonazo, onda, chispas y rayos de luz dorada que salen de dentro girando; al salir el
// arma que toca: otro estallido, el arma se hincha flotando y vuela hacia ti dejando estela.
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
        // Luz de dentro: rayos dorados en abanico que salen de la caja abierta (giran y laten) y
        // el resplandor de la boca de la caja; flare: el fogonazo blanco que se hincha y se apaga
        const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
        this.rays = new THREE.Group();
        this.rayMat = glow(0xffe9a0, 0);
        for (let i = 0; i < 9; i++) {
            const pivot = new THREE.Group(), m = new THREE.Mesh(box(0.16 + (i % 3) * 0.06, 3.2 + (i % 4) * 0.5, 0.03), this.rayMat);
            m.position.y = 1.6 + (i % 4) * 0.25;
            pivot.add(m);
            pivot.rotation.set(0, (i / 9) * Math.PI * 2, 0.25 + (i % 3) * 0.12);
            this.rays.add(pivot);
        }
        this.rays.position.y = 0.6;
        this.rays.visible = false;
        this.innerMat = glow(0xfff3b0, 0);
        this.inner = new THREE.Mesh(box(1.2, 0.08, 0.6), this.innerMat);
        this.inner.position.y = 0.62;
        this.flareMat = glow(0xffffff, 0);
        this.flare = new THREE.Mesh(box(1, 1, 1), this.flareMat);
        this.flare.position.y = 0.9;
        this.flare.visible = false;
        this.holder.add(this.rays, this.inner, this.flare);
        this.flareT = 0;
        this.root.add(this.holder);
        this.shots = []; // proyectiles en vuelo (cohetes, rayos, virotes)
        this.thrown = []; // armas de la caja gastadas, tiradas desde la torre
        this.reset();
    }

    reset() {
        this.state = null;
        this.holder.visible = false;
        this.next = rand(BOX.first[0], BOX.first[1]);
        this.tower = -1;
        for (const s of this.shots) this.root.remove(s.mesh, s.lamp, s.halo);
        this.shots = [];
        for (const o of this.thrown) this.root.remove(o.g);
        this.thrown = [];
        this.rays.visible = this.flare.visible = false;
        this.rayMat.opacity = this.innerMat.opacity = 0;
    }

    // Fogonazo (se hincha y se apaga), onda a la altura de la caja y chispas
    burst(n, colors, up = 4) {
        const p = this.holder.position, sn = this.sn;
        this.flareT = 0.35;
        sn.particles.burst(p.x, p.y + 0.6, p.z, n, colors, { speed: 2.5, up, size: 0.1, ttl: 0.7 });
        if (sn.waves) sn.waves.spawn(p.x, p.z, colors[1], 1.8, 0.45, p.y + 0.05);
    }

    // Aparece en una torre que no es la tuya: en la plataforma pequeña de su barandilla izquierda,
    // de cara a donde se pone el tirador, con su rayo de luz y su «?» encima
    spawn() {
        const sn = this.sn, f = sn.field, n = f.towers.length;
        const towers = [...Array(n).keys()].filter((i) => i !== sn.corner);
        const i = towers[(Math.random() * towers.length) | 0], t = f.towers[i], L = t.ledge;
        this.tower = i;
        this.holder.position.set(L.x, L.y, L.z);
        this.holder.rotation.y = Math.atan2(t.x - L.x, t.z - L.z); // (la tapa se abre hacia fuera)
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
        this.rays.visible = true;
        this.burst(28, BLUE.concat(GOLD), 4);
        this.sn.hooks.sfx.play('unlock');
        if (this.sn.hooks.flash) this.sn.hooks.flash(0xfff3b0, 0.12);
        if (this.sn.hooks.onBox) this.sn.hooks.onBox('open');
    }

    get weapon() {
        return WONDER[this.pick];
    }

    update(dt, time) {
        const sn = this.sn;
        this.updateShots(dt);
        this.updateThrown(dt);
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
        // El fogonazo: se hincha y se apaga
        this.flareT = Math.max(0, this.flareT - dt);
        this.flare.visible = this.flareT > 0;
        if (this.flare.visible) {
            const f = 1 - this.flareT / 0.35;
            this.flare.scale.setScalar(0.4 + f * 1.2);
            this.flareMat.opacity = (1 - f) * 0.35;
        }
        // Los rayos de luz de dentro: giran y laten (más fuertes según se acerca el arma que toca)
        if (this.rays.visible) {
            this.rays.rotation.y += dt * 1.6;
            const k3 = this.state === 'spin' ? Math.min(1, this.t / 0.4) * (0.55 + Math.min(1, this.t / BOX.spin) * 0.35) : this.state === 'give' ? Math.max(0, 1 - this.t / 0.9) : 0;
            this.rayMat.opacity = k3 * (0.17 + Math.sin(time * 10) * 0.05);
            this.innerMat.opacity = k3 * 0.6;
            this.rays.scale.set(1, 0.6 + k3 * 0.3 + Math.sin(time * 7) * 0.04, 1);
            if (this.state === 'spin' && Math.random() < dt * 10) {
                const p = this.holder.position;
                sn.particles.burst(p.x, p.y + 0.4, p.z, 2, GOLD, { speed: 0.6, up: 2.5, size: 0.07, ttl: 0.7 });
            }
        }
        // Ya en su torre, el «?» y el rayo sobran (estarían delante de los ojos)
        if (this.state === 'idle') this.beam.visible = this.icon.visible = !(sn.corner === this.tower && !sn.move);
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
                g.position.set(0, 0.6 + k2 * 0.75, 0); // (sube desde la boca de la caja)
                g.scale.setScalar(GUN);
                g.rotation.set(0, face + Math.PI / 2 + Math.sin(time * 2) * 0.25, 0);
            });
            if (this.t >= BOX.spin + 0.5) {
                // ¡La que toca! Estallido dorado y el arma se hincha
                this.state = 'give';
                this.t = 0;
                this.burst(34, GOLD, 5);
                sn.hooks.sfx.play('achievement');
            }
            return;
        }
        if (this.state === 'give') {
            // Flota hinchándose un momento (girando de cara a ti) y luego vuela hacia el tirador
            // dejando una estela dorada; al llegar, es suya
            const g = this.guns[this.pick], HOLD = 0.35, k = Math.min(1, this.t / HOLD), e = Math.min(1, Math.max(0, this.t - HOLD) / 0.45);
            g.scale.setScalar(GUN * (1 + Math.sin(k * Math.PI) * 0.35));
            this.holder.worldToLocal(_v.copy(sn.pos));
            _v.y -= 0.4 / SIZE; // (a las manos, no a los ojos)
            g.position.lerpVectors(new THREE.Vector3(0, 1.35 + k * 0.4, 0), _v, e * e);
            g.rotation.y += dt * (k < 1 ? 4 : 14);
            if (e > 0) {
                g.getWorldPosition(_v);
                sn.particles.burst(_v.x, _v.y, _v.z, 2, GOLD, { speed: 0.5, up: 0.3, size: 0.08, ttl: 0.4, grav: 0 });
            }
            if (e >= 1) {
                g.visible = false;
                g.scale.setScalar(GUN);
                sn.giveSpecial(this.weapon);
                if (sn.hooks.flash) sn.hooks.flash(0xfff3b0, 0.2);
                this.rays.visible = false;
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
        this.rays.visible = false;
        for (const g of this.guns) g.visible = false;
        if (this.sn.hooks.onBox) this.sn.hooks.onBox('gone');
    }

    // Sin munición: el arma de la caja sale volando de las manos (hacia delante y abajo, dando
    // vueltas), bota en el suelo y desaparece en una nube de humo
    throwAway(id) {
        const sn = this.sn, g = buildWonder(id, this.ink), cam = sn.camera;
        const fwd = cam.getWorldDirection(new THREE.Vector3()), right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
        g.scale.setScalar(0.5);
        g.position.copy(sn.pos).addScaledVector(fwd, 0.5).addScaledVector(right, 0.3).add(_v.set(0, -0.35, 0));
        g.quaternion.copy(cam.quaternion);
        this.root.add(g);
        const v = fwd.clone().setY(0).normalize().multiplyScalar(2.2).addScaledVector(right, 1.2).setY(2.6);
        this.thrown.push({ g, v, spin: new THREE.Vector3(rand(5, 9), rand(-4, 4), rand(3, 7)), t: 0, bounced: false });
    }

    updateThrown(dt) {
        const sn = this.sn;
        this.thrown = this.thrown.filter((o) => {
            o.t += dt;
            o.v.y -= 14 * dt;
            o.g.position.addScaledVector(o.v, dt);
            o.g.rotation.x += o.spin.x * dt;
            o.g.rotation.y += o.spin.y * dt;
            o.g.rotation.z += o.spin.z * dt;
            const p = o.g.position;
            if (p.y < 0.15 && o.v.y < 0) {
                p.y = 0.15;
                if (!o.bounced) {
                    // Bota una vez (con un golpe de polvo) y se queda en el suelo un momento
                    o.bounced = true;
                    o.v.multiplyScalar(0.35).setY(2.2);
                    o.spin.multiplyScalar(0.5);
                    sn.particles.burst(p.x, 0.2, p.z, 10, [sn.theme.dust, 0x8a7a5a], { speed: 1.5, up: 1.5, size: 0.1, ttl: 0.5 });
                    sn.hooks.sfx.play('metal');
                } else o.v.set(0, 0, 0), o.spin.set(0, 0, 0);
            }
            if (o.t < 2.2) return true;
            sn.particles.burst(p.x, p.y + 0.2, p.z, 18, [0x8a8a8a, 0x5a5a5a, 0xffffff], { speed: 1.2, up: 2, size: 0.18, ttl: 0.8, grav: -0.5 });
            this.root.remove(o.g);
            return false;
        });
    }

    // ---------- Disparos de las armas de la caja (proyectiles) ----------
    // Sale de la boca hacia donde se apunta y revienta donde da (blancos, alienígenas, ovnis o
    // el suelo). El virote de la ballesta se clava donde da (en un cultivo, en el suelo o en un
    // alienígena u ovni, y entonces va pegado a él: stick, con su punto off), pita y revienta a
    // los fuse s
    launch(w, origin, dir, muzzle) {
        const sn = this.sn, f = sn.field;
        const hits = f.raycast(origin, dir), ufo = sn.flyers.hit(origin, dir), alien = sn.walkers.hit(origin, dir);
        let t = dir.y < -1e-3 ? Math.min(80, -origin.y / dir.y) : 80, flyer = null, stick = null;
        if (hits.length) t = Math.min(t, hits[0].t);
        if (alien && alien.t < t) {
            t = alien.t;
            stick = alien.walker.g.position;
        }
        if (ufo && ufo.t < t) {
            t = ufo.t;
            flyer = ufo.flyer;
            stick = ufo.flyer.model.root.position;
        }
        const to = origin.clone().addScaledVector(dir, t), g = new THREE.Group();
        const off = stick ? to.clone().sub(stick) : null;
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
        this.shots.push({ w, mesh: g, from: muzzle.clone(), to, len: muzzle.distanceTo(to), d: 0, flyer, stick, off, fuse: -1, trail: 0 });
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
                // Virote clavado: su lucecita roja (se ve hasta entre los cultivos) parpadea y pita,
                // cada vez más deprisa, hasta reventar. Clavado en un alienígena o un ovni, va con él
                s.fuse -= dt;
                if (s.stick) {
                    p.copy(s.stick).add(s.off);
                    s.lamp.position.copy(p).y += 0.15;
                    s.halo.position.copy(s.lamp.position);
                }
                const left = s.fuse / s.w.fuse, on = Math.sin((1 - left) * (1 - left) * 70 + (1 - left) * 18) > 0;
                if (on && !s.on) sn.hooks.sfx.play('tick');
                s.on = on;
                s.lamp.visible = s.halo.visible = on;
                s.halo.scale.setScalar(0.4 + (1 - left) * 0.35);
                if (s.fuse > 0) return true;
                this.root.remove(s.lamp, s.halo);
                this.boom(s);
                return false;
            }
            // (si va a por algo que se mueve, el punto al que va se mueve con ello)
            if (s.stick) {
                s.to.copy(s.stick).add(s.off);
                s.len = s.from.distanceTo(s.to);
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
                // Se clava: le sale la lucecita (la luz y su halo, por encima de todo)
                s.fuse = s.w.fuse;
                const top = { depthTest: false, depthWrite: false, transparent: true };
                s.lamp = new THREE.Mesh(box(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3e1a, ...top }));
                s.halo = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff3e1a, opacity: 0.35, blending: THREE.AdditiveBlending, ...top }));
                for (const m of [s.lamp, s.halo]) {
                    m.position.copy(p).y += 0.15;
                    m.renderOrder = 5;
                    this.root.add(m);
                }
                sn.particles.burst(p.x, p.y, p.z, 6, [0xc8c0b0, sn.theme.dust], { speed: 1, up: 1, size: 0.06, ttl: 0.3 });
                sn.hooks.sfx.play('crateHit'); // (¡chac!: clavado)
                if (s.stick && sn.hooks.onHitMarker) sn.hooks.onHitMarker();
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
