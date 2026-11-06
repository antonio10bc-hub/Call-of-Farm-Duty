import * as THREE from 'three';
import { box, toon } from '../render/materials.js';
import { Particles } from '../render/Particles.js';
import { MagicWheat } from '../render/magicWheat.js';
import { RifleModel } from '../render/RifleModel.js';
import { L } from '../core/I18n.js';
import { vibrate } from '../core/Haptics.js';

const _v = new THREE.Vector3();
const _c = new THREE.Color();
const ease = (k) => k * k * (3 - 2 * k);
const RAINBOW = [0xff3e5e, 0xff9a1f, 0xffe03a, 0x7dff4a, 0x23e0d6, 0x7b5cff, 0xffffff];

export const LINES = {
    lifetime: L('IF YOU KEEP GOING LIKE THIS, HARVESTING ALL THIS WHEAT IS IMPOSSIBLE. IT WILL TAKE YOU A LIFETIME.', 'SI SIGUES ASÍ, RECOLECTAR TODO ESTE TRIGO ES IMPOSIBLE. ESTO TE LLEVARÁ TODA UNA VIDA.'),
    come: L('COME. LET ME OPEN YOUR EYES.', 'VEN, QUE TE ABRO LOS OJOS.'),
    eyes: L('LET ME OPEN YOUR EYES.', 'DEJA QUE TE ABRA LOS OJOS.'),
    better: L('THERE IS A MUCH MORE EFFICIENT WAY TO HARVEST YOUR CROPS.', 'HAY UNA FORMA MUCHO MÁS EFICIENTE DE RECOLECTAR TUS CULTIVOS.'),
    show: L('LET ME SHOW YOU.', 'DÉJAME QUE TE LO MUESTRE.'),
    take: L('TAKE THIS. IT WILL COME IN HANDY.', 'TOMA ESTO. TE SERÁ ÚTIL.'),
    aim: L('NOW AIM AT ME.', 'AHORA, APÚNTAME.'),
    remember: L("DON'T FORGET WHAT I TAUGHT YOU.", 'NO OLVIDES LO QUE TE HE ENSEÑADO.'),
    luck: L('NOW YOU ONLY HAVE YOURSELF. GOOD LUCK.', 'AHORA SOLO DEPENDES DE TI MISMO. BUENA SUERTE.'),
};

