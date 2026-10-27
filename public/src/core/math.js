export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const wrapAngle = (a) => {
    a = (a + Math.PI) % TAU;
    return (a < 0 ? a + TAU : a) - Math.PI;
};

// Gira "from" hacia "to" como mucho "step" radianes por el camino corto.
export const turnTowards = (from, to, step) => {
    const d = wrapAngle(to - from);
    return Math.abs(d) <= step ? to : from + Math.sign(d) * step;
};

// Suavizado exponencial independiente del framerate.
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export const easeOutBack = (t) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
