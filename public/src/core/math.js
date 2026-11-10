const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const wrapAngle = (a) => {
    a = (a + Math.PI) % TAU;
    return (a < 0 ? a + TAU : a) - Math.PI;
};

// Suavizado exponencial independiente del framerate.
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export const easeOutBack = (t) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
