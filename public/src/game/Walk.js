import { groundAt, isWater, regionAt } from '../world/valley.js';
import { damp } from '../core/math.js';

// Paseo en primera persona por el valle (experimental): WASD anda, ratón mira, Mayús corre,
// espacio salta. Coge la cámara de la granja y la deja donde estaba al salir.
const EYE = 1.6, WALK = 5, RUN = 10, GRAV = 22, JUMP = 7.5;

export class Walk {
    constructor() {
        this.on = false;
        this.yaw = 0;
        this.pitch = 0;
        this.x = 0; this.z = 0; this.y = 0; this.vy = 0;
        this.bob = 0;
    }

    start(x, z, yaw) {
        this.on = true;
        this.x = x; this.z = z;
        this.y = groundAt(x, z); this.vy = 0;
        this.yaw = yaw; this.pitch = 0;
    }

    stop() { this.on = false; }

    look(dx, dy) {
        this.yaw -= dx * 0.0025;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0025));
    }

    // Se puede pisar: dentro del valle y sin agua
    free(x, z) { return regionAt(x, z) >= 0 && !isWater(x, z); }

    update(dt, keys, camera) {
        const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
        const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
        const sp = keys.has('shift') ? RUN : WALK, len = Math.hypot(f, s) || 1;
        const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
        // Adelante es -Z de la cámara
        const vx = ((-sy * f + cy * s) / len) * sp, vz = ((-cy * f - sy * s) / len) * sp;
        // Se desliza por los bordes: cada eje por separado
        const nx = this.x + vx * dt, nz = this.z + vz * dt;
        if (this.free(nx, this.z)) this.x = nx;
        if (this.free(this.x, nz)) this.z = nz;

        const g = groundAt(this.x, this.z), grounded = this.y <= g + 0.01;
        if (grounded && keys.has(' ')) this.vy = JUMP;
        this.vy -= GRAV * dt;
        this.y += this.vy * dt;
        // Sube escalones al momento y baja con suavidad
        if (this.y < g) { this.y = g; this.vy = 0; }
        else if (grounded && this.vy <= 0) this.y = damp(this.y, g, 12, dt);

        const moving = (f || s) && grounded;
        this.bob += moving ? dt * sp * 1.6 : 0;
        const bob = moving ? Math.sin(this.bob) * 0.06 : 0;

        camera.position.set(this.x, this.y + EYE + bob, this.z);
        camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
}
