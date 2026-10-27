import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { KS } from '../content/killstreaks.js';

const FIRE = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a];
const SMOKE = [0x5a5048, 0x7a7068, 0x3a302a, 0x9a9088];

// Materiales por color, compartidos (las bombas salen a decenas)
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);

// Caja con su contorno de tinta (las piezas de la granada, las bombas y el avión)
function hulled(parent, ink, w, h, d, color, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(box(1, 1, 1), mat(color));
    m.scale.set(w, h, d);
    const o = new THREE.Mesh(box(1, 1, 1), ink);
    o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
    g.add(m, o);
    g.position.set(x, y, z);
    parent.add(g);
    return g;
}

// Recompensas de las rachas de bajas, en el campo de tiro:
//   granada    sale de la torre en arco hacia el montón de blancos más gordo y revienta
//   predator   la vista pasa a ser cenital: el misil baja solo, se guía mirando y se acelera
//              con el gatillo; al tocar el suelo explota (el francotirador no responde mientras)
//   bombardero un avión enorme cruza el campo soltando bombas; se sigue disparando a la vez
//   nuke       cuenta atrás de 5 s y una explosión que lo recoge todo
export class Killstreaks {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.ink = outline(sniper.theme.outline);
        this.grenades = [];
        this.bombs = [];
        this.plane = null;
        this.predator = null;
        this.nuke = null;
    }

    // La barra de la racha no baja mientras se guía el misil o cuenta la bomba nuclear
    get paused() {
        return !!this.predator || (!!this.nuke && this.nuke.boom < 0);
    }

    // Con la bomba nuclear en cuenta atrás el campo no se da por terminado aunque se vacíe
    get holdsEnd() {
        return !!this.nuke && this.nuke.boom < 0;
    }

    trigger(id) {
        const { hooks } = this.sn;
        if (hooks.onMedal) hooks.onMedal({ reward: id });
        if (id === 'nuke') return this.startNuke();
        if (this.sn.field.remaining === 0) return; // ya no queda nada que recoger
        if (id === 'grenade') this.throwGrenade();
        else if (id === 'predator') this.startPredator();
        else if (id === 'bomber') this.callBomber();
    }

    // El blanco vivo con más vecinos a menos de r (donde más se recoge de una vez). inView: si hay
    // alguno dentro de la vista, solo entre esos (la granada se ve volar hasta él)
    bestSpot(r, inView = false) {
        const alive = this.sn.field.targets.filter((s) => s.alive && s.landed);
        let pool = alive;
        if (inView) {
            const cam = this.sn.camera, v = new THREE.Vector3();
            cam.updateMatrixWorld();
            const seen = alive.filter((s) => {
                v.set(s.x, s.y, s.z).project(cam);
                return v.z < 1 && Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.8;
            });
            if (seen.length) pool = seen;
        }
        let best = null, bestN = -1;
        for (const s of pool) {
            const n = alive.reduce((k, o) => k + (Math.hypot(o.x - s.x, o.z - s.z) <= r ? 1 : 0), 0);
            if (n > bestN) [best, bestN] = [s, n];
        }
        return best;
    }

    // ---------- Granada ----------
    // Sale de delante de la cámara, abajo a la derecha (como lanzada con la mano) para que se vea
    // salir; es gorda, brilla en amarillo y deja estela de humo y chispas
    throwGrenade() {
        const t = this.bestSpot(KS.grenade.radius, true);
        if (!t) return;
        const g = new THREE.Group();
        hulled(g, this.ink, 0.42, 0.52, 0.42, 0x5a7a3a);
        hulled(g, this.ink, 0.44, 0.08, 0.44, 0x3a5a2a, 0, -0.06, 0);
        hulled(g, this.ink, 0.16, 0.12, 0.22, 0xc8c0b0, 0, 0.32, 0.05);
        const glow = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffe03a, side: THREE.BackSide }));
        glow.scale.set(0.62, 0.72, 0.62);
        g.add(glow);
        this.root.add(g);
        const cam = this.sn.camera;
        cam.updateMatrixWorld();
        const from = cam.getWorldPosition(new THREE.Vector3())
            .addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 2.4)
            .addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), 0.2)
            .addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), -0.4);
        // Arco bajo: así no se sale por arriba de la pantalla
        const arc = Math.min(KS.grenade.arc, 1.2 + Math.hypot(t.x - from.x, t.z - from.z) * 0.08);
        this.grenades.push({ obj: g, glow, from, x: t.x, z: t.z, t: 0, arc, trail: 0 });
        this.sn.hooks.sfx.play('grenade');
    }

    // ---------- Misil Predator ----------
    startPredator() {
        if (this.predator) return;
        const sn = this.sn, c = this.bestSpot(KS.predator.radius) || { x: sn.field.cx, z: sn.field.cz };
        sn.setAds(false);
        sn.pending = false;
        this.predator = { x: c.x, z: c.z, y: KS.predator.height, boost: false, boom: -1, yaw: sn.lookYaw };
        sn.hooks.sfx.play('missile');
        if (sn.hooks.onPredator) sn.hooks.onPredator(true);
    }

    // Guiar el misil: lo que se gira la vista mueve el punto de impacto (más fino al acercarse)
    steer(dx, dy, rate) {
        const p = this.predator;
        if (!p || p.boom >= 0) return;
        const k = rate * KS.predator.steer * (0.35 + 0.65 * (p.y / KS.predator.height));
        const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        const f = this.sn.field, xs = f.poly.map((q) => q.x), zs = f.poly.map((q) => q.z);
        p.x = Math.min(Math.max(...xs) + 4, Math.max(Math.min(...xs) - 4, p.x + (rx * dx - fx * dy) * k));
        p.z = Math.min(Math.max(...zs) + 4, Math.max(Math.min(...zs) - 4, p.z + (rz * dx - fz * dy) * k));
    }

    boost() {
        const p = this.predator;
        if (!p || p.boost || p.boom >= 0) return;
        p.boost = true;
        this.sn.hooks.sfx.play('boost');
    }

    endPredator() {
        if (!this.predator) return;
        this.predator = null;
        if (this.sn.hooks.onPredator) this.sn.hooks.onPredator(false);
    }

    // Cámara del misil: mirando hacia abajo, con el norte de la vista hacia donde miraba el tirador
    aimCamera(camera) {
        const p = this.predator;
        const rise = p.boom >= 0 ? 3 + p.boom * 10 : 0; // tras el impacto se ve la explosión desde arriba
        camera.position.set(p.x, Math.max(5, p.y) + rise, p.z); // sin meterse entre las matas
        camera.rotation.set(-Math.PI / 2 + 0.001, p.yaw, 0);
        camera.fov = 70;
        camera.updateProjectionMatrix();
    }

    // ---------- Bombardero ----------
    buildPlane() {
        const g = new THREE.Group(), ink = this.ink, OL = 0x6a7a5a, DK = 0x4a5a3e;
        hulled(g, ink, 1.6, 1.5, 9.5, OL);
        hulled(g, ink, 1.2, 1.0, 1.2, 0x9fdcff, 0, 0.35, 5.0);   // morro acristalado
        hulled(g, ink, 14, 0.28, 2.3, OL, 0, 0.1, 0.8);          // alas
        hulled(g, ink, 4.8, 0.22, 1.3, DK, 0, 0.3, -4.3);        // estabilizador
        hulled(g, ink, 0.24, 2.2, 1.5, DK, 0, 1.4, -4.2);        // deriva
        hulled(g, ink, 1.0, 0.5, 2.4, DK, 0, -0.85, 0.6);        // compuerta de bombas
        g.userData.props = [];
        for (const x of [-4.8, -2.5, 2.5, 4.8]) {
            hulled(g, ink, 0.75, 0.75, 1.6, DK, x, -0.1, 1.3);
            const prop = hulled(g, ink, 2.0, 0.14, 0.08, 0x2a2a2a, x, -0.1, 2.2);
            g.userData.props.push(prop);
        }
        // Escarapelas en las alas
        for (const x of [-5.5, 5.5]) hulled(g, ink, 1.0, 0.04, 1.0, 0xffffff, x, 0.26, 0.8).add(new THREE.Mesh(box(0.55, 0.06, 0.55), mat(0xc8402e)));
        g.scale.setScalar(1.25);
        return g;
    }

    callBomber() {
        if (this.plane) return;
        const f = this.sn.field, a = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const model = this.buildPlane();
        model.rotation.y = a;
        this.root.add(model);
        const half = 40 + f.radius;
        this.plane = { model, dir, x0: f.cx - dir.x * half, z0: f.cz - dir.z * half, dist: 0, len: half * 2, drop: 0 };
        this.sn.hooks.sfx.play('plane');
    }

    // ---------- Bomba nuclear ----------
    startNuke() {
        if (this.nuke) return;
        this.nuke = { t: KS.nuke.countdown, boom: -1, sec: 0 };
    }

    detonate() {
        const sn = this.sn, f = sn.field, N = this.nuke;
        N.boom = 0;
        // Bola de fuego gigante en el centro del campo: cubos anidados, de blanco a rojo
        N.ball = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a].map((c, i) => {
            const m = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false }));
            m.position.set(f.cx, 2, f.cz);
            m.renderOrder = 10 - i;
            this.root.add(m);
            return m;
        });
        const P = sn.particles;
        P.burst(f.cx, 2, f.cz, 500, FIRE, { speed: 40, up: 20, size: 1.2, ttl: 1.6, grav: 2 });
        P.burst(f.cx, 4, f.cz, 400, SMOKE, { speed: 10, up: 22, size: 2.6, ttl: 5, grav: -3 });
        P.burst(f.cx, 0.5, f.cz, 400, [sn.theme.dust, 0x8a5a34], { speed: 45, up: 2, size: 0.9, ttl: 2, grav: 1 });
        for (const [r, ttl, col] of [[20, 0.5, 0xffffff], [40, 1, 0xffe03a], [70, 1.6, 0xff9a1f], [100, 2.4, 0xfff3d6]]) sn.waves.spawn(f.cx, f.cz, col, r, ttl);
        sn.trauma = 1;
        sn.hooks.sfx.play('nuke');
        if (sn.hooks.onNuke) sn.hooks.onNuke();
        // Todo lo que queda en el campo, recogido
        const all = f.targets.filter((s) => s.alive);
        for (const s of all) s.landed = true;
        if (all.length) sn.harvest(all);
        if (f.remaining === 0 && sn.ending < 0) sn.finish();
    }

    update(dt, rawDt) {
        const sn = this.sn;
        // Granadas en vuelo: arco, giro, brillo que late y estela
        this.grenades = this.grenades.filter((g) => {
            g.t += dt;
            const k = Math.min(1, g.t / KS.grenade.flight);
            const o = g.obj.position;
            o.set(g.from.x + (g.x - g.from.x) * k, g.from.y + (0.25 - g.from.y) * k + Math.sin(k * Math.PI) * g.arc, g.from.z + (g.z - g.from.z) * k);
            g.obj.rotation.set(g.t * 9, g.t * 4, 0);
            g.glow.scale.setScalar(0.62 + Math.abs(Math.sin(g.t * 14)) * 0.18);
            if ((g.trail -= dt) <= 0) {
                g.trail = 0.025;
                sn.particles.spawn(o.x, o.y, o.z, (Math.random() - 0.5) * 0.3, 0.4, (Math.random() - 0.5) * 0.3, 0.16 + Math.random() * 0.1, 0.7, Math.random() < 0.65 ? SMOKE[(Math.random() * 3) | 0] : 0xffe03a, -0.5);
            }
            if (k < 1) return true;
            g.glow.material.dispose();
            this.root.remove(g.obj);
            sn.blast(g.x, g.z, KS.grenade.radius, 0.7);
            return false;
        });
        // Misil: baja, y al llegar al suelo, ¡boom!
        const p = this.predator;
        if (p) {
            if (p.boom < 0) {
                p.y -= (p.boost ? KS.predator.boost : KS.predator.speed) * rawDt;
                if (p.y <= 0.6) {
                    p.boom = 0;
                    sn.blast(p.x, p.z, KS.predator.radius, 1.8);
                }
            } else if ((p.boom += rawDt) > 1.4) this.endPredator();
        }
        // Bombardero y sus bombas
        const pl = this.plane;
        if (pl) {
            pl.dist += KS.bomber.speed * dt;
            const x = pl.x0 + pl.dir.x * pl.dist, z = pl.z0 + pl.dir.z * pl.dist;
            pl.model.position.set(x, KS.bomber.height, z);
            for (const pr of pl.model.userData.props) pr.rotation.z += rawDt * 40;
            // Suelta bombas mientras pasa por encima del campo (contando lo que avanzan al caer)
            const f = sn.field, ahead = KS.bomber.speed * 0.55;
            const over = Math.hypot(x + pl.dir.x * ahead - f.cx, z + pl.dir.z * ahead - f.cz) < f.radius * 0.95;
            if (over && (pl.drop -= dt) <= 0) {
                pl.drop = KS.bomber.every;
                const b = new THREE.Group();
                hulled(b, this.ink, 0.35, 0.35, 0.8, 0x3a3a34);
                b.position.set(x + (Math.random() - 0.5) * 1.5, KS.bomber.height - 1.2, z + (Math.random() - 0.5) * 1.5);
                b.rotation.y = pl.model.rotation.y;
                this.root.add(b);
                this.bombs.push({ obj: b, vx: pl.dir.x * KS.bomber.speed * 0.8, vz: pl.dir.z * KS.bomber.speed * 0.8, vy: 0 });
            }
            if (pl.dist >= pl.len) {
                this.root.remove(pl.model);
                this.plane = null;
            }
        }
        this.bombs = this.bombs.filter((b) => {
            b.vy -= 24 * dt;
            b.obj.position.x += b.vx * dt;
            b.obj.position.y += b.vy * dt;
            b.obj.position.z += b.vz * dt;
            b.obj.rotation.x = Math.min(1.4, b.obj.rotation.x + dt * 1.6); // el morro cae hacia abajo
            if (b.obj.position.y > 0.2) return true;
            this.root.remove(b.obj);
            sn.blast(b.obj.position.x, b.obj.position.z, KS.bomber.radius, 0.9);
            return false;
        });
        // Bomba nuclear: cuenta atrás, explosión y bola de fuego que lo llena todo
        const N = this.nuke;
        if (N) {
            if (N.boom < 0) {
                N.t -= rawDt;
                const sec = Math.max(0, Math.ceil(N.t));
                if (sec !== N.sec) {
                    N.sec = sec;
                    if (sn.hooks.onNukeCount) sn.hooks.onNukeCount(sec);
                    if (sec > 0) sn.hooks.sfx.play('siren');
                }
                if (N.t <= 0) this.detonate();
            } else {
                N.boom += rawDt;
                sn.trauma = Math.max(sn.trauma, Math.max(0, 1 - N.boom / 3));
                N.ball.forEach((m, i) => {
                    const grow = Math.min(1, N.boom / (0.5 + i * 0.15)), fade = Math.max(0, (N.boom - 1 - i * 0.2) / 1.6);
                    m.scale.setScalar(Math.max(0.0001, (4 + 46 * (1 - (1 - grow) ** 3)) * (0.55 + i * 0.15)));
                    m.material.opacity = Math.max(0, 1 - fade);
                    m.rotation.y += rawDt * (0.5 + i * 0.3);
                    m.visible = fade < 1;
                });
            }
        }
    }

    // Al terminar el campo: deja de guiarse el misil (lo demás sigue hasta salir)
    stopControl() {
        this.endPredator();
    }

    // Al salir del campo de tiro: fuera todo
    clear() {
        this.endPredator();
        for (const m of [...this.root.children]) this.root.remove(m);
        if (this.nuke && this.nuke.ball) for (const m of this.nuke.ball) m.material.dispose();
        this.grenades = [];
        this.bombs = [];
        this.plane = null;
        this.nuke = null;
    }
}
