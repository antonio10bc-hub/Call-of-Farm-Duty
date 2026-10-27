import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, wrapAngle } from '../core/math.js';
import { box } from '../render/materials.js';
import { Particles } from '../render/Particles.js';
import { Shockwaves } from '../render/Shockwaves.js';
import { RifleModel } from '../render/RifleModel.js';
import { SniperField } from '../world/SniperField.js';
import { vibrate } from '../core/Haptics.js';

const S = CONFIG.sniper;
const WHEAT_BURST = [0xffd23f, 0xfff0a0, 0xe6a400, 0xffffff];
const CONFETTI = [0xffe03a, 0xff3e8e, 0x23e0d6, 0xff9a1f, 0x7b5cff, 0xb6ff5c, 0xffffff];
const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Modo francotirador en primera persona: una torreta en cada esquina del campo, mira con
// zoom y haces de trigo que se recogen de un disparo.
export class Sniper {
    // hooks: { sfx, onHit(sheaf, screenX, screenY), onDone(), onCorner(i) }
    constructor(theme, hooks) {
        this.theme = theme;
        this.hooks = hooks;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(theme.sky);
        this.field = new SniperField(theme, S.eyeHeight);
        this.scene.add(this.field.root);
        this.particles = new Particles(this.scene, 800);
        this.waves = new Shockwaves(this.scene);

        this.camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, 400);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);
        this.rifle = new RifleModel(theme.outline);
        this.camera.add(this.rifle.root);

        // Trazador de la bala: una barrita amarilla que dura un instante
        this.tracer = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff4b0 }));
        this.tracer.visible = false;
        this.scene.add(this.tracer);
        this.tracerT = 0;

        this.corner = 0;
        this.pos = new THREE.Vector3();
        this.aimYaw = 0;
        this.aimPitch = 0;
        this.scoped = false;
        this.fov = S.fov;
        this.bolt = 0;
        this.recoil = 0;
        this.trauma = 0;
        this.hitStop = 0;
        this.slowmo = 0;
        this.move = null;
        this.time = 0;
        this.ending = -1;
        this.prevYaw = 0;
        this.prevPitch = 0;
    }

    // plots: [{ plot, count }] parcelas listas y cuántos haces quedan en cada una
    enter(plots) {
        this.field.restartIntro();
        this.field.spawnSheaves(plots);
        this.particles.clear();
        this.waves.clear();
        this.corner = 0;
        this.move = null;
        this.placeAt(this.corner);
        this.aimYaw = this.aimPitch = 0;
        this.scoped = false;
        this.fov = S.fov;
        this.bolt = 0;
        this.ending = -1;
        this.slowmo = 0;
        this.hitStop = 0;
    }

    leave() {
        this.field.clearSheaves();
        this.particles.clear();
    }

    eyeOf(i, out = new THREE.Vector3()) {
        const t = this.field.towers[i];
        return out.set(t.x, t.floor + 1.35, t.z);
    }

    placeAt(i) {
        this.eyeOf(i, this.pos);
    }

    get moving() {
        return !!this.move;
    }

    // Salta a la esquina vecina (dir: +1 / -1)
    goCorner(dir) {
        if (this.move || this.ending >= 0) return;
        const n = this.field.towers.length;
        const to = (this.corner + dir + n) % n;
        this.move = { from: this.pos.clone(), to: this.eyeOf(to), t: 0, idx: to };
        this.setScoped(false);
        this.aimYaw = this.aimPitch = 0;
        this.hooks.sfx.play('corner');
    }

    // Dirección base: mirando al centro del campo
    baseYaw() {
        return Math.atan2(-(this.field.cx - this.pos.x), -(this.field.cz - this.pos.z));
    }

    basePitch() {
        const d = Math.hypot(this.field.cx - this.pos.x, this.field.cz - this.pos.z);
        return Math.atan2(-(this.pos.y - 0.4), d);
    }

    setScoped(on) {
        if (on === this.scoped) return;
        this.scoped = on;
        this.hooks.sfx.play(on ? 'scopeIn' : 'scopeOut');
    }

    // Toque fuera de la mira: apunta a ese punto de la pantalla y entra en la mira
    scopeAt(nx, ny) {
        if (this.move || this.ending >= 0) return;
        _ndc.set(nx, ny);
        _ray.setFromCamera(_ndc, this.camera);
        const d = _ray.ray.direction;
        const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(clamp(d.y, -1, 1));
        this.aimYaw = clamp(wrapAngle(yaw - this.baseYaw()), -S.yawLimit, S.yawLimit);
        this.aimPitch = clamp(pitch - this.basePitch(), -0.5, 0.6);
        this.setScoped(true);
    }

    // Arrastre con la mira puesta (píxeles de pantalla); más fino cuanto más zoom
    aim(dx, dy) {
        const k = S.aimSpeed * (this.fov / S.fov);
        this.aimYaw = clamp(this.aimYaw - dx * k, -S.yawLimit, S.yawLimit);
        this.aimPitch = clamp(this.aimPitch - dy * k, -0.5, 0.6);
    }

    get canFire() {
        return this.bolt <= 0 && !this.move && this.ending < 0;
    }

    fire() {
        if (!this.canFire) return false;
        const { sfx } = this.hooks;
        this.bolt = S.boltTime;
        this.recoil = 1;
        this.trauma = Math.min(1, this.trauma + 0.35);
        this.rifle.fire();
        sfx.play('snipe');
        setTimeout(() => sfx.play('bolt'), 320);
        vibrate('crate');

        const cam = this.camera;
        cam.updateMatrixWorld();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        const dir = cam.getWorldDirection(new THREE.Vector3());
        // Chispas en la boca del cañón (solo se ven sin la mira)
        this.rifle.muzzle.getWorldPosition(_o);
        if (!this.scoped) this.particles.burst(_o.x, _o.y, _o.z, 10, [0xffffff, 0xffe03a, 0xff9a1f], { speed: 1.4, up: 0.6, size: 0.05, ttl: 0.16, grav: 0 });

        const hit = this.field.raycast(origin, dir);
        let end;
        if (hit) {
            const s = hit.sheaf;
            end = origin.clone().addScaledVector(dir, hit.t);
            s.alive = false;
            s.dying = 0.14;
            s.model.hit();
            this.hitStop = S.hitStop;
            this.trauma = Math.min(1, this.trauma + 0.2);
            const y = 0.6;
            this.particles.burst(s.x, y, s.z, 46, WHEAT_BURST, { speed: 4.2, up: 4.5, size: 0.16, ttl: 0.9 });
            this.particles.burst(s.x, y, s.z, 22, CONFETTI, { speed: 2.6, up: 5, size: 0.09, ttl: 1.2, grav: 7 });
            this.particles.burst(s.x, 0.1, s.z, 12, [0xf4ffd8, 0x9ae86e], { speed: 2, up: 1, size: 0.14, ttl: 0.5 });
            this.waves.spawn(s.x, s.z, 0xffe03a, 2.2, 0.4);
            vibrate('pickup');
            sfx.play('harvest');
            _v.set(s.x, y, s.z).project(cam);
            this.hooks.onHit(s, _v.x, _v.y);
            if (this.field.remaining === 0) this.finish();
        } else {
            // Al suelo: polvo donde da
            const t = dir.y < -1e-3 ? -origin.y / dir.y : 60;
            end = origin.clone().addScaledVector(dir, Math.min(t, 80));
            if (dir.y < -1e-3 && t < 80) {
                this.particles.burst(end.x, 0.05, end.z, 14, [0x8a5a34, 0x9ae86e, 0xf4ffd8], { speed: 1.6, up: 2.2, size: 0.12, ttl: 0.5 });
                this.waves.spawn(end.x, end.z, 0xffffff, 0.8, 0.25);
            }
            setTimeout(() => sfx.play('miss'), 60);
        }
        // Trazador desde un poco por debajo de la vista
        const from = this.scoped ? origin.clone().addScaledVector(dir, 1.5).add(_v.set(0, -0.15, 0)) : _o.clone();
        const len = from.distanceTo(end);
        this.tracer.position.copy(from).lerp(end, 0.5);
        this.tracer.lookAt(end);
        this.tracer.scale.set(0.04, 0.04, len);
        this.tracer.visible = true;
        this.tracerT = 0.06;
        return !!hit;
    }

    // Último haz: cámara lenta, confeti y vuelta a la granja
    finish() {
        this.ending = 0;
        this.slowmo = S.slowmoTime;
        this.hooks.sfx.play('win');
        if (this.hooks.onFinish) this.hooks.onFinish();
    }

    update(rawDt) {
        // Hit-stop y cámara lenta
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
            this.pos.y += Math.sin(e * Math.PI) * 1.4; // saltito de torreta a torreta
            if (m.t >= 1) {
                this.corner = m.idx;
                this.move = null;
                this.trauma = Math.min(1, this.trauma + 0.25);
                const t = this.field.towers[this.corner];
                this.particles.burst(t.x, t.floor + 0.05, t.z, 16, [this.theme.dust, 0xffd23f], { speed: 2, up: 1.5, size: 0.12, ttl: 0.5 });
                this.hooks.sfx.play('drop');
                if (this.hooks.onCorner) this.hooks.onCorner(this.corner);
            }
        }

        // Zoom suave hacia la mira (o fuera de ella)
        this.fov = damp(this.fov, this.scoped ? S.scopeFov : S.fov, 14, rawDt);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
        this.bolt = Math.max(0, this.bolt - dt);
        this.recoil = Math.max(0, this.recoil - rawDt * 4);
        const tr = this.trauma * this.trauma;
        this.trauma = Math.max(0, this.trauma - rawDt * 2.2);
        const shake = tr * 0.03 * (this.fov / S.fov);

        // Vaivén de la respiración con la mira puesta
        const sw = this.scoped ? S.sway : 0;
        const yaw = this.baseYaw() + this.aimYaw + Math.sin(time * 1.3) * sw + (Math.random() * 2 - 1) * shake;
        const pitch = this.basePitch() + this.aimPitch + Math.cos(time * 0.9) * sw * 0.7 + this.recoil * this.recoil * 0.06 * (this.fov / S.fov) + (Math.random() * 2 - 1) * shake;
        this.camera.position.copy(this.pos);
        this.camera.rotation.set(pitch, yaw, 0);

        const bob = this.move ? -Math.sin(this.move.t * Math.PI) * 0.08 : Math.sin(time * 2) * 0.006;
        this.rifle.update(rawDt, wrapAngle(yaw - this.prevYaw), pitch - this.prevPitch, bob);
        this.prevYaw = yaw;
        this.prevPitch = pitch;
        this.rifle.root.visible = this.fov > (S.fov + S.scopeFov) * 0.55;

        this.field.update(dt, time, this.pos, (s) => {
            this.particles.burst(s.x, 0.05, s.z, 10, [this.theme.dust, 0x9ae86e], { speed: 1.8, up: 1.2, size: 0.12, ttl: 0.45 });
            this.waves.spawn(s.x, s.z, 0xffffff, 1.2, 0.3);
            this.trauma = Math.min(1, this.trauma + 0.05);
            this.hooks.sfx.play('pop');
        });
        // Haces recién recogidos: se hinchan con el flash blanco y desaparecen
        for (const s of this.field.sheaves) {
            if (s.alive || !(s.dying > 0)) continue;
            s.dying -= rawDt;
            const k = 1 + (0.14 - Math.max(0, s.dying)) * 3;
            s.model.root.scale.set(k, 2 - k, k);
            s.model.updateFx(0);
            if (s.dying <= 0) s.model.root.visible = false;
        }

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
            // Sale de la mira para ver la celebración entera
            if (this.ending > 0.45 && this.scoped) this.setScoped(false);
            // Confeti alrededor de la vista durante la celebración
            if (Math.floor(this.ending * 10) !== Math.floor(before * 10)) {
                this.camera.getWorldDirection(_v);
                const p = _o.copy(this.pos).addScaledVector(_v, 6);
                this.particles.burst(p.x + (Math.random() - 0.5) * 4, p.y + 2, p.z + (Math.random() - 0.5) * 4, 14, CONFETTI, { speed: 2, up: 2, size: 0.1, ttl: 1.4, grav: 5 });
            }
            if (this.ending > 2.6 && before <= 2.6) this.hooks.onDone();
        }
    }
}
