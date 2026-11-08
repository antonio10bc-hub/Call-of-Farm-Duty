import * as THREE from 'three';
import { VoxelModel } from '../render/VoxelModel.js';
import { buildGun } from '../render/RifleModel.js';
import { THEME } from '../content/theme.js';
import { DEFAULT_LOADOUT } from '../content/arsenal.js';

// Las fotos de la armería: no son dibujos, son las piezas de verdad (las mismas cajas que el fusil
// en primera persona, render/RifleModel.js: buildGun) renderizadas en 3D, de perfil y un poco
// desde arriba, con el sombreado toon y el contorno de tinta del juego. Se hacen en un canvas
// pequeño (W×H, a píxeles, sin suavizar) con su propio renderer y se guardan como imagen.
const W = 128, H = 64;
const cache = new Map();
let gl = null, scene = null, cam = null;

function setup() {
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
    gl.setPixelRatio(1);
    gl.setSize(W, H, false);
    gl.outputColorSpace = THREE.LinearSRGBColorSpace; // (como el juego)
    gl.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    const { light } = THEME;
    const sun = new THREE.DirectionalLight(light.sun, light.sunIntensity);
    sun.position.set(-3, 8, 5);
    scene.add(sun, new THREE.HemisphereLight(light.sky, light.ground, light.hemiIntensity));
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
}

// Encuadra lo que haya en root (proyección ortográfica: cabe entero, con un margen)
const DIR = new THREE.Vector3(-1, 0.34, -0.14).normalize(); // de perfil (el cañón a la izquierda), algo de frente
function frame(root) {
    const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3());
    cam.position.copy(c).addScaledVector(DIR, 10);
    cam.lookAt(c);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(cam.matrixWorldInverse);
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hw = Math.max((x1 - x0) / 2, ((y1 - y0) / 2) * (W / H)) * 1.08, hh = hw * (H / W);
    Object.assign(cam, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh });
    cam.updateProjectionMatrix();
}

// URL de la foto de una pieza (kind: scope, rifle o mag; o 'loadout' con el equipo entero
// { scope, rifle, mag } en item: el fusil montado)
export function gearArt(kind, item) {
    const whole = kind === 'loadout';
    const key = whole ? `loadout:${item.scope}|${item.rifle}|${item.mag}` : `${kind}:${item.id}`;
    if (cache.has(key)) return cache.get(key);
    let url = '';
    try {
        if (!gl) setup();
        const model = new VoxelModel(THEME.outline);
        buildGun(model, model.root, whole ? item : { ...DEFAULT_LOADOUT, [kind]: item.id }, whole ? null : kind);
        scene.add(model.root);
        model.root.updateMatrixWorld(true);
        frame(model.root);
        gl.render(scene, cam);
        url = gl.domElement.toDataURL();
        scene.remove(model.root);
        model.dispose();
    } catch {
        /* sin WebGL: sin foto */
    }
    cache.set(key, url);
    return url;
}
