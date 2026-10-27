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
const GRAIN = [0xf6cf4a, 0xffe9a0, 0xd9a42e, 0xfff6dc];
const CHAFF = [0xe8b830, 0xc8c84a, 0xfff3d6];
const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Modo francotirador en primera persona. Un solo gesto: mantener apunta (la mira hace zoom
// hacia ese punto), mover la mirilla la desplaza despacio y soltar dispara. Se puede apuntar y
// disparar también mientras se salta de una torre a otra.
export class Sniper {
    // hooks: { sfx, onHit(target, ndcX, ndcY), onFinish(), onDone(), onCorner(i) }
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
        // Dirección absoluta de la vista (mientras se apunta) y la que se ve ahora mismo
        this.aimYaw = 0;
        this.aimPitch = 0;
        this.yaw = 0;
        this.pitch = 0;
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

    enter(plots) {
        this.field.restartIntro();
        this.field.spawnSheaves(plots);
        this.particles.clear();
        this.waves.clear();
        this.corner = 0;
        this.move = null;
        this.eyeOf(0, this.pos);
        this.scoped = false;
        this.fov = S.fov;
        this.yaw = this.aimYaw = this.baseYaw();
        this.pitch = this.aimPitch = this.basePitch();
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
        return out.set(t.x, t.floor + 1.15, t.z);
    }

    get moving() {
        return !!this.move;
    }

    // Salta a la torre vecina (dir: +1 / -1). La mira sigue puesta si lo estaba.
    goCorner(dir) {
        if (this.move || this.ending >= 0) return;
        const n = this.field.towers.length;
        const to = (this.corner + dir + n) % n;
        this.move = { from: this.pos.clone(), to: this.eyeOf(to), t: 0, idx: to };
        this.hooks.sfx.play('corner');
    }

    baseYaw() {
        return Math.atan2(-(this.field.cx - this.pos.x), -(this.field.cz - this.pos.z));
    }

    basePitch() {
        const d = Math.hypot(this.field.cx - this.pos.x, this.field.cz - this.pos.z);
        return Math.atan2(-(this.pos.y - 0.5), d);
    }

    // Mantener pulsado: apunta hacia ese punto de la pantalla (coordenadas -1..1) y hace zoom
    press(nx, ny) {
        if (this.ending >= 0) return;
        _ndc.set(nx, ny);
        this.camera.updateMatrixWorld();
        _ray.setFromCamera(_ndc, this.camera);
        const d = _ray.ray.direction;
        this.aimYaw = Math.atan2(-d.x, -d.z);
        this.aimPitch = Math.asin(clamp(d.y, -1, 1));
        this.clampAim();
        if (!this.scoped) {
            this.scoped = true;
            this.hooks.sfx.play('scopeIn');
        }
    }

    // Mover el dedo o el ratón con la mira puesta: la mirilla se desplaza despacio
    drag(dx, dy) {
        if (!this.scoped) return;
        const k = S.aimSpeed * (this.fov / S.fov + 0.15);
        this.aimYaw -= dx * k;
        this.aimPitch -= dy * k;
        this.clampAim();
    }

    // Soltar: dispara (si el cerrojo está listo) y sale de la mira
    release(fire = true) {
        if (!this.scoped) return false;
        const hit = fire ? this.fire() : false;
        this.scoped = false;
        if (!fire) this.hooks.sfx.play('scopeOut');
        return hit;
    }

    clampAim() {
        const by = this.baseYaw();
        this.aimYaw = by + clamp(wrapAngle(this.aimYaw - by), -S.yawLimit, S.yawLimit);
        this.aimPitch = clamp(this.aimPitch, -0.9, 0.35);
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
        this.recoil = 1;
        this.trauma = Math.min(1, this.trauma + 0.35);
        this.rifle.fire();
        sfx.play('snipe');
        setTimeout(() => sfx.play('bolt'), 320);
        vibrate('crate');

        // El disparo sale hacia donde apunta la mira (no hacia donde se ha ido el retroceso)
        const origin = this.pos.clone();
        const cp = Math.cos(this.aimPitch);
        const dir = new THREE.Vector3(-Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), -Math.cos(this.aimYaw) * cp);
        this.rifle.muzzle.getWorldPosition(_o);
        this.particles.burst(_o.x, _o.y, _o.z, 10, [0xffffff, 0xffe03a, 0xff9a1f], { speed: 1.4, up: 0.6, size: 0.04, ttl: 0.16, grav: 0 });

        const hit = this.field.raycast(origin, dir);
        let end;
        if (hit) {
            const s = hit.sheaf;
            end = origin.clone().addScaledVector(dir, hit.t);
            s.alive = false;
            s.dying = 0.14;
            s.flash = 1;
            this.hitStop = S.hitStop;
            this.trauma = Math.min(1, this.trauma + 0.2);
            // Grano y paja que saltan, polvo de tierra y una onda en el suelo
            this.particles.burst(s.x, 0.9, s.z, 50, GRAIN, { speed: 3.6, up: 4.2, size: 0.09, ttl: 1.0 });
            this.particles.burst(s.x, 0.6, s.z, 30, CHAFF, { speed: 2.4, up: 3, size: 0.06, ttl: 1.2, grav: 4 });
            this.particles.burst(s.x, 0.1, s.z, 12, [this.theme.dust, 0x8a5a34], { speed: 1.8, up: 1, size: 0.12, ttl: 0.5 });
            this.waves.spawn(s.x, s.z, 0xffe9a0, 1.8, 0.35);
            vibrate('pickup');
            sfx.play('harvest');
            _v.set(s.x, 0.9, s.z).project(this.camera);
            this.hooks.onHit(s, _v.x, _v.y);
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
        const from = this.scoped ? origin.clone().addScaledVector(dir, 1.5).add(_v.set(0, -0.15, 0)) : _o.clone();
        this.tracer.position.copy(from).lerp(end, 0.5);
        this.tracer.lookAt(end);
        this.tracer.scale.set(0.03, 0.03, from.distanceTo(end));
        this.tracer.visible = true;
        this.tracerT = 0.06;
        return !!hit;
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
            const before = this.baseYaw();
            m.t = Math.min(1, m.t + rawDt / S.cornerTime);
            const e = easeInOut(m.t);
            this.pos.lerpVectors(m.from, m.to, e);
            this.pos.y += Math.sin(e * Math.PI) * 1.2; // tirolina/salto de torre a torre
            // Sin mira, la vista acompaña al centro del campo
            if (!this.scoped) this.aimYaw += wrapAngle(this.baseYaw() - before);
            if (m.t >= 1) {
                this.corner = m.idx;
                this.move = null;
                this.trauma = Math.min(1, this.trauma + 0.25);
                const t = this.field.towers[this.corner];
                t.model.select();
                this.particles.burst(t.x, t.floor + 0.1, t.z, 14, [this.theme.dust, 0xb07a44], { speed: 1.6, up: 1.2, size: 0.08, ttl: 0.5 });
                this.hooks.sfx.play('drop');
                if (this.hooks.onCorner) this.hooks.onCorner(this.corner);
            }
        }

        // Sin mira la vista vuelve sola a mirar al centro del campo
        if (!this.scoped) {
            this.aimYaw = this.baseYaw() + wrapAngle(this.aimYaw - this.baseYaw()) * Math.exp(-rawDt * 3);
            this.aimPitch = damp(this.aimPitch, this.basePitch(), 3, rawDt);
        }
        this.fov = damp(this.fov, this.scoped ? S.scopeFov : S.fov, 12, rawDt);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
        this.bolt = Math.max(0, this.bolt - dt);
        this.recoil = Math.max(0, this.recoil - rawDt * 4);
        const tr = this.trauma * this.trauma;
        this.trauma = Math.max(0, this.trauma - rawDt * 2.2);
        const shake = tr * 0.03 * (this.fov / S.fov);
        const sw = this.scoped ? S.sway : 0;
        this.yaw = this.aimYaw + Math.sin(time * 1.3) * sw + (Math.random() * 2 - 1) * shake;
        this.pitch = this.aimPitch + Math.cos(time * 0.9) * sw * 0.7 + this.recoil * this.recoil * 0.06 * (this.fov / S.fov) + (Math.random() * 2 - 1) * shake;
        this.camera.position.copy(this.pos);
        this.camera.rotation.set(this.pitch, this.yaw, 0);

        const bob = this.move ? -Math.sin(this.move.t * Math.PI) * 0.06 : Math.sin(time * 2) * 0.004;
        this.rifle.update(rawDt, wrapAngle(this.yaw - this.prevYaw), this.pitch - this.prevPitch, bob);
        this.prevYaw = this.yaw;
        this.prevPitch = this.pitch;
        this.rifle.root.visible = this.fov > (S.fov + S.scopeFov) * 0.55;

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
            if (this.ending > 0.45 && this.scoped) this.scoped = false;
            // Lluvia de grano dorado durante la celebración
            if (Math.floor(this.ending * 10) !== Math.floor(before * 10)) {
                this.camera.getWorldDirection(_v);
                const p = _o.copy(this.pos).addScaledVector(_v, 7);
                this.particles.burst(p.x + (Math.random() - 0.5) * 5, p.y + 2, p.z + (Math.random() - 0.5) * 5, 16, [...GRAIN, 0xffffff], { speed: 1.6, up: 1.5, size: 0.08, ttl: 1.5, grav: 4 });
            }
            if (this.ending > 2.6 && before <= 2.6) this.hooks.onDone();
        }
    }
}
