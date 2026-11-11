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

// Junta varias geometrías de caja (ya colocadas) en una sola: una llamada de dibujo en vez de muchas
export function mergeBoxes(list) {
    let nv = 0, ni = 0;
    for (const g of list) {
        nv += g.attributes.position.count;
        ni += g.index.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0, i = 0;
    for (const g of list) {
        const a = g.attributes;
        pos.set(a.position.array, v * 3);
        nor.set(a.normal.array, v * 3);
        if (a.uv) uv.set(a.uv.array, v * 2);
        for (let k = 0; k < g.index.count; k++) idx[i + k] = g.index.array[k] + v;
        v += a.position.count;
        i += g.index.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
}

// Junta las piezas fijas de un grupo (una malla por material): las que no se mueven, no se
// encienden ni cambian de material por separado. stop(o): lo que se deja tal cual (con lo de dentro)
export function bakeGroup(group, stop = () => false) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), M = new THREE.Matrix4();
    const byMat = new Map(), done = [];
    const simple = (o) => o.isMesh && !o.isInstancedMesh && o.visible && o.geometry.index && o.geometry.attributes.normal && !stop(o);
    const visit = (o) => {
        if (o !== group && stop(o)) return;
        // (una pieza con algo que no se puede juntar colgando, se queda)
        if (o !== group && simple(o) && o.children.every((c) => simple(c) && !c.children.length)) {
            for (const m of [o, ...o.children]) {
                M.multiplyMatrices(inv, m.matrixWorld);
                if (!byMat.has(m.material)) byMat.set(m.material, []);
                byMat.get(m.material).push(m.geometry.clone().applyMatrix4(M));
            }
            done.push(o);
            return;
        }
        for (const c of [...o.children]) visit(c);
    };
    visit(group);
    if (done.length < 2) return;
    for (const o of done) o.removeFromParent();
    for (const [mat, list] of byMat) {
        const m = new THREE.Mesh(mergeBoxes(list), mat);
        group.add(m);
        for (const g of list) g.dispose();
    }
}

// Junta, en cada grupo de un modelo (el de fuera y cada subgrupo que se mueve aparte: patas,
// cabeza, rabo...), sus piezas por material: el modelo se anima igual (se mueven los grupos) con
// muchas menos llamadas de dibujo. Para los animales del mapa
export function bakeRigid(root) {
    const groups = [];
    root.traverse((o) => { if (!o.isMesh) groups.push(o); });
    for (const g of groups.reverse()) bakeGroup(g, (o) => !o.isMesh);
}
