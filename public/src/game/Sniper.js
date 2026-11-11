import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, wrapAngle } from '../core/math.js';
import { box } from '../render/materials.js';
import { Particles } from '../render/Particles.js';
import { Shockwaves } from '../render/Shockwaves.js';
import { RifleModel } from '../render/RifleModel.js';
import { SniperField } from '../world/SniperField.js';
import { vibrate } from '../core/Haptics.js';
import { CROPS } from '../content/crops.js';
import { KS, streakOf } from '../content/killstreaks.js';
import { Killstreaks } from './Killstreaks.js';
import { Flyers } from './Flyers.js';
import { Walkers } from './Walkers.js';
import { Turrets } from './Turrets.js';
import { MysteryBox } from './MysteryBox.js';
import { WONDER_ZOOM, WONDER } from '../content/mysterybox.js';
import { loadoutStats } from '../content/arsenal.js';
import { RANGE_FX, RANGE_SPOTS, RANGE_EYE } from '../world/RangeTargets.js';
const fxOf = (crop) => CROPS[crop] || RANGE_FX; // (las dianas del campo de pruebas no son un cultivo)

const S = CONFIG.sniper;
const FIRE = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a];
const SMOKE = [0x5a5048, 0x7a7068, 0x3a302a, 0x9a9088];
const RUST = [0x8a4a2a, 0xa85a2a, 0x6a3a22, 0x2e2a28];
const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Modo francotirador en primera persona, con el tacto de un shooter: la vista es libre (se
// mira arrastrando o con el ratón) y la mirilla está siempre en el centro. Apuntar sube el arma
// al ojo y hace zoom hacia donde se mira; con la mira la vista va más despacio; soltar dispara.
// Se puede mirar, apuntar y disparar también mientras se salta de una torre a otra.
// Dos modos: cosecha (los blancos son las matas o los tomates) y desbloqueo (un solo disparo
// lejano al barril rojo encima de la chatarra, sin poder cambiar de torre).
// Cosechando hay dos rachas de bajas (content/killstreaks.js): la de granadas, al recoger
// (fragmentación, racimo e incendiaria), y la alienígena, al abatir alienígenas que cruzan el
// campo a pie o ovnis pequeños (misil Predator, que mientras se guía tiene la vista y el gatillo,
// bombardero y bomba nuclear).
export class Sniper {
    // hooks: { sfx, onHit(target, ndcX, ndcY), onMedal({ collateral, streak, reward }), onUnlock(),
    //          onAlien(ndcX, ndcY), onHitMarker(), onUfoDown(),
    //          onPredator(on), onNukeCount(s), onNuke(), onFinish(), onDone(), onCorner(i) }
    constructor(theme, hooks) {
        this.theme = theme;
        this.hooks = hooks;
        this.tracks = { crop: true, alien: true }; // rachas abiertas (las cierra la progresión)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(theme.sky);
        this.field = new SniperField(theme);
        this.wireField();
        this.scene.add(this.field.root);
        this.particles = new Particles(this.scene, 3200);
        this.waves = new Shockwaves(this.scene);

        this.camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, 500);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);
        this.rifle = new RifleModel(theme.outline);
        this.camera.add(this.rifle.root);

        // Lo que da el equipo de la armería del granero (mirilla, rifle y cargador)
        this.stats = loadoutStats();
        this.ammo = this.stats.size; // balas en el cargador
        this.reloadT = 0;            // lo que le queda a la recarga (s)
        this.regenT = 0;
        this.ks = new Killstreaks(this);
        this.flyers = new Flyers(this);
        this.walkers = new Walkers(this);
        this.turrets = new Turrets(this);
        this.box = new MysteryBox(this); // la caja sorpresa (y los disparos de sus armas)
        this.special = null;             // el arma que ha tocado en la caja (o null: el rifle)
        this.aliens = 0;        // racha alienígena: abatidos en esta partida (no se pierde)
        this.streak = 0;        // racha de granadas: lo recogido seguido
        this.streakT = 0; // lo que le queda a la barra de la racha (s) y lo que duraba llena
        this.streakMax = 1;

        this.nightK = 0; // lo de noche que es (lo pone main.js con el ciclo de día y noche)
        this.buildNightSky();

        this.tracer = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
        this.tracer.visible = false;
        this.scene.add(this.tracer);
        this.tracerT = 0;

        this.corner = 0;
        this.pos = new THREE.Vector3();
        // Hacia dónde mira el jugador (lo controla él) y lo que se ve (con sway y retroceso)
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.scoped = false;
        this.adsK = 0;          // 0 = arma en la cadera, 1 = mira puesta
        this.kickP = 0;         // retroceso (muelle): desplazamiento y velocidad
        this.kickV = 0;
        this.kickYaw = 0;
        this.dipP = 0;          // amortiguación al aterrizar en una torre
        this.dipV = 0;
        this.roll = 0;
        this.settle = 1;        // 1 = mira recién subida (tiembla), 0 = asentada
        this.turned = 0;        // radianes girados este frame
        this.turnSpeed = 0;     // velocidad de giro suavizada
        this.fov = S.fov;
        this.bolt = 0;
        this.trauma = 0;
        this.hitStop = 0;
        this.slowmo = 0;
        this.move = null;
        this.time = 0;
        this.ending = -1;
        this.prevYaw = 0;
        this.prevPitch = 0;
    }

    // Cielo de noche: luna llena enorme y cuadrada (con sus cráteres y su halo, también cuadrados),
    // detrás del campo y algo alta, y estrellas (se ven más cuanto más de noche es)
    buildNightSky() {
        const g = (this.nightSky = new THREE.Group());
        const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false });
        this.moonMats = [mat(this.theme.night.moon, 1), mat(0xd8d0b0, 1), mat(0xfff6d8, 0.18), mat(0xfff6d8, 0.08)];
        const moon = new THREE.Group();
        moon.add(new THREE.Mesh(box(14, 14, 0.5), this.moonMats[0])); // cuadrada, de píxel
        for (const [x, y, s] of [[-2.5, 2, 2.6], [3, -1.5, 3.2], [-1, -4, 1.8], [2, 4, 1.4]]) {
            const c = new THREE.Mesh(box(s, s, 0.6), this.moonMats[1]);
            c.position.set(x, y, 0.1);
            moon.add(c);
        }
        for (const [s, m] of [[22, 2], [32, 3]]) moon.add(new THREE.Mesh(box(s, s, 0.2), this.moonMats[m]));
        moon.position.set(90, 55, -140);
        moon.lookAt(0, 0, 0);
        g.add(moon);
        const pos = [];
        for (let k = 0; k < 260; k++) {
            const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3, r = 220;
            pos.push(Math.cos(e) * Math.sin(a) * r, Math.sin(e) * r, Math.cos(e) * Math.cos(a) * r);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        this.starMat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
        g.add(new THREE.Points(geo, this.starMat));
        g.visible = false;
        this.scene.add(g);
    }

    updateNightSky() {
        const k = this.nightK;
        this.nightSky.visible = k > 0.01;
        if (!this.nightSky.visible) return;
        this.nightSky.position.copy(this.camera.position);
        this.moonMats[0].opacity = this.moonMats[1].opacity = k;
        this.moonMats[2].opacity = 0.18 * k;
        this.moonMats[3].opacity = 0.08 * k;
        this.starMat.opacity = k * (0.75 + Math.sin(this.time * 3) * 0.1);
    }

    // Campo de tiro del tamaño pedido (se monta de nuevo solo si cambia)
    setArena(scale) {
        if (this.field.scale === scale) return;
        this.scene.remove(this.field.root);
        this.field.dispose();
        this.field = new SniperField(this.theme, scale);
        this.wireField();
        this.scene.add(this.field.root);
    }


    // Lo que avisa el campo: a una vaca se le ha llenado la ubre (muge, a veces) y cada bote de
    // una vaca sobre su ubre gigante (¡boing!, de vez en cuando, y un poco de polvo)
    wireField() {
        this.field.onFull = () => {
            if (Math.random() < 0.5) this.hooks.sfx.play('moo');
        };
        // Gallinas: cacarea al lanzar el huevo (a veces); el que cae sin que le den se casca: yema,
        // trozos de cáscara y un chof
        this.field.onToss = (s) => {
            if (Math.random() < 0.6) this.hooks.sfx.play('cluck');
            this.particles.burst(s.cx, 0.4, s.cz, 6, [0xfaf6ec, 0xf0e6d0], { speed: 1.4, up: 1.6, size: 0.07, ttl: 0.5 });
        };
        this.field.onSplat = (s, x, z) => {
            this.hooks.sfx.play('splat');
            this.particles.burst(x, 0.1, z, 18, [0xffd23f, 0xffb020, 0xfff6e6, 0xffffff], { speed: 1.8, up: 1.4, size: 0.08, ttl: 0.6 });
            this.waves.spawn(x, z, 0xffd23f, 0.8, 0.3);
        };
        this.field.onBoing = (s) => {
            if (Math.random() < 0.18) this.hooks.sfx.play('boing');
            this.particles.burst(s.cx, 0.1, s.cz, 4, [0xd8c8a0, 0x9ad962], { speed: 1.2, up: 0.8, size: 0.08, ttl: 0.35 });
        };
        // Un pez que salta o vuelve al agua: salpicón y su onda (más grandes los peces grandes)
        this.field.onFishSplash = (x, z, size) => {
            const k = { s: 0.6, m: 1, l: 1.5 }[size] || 1;
            this.particles.burst(x, 0.1, z, Math.round(10 * k), [0xffffff, 0xc0e4f8, 0x9fdcff], { speed: 1.8 * k, up: 3 * k, size: 0.09, ttl: 0.5 });
            this.waves.spawn(x, z, 0xc0e4f8, 0.9 * k, 0.5);
            if (Math.random() < 0.3) this.hooks.sfx.play('pop');
        };
        // Un cerdo deslizándose de barriga: salpica barro por detrás
        this.field.onSplash = (s) => {
            this.particles.burst(s.cx - s.vx * 0.08, 0.15, s.cz - s.vz * 0.08, 4, [0x7a5232, 0x5a3a22, 0x8a5e38], { speed: 1.6, up: 1.6, size: 0.1, ttl: 0.45 });
            if (Math.random() < 0.06) this.hooks.sfx.play('sand');
        };
    }

    // what: { crop, count, arena, turrets } para cosechar (count blancos de ese cultivo en un
    // campo de tamaño arena, con o sin sus torretas automáticas) o { unlock: true }; loadout:
    // el equipo de la armería ({ scope, rifle, mag })
    // practice: el campo de pruebas (nada cuenta: los blancos vuelven a salir y no se acaba)
    enter(what) {
        this.setArena(what.arena || 1);
        this.special = this.base = null;
        this.dropT = this.swapT = this.overheat = 0;
        this.practice = !!what.practice;
        this.practiceCount = what.count;
        this.respawnT = 0;
        this.setLoadout(what.loadout);
        this.unlocking = !!what.unlock;
        this.crop = what.crop || null;
        this.field.restartIntro();
        this.field.setUnlockView(this.unlocking);
        this.puffT = 0;
        if (this.unlocking) this.field.spawnJunk();
        else this.field.spawn(what.crop, what.count);
        this.particles.clear();
        this.waves.clear();
        this.corner = 0;
        this.move = null;
        this.roll = 0;
        this.rifle.swap = null; // (si se salió a medio cambiar de arma)
        this.eyeOf(0, this.pos);
        this.scoped = false;
        this.fov = S.fov;
        this.yaw = this.lookYaw = this.baseYaw();
        this.pitch = this.lookPitch = this.basePitch();
        this.adsK = this.kickP = this.kickV = this.dipP = this.dipV = 0;
        this.settle = 1;
        this.turned = this.turnSpeed = 0;
        this.pending = false;
        this.bolt = 0;
        this.ending = -1;
        this.slowmo = 0;
        this.hitStop = 0;
        this.streak = this.streakT = 0;
        this.aliens = 0;
        this.alienAt = -9;
        this.ks.clear();
        this.flyers.reset();
        this.walkers.reset();
        this.turrets.set(!this.unlocking && !!what.turrets);
        this.box.reset();
        // Depuración (los ajustes de DEBUG, en this.debug): vacas llenas y empezar con un arma de
        // la caja
        const D = this.debug || {};
        if (this.crop) {
            if (D.cowsFull) for (const s of this.field.targets) if (s.kind === 'cow' || s.kind === 'sheep' || s.kind === 'hen' || s.kind === 'pig' || s.kind === 'fish') s.swell = 1;
            const w = D.startWonder && WONDER.find((x) => x.id === D.startWonder);
            if (w) this.giveSpecial(w);
        }
    }

    // Cambiar de equipo (al entrar, y en el campo de pruebas en cualquier momento)
    setLoadout(loadout) {
        if (this.special) {
            this.special = null;
            this.base = null;
        }
        this.loadout = loadout;
        this.stats = loadoutStats(loadout);
        this.rifle.setLoadout(loadout);
        this.tracer.material.color.setHex(this.stats.tracer);
        this.ammo = this.stats.size;
        this.reloadT = this.regenT = 0;
        this.bolt = 0;
    }

    // Campo de pruebas: otros blancos (los de ese cultivo)
    setTargets(mode) {
        this.crop = 'range';
        this.field.rangeMode = mode || this.field.rangeMode;
        this.field.spawn('range', this.practiceCount);
        this.respawnT = 0;
    }

    // El arma de la caja sorpresa: sustituye al rifle (un solo cargador, sin recargas) hasta
    // gastarla. Sin mirilla de francotirador: al apuntar sube al centro, con poco zoom, firme y
    // rápida, y se apunta con su propia mira
    giveSpecial(w) {
        this.base = this.base || this.stats;
        this.special = w;
        this.stats = { ...this.base, zoom: WONDER_ZOOM, ads: 0.15, steady: 0.3, lens: null, bolt: w.rate, size: w.ammo, reload: 0, regen: 0, recoil: w.mode === 'rocket' ? 1.6 : 0.45 };
        this.ammo = w.ammo;
        this.reloadT = this.bolt = 0;
        this.dropT = this.swapT = this.overheat = 0;
        this.rifle.setSpecial(w.id);
        this.rifle.swapIn(); // (sube a las manos desde abajo)
        this.tracer.material.color.setHex(this.stats.tracer);
        this.hooks.sfx.play('reloaded');
        if (this.hooks.onWonder) this.hooks.onWonder(w);
    }

    // Sin munición en el arma de la caja: tras el último disparo (dropT) baja de las manos y sale
    // volando torre abajo (MysteryBox.throwAway); al poco (swapT) sube el fusil girando y se le
    // monta el cerrojo (endSpecial)
    dropSpecial() {
        if (!this.special) return;
        this.rifle.swapOut();
        this.box.throwAway(this.special.id);
        this.hooks.sfx.play('whoosh');
        this.hooks.sfx.play('scopeOut');
        this.swapT = 0.38;
    }

    // Vuelve el rifle (con el cargador lleno)
    endSpecial() {
        if (!this.special) return;
        this.special = null;
        this.stats = this.base;
        this.base = null;
        this.ammo = this.stats.size;
        this.dropT = this.swapT = 0;
        this.rifle.setLoadout(this.loadout);
        this.rifle.swapIn(true);
        this.bolt = 0.5; // (mientras sube y se monta el cerrojo)
        this.tracer.material.color.setHex(this.stats.tracer);
        this.hooks.sfx.play('reloaded');
        setTimeout(() => this.hooks.sfx.play('bolt'), 260);
        if (this.hooks.onWonder) this.hooks.onWonder(null);
    }

    leave() {
        this.box.reset();
        this.dropT = this.swapT = 0;
        if (this.special) {
            this.special = null;
            this.stats = this.base;
            this.base = null;
        }
        this.ks.clear();
        this.turrets.clear();
        this.flyers.reset();
        this.walkers.reset();
        this.field.clearSheaves();
        this.particles.clear();
    }

    // Ojo del tirador en la torre i (en el desbloqueo, siempre la atalaya lejana)
    eyeOf(i, out = new THREE.Vector3()) {
        if (this.practice) {
            const p = RANGE_SPOTS[i % RANGE_SPOTS.length];
            return out.set(p.x, RANGE_EYE, p.z); // (campo de pruebas: de pie, en la línea de tiro)
        }
        const t = this.unlocking ? this.field.farTower : this.field.towers[i];
        return out.set(t.x, t.floor + 1.15, t.z);
    }

    // Los sitios desde los que se tira: las torres (o, en el campo de pruebas, los puestos de la línea)
    get stations() {
        return this.practice ? RANGE_SPOTS : this.field.towers;
    }

    get moving() {
        return !!this.move;
    }

    // Salta a la torre vecina (dir: +1 / -1). La mira sigue puesta si lo estaba.
    goCorner(dir) {
        if (this.move || this.ending >= 0 || this.unlocking || this.lockCorners || this.ks.predator) return;
        const n = this.stations.length;
        const to = (this.corner + dir + n) % n;
        this.move = { from: this.pos.clone(), to: this.eyeOf(to), t: 0, idx: to };
        this.hooks.sfx.play('corner');
    }

    // Salta a la torre vecina que queda a la izquierda (side -1) o a la derecha (+1) de la vista
    goSide(side) {
        if (this.move || this.ending >= 0 || this.unlocking || this.lockCorners || this.ks.predator) return;
        const n = this.stations.length;
        const rx = Math.cos(this.lookYaw), rz = -Math.sin(this.lookYaw); // derecha de la vista
        const along = (d) => {
            const t = this.stations[(this.corner + d + n) % n];
            return (t.x - this.pos.x) * rx + (t.z - this.pos.z) * rz;
        };
        this.goCorner(along(1) * side >= along(-1) * side ? 1 : -1);
    }

    // Al entrar se mira al centro del campo (o, en el desbloqueo, hacia el montón de chatarra)
    aimPoint() {
        const b = this.unlocking && this.field.barrel;
        if (this.practice) return { x: this.pos.x + 14, y: 1.2, z: this.pos.z }; // (campo de pruebas: al frente, por su calle)
        return b ? { x: b.x, y: b.y - 1, z: b.z } : { x: this.field.cx, y: 0.5, z: this.field.cz };
    }

    baseYaw() {
        const a = this.aimPoint();
        return Math.atan2(-(a.x - this.pos.x), -(a.z - this.pos.z));
    }

    basePitch() {
        const a = this.aimPoint();
        return Math.atan2(-(this.pos.y - a.y), Math.hypot(a.x - this.pos.x, a.z - this.pos.z));
    }

    // Girar la vista. rate: radianes por píxel (o por unidad de stick); con la mira, más fino
    look(dx, dy, rate) {
        if (this.ks.predator) return this.ks.steer(dx, dy, rate); // guiando el misil
        const k = rate * (this.fov / S.fov) * (1 - this.adsK * (1 - S.adsSlow));
        this.lookYaw -= dx * k;
        this.lookPitch = clamp(this.lookPitch - dy * k, S.pitchMin, S.pitchMax);
        this.turned += Math.hypot(dx, dy) * k; // para la dispersión por girar
    }

    // Mirar a un punto del mundo (lo usan las pruebas)
    lookAt(x, y, z) {
        const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
        this.lookYaw = Math.atan2(-dx, -dz);
        this.lookPitch = Math.atan2(dy, Math.hypot(dx, dz));
    }

    // Subir o bajar el arma al ojo
    setAds(on) {
        this.pending = false;
        if (this.ks.predator) return on && this.ks.boost(); // el gatillo acelera el misil
        if (on === this.scoped || (on && this.ending >= 0)) return;
        this.scoped = on;
        this.hooks.sfx.play(on ? 'scopeIn' : 'scopeOut');
    }

    // Soltar: dispara (si el cerrojo está listo) y baja el arma
    // Si se suelta mientras el cerrojo aún recarga, el disparo queda guardado: el arma sigue
    // arriba y dispara en cuanto está lista (no se pierde la puntería)
    release(fire = true) {
        if (this.ks.predator) return false;
        if (!this.scoped) return false;
        if (fire && (this.bolt > 0 || this.reloadT > 0 || this.ammo <= 0) && this.ending < 0) {
            this.pending = true;
            return false;
        }
        this.pending = false;
        const hit = fire ? this.fire() : false;
        this.scoped = false;
        if (!fire) this.hooks.sfx.play('scopeOut');
        return hit;
    }

    // Dispersión actual (radianes). Se suma:
    //  - la de la cadera, que desaparece al llegar al 90% de la subida del arma
    //  - la de una mira recién subida (desde ese 90%), que tarda un momento en asentarse
    //  - la de estar girando la vista (un giro brusco justo antes de disparar falla)
    // y todo crece si se está saltando de torre.
    get spread() {
        const k = clamp((this.adsK - 0.4) / (S.adsReady - 0.4), 0, 1);
        const hip = S.hipSpread * this.stats.hip * (1 - k * k * (3 - 2 * k));
        const steady = this.stats.steady;
        const settle = (this.adsK >= S.adsReady ? S.settleSpread * this.settle : this.adsK > 0.4 ? S.settleSpread : 0) * steady;
        const turning = Math.min(S.lookSpreadMax, this.turnSpeed * S.lookSpread);
        return (hip + settle + turning) * (this.move ? 1 + S.moveSpread : 1);
    }

    get canFire() {
        return this.bolt <= 0 && this.reloadT <= 0 && this.ammo > 0 && this.ending < 0;
    }

    // Recargar (solo, al vaciar el cargador; o a mano con R). La célula alienígena no recarga: se
    // regenera sola
    reload() {
        if (this.special || this.stats.regen || this.reloadT > 0 || this.ammo >= this.stats.size || this.unlocking) return false;
        this.reloadT = this.stats.reload;
        this.hooks.sfx.play('reload');
        this.rifle.reload(this.stats.reload);
        return true;
    }

    fire() {
        if (this.ks.predator) return this.ks.boost(), false;
        if (!this.canFire) {
            this.hooks.sfx.play('scopeOut');
            return false;
        }
        const { sfx } = this.hooks;
        this.bolt = this.stats.bolt;
        if (this.special) {
            // (sin balas: la tira y vuelve el fusil; con la pistola de rayos, al acabar su rayo)
            if (--this.ammo <= 0) this.dropT = this.special.mode === 'beam' ? this.special.beam + 0.3 : 0.45;
        } else if (!this.unlocking && --this.ammo <= 0) setTimeout(() => this.reload(), 1000 * Math.min(0.3, this.stats.bolt));
        // Retroceso: la vista salta hacia arriba (y un poco de lado) y vuelve con un muelle
        this.kickV += S.recoil * this.stats.recoil * (this.scoped ? 30 : 22);
        this.kickYaw = (Math.random() - 0.5) * S.recoil * this.stats.recoil * 0.5;
        this.trauma = Math.min(1, this.trauma + (this.scoped ? 0.2 : 0.35));
        // (el cerrojo se mueve y suena al ritmo de su mejora)
        this.rifle.fire(this.special ? 1 : S.boltTime / this.stats.bolt);
        sfx.play(this.special ? this.special.sfx : 'snipe');
        if (!this.special) setTimeout(() => sfx.play('bolt'), 320 * (this.stats.bolt / S.boltTime));
        vibrate('crate');

        // El disparo sale justo por la mirilla: el centro de lo que se ve ahora
        this.camera.updateMatrixWorld();
        const origin = this.pos.clone();
        const dir = this.camera.getWorldDirection(new THREE.Vector3());
        // Dispersión: sin la mira subida del todo la bala se va a cualquier lado del cono
        const spread = this.spread;
        if (spread > 0) {
            const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.tan(spread);
            _v.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
            _o.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
            dir.addScaledVector(_v, Math.cos(a) * r).addScaledVector(_o, Math.sin(a) * r).normalize();
        }
        this.rifle.muzzle.getWorldPosition(_o);
        const muzzle = _o.clone();
        this.particles.burst(_o.x, _o.y, _o.z, 10, [0xffffff, 0xffe03a, 0xff9a1f], { speed: 1.4, up: 0.6, size: 0.04, ttl: 0.16, grav: 0 });

        // La caja sorpresa: desde su torre, el disparo la abre (desde otra, solo rebota)
        const box = this.box.hit(origin, dir);
        if (box) {
            this.drawTracer(origin, dir, muzzle, origin.clone().addScaledVector(dir, box.t));
            if (box.near) this.box.open();
            else {
                sfx.play('wall');
                if (this.hooks.onBox) this.hooks.onBox('far');
            }
            return true;
        }
        // Prólogo: el trigo mágico flotando en el centro del campo es el blanco
        if (this.magic) {
            const t = this.magic.hit(origin, dir);
            if (t !== null) {
                this.drawTracer(origin, dir, muzzle, origin.clone().addScaledVector(dir, t));
                if (this.hooks.onMagic) this.hooks.onMagic();
                return true;
            }
        }
        if (this.unlocking) return this.fireAtJunk(origin, dir, muzzle);
        // Pistola de rayos: su rayo continuo
        if (this.special && this.special.mode === 'beam') {
            this.box.startBeam(this.special);
            return true;
        }
        // Bazuca y ballesta: su proyectil
        if (this.special) {
            this.box.launch(this.special, origin, dir, muzzle);
            return true;
        }
        const hits = this.field.raycast(origin, dir);
        hits.length = Math.min(hits.length, this.stats.pierce); // lo que atraviesa este rifle
        // Un alienígena (a pie o en ovni pequeño) en la línea de tiro para la bala: cae él y lo
        // que la bala haya atravesado antes (colateral)
        const ufo = this.flyers.hit(origin, dir), alien = this.walkers.hit(origin, dir);
        let stop = ufo && (!alien || ufo.t < alien.t) ? ufo : alien;
        // (una calabaza por delante para la bala: no llega al alienígena)
        const wall = hits.find((h) => h.sheaf.hp > 0);
        if (stop && wall && wall.t < stop.t) stop = null;
        if (stop) {
            const before = hits.filter((h) => h.t < stop.t);
            if (this.hooks.onHitMarker) this.hooks.onHitMarker();
            if (stop.flyer) this.flyers.shoot(stop.flyer);
            else this.walkers.shoot(stop.walker);
            if (before.length && this.hooks.onMedal) this.hooks.onMedal({ collateral: before.length + 1 });
            if (before.length) this.harvest(before.map((h) => h.sheaf));
            this.hitStop = S.hitStop * (1 + Math.min(2, before.length));
            this.trauma = Math.min(1, this.trauma + 0.3);
            this.drawTracer(origin, dir, muzzle, origin.clone().addScaledVector(dir, stop.t));
            return true;
        }
        let end;
        // Lo que aguanta varios tiros (calabazas) para la bala: se lleva un tiro y, si era el
        // último, se recoge con lo que la bala haya atravesado antes
        const solid = hits.findIndex((h) => h.sheaf.hp > 0);
        if (solid >= 0) {
            const s = hits[solid].sheaf;
            end = origin.clone().addScaledVector(dir, hits[solid].t);
            hits.length = solid;
            if ((s.hp -= this.stats.damage) <= 0) hits.push({ sheaf: s, t: 0 });
            else this.damage(s);
        }
        if (hits.length) {
            // La bala sigue tras la última mata hasta el suelo
            const tEnd = dir.y < -1e-3 ? Math.min(80, -origin.y / dir.y) : hits[hits.length - 1].t;
            end = end || origin.clone().addScaledVector(dir, tEnd);
            this.hitStop = S.hitStop * Math.min(3, hits.length);
            this.trauma = Math.min(1, this.trauma + 0.2 * hits.length);
            // Colateral: varias de una bala
            if (hits.length > 1 && this.hooks.onMedal) this.hooks.onMedal({ collateral: hits.length });
            this.harvest(hits.map((h) => h.sheaf));
        } else if (solid >= 0) {
            this.hitStop = S.hitStop;
            this.trauma = Math.min(1, this.trauma + 0.15);
        } else {
            const t = dir.y < -1e-3 ? -origin.y / dir.y : 80;
            end = origin.clone().addScaledVector(dir, Math.min(t, 80));
            if (dir.y < -1e-3 && t < 80) {
                this.particles.burst(end.x, 0.05, end.z, 14, [0x8a5a34, 0xc8c84a, this.theme.dust], { speed: 1.6, up: 2.2, size: 0.08, ttl: 0.5 });
                this.waves.spawn(end.x, end.z, 0xffffff, 0.7, 0.25);
            }
            setTimeout(() => sfx.play('miss'), 60);
        }
        this.drawTracer(origin, dir, muzzle, end);
        return hits.length > 0 || solid >= 0;
    }

    // Un tiro a algo que aguanta más (calabaza): se resquebraja, salta un trozo y el hitmarker
    damage(s) {
        const C = fxOf(this.crop);
        s.flash = 1;
        this.particles.burst(s.x, s.size * 0.6, s.z, 26, C.burst, { speed: 3, up: 3.5, size: 0.1, ttl: 0.7 });
        this.waves.spawn(s.x, s.z, 0xffe9a0, 1.2, 0.25);
        this.hooks.sfx.play('crateHit');
        if (this.hooks.onHitMarker) this.hooks.onHitMarker();
        vibrate('pickup');
    }

    // Blancos recogidos (por una bala, una granada, bombas...): saltan, cuentan para la racha
    // (doble, triple, multi kill y las recompensas) y, si no queda nada, se acaba el campo.
    // auto: los recogen las torretas automáticas (no cuentan para la racha)
    harvest(list, auto = false) {
        const { sfx } = this.hooks, C = fxOf(this.crop);
        list.forEach((s, k) => {
            s.alive = false;
            s.dying = 0.14 + Math.min(k, 6) * 0.05;
            s.flash = 1;
            // Grano y paja (o zumo y pepitas de tomate) que saltan, polvo de tierra y una onda
            this.particles.burst(s.x, s.y, s.z, 50, C.burst, { speed: 3.6, up: 4.2, size: 0.09, ttl: 1.0 });
            this.particles.burst(s.x, s.y - 0.3, s.z, 30, C.chaff, { speed: 2.4, up: 3, size: 0.06, ttl: 1.2, grav: 4 });
            this.particles.burst(s.x, 0.1, s.z, 12, [this.theme.dust, 0x8a5a34], { speed: 1.8, up: 1, size: 0.12, ttl: 0.5 });
            this.waves.spawn(s.x, s.z, 0xffe9a0, 1.8, 0.35);
            _v.set(s.x, s.y, s.z).project(this.camera);
            this.hooks.onHit(s, _v.x, _v.y);
            if (k && k < 6) setTimeout(() => sfx.play('harvest'), k * 90);
        });
        sfx.play('harvest');
        if (!auto) {
            vibrate('pickup');
            this.addStreak(list.length);
        }
        this.checkEnd();
    }

    // Sin nada que recoger (ni nadie huyendo con algo robado, ni la nuclear a punto): se acaba
    checkEnd() {
        // (en el campo de pruebas no se acaba: al poco vuelven a salir)
        if (this.practice) {
            if (this.field.remaining === 0 && !this.respawnT) this.respawnT = 1.4;
            return;
        }
        if (this.field.remaining === 0 && !this.ks.holdsEnd && !this.walkers.carrying && !this.flyers.carrying && this.ending < 0 && !this.unlocking) this.finish();
    }

    // Racha de granadas: sube y la barra se rellena, cada vez durando menos. Al llegar a cada
    // número se lanza su granada.
    // Las rachas de un tipo que lleva la clase equipada (ksIds: sus ids; sin clase, todas)
    streaks(track) {
        return streakOf(track).filter((k) => !this.ksIds || this.ksIds.includes(k.id));
    }

    addStreak(n) {
        const prev = this.streak;
        this.streak += n;
        this.streakMax = Math.max(KS.bar.min, KS.bar.time * KS.bar.decay ** (this.streak - 1));
        this.streakT = this.streakMax;
        if (!this.scripted && this.tracks.crop) for (const k of this.streaks('crop')) if (prev < k.at && this.streak >= k.at) this.ks.trigger(k.id);
    }

    // Racha alienígena: cada alienígena abatido suma (no se pierde con el tiempo) y al llegar a
    // cada número se lanza su recompensa
    // Las medallas DOBLE / TRIPLE / MULTI KILL son solo de alienígenas (abatidos seguidos, con
    // menos de 3 s entre uno y otro)
    addAlien(n) {
        const prev = this.aliens;
        this.aliens += n;
        this.alienChain = this.time - (this.alienAt ?? -9) < 3 ? (this.alienChain || 0) + n : n;
        this.alienAt = this.time;
        if (this.hooks.onMedal && this.alienChain >= 2 && this.alienChain - n < 4) this.hooks.onMedal({ streak: Math.min(4, this.alienChain) });
        if (!this.scripted && this.tracks.alien) for (const k of this.streaks('alien')) if (prev < k.at && this.aliens >= k.at) this.ks.trigger(k.id);
    }

    // Lo que hay a menos de r de un punto del suelo (explosiones y fuego): los alienígenas
    // abatidos y los blancos recogidos
    catchAt(x, z, r) {
        for (const w of this.walkers.near(x, z, r)) this.walkers.shoot(w);
        const caught = this.field.targets.filter((s) => s.alive && s.landed && Math.hypot(s.x - x, s.z - z) <= r);
        if (caught.length) this.harvest(caught);
    }

    // Explosión en el suelo (granada, misil, bombas): fuego, humo, polvo y ondas, y se recoge
    // todo lo que quede a menos de r. k: tamaño (1 = normal)
    blast(x, z, r, k = 1) {
        const P = this.particles, { sfx } = this.hooks;
        P.burst(x, 0.5, z, 90 * k, FIRE, { speed: 8 * k, up: 7 * k, size: 0.35 * k, ttl: 0.8, grav: 3 });
        P.burst(x, 0.8, z, 40 * k, SMOKE, { speed: 3 * k, up: 4 * k, size: 0.7 * k, ttl: 2, grav: -1.5 });
        P.burst(x, 0.2, z, 60 * k, [this.theme.dust, 0x8a5a34], { speed: 9 * k, up: 2, size: 0.25 * k, ttl: 0.9, grav: 4 });
        this.waves.spawn(x, z, 0xffe03a, r * 1.6, 0.5);
        this.waves.spawn(x, z, 0xffffff, r * 0.8, 0.3);
        this.trauma = Math.min(1, this.trauma + 0.3 * k);
        sfx.play(Math.random() < 0.5 ? 'boom' : 'crateBreak');
        vibrate('crate');
        this.catchAt(x, z, r);
    }

    drawTracer(origin, dir, muzzle, end) {
        const from = this.scoped ? origin.clone().addScaledVector(dir, 1.5).add(_v.set(0, -0.15, 0)) : muzzle;
        this.tracer.position.copy(from).lerp(end, 0.5);
        this.tracer.lookAt(end);
        this.tracer.scale.set(0.03, 0.03, from.distanceTo(end));
        this.tracer.visible = true;
        this.tracerT = 0.06;
    }

    // Desbloqueo: el barril revienta todo; la chatarra solo suelta chispas
    fireAtJunk(origin, dir, muzzle) {
        const { sfx } = this.hooks;
        const hit = this.field.raycastJunk(origin, dir);
        const t = hit ? hit.t : dir.y < -1e-3 ? Math.min(80, -origin.y / dir.y) : 80;
        const end = origin.clone().addScaledVector(dir, t);
        this.drawTracer(origin, dir, muzzle, end);
        if (hit && hit.barrel) {
            this.explode();
            return true;
        }
        if (hit) {
            this.particles.burst(end.x, end.y, end.z, 16, [0xffffff, 0xffe03a, 0xff9a1f], { speed: 3, up: 2.5, size: 0.06, ttl: 0.35 });
            setTimeout(() => sfx.play('wall'), 60);
        } else {
            if (end.y < 0.5) this.particles.burst(end.x, 0.05, end.z, 14, [0x8a5a34, 0x6f8a3a, this.theme.dust], { speed: 1.6, up: 2.2, size: 0.08, ttl: 0.5 });
            setTimeout(() => sfx.play('miss'), 60);
        }
        return false;
    }

    // ¡BOOM! Fogonazo, bola de fuego, hongo de humo, chatarra por los aires, ondas que
    // recorren todo el campo y explosiones en cadena por el montón; la tierra queda limpia
    explode() {
        const { sfx } = this.hooks;
        const b = this.field.barrel;
        this.field.explode();
        const P = this.particles;
        const blast = (x, y, z, k) => {
            P.burst(x, y, z, 260 * k, FIRE, { speed: 20 * k, up: 15 * k, size: 0.7 * k, ttl: 1.1, grav: 2 });
            P.burst(x, y, z, 160 * k, RUST, { speed: 24 * k, up: 18 * k, size: 0.22 * k, ttl: 2.2, grav: 16 });
        };
        blast(b.x, b.y, b.z, 1);
        // Hongo: columna de humo que sube y se abre arriba
        P.burst(b.x, b.y + 1, b.z, 220, SMOKE, { speed: 5, up: 10, size: 1.5, ttl: 4, grav: -2.5 });
        P.burst(b.x, b.y + 6, b.z, 120, [...SMOKE, 0xff9a1f], { speed: 9, up: 3, size: 1.8, ttl: 3.2, grav: -1 });
        // Polvo que barre el suelo hacia fuera
        P.burst(b.x, 0.3, b.z, 260, [this.theme.dust, 0x8a5a34, 0x6f8a3a], { speed: 26, up: 1.5, size: 0.6, ttl: 1.6, grav: 1 });
        for (const [r, ttl, col] of [[8, 0.4, 0xffffff], [16, 0.7, 0xffe03a], [28, 1.1, 0xff9a1f], [40, 1.6, 0xfff3d6]]) this.waves.spawn(b.x, b.z, col, r, ttl);
        // Explosiones en cadena por el montón
        for (let k = 1; k <= 4; k++) {
            setTimeout(() => {
                if (!this.unlocking) return;
                const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 4;
                blast(b.x + Math.sin(a) * d, 0.8, b.z + Math.cos(a) * d, 0.5);
                this.waves.spawn(b.x + Math.sin(a) * d, b.z + Math.cos(a) * d, 0xffe03a, 10, 0.6);
                this.trauma = Math.min(1, this.trauma + 0.5);
                sfx.play(k % 2 ? 'crateBreak' : 'boom');
            }, 180 + k * 230);
        }
        this.trauma = 1;
        this.hitStop = 0.18;
        sfx.play('boom');
        setTimeout(() => sfx.play('crateBreak'), 60);
        setTimeout(() => sfx.play('boom'), 140);
        vibrate('kill');
        if (this.hooks.onUnlock) this.hooks.onUnlock();
        this.ending = 0;
        this.slowmo = S.slowmoTime * 1.8;
        setTimeout(() => sfx.play('win'), 1400);
    }

    finish() {
        this.ks.stopControl();
        this.ending = 0;
        this.slowmo = S.slowmoTime;
        this.hooks.sfx.play('win');
        if (this.hooks.onFinish) this.hooks.onFinish();
    }

    update(rawDt) {
        let dt = rawDt;
        if (this.hitStop > 0) {
            this.hitStop -= rawDt;
            dt = 0;
        } else if (this.slowmo > 0) {
            this.slowmo -= rawDt;
            dt *= S.slowmo;
        }
        this.time += dt;
        const time = this.time;
        // La barra de la racha se vacía (no mientras se guía el misil o cuenta la nuclear)
        if (this.streak > 0 && !this.ks.paused && this.ending < 0 && (this.streakT -= dt) <= 0) this.streak = this.streakT = 0;
        this.ks.update(dt, rawDt);
        this.flyers.update(dt, time);
        this.walkers.update(dt, time);
        this.box.update(dt, time);
        if (this.dropT > 0 && (this.dropT -= rawDt) <= 0) this.dropSpecial();
        if (this.respawnT > 0 && (this.respawnT -= rawDt) <= 0) this.setTargets(); // (campo de pruebas: otra tanda)
        // La pistola de rayos, sobrecalentada tras cada rayo: echa vapor por la boca hasta enfriarse
        if (this.overheat > 0) {
            this.overheat -= rawDt;
            if (Math.random() < rawDt * 22) {
                this.rifle.muzzle.getWorldPosition(_o);
                this.particles.burst(_o.x, _o.y, _o.z, 2, [0xffffff, 0xd8d8d8, 0xb8ffb0], { speed: 0.3, up: 0.9, size: 0.05, ttl: 0.6, grav: -0.8 });
            }
        }
        if (this.swapT > 0 && (this.swapT -= rawDt) <= 0) this.endSpecial();
        this.updateNightSky();
        if (this.crop) this.checkEnd();
        this.turrets.update(dt);

        if (this.move) {
            const m = this.move;
            m.t = Math.min(1, m.t + rawDt / S.cornerTime);
            const e = easeInOut(m.t);
            this.pos.lerpVectors(m.from, m.to, e);
            this.pos.y += Math.sin(e * Math.PI) * 1.2; // salto de torre a torre
            // Inclinación de la cabeza hacia el lado al que se va (la vista sigue siendo tuya)
            const side = Math.sign(_v.subVectors(m.to, m.from).dot(_o.set(Math.cos(this.lookYaw), 0, -Math.sin(this.lookYaw)))) || 1;
            this.roll = Math.sin(e * Math.PI) * 0.07 * side;
            if (m.t >= 1) {
                this.corner = m.idx;
                this.move = null;
                this.roll = 0;
                this.dipV -= 2.2; // aterrizaje: las piernas amortiguan
                this.trauma = Math.min(1, this.trauma + 0.2);
                const t = this.practice ? { x: this.pos.x, z: this.pos.z, floor: 0 } : this.field.towers[this.corner];
                if (t.model) t.model.select();
                this.particles.burst(t.x, t.floor + 0.1, t.z, 14, [this.theme.dust, 0xb07a44], { speed: 1.6, up: 1.2, size: 0.08, ttl: 0.5 });
                this.hooks.sfx.play('drop');
                vibrate('pickup');
                if (this.hooks.onCorner) this.hooks.onCorner(this.corner);
            }
        }

        // Subir/bajar el arma al ojo; el zoom sigue al arma con su propia curva
        this.adsK = Math.min(1, Math.max(0, this.adsK + (this.scoped ? 1 : -1.3) * rawDt / this.stats.ads));
        // La mira recién subida tiembla y tarda en asentarse; bajarla lo reinicia
        this.settle = this.adsK < S.adsReady ? 1 : Math.max(0, this.settle - rawDt / (S.settleTime * (0.5 + 0.5 * this.stats.steady)));
        // Velocidad de giro de la vista (rad/s), suavizada
        if (rawDt > 0) this.turnSpeed += (this.turned / rawDt - this.turnSpeed) * (1 - Math.exp(-rawDt * 12));
        this.turned = 0;
        const zk = clamp((this.adsK - 0.3) / 0.7, 0, 1);
        this.fov = S.fov + (this.stats.zoom - S.fov) * zk * zk * (3 - 2 * zk);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
        this.bolt = Math.max(0, this.bolt - dt);
        // El cargador: la recarga corre; la célula alienígena va regenerando balas
        if (this.reloadT > 0 && (this.reloadT -= dt) <= 0) {
            this.reloadT = 0;
            this.ammo = this.stats.size;
            this.hooks.sfx.play('reloaded');
        }
        if (this.stats.regen && this.ammo < this.stats.size && (this.regenT += dt) >= this.stats.regen) {
            this.regenT = 0;
            this.ammo++;
        }
        if (this.pending && this.canFire) this.release(true);

        // Muelles del retroceso y del aterrizaje
        this.kickV += (-170 * this.kickP - 20 * this.kickV) * rawDt;
        this.kickP += this.kickV * rawDt;
        this.dipV += (-90 * this.dipP - 12 * this.dipV) * rawDt;
        this.dipP += this.dipV * rawDt;
        const tr = this.trauma * this.trauma;
        this.trauma = Math.max(0, this.trauma - rawDt * 2.4);
        const shake = tr * 0.025 * (this.fov / S.fov);
        // Respiración con la mira (un ocho lento)
        const sw = S.sway * this.adsK * this.stats.steady;
        const jitter = this.adsK >= S.adsReady ? S.settleSway * this.settle * this.settle * this.stats.steady : 0;
        const fovK = this.fov / S.fov;
        this.yaw = this.lookYaw + Math.sin(time * 0.9) * sw + Math.sin(time * 11) * jitter + this.kickYaw * this.kickP * 10 + (Math.random() * 2 - 1) * shake;
        this.pitch = clamp(this.lookPitch + Math.sin(time * 1.8) * sw * 0.6 + Math.cos(time * 13) * jitter * 0.8 + this.kickP * fovK + (Math.random() * 2 - 1) * shake, -1.5, 1.5);
        this.camera.position.copy(this.pos);
        this.camera.position.y += this.dipP * 0.12 + (this.move ? 0 : Math.sin(time * 1.6) * 0.008 * (1 - this.adsK));
        this.camera.rotation.set(this.pitch, this.yaw, this.roll);

        const bob = this.move ? -Math.sin(this.move.t * Math.PI * 2) * 0.03 : Math.sin(time * 1.6) * 0.004 + this.dipP * 0.05;
        this.rifle.update(rawDt, wrapAngle(this.yaw - this.prevYaw), this.pitch - this.prevPitch, bob, this.adsK);
        this.prevYaw = this.yaw;
        this.prevPitch = this.pitch;
        // La mira tapa el arma cuando está pegada al ojo; guiando el misil, la vista es la suya
        this.rifle.root.visible = (this.adsK < 0.85 || !!this.special) && !this.ks.predator && !this.hideRifle;
        if (this.ks.predator) {
            this.ks.aimCamera(this.camera);
            this.fov = this.camera.fov;
        }

        // El barril, esperando: suelta humo y chispas para que se vea que es el blanco
        const B = this.unlocking && !this.field.exploded && this.field.barrel;
        if (B && (this.puffT -= dt) <= 0) {
            this.puffT = 0.09;
            this.particles.spawn(B.x + (Math.random() - 0.5) * 0.3, B.y + 0.55, B.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, 1 + Math.random(), (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.15, 1.3, Math.random() < 0.7 ? SMOKE[(Math.random() * 2) | 0] : 0xffe03a, -0.8);
        }
        this.field.update(dt, time, this.pos, (s) => {
            this.particles.burst(s.x, 0.05, s.z, 6, [this.theme.dust, 0xc8c84a], { speed: 1.2, up: 1, size: 0.07, ttl: 0.4 });
        });
        if (this.tracerT > 0) {
            this.tracerT -= rawDt;
            if (this.tracerT <= 0) this.tracer.visible = false;
        }
        this.particles.update(dt);
        this.particles.sync();
        this.waves.update(dt);

        if (this.ending >= 0) {
            const before = this.ending;
            this.ending += rawDt;
            if (this.ending > 0.45 && this.scoped) this.setAds(false);
            // Lluvia de lo cosechado durante la celebración (tras la explosión, humo y chispas)
            if (Math.floor(this.ending * 10) !== Math.floor(before * 10)) {
                if (this.unlocking) {
                    const b = this.field.junk && this.field.junk.center;
                    if (b && this.ending < 3.5) this.particles.burst(b.x + (Math.random() - 0.5) * 6, 0.4, b.z + (Math.random() - 0.5) * 6, 14, Math.random() < 0.35 ? FIRE : SMOKE, { speed: 1.5, up: 4, size: 1, ttl: 2, grav: -1.5 });
                } else {
                    this.camera.getWorldDirection(_v);
                    const p = _o.copy(this.pos).addScaledVector(_v, 7);
                    this.particles.burst(p.x + (Math.random() - 0.5) * 5, p.y + 2, p.z + (Math.random() - 0.5) * 5, 16, [...fxOf(this.crop).burst, 0xffffff], { speed: 1.6, up: 1.5, size: 0.08, ttl: 1.5, grav: 4 });
                }
            }
            const doneAt = this.unlocking ? 4.6 : 2.6;
            if (this.ending > doneAt && before <= doneAt) this.hooks.onDone();
        }
    }
}