// El prólogo: un vistazo a lo que será el juego antes de empezar de cero.
//   field  en primera persona en un campo de trigo enorme: se recogen dos matas a mano; aparece
//          el trigo mágico y, al ir a cogerlo, habla
//   space  en el espacio: tú (un ente blanco y brillante) frente al trigo mágico, con la cámara
//          girando alrededor; habla y todo se funde en blanco
//   tower  en la torre del campo de tiro (con el francotirador): el trigo te da el rifle y te
//          pide que le apuntes; al darle, cinemática con todas las granadas, el bombardero y la
//          bomba nuclear, y fundido en blanco
//   map    en el mapa de la granja (todo bloqueado): se despide y se va; vuelve el control
// hooks: { sfx, say(text|null), prompt(text|null), flash(color, k), enterTower(), toMap(), done(),
//          popPlus(x, y), lights(scene) }
export class Prologue {
    constructor(theme, sniper, farm, hooks) {
        this.theme = theme;
        this.sn = sniper;
        this.farm = farm;
        this.hooks = hooks;
        this.phase = null;
        this.locked = true;
        this.t = 0;
        this.queue = [];
        this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 600);
        this.camera.rotation.order = 'YXZ';
    }

    get active() {
        return !!this.phase;
    }

    resize(aspect) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    // Acciones programadas: at s después de ahora
    after(at, fn) {
        this.queue.push({ at: this.t + at, fn });
    }

    runQueue() {
        const due = this.queue.filter((q) => q.at <= this.t);
        this.queue = this.queue.filter((q) => q.at > this.t);
        for (const q of due) q.fn();
    }

    say(text) {
        this.hooks.say(text);
    }

    // ---------- 1. El campo de trigo, a mano ----------
    start() {
        this.phase = 'field';
        this.t = 0;
        this.queue = [];
        this.buildField();
        this.picked = 0;
        this.reach = null;
        this.locked = true;
        this.hooks.flash(0xffffff, 1);
        this.after(1.2, () => {
            this.locked = false;
            this.hooks.prompt('collect');
        });
    }

    buildField() {
        const s = (this.scene = new THREE.Scene()), T = this.theme;
        s.background = new THREE.Color(T.sky);
        this.hooks.lights(s);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(T.soil[0]));
        ground.rotation.x = -Math.PI / 2;
        s.add(ground);
        // Trigo hasta el horizonte (quieto: son miles de tallos) y nubes
        const stalks = [];
        // Denso cerca y más espaciado a lo lejos (de lejos no se nota y pesa mucho menos)
        for (let x = -26; x <= 26; x += 0.5) for (let z = -28; z <= 6; z += 0.5) {
            const px = x + (Math.random() - 0.5) * 0.3, pz = z + (Math.random() - 0.5) * 0.3, r = Math.hypot(px, pz);
            if (r < 1.5 || r > 28 || (r > 9 && Math.random() < 0.45)) continue;
            stalks.push([px, pz, 0.95 + Math.random() * 0.4, Math.random()]);
        }
        const n = stalks.length, st = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), n), ea = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), n);
        const d = new THREE.Object3D();
        stalks.forEach(([x, z, h, tone], i) => {
            const tilt = (Math.random() - 0.5) * 0.2;
            d.position.set(x, h / 2, z);
            d.rotation.set(tilt, 0, tilt * 0.7);
            d.scale.set(0.05, h, 0.05);
            d.updateMatrix();
            st.setMatrixAt(i, d.matrix);
            st.setColorAt(i, _c.setHex(0xe8b830).offsetHSL(0, 0, (tone - 0.5) * 0.1));
            d.position.set(x - tilt * 0.7 * h / 2, h + 0.1, z + tilt * h / 2);
            d.scale.set(0.11, 0.26, 0.11);
            d.updateMatrix();
            ea.setMatrixAt(i, d.matrix);
            ea.setColorAt(i, _c.setHex(tone < 0.5 ? 0xf6cf4a : 0xd9a42e));
        });
        s.add(st, ea);
        for (let k = 0; k < 8; k++) {
            const c = new THREE.Mesh(box(1, 1, 1), toon(0xffffff));
            c.scale.set(6 + Math.random() * 6, 1.5, 4);
            c.position.set(-60 + k * 18, 22 + Math.random() * 8, -70 - Math.random() * 20);
            s.add(c);
        }
        // Las matas que se recogen: delante, al alcance de la mano; la tercera, la mágica
        this.clumps = [[0.05, -1.6], [0.45, -1.85]].map(([x, z]) => this.clump(x, z));
        this.magic = new MagicWheat(T.outline);
        this.magic.root.position.set(-0.1, 0, -2.7);
        this.magic.float = false;
        this.magic.root.visible = false;
        s.add(this.magic.root);
        this.particles = new Particles(s, 300);
        // La mano: manga de cuadros y la mano, abajo a la derecha de la vista
        const cam = this.camera;
        s.add(cam);
        this.hand = new THREE.Group();
        const sleeve = new THREE.Mesh(box(0.14, 0.14, 0.5), toon(0xc8402e));
        sleeve.position.z = 0.22;
        const cuff = new THREE.Mesh(box(0.15, 0.15, 0.05), toon(0xfff3d6));
        cuff.position.z = -0.03;
        const palm = new THREE.Mesh(box(0.12, 0.05, 0.14), toon(0xe8b48a));
        palm.position.set(0, 0, -0.1);
        this.hand.add(sleeve, cuff, palm);
        for (let k = 0; k < 4; k++) {
            const f = new THREE.Mesh(box(0.025, 0.03, 0.08), toon(0xe8b48a));
            f.position.set(-0.045 + k * 0.03, 0, -0.2);
            this.hand.add(f);
        }
        this.handRest = new THREE.Vector3(0.24, -0.3, -0.55);
        this.hand.position.copy(this.handRest);
        this.hand.rotation.x = 0.2;
        cam.add(this.hand);
        cam.position.set(0, 1.6, 0.4);
        cam.rotation.set(-0.3, 0, 0);
        cam.fov = 62;
        cam.updateProjectionMatrix();
    }

    // Una mata de trigo para recoger a mano (un poco más gorda y brillante que el resto)
    clump(x, z) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        for (let k = 0; k < 7; k++) {
            const a = k * 0.9, r = k ? 0.06 : 0, h = 1.05 + (k % 3) * 0.06;
            const s = new THREE.Mesh(box(0.05, h, 0.05), toon(0xf0c040));
            s.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r);
            const e = new THREE.Mesh(box(0.12, 0.28, 0.12), toon(0xffd84a));
            e.position.set(Math.sin(a) * r, h + 0.12, Math.cos(a) * r);
            g.add(s, e);
        }
        this.scene.add(g);
        return g;
    }

    // Tocar: recoger la siguiente mata (o ir a por el trigo mágico)
    tap() {
        if (this.phase !== 'field' || this.locked || this.reach) return;
        this.hooks.prompt(null);
        this.locked = true;
        const target = this.picked < 2 ? this.clumps[this.picked] : this.magic.root;
        // A dónde va la mano: la mata, en el espacio de la cámara
        this.camera.updateMatrixWorld();
        const local = this.camera.worldToLocal(target.localToWorld(_v.set(0, 1.0, 0)).clone());
        this.reach = { t: 0, target, to: local.multiplyScalar(this.picked < 2 ? 0.85 : 0.45), magic: this.picked >= 2 };
        this.hooks.sfx.play('step');
    }

    updateField(dt, time) {
        const R = this.reach;
        if (R) {
            R.t += dt;
            const go = Math.min(1, R.t / 0.35), back = Math.max(0, Math.min(1, (R.t - 0.55) / 0.4));
            const k = ease(go) * (1 - ease(back));
            this.hand.position.lerpVectors(this.handRest, R.to, k);
            this.hand.rotation.x = 0.2 - k * 0.4;
            if (R.magic) {
                // Al ir a por el trigo mágico, la mano se para a medio camino: él habla
                if (R.t > 0.35 && !R.spoke) {
                    R.spoke = true;
                    this.say(LINES.lifetime);
                    this.hooks.sfx.play('secret');
                    this.after(4.2, () => this.say(LINES.come));
                    this.after(6.6, () => this.toSpace());
                }
                if (R.t > 0.35) this.hand.position.copy(R.to);
            } else if (R.t > 0.35 && !R.grabbed) {
                // La mata, a la mano
                R.grabbed = true;
                this.camera.attach(R.target);
                this.hooks.sfx.play('harvest');
                vibrate('pickup');
                const p = R.target.getWorldPosition(new THREE.Vector3());
                this.particles.burst(p.x, 1, p.z, 18, [0xf6cf4a, 0xffe9a0, 0xd9a42e], { speed: 1.4, up: 1.6, size: 0.04, ttl: 0.7 });
                this.hooks.popPlus();
            }
            if (R.grabbed) {
                // Se la lleva con la mano y desaparece por abajo
                R.target.position.lerp(this.hand.position, 0.3);
                if (back >= 1) {
                    this.camera.remove(R.target);
                    this.reach = null;
                    this.picked++;
                    if (this.picked === 2) {
                        // Detrás aparece el trigo mágico, brillando
                        this.after(0.4, () => {
                            this.magic.root.visible = true;
                            this.magic.root.scale.setScalar(0.0001);
                            this.magic.pop = 1;
                            this.hooks.sfx.play('unlock');
                            this.particles.burst(-0.1, 1, -2.7, 40, RAINBOW, { speed: 1.6, up: 2, size: 0.05, ttl: 1.2, grav: 1 });
                        });
                        this.after(1.4, () => {
                            this.locked = false;
                            this.hooks.prompt('collect');
                        });
                    } else {
                        this.locked = false;
                        this.hooks.prompt('collect');
                    }
                }
            }
        }
        // El trigo mágico: crece de golpe al salir y suelta chispas de colores
        const m = this.magic;
        if (m.root.visible) {
            m.root.scale.setScalar(Math.min(1, m.root.scale.x + dt * 3));
            m.update(dt, time);
            if (Math.random() < dt * 14) this.particles.spawn(-0.1 + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, -2.7 + (Math.random() - 0.5) * 0.6, 0, 0.5, 0, 0.03, 0.9, RAINBOW[(Math.random() * RAINBOW.length) | 0], -0.3);
        }
        // Respiración de la vista
        this.camera.position.y = 1.6 + Math.sin(time * 1.4) * 0.01;
        this.particles.update(dt);
        this.particles.sync();
    }

    // ---------- 2. El espacio ----------
    toSpace() {
        this.say(null);
        this.locked = true;
        this.fade = { t: 0, len: 1.2, then: () => this.startSpace() };
    }

    startSpace() {
        this.phase = 'space';
        this.hooks.cine(true);
        const s = (this.scene = new THREE.Scene());
        s.background = new THREE.Color(0x07061a);
        s.add(new THREE.AmbientLight(0xffffff, 1.4));
        const sun = new THREE.DirectionalLight(0xfff2d6, 2);
        sun.position.set(-4, 6, 5);
        s.add(sun);
        // Estrellas (cubitos), un planeta con su anillo a lo lejos
        const N = 700, stars = new THREE.InstancedMesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), N), d = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), r = 70 + Math.random() * 60;
            d.position.set(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r);
            d.scale.setScalar(0.15 + Math.random() * 0.35);
            d.updateMatrix();
            stars.setMatrixAt(i, d.matrix);
            stars.setColorAt(i, _c.setHex([0xffffff, 0x9fdcff, 0xffd0e0, 0xfff3a0][i % 4]));
        }
        s.add(stars);
        const planet = new THREE.Group();
        planet.position.set(-30, -8, -50);
        for (const [w, c] of [[12, 0x3a7ec8], [9, 0x5a9e32]]) {
            const m = new THREE.Mesh(box(w, w, w), toon(c));
            m.rotation.set(0.3, 0.6, 0.1);
            planet.add(m);
        }
        const ring = new THREE.Mesh(box(26, 0.4, 26), toon(0xe8d8b0));
        ring.rotation.set(0.35, 0.6, 0.2);
        ring.scale.set(1, 1, 0.25);
        planet.add(ring);
        s.add(planet);
        // Tú: un ente blanco y brillante, flotando frente al trigo mágico
        this.entity = this.buildEntity();
        this.entity.position.set(-1.5, 0, 0);
        this.entity.rotation.y = Math.PI / 2;
        s.add(this.entity);
        this.magic = new MagicWheat(this.theme.outline);
        this.magic.root.position.set(1.6, -0.2, 0);
        this.magic.base = 0;
        this.magic.root.scale.setScalar(1.3);
        s.add(this.magic.root);
        this.particles = new Particles(s, 300);
        this.orbit = 0;
        this.hooks.flash(0xffffff, 1);
        this.hooks.sfx.play('secret');
        this.after(1.4, () => this.say(LINES.eyes));
        this.after(4.4, () => this.say(LINES.better));
        this.after(8.4, () => this.say(LINES.show));
        this.after(11.2, () => {
            this.say(null);
            this.fade = { t: 0, len: 2.6, color: 0xffffff, then: () => this.startTower() };
        });
    }

    buildEntity() {
        const g = new THREE.Group(), W = new THREE.MeshBasicMaterial({ color: 0xffffff }), G = new THREE.MeshBasicMaterial({ color: 0xc4ecff, side: THREE.BackSide, transparent: true, opacity: 0.45, depthWrite: false });
        const part = (w, h, d, x, y, z) => {
            const m = new THREE.Mesh(box(w, h, d), W);
            m.position.set(x, y, z);
            const glow = new THREE.Mesh(box(w + 0.16, h + 0.16, d + 0.16), G);
            m.add(glow);
            g.add(m);
            return m;
        };
        part(0.42, 0.42, 0.42, 0, 1.55, 0);
        part(0.52, 0.7, 0.3, 0, 0.95, 0);
        this.arms = [part(0.16, 0.62, 0.16, -0.38, 0.95, 0), part(0.16, 0.62, 0.16, 0.38, 0.95, 0)];
        part(0.18, 0.66, 0.2, -0.13, 0.3, 0);
        part(0.18, 0.66, 0.2, 0.13, 0.3, 0);
        return g;
    }

    updateSpace(dt, time) {
        // La cámara gira despacio alrededor de los dos
        this.orbit += dt * 0.32;
        const r = 6.2, a = this.orbit + 0.6;
        this.camera.position.set(Math.sin(a) * r, 1.4 + Math.sin(this.orbit * 0.7) * 0.6, Math.cos(a) * r);
        this.camera.lookAt(0, 0.8, 0);
        this.entity.position.y = Math.sin(time * 1.2) * 0.15;
        this.entity.rotation.z = Math.sin(time * 0.8) * 0.04;
        this.arms.forEach((m, i) => (m.rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(time * 1.1) * 0.05)));
        this.magic.update(dt, time);
        if (Math.random() < dt * 20) {
            const c = this.magic.center(_v);
            this.particles.spawn(c.x + (Math.random() - 0.5), c.y + (Math.random() - 0.5) * 1.4, c.z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4, 0.05, 1.4, RAINBOW[(Math.random() * RAINBOW.length) | 0], 0);
        }
        if (Math.random() < dt * 10) this.particles.spawn(-1.5 + (Math.random() - 0.5), Math.random() * 1.8, (Math.random() - 0.5), 0, 0.3, 0, 0.04, 1.2, 0xffffff, 0);
        this.particles.update(dt);
        this.particles.sync();
    }

    // ---------- 3. La torre y el rifle ----------
    startTower() {
        this.phase = 'tower';
        this.scene = null;
        this.hooks.cine(false);
        this.hooks.enterTower();
        const sn = this.sn, f = sn.field;
        sn.calm = sn.lockCorners = sn.scripted = sn.hideRifle = true;
        this.magic = new MagicWheat(this.theme.outline);
        this.magic.root.position.set(f.cx, 0, f.cz);
        this.magic.base = 1.4;
        this.magic.root.scale.setScalar(2.6);
        sn.scene.add(this.magic.root);
        sn.magic = this.magic;
        sn.lookAt(f.cx, 2.6, f.cz);
        this.locked = true;
        this.hooks.flash(0xffffff, 1);
        this.after(1.0, () => this.say(LINES.take));
        this.after(1.8, () => this.giveRifle());
        this.after(5.2, () => {
            this.say(LINES.aim);
            this.hooks.prompt('aim');
            this.locked = false;
        });
    }

    // El rifle sale flotando del trigo hacia arriba, gira, desaparece y aparece en tus manos
    giveRifle() {
        const sn = this.sn, gift = new RifleModel(this.theme.outline);
        gift.root.scale.setScalar(4.5);
        const c = this.magic.center(new THREE.Vector3());
        gift.root.position.copy(c);
        gift.root.rotation.y = Math.PI / 2;
        sn.scene.add(gift.root);
        this.gift = { model: gift, t: 0, from: c.clone() };
        this.hooks.sfx.play('power');
    }

    updateGift(dt) {
        const G = this.gift;
        if (!G) return;
        G.t += dt;
        const sn = this.sn, r = G.model.root, k = Math.min(1, G.t / 2.2);
        r.position.set(G.from.x, G.from.y + ease(k) * 7, G.from.z);
        r.rotation.y += dt * (2 + k * 6);
        if (Math.random() < dt * 30) sn.particles.spawn(r.position.x + (Math.random() - 0.5) * 2, r.position.y, r.position.z + (Math.random() - 0.5) * 2, 0, -0.5, 0, 0.12, 1, RAINBOW[(Math.random() * RAINBOW.length) | 0], 0);
        if (G.t > 2.2) {
            // ¡Puf! Y ya lo tienes en las manos
            const s = Math.max(0.0001, 4.5 * (1 - (G.t - 2.2) / 0.3));
            r.scale.setScalar(s);
            if (G.t > 2.5) {
                sn.particles.burst(r.position.x, r.position.y, r.position.z, 50, RAINBOW, { speed: 4, up: 2, size: 0.18, ttl: 0.9, grav: 0 });
                sn.scene.remove(r);
                this.gift = null;
                sn.hideRifle = false;
                sn.rifle.reload(0.6); // lo coloca con un vaivén
                this.hooks.flash(0xffffff, 0.5);
                this.hooks.sfx.play('reloaded');
                vibrate('pickup');
            }
        }
    }

    // Le has dado: se deshace y empieza el espectáculo
    hitMagic() {
        if (this.phase !== 'tower' || this.show) return;
        const sn = this.sn, c = this.magic.center(new THREE.Vector3());
        this.locked = true;
        this.hooks.prompt(null);
        this.say(null);
        sn.release(false);
        sn.magic = null;
        this.magic.gone = 0.01;
        this.magic.float = false;
        sn.particles.burst(c.x, c.y, c.z, 140, RAINBOW, { speed: 6, up: 5, size: 0.2, ttl: 1.6, grav: 2 });
        sn.waves.spawn(c.x, c.z, 0xffffff, 6, 0.8);
        this.hooks.flash(0xffffff, 0.8);
        this.hooks.sfx.play('secret');
        sn.hitStop = 0.15;
        this.hooks.cine(true);
        this.show = { t: 0, look: null };
        const ks = sn.ks, f = sn.field;
        // Todas las granadas, una detrás de otra; el bombardero; y la bomba nuclear
        const throwAt = (type) => () => {
            ks.throwGrenade(type);
            const g = ks.grenades[ks.grenades.length - 1];
            if (g) this.show.look = { x: g.x, y: 0.5, z: g.z };
        };
        this.after(1.4, throwAt('frag'));
        this.after(3.2, throwAt('cluster'));
        this.after(5.0, throwAt('fire'));
        this.after(7.4, () => {
            ks.callBomber();
            this.show.look = null;
        });
        this.after(12.6, () => {
            this.show.look = null;
            ks.startNuke();
        });
    }

    updateTower(dt, time) {
        const sn = this.sn;
        if (this.magic) this.magic.update(dt, time);
        if (this.magic && this.magic.root.visible && this.magic.gone === 0 && Math.random() < dt * 24) {
            const c = this.magic.center(_v);
            sn.particles.spawn(c.x + (Math.random() - 0.5) * 2.4, c.y + (Math.random() - 0.5) * 3, c.z + (Math.random() - 0.5) * 2.4, 0, 0.6, 0, 0.12, 1.2, RAINBOW[(Math.random() * RAINBOW.length) | 0], -0.2);
        }
        this.updateGift(dt);
        const S = this.show;
        if (!S) return;
        S.t += dt;
        // La cámara sigue la acción: las granadas, el avión (por delante) y, al final, la bomba
        let to = S.look;
        const pl = sn.ks.plane;
        if (pl) to = { x: pl.model.position.x + pl.dir.x * 8, y: pl.model.position.y * 0.5, z: pl.model.position.z + pl.dir.z * 8 };
        if (to && !sn.ks.nuke) {
            const dx = to.x - sn.pos.x, dz = to.z - sn.pos.z, dy = to.y - sn.pos.y;
            const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)), a = 1 - Math.exp(-dt * 2.5);
            sn.lookYaw += Math.atan2(Math.sin(yaw - sn.lookYaw), Math.cos(yaw - sn.lookYaw)) * a;
            sn.lookPitch += (pitch - sn.lookPitch) * a;
        }
        // Tras la explosión nuclear, todo a blanco y al mapa
        const N = sn.ks.nuke;
        if (N && N.boom > 2.4 && !this.fade) this.fade = { t: 0, len: 2, color: 0xffffff, then: () => this.toMap() };
    }

    // ---------- 4. El mapa: se despide ----------
    toMap() {
        const sn = this.sn;
        this.show = null;
        if (this.magic) sn.scene.remove(this.magic.root);
        sn.calm = sn.lockCorners = sn.scripted = sn.hideRifle = false;
        sn.magic = null;
        this.phase = 'map';
        this.locked = true;
        this.hooks.toMap();
        this.hooks.flash(0xffffff, 1);
        this.hooks.cine(true);
        const F = this.farm;
        this.magic = new MagicWheat(this.theme.outline);
        this.magic.base = 3.2;
        this.magic.root.scale.setScalar(1.8);
        this.magic.root.position.set(15, 0, 18);
        F.root.add(this.magic.root);
        this.leaving = 0;
        this.after(3.0, () => this.say(LINES.remember));
        this.after(6.4, () => this.say(LINES.luck));
        this.after(10.2, () => {
            this.say(null);
            this.leaving = 0.001;
            this.hooks.sfx.play('whoosh');
        });
        this.after(12, () => {
            F.root.remove(this.magic.root);
            this.magic = null;
            this.phase = null;
            this.locked = false;
            this.hooks.cine(false);
            this.hooks.done();
        });
    }

    updateMap(dt, time, particles) {
        const m = this.magic;
        if (!m) return;
        m.update(dt, time);
        if (this.leaving > 0) {
            // Se va hacia arriba, cada vez más deprisa
            this.leaving += dt;
            m.root.position.y += dt * (2 + this.leaving * 14);
            m.root.rotation.y += dt * 6;
        }
        if (Math.random() < dt * 22) {
            const c = m.center(_v);
            particles.spawn(c.x + (Math.random() - 0.5) * 1.6, c.y + (Math.random() - 0.5) * 2, c.z + (Math.random() - 0.5) * 1.6, 0, this.leaving ? -2 : 0.4, 0, 0.1, 1.2, RAINBOW[(Math.random() * RAINBOW.length) | 0], 0);
        }
    }

    // ---------- Bucle ----------
    // Devuelve el color y la intensidad del fundido (si hay uno en marcha)
    update(dt, time, particles) {
        this.t += dt;
        this.runQueue();
        if (this.phase === 'field') this.updateField(dt, time);
        else if (this.phase === 'space') this.updateSpace(dt, time);
        else if (this.phase === 'tower') this.updateTower(dt, time);
        else if (this.phase === 'map') this.updateMap(dt, time, particles);
        if (this.fade) {
            const F = this.fade;
            F.t += dt;
            this.hooks.flash(F.color || 0xffffff, Math.min(1, F.t / F.len));
            if (F.t >= F.len) {
                this.fade = null;
                F.then();
            }
        }
    }
}
