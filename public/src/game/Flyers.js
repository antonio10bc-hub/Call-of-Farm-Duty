import * as THREE from 'three';
import { Ufo } from '../render/structures.js';
import { box, toon } from '../render/materials.js';
import { UFO } from '../content/ufo.js';
import { CROPS } from '../content/crops.js';

const F = UFO.flyer, B = F.beam;
const SPARKS = [0xffffff, 0xffe03a, 0x7dff4a, 0x9fdcff];
const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
// De noche brillan su cúpula, sus luces y la panza (color de la pieza → luz que echa)
const GLOW = [[0x9fdcff, 0x5aa8ff], [0xc4ecff, 0x9fdcff], [0xffe03a, 0xffe03a], [0xff3e5e, 0xff3e5e], [0x7dff4a, 0x3ec82a], [0x4a5868, 0x2a5a9a]];
// El rayo: un cono de luz verde (hexagonal, como todo de cubos) y otro más fino y brillante dentro
const BEAM_GEO = new THREE.CylinderGeometry(0.45, B.radius, 1, 6, 1, true);
const CORE_GEO = new THREE.CylinderGeometry(0.2, B.radius * 0.45, 1, 6, 1, true);

// Ovnis pequeños en el campo de tiro: de vez en cuando cruza uno el cielo, bamboleándose. Algunos
// (thief) son ladrones: se paran encima de la zona con más cultivos, bajan y echan su rayo, que
// absorbe todo lo que pilla debajo (se ve subir girando hasta la nave); luego se van con ello. Si
// se le da, cae en barrena echando chispas y, al tocar el suelo, suelta monedas alienígenas
// (hooks.onUfoCoin); lo que se llevaba se recupera (hooks.onHit) y si escapa, se pierde
// (hooks.onStolen). También suma a la racha alienígena. De noche brillan. Su caja de impacto es
// una esfera (radius).
export class Flyers {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.list = [];
        this.reset();
    }

    // Fuera de la escena y sus materiales liberados (con su rayo y lo que se llevaba)
    drop(fl) {
        this.root.remove(fl.model.root);
        for (const m of fl.model.materials) m.dispose();
        this.endBeam(fl);
        for (const c of fl.cubes) this.root.remove(c.mesh);
        fl.cubes = [];
    }

    reset() {
        for (const f of this.list) this.drop(f);
        this.list = [];
        this.next = rand(F.min, F.max);
    }

    // ¿Alguno se lleva algo? (el campo no se da por terminado mientras tanto)
    get carrying() {
        return this.list.some((fl) => !fl.falling && fl.loot.length > 0);
    }

    // Uno nuevo cruzando el campo por encima, en una dirección al azar. Los ladrones pasan justo
    // por encima de la zona con más cultivos (y ahí se paran)
    spawn(thief = !!this.sn.crop && Math.random() < F.thief) {
        const f = this.sn.field, a = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const half = f.radius + 25, y = rand(F.height[0], F.height[1]);
        const model = new Ufo(this.sn.theme.outline, true);
        model.root.scale.setScalar(0.35);
        this.root.add(model.root);
        const spot = thief ? this.sn.ks.bestSpot(B.radius) : null;
        const side = (Math.random() - 0.5) * f.radius;
        const cx = spot ? spot.x : f.cx + dir.z * side, cz = spot ? spot.z : f.cz - dir.x * side;
        const fl = {
            model, dir, y, len: half * 2, dist: 0, ph: Math.random() * 6, falling: false, vy: 0, spin: 0,
            x0: cx - dir.x * half, z0: cz - dir.z * half,
            spot: spot ? { x: spot.x, z: spot.z } : null, mode: 'fly', low: 0, beamT: 0, beam: null, loot: [], cubes: [],
        };
        this.list.push(fl);
        this.place(fl, 0);
        return fl;
    }

    place(fl, time) {
        const p = fl.model.root.position;
        const y = fl.y + (B.height - fl.y) * fl.low; // baja para echar el rayo
        p.set(fl.x0 + fl.dir.x * fl.dist, y + Math.sin(time * 2 + fl.ph) * 0.4 * (1 - fl.low * 0.7), fl.z0 + fl.dir.z * fl.dist);
    }

    // El más cercano de los que vuelan en la línea de tiro: { flyer, t } o null
    hit(origin, dir) {
        let best = null;
        for (const fl of this.list) {
            if (fl.falling) continue;
            const c = fl.model.root.position;
            _v.subVectors(c, origin);
            const tca = _v.dot(dir);
            if (tca < 0) continue;
            const d2 = _v.lengthSq() - tca * tca;
            if (d2 > F.radius * F.radius) continue;
            const t = tca - Math.sqrt(F.radius * F.radius - d2);
            if (!best || t < best.t) best = { flyer: fl, t };
        }
        return best;
    }

    // Derribado: chispazo, humo y a caer dando vueltas. Lo que se llevaba se recupera
    shoot(fl) {
        const p = fl.model.root.position, sn = this.sn;
        fl.falling = true;
        fl.vy = 2;
        fl.spin = 9;
        sn.particles.burst(p.x, p.y, p.z, 40, SPARKS, { speed: 4, up: 3, size: 0.12, ttl: 0.7 });
        sn.hooks.sfx.play('crateHit');
        sn.hooks.sfx.play('shieldGet');
        this.endBeam(fl);
        if (fl.loot.length) {
            const C = CROPS[sn.crop] || CROPS.wheat;
            sn.particles.burst(p.x, p.y, p.z, 50, C.burst, { speed: 4, up: 2, size: 0.1, ttl: 1 });
            _v.copy(p).project(sn.camera);
            for (const s of fl.loot) if (sn.hooks.onHit) sn.hooks.onHit(s, _v.x, _v.y);
            fl.loot = [];
            for (const c of fl.cubes) this.root.remove(c.mesh);
            fl.cubes = [];
        }
        sn.addAlien(1); // también cuenta para la racha alienígena
    }

    // El rayo: se enciende y absorbe lo que hay debajo (como mucho B.max, de lo más cerca a lo más
    // lejos), que sube girando hasta la nave
    startBeam(fl) {
        const sn = this.sn, f = sn.field, S = fl.spot;
        const near = f.targets.filter((s) => s.alive && s.landed && Math.hypot(s.x - S.x, s.z - S.z) <= B.radius)
            .sort((a, b) => Math.hypot(a.x - S.x, a.z - S.z) - Math.hypot(b.x - S.x, b.z - S.z)).slice(0, B.max);
        if (!near.length) {
            fl.mode = 'leave';
            return;
        }
        const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const g = new THREE.Group();
        g.add(new THREE.Mesh(BEAM_GEO, mat(0x7dff4a, 0.22)), new THREE.Mesh(CORE_GEO, mat(0xd8ffb0, 0.3)));
        g.position.set(S.x, 0, S.z);
        this.root.add(g);
        fl.beam = g;
        fl.mode = 'beam';
        fl.beamT = B.time;
        sn.waves.spawn(S.x, S.z, 0x7dff4a, B.radius * 1.3, 0.5);
        sn.hooks.sfx.play('ufo');
        const C = CROPS[sn.crop] || CROPS.wheat, cubeMat = toon(C.loot || C.fruit || 0xffd23f);
        near.forEach((s, k) => {
            s.alive = false;
            s.dying = 0.2;
            s.flash = 1;
            fl.loot.push(s);
            const mesh = new THREE.Mesh(box(0.34, 0.34, 0.34), cubeMat);
            mesh.position.set(s.x, s.y, s.z);
            mesh.visible = false;
            this.root.add(mesh);
            fl.cubes.push({ mesh, from: new THREE.Vector3(s.x, s.y, s.z), t: -k * 0.18 });
        });
    }

    endBeam(fl) {
        if (!fl.beam) return;
        this.root.remove(fl.beam);
        for (const m of fl.beam.children) m.material.dispose();
        fl.beam = null;
    }

    update(dt, time) {
        const sn = this.sn, k = sn.nightK || 0;
        if (!sn.calm && !sn.unlocking && sn.ending < 0 && (this.next -= dt) <= 0) {
            this.next = rand(F.min, F.max);
            this.spawn();
            sn.hooks.sfx.play('radar');
        }
        this.list = this.list.filter((fl) => {
            const r = fl.model.root;
            fl.model.update(dt, time);
            for (const [c, e] of GLOW) {
                const m = fl.model.mats.get(c);
                if (m) m.emissive.setHex(e).multiplyScalar(k * 0.8);
            }
            if (!fl.falling) {
                if (fl.mode === 'beam') this.beaming(fl, dt, time);
                else if (fl.spot && fl.mode === 'fly' && fl.dist >= fl.len / 2) {
                    // Ladrón: al llegar encima de su zona se para y baja; luego echa el rayo
                    fl.dist = fl.len / 2;
                    fl.low = Math.min(1, fl.low + dt * 1.2);
                    if (fl.low >= 1) this.startBeam(fl);
                } else {
                    fl.dist += F.speed * dt;
                    fl.low = Math.max(0, fl.low - dt * 0.8); // al irse, vuelve a subir
                }
                this.place(fl, time);
                r.rotation.set(Math.sin(time * 1.6 + fl.ph) * 0.15 * (1 - fl.low), time * 3, Math.cos(time * 1.3 + fl.ph) * 0.15 * (1 - fl.low));
                this.updateCubes(fl, dt);
                if (fl.dist < fl.len) return true;
                // Se ha ido: si se llevaba algo, se pierde
                if (fl.loot.length && sn.hooks.onStolen) {
                    _v.copy(r.position).project(sn.camera);
                    sn.hooks.onStolen(fl.loot[0], _v.x, _v.y, fl.loot.length);
                }
                fl.loot = [];
                this.drop(fl);
                return false;
            }
            // Cayendo en barrena, con humo y chispas
            fl.vy -= 14 * dt;
            r.position.y += fl.vy * dt;
            r.position.x += fl.dir.x * F.speed * 0.5 * dt;
            r.position.z += fl.dir.z * F.speed * 0.5 * dt;
            r.rotation.x += fl.spin * dt;
            r.rotation.z += fl.spin * 0.6 * dt;
            if (Math.random() < 0.6) sn.particles.spawn(r.position.x, r.position.y, r.position.z, 0, 0.5, 0, 0.18 + Math.random() * 0.12, 0.8, Math.random() < 0.3 ? 0xffe03a : 0x5a5048, -0.5);
            if (r.position.y > 0.3) return true;
            // En el suelo: pum y la moneda
            sn.particles.burst(r.position.x, 0.3, r.position.z, 50, [0xffffff, 0xffe03a, 0xff9a1f, 0x7dff4a], { speed: 5, up: 5, size: 0.2, ttl: 0.8 });
            sn.waves.spawn(r.position.x, r.position.z, 0x7dff4a, 2.4, 0.5);
            sn.hooks.sfx.play('boom');
            _v.copy(r.position).project(sn.camera);
            if (sn.hooks.onUfoCoin) sn.hooks.onUfoCoin(F.coins, _v.x, _v.y);
            this.drop(fl);
            return false;
        });
    }

    // Con el rayo encendido: late, chispas verdes que suben por él y, al acabar, se apaga y se va
    beaming(fl, dt, time) {
        const sn = this.sn, h = fl.model.root.position.y;
        fl.beam.scale.set(1, Math.max(0.01, h - 0.3), 1);
        fl.beam.position.y = (h - 0.3) / 2;
        fl.beam.children[0].material.opacity = 0.18 + Math.sin(time * 12) * 0.06;
        fl.beam.children[1].material.opacity = 0.25 + Math.sin(time * 17 + 1) * 0.08;
        fl.beam.rotation.y += dt * 2;
        if (Math.random() < dt * 30) {
            const a = Math.random() * Math.PI * 2, d = Math.random() * B.radius;
            sn.particles.spawn(fl.spot.x + Math.sin(a) * d, 0.2, fl.spot.z + Math.cos(a) * d, 0, 3 + Math.random() * 2, 0, 0.08 + Math.random() * 0.06, 1, Math.random() < 0.5 ? 0x7dff4a : 0xd8ffb0, -1);
        }
        if ((fl.beamT -= dt) > 0) return;
        this.endBeam(fl);
        fl.mode = 'leave';
    }

    // Lo absorbido sube girando por el rayo hasta la nave y se mete dentro
    updateCubes(fl, dt) {
        const to = fl.model.root.position;
        fl.cubes = fl.cubes.filter((c) => {
            c.t += dt;
            if (c.t < 0) return true;
            const k = Math.min(1, c.t / 1.3), e = k * k;
            c.mesh.visible = true;
            c.mesh.position.lerpVectors(c.from, to, e);
            c.mesh.position.x += Math.sin(c.t * 6) * 0.2 * (1 - k);
            c.mesh.rotation.set(c.t * 5, c.t * 7, 0);
            c.mesh.scale.setScalar(Math.max(0.0001, 1 - Math.max(0, k - 0.75) * 4));
            if (k < 1) return true;
            this.root.remove(c.mesh);
            return false;
        });
    }
}
