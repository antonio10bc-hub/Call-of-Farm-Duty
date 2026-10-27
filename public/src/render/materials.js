import * as THREE from 'three';

// --- Geometrías compartidas (nunca se liberan: son pocas y se reutilizan) ---
const boxCache = new Map();
export function box(w, h, d) {
    const key = `${w}|${h}|${d}`;
    let g = boxCache.get(key);
    if (!g) boxCache.set(key, (g = new THREE.BoxGeometry(w, h, d)));
    return g;
}

// --- Rampa toon de 3 tonos: sombreado "a brochazos" ---
let gradient = null;
function toonGradient() {
    if (!gradient) {
        gradient = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
        gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
        gradient.generateMipmaps = false;
        gradient.needsUpdate = true;
    }
    return gradient;
}

// --- Efectos por entidad: transparencia "screen-door" (trama Bayer) y flash blanco ---
// fx = { fade: { value }, flash: { value } } compartido por todas las piezas de una entidad.
const FX_HEAD = /* glsl */ `
uniform float uFade;
uniform float uFlash;
float fxBayer(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return (m[q.x + q.y * 4] + 0.5) / 16.0;
}
`;

function withFx(material, fx, flash) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uFade = fx.fade;
        shader.uniforms.uFlash = fx.flash;
        let src = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${FX_HEAD}`)
            .replace('void main() {', 'void main() {\n\tif (uFade < 0.999 && fxBayer(gl_FragCoord.xy) >= uFade) discard;');
        if (flash) {
            src = src.replace('#include <dithering_fragment>',
                '#include <dithering_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);');
        }
        shader.fragmentShader = src;
    };
    material.customProgramCacheKey = () => (flash ? 'fx-flash' : 'fx');
    return material;
}

export function toon(color, fx) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    return fx ? withFx(m, fx, true) : m;
}

// Contorno por "casco invertido": se dibuja la cara trasera de una caja algo mayor.
export function outline(color, fx) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    return fx ? withFx(m, fx, false) : m;
}

export const OUTLINE = 0.05;
