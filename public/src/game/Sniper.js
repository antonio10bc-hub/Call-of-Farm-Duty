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
export class Sniper {
    // hooks: { sfx, onHit(target, ndcX, ndcY), onMedal({ collateral, streak }), onUnlock(), onFinish(), onDone(), onCorner(i) }
    constructor(theme, hooks) {
        this.theme = theme;
        this.hooks = hooks;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(theme.sky);
        this.field = new SniperField(theme);
        this.scene.add(this.field.root);
        this.particles = new Particles(this.scene, 900);
        this.waves = new Shockwaves(this.scene);

        this.camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, 500);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);
        this.rifle = new RifleModel(theme.outline);
        this.camera.add(this.rifle.root);

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

    // what: { crop, count } para cosechar (count blancos de ese cultivo) o { unlock: true }
    enter(what) {
        this.unlocking = !!what.unlock;
        this.crop = what.crop || null;
        this.field.restartIntro();
        if (this.unlocking) this.field.spawnJunk();
        else this.field.spawn(what.crop, what.count);
        this.particles.clear();
        this.waves.clear();
        this.corner = 0;
        this.move = null;
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
        this.streak = 0; // matas seguidas, cada una a menos de multiKillTime de la anterior
        this.lastKill = -Infinity;
    }

    leave() {
        this.field.clearSheaves();
        this.particles.clear();
    }

    eyeOf(i, out = new THREE.Vector3()) {
        const t = this.field.towers[i];
        return out.set(t.x, t.floor + 1.15, t.z);
    }

    get moving() {
        return !!this.move;
    }

    // Salta a la torre vecina (dir: +1 / -1). La mira sigue puesta si lo estaba.
    goCorner(dir) {
        if (this.move || this.ending >= 0 || this.unlocking) return;
        const n = this.field.towers.length;
        const to = (this.corner + dir + n) % n;
        this.move = { from: this.pos.clone(), to: this.eyeOf(to), t: 0, idx: to };
        this.hooks.sfx.play('corner');
    }

    // Salta a la torre vecina que queda a la izquierda (side -1) o a la derecha (+1) de la vista
    goSide(side) {
        if (this.move || this.ending >= 0 || this.unlocking) return;
        const n = this.field.towers.length;
        const rx = Math.cos(this.lookYaw), rz = -Math.sin(this.lookYaw); // derecha de la vista
        const along = (d) => {
            const t = this.field.towers[(this.corner + d + n) % n];
            return (t.x - this.pos.x) * rx + (t.z - this.pos.z) * rz;
        };
        this.goCorner(along(1) * side >= along(-1) * side ? 1 : -1);
    }

    // Al entrar se mira al centro del campo (o, en el desbloqueo, hacia el montón de chatarra)
    aimPoint() {
        const b = this.unlocking && this.field.barrel;
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
        if (on === this.scoped || (on && this.ending >= 0)) return;
        this.scoped = on;
        this.hooks.sfx.play(on ? 'scopeIn' : 'scopeOut');
    }

    // Soltar: dispara (si el cerrojo está listo) y baja el arma
    // Si se suelta mientras el cerrojo aún recarga, el disparo queda guardado: el arma sigue
    // arriba y dispara en cuanto está lista (no se pierde la puntería)
    release(fire = true) {
        if (!this.scoped) return false;
        if (fire && this.bolt > 0 && this.ending < 0) {
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
        const hip = S.hipSpread * (1 - k * k * (3 - 2 * k));
        const settle = this.adsK >= S.adsReady ? S.settleSpread * this.settle : this.adsK > 0.4 ? S.settleSpread : 0;
        const turning = Math.min(S.lookSpreadMax, this.turnSpeed * S.lookSpread);
        return (hip + settle + turning) * (this.move ? 1 + S.moveSpread : 1);
    }

    get canFire() {
        return this.bolt <= 0 && this.ending < 0;
    }

    fire() {
        if (!this.canFire) {
            this.hooks.sfx.play('scopeOut');
            return false;
        }
        const { sfx } = this.hooks;
        this.bolt = S.boltTime;
        // Retroceso: la vista salta hacia arriba (y un poco de lado) y vuelve con un muelle
        this.kickV += S.recoil * (this.scoped ? 30 : 22);
        this.kickYaw = (Math.random() - 0.5) * S.recoil * 0.5;
        this.trauma = Math.min(1, this.trauma + (this.scoped ? 0.2 : 0.35));
        this.rifle.fire();
        sfx.play('snipe');
        setTimeout(() => sfx.play('bolt'), 320);
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

        if (this.unlocking) return this.fireAtJunk(origin, dir, muzzle);
        const hits = this.field.raycast(origin, dir);
        const C = CROPS[this.crop];
        let end;
        if (hits.length) {
            // La bala sigue tras la última mata hasta el suelo
            const tEnd = dir.y < -1e-3 ? Math.min(80, -origin.y / dir.y) : hits[hits.length - 1].t;
            end = origin.clone().addScaledVector(dir, tEnd);
            hits.forEach(({ sheaf: s }, k) => {
                s.alive = false;
                s.dying = 0.14 + k * 0.05;
                s.flash = 1;
                // Grano y paja (o zumo y pepitas de tomate) que saltan, polvo de tierra y una onda
                this.particles.burst(s.x, s.y, s.z, 50, C.burst, { speed: 3.6, up: 4.2, size: 0.09, ttl: 1.0 });
                this.particles.burst(s.x, s.y - 0.3, s.z, 30, C.chaff, { speed: 2.4, up: 3, size: 0.06, ttl: 1.2, grav: 4 });
                this.particles.burst(s.x, 0.1, s.z, 12, [this.theme.dust, 0x8a5a34], { speed: 1.8, up: 1, size: 0.12, ttl: 0.5 });
                this.waves.spawn(s.x, s.z, 0xffe9a0, 1.8, 0.35);
                _v.set(s.x, s.y, s.z).project(this.camera);
                this.hooks.onHit(s, _v.x, _v.y);
                if (k) setTimeout(() => sfx.play('harvest'), k * 90);
            });
            this.hitStop = S.hitStop * Math.min(3, hits.length);
            this.trauma = Math.min(1, this.trauma + 0.2 * hits.length);
            vibrate('pickup');
            sfx.play('harvest');
            // Medallas: colateral (varias de una bala) y racha (doble, triple, multi kill)
            this.streak = (this.time - this.lastKill < S.multiKillTime ? this.streak : 0) + hits.length;
            this.lastKill = this.time;
            if (this.hooks.onMedal) this.hooks.onMedal({ collateral: hits.length, streak: this.streak });
            if (this.field.remaining === 0) this.finish();
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
        return hits.length > 0;
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

    // ¡Boom! Fuego, humo y chatarra por los aires, ondas en el suelo y la tierra queda limpia
    explode() {
        const { sfx } = this.hooks;
        const b = this.field.barrel;
        this.field.explode();
        const P = this.particles;
        P.burst(b.x, b.y, b.z, 140, FIRE, { speed: 11, up: 9, size: 0.32, ttl: 0.9, grav: 3 });
        P.burst(b.x, b.y + 0.5, b.z, 70, SMOKE, { speed: 4, up: 5, size: 0.6, ttl: 2.4, grav: -1.5 });
        P.burst(b.x, b.y, b.z, 90, RUST, { speed: 14, up: 12, size: 0.16, ttl: 1.6, grav: 16 });
        P.burst(b.x, 0.2, b.z, 60, [this.theme.dust, 0x8a5a34], { speed: 9, up: 2, size: 0.3, ttl: 1.2, grav: 2 });
        for (const [r, ttl, col] of [[5, 0.4, 0xffffff], [10, 0.7, 0xffe03a], [16, 1.1, 0xff9a1f]]) this.waves.spawn(b.x, b.z, col, r, ttl);
        this.trauma = 1;
        this.hitStop = 0.14;
        sfx.play('boom');
        setTimeout(() => sfx.play('crateBreak'), 80);
        setTimeout(() => sfx.play('boom'), 220);
        vibrate('kill');
        if (this.hooks.onUnlock) this.hooks.onUnlock();
        this.ending = 0;
        this.slowmo = S.slowmoTime * 1.4;
        setTimeout(() => sfx.play('win'), 900);
    }

    finish() {
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
                const t = this.field.towers[this.corner];
                t.model.select();
                this.particles.burst(t.x, t.floor + 0.1, t.z, 14, [this.theme.dust, 0xb07a44], { speed: 1.6, up: 1.2, size: 0.08, ttl: 0.5 });
                this.hooks.sfx.play('drop');
                vibrate('pickup');
                if (this.hooks.onCorner) this.hooks.onCorner(this.corner);
            }
        }

        // Subir/bajar el arma al ojo; el zoom sigue al arma con su propia curva
        this.adsK = Math.min(1, Math.max(0, this.adsK + (this.scoped ? 1 : -1.3) * rawDt / S.adsTime));
        // La mira recién subida tiembla y tarda en asentarse; bajarla lo reinicia
        this.settle = this.adsK < S.adsReady ? 1 : Math.max(0, this.settle - rawDt / S.settleTime);
        // Velocidad de giro de la vista (rad/s), suavizada
        if (rawDt > 0) this.turnSpeed += (this.turned / rawDt - this.turnSpeed) * (1 - Math.exp(-rawDt * 12));
        this.turned = 0;
        const zk = clamp((this.adsK - 0.3) / 0.7, 0, 1);
        this.fov = S.fov + (S.scopeFov - S.fov) * zk * zk * (3 - 2 * zk);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
        this.bolt = Math.max(0, this.bolt - dt);
        if (this.pending && this.bolt <= 0) this.release(true);

        // Muelles del retroceso y del aterrizaje
        this.kickV += (-170 * this.kickP - 20 * this.kickV) * rawDt;
        this.kickP += this.kickV * rawDt;
        this.dipV += (-90 * this.dipP - 12 * this.dipV) * rawDt;
        this.dipP += this.dipV * rawDt;
        const tr = this.trauma * this.trauma;
        this.trauma = Math.max(0, this.trauma - rawDt * 2.4);
        const shake = tr * 0.025 * (this.fov / S.fov);
        // Respiración con la mira (un ocho lento)
        const sw = S.sway * this.adsK;
        const jitter = this.adsK >= S.adsReady ? S.settleSway * this.settle * this.settle : 0;
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
        // La mira tapa el arma cuando está pegada al ojo
        this.rifle.root.visible = this.adsK < 0.85;

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
                    if (b && this.ending < 2) this.particles.burst(b.x + (Math.random() - 0.5) * 3, 0.4, b.z + (Math.random() - 0.5) * 3, 8, Math.random() < 0.3 ? FIRE : SMOKE, { speed: 1.2, up: 3, size: 0.5, ttl: 1.6, grav: -1 });
                } else {
                    this.camera.getWorldDirection(_v);
                    const p = _o.copy(this.pos).addScaledVector(_v, 7);
                    this.particles.burst(p.x + (Math.random() - 0.5) * 5, p.y + 2, p.z + (Math.random() - 0.5) * 5, 16, [...CROPS[this.crop].burst, 0xffffff], { speed: 1.6, up: 1.5, size: 0.08, ttl: 1.5, grav: 4 });
                }
            }
            const doneAt = this.unlocking ? 3.4 : 2.6;
            if (this.ending > doneAt && before <= doneAt) this.hooks.onDone();
        }
    }
}
