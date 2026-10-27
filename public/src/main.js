import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEME } from './content/theme.js';
import { CROPS } from './content/crops.js';
import { FARM, INFO } from './content/farm.js';
import { RetroRenderer } from './render/RetroRenderer.js';
import { CameraRig } from './render/CameraRig.js';
import { Particles } from './render/Particles.js';
import { weatherParticle } from './render/weather.js';
import { Farm } from './world/Farm.js';
import { FarmState } from './game/FarmState.js';
import { Sniper } from './game/Sniper.js';
import { Scope } from './ui/Scope.js';
import { installPixelSprites } from './ui/PixelArt.js';
import { Sfx } from './core/Audio.js';
import { Music } from './core/Music.js';
import { Settings } from './core/Settings.js';
import { L, applyHtmlTexts, switchLang } from './core/I18n.js';
import { vibrate } from './core/Haptics.js';
import { clamp } from './core/math.js';

const $ = (id) => document.getElementById(id);
const INK = THEME.outline;
const M = CONFIG.map;
const S = CONFIG.sniper;

Settings.load();
applyHtmlTexts();
installPixelSprites();

const sfx = new Sfx();
const music = new Music(sfx);
sfx.enabled = Settings.sfx;
music.enabled = Settings.music;

const canvas = $('view');
const renderer = new RetroRenderer(canvas, CONFIG.render);
const scope = new Scope($('scope'));
const state = new FarmState();

function addLights(scene) {
    const { light } = THEME;
    const sun = new THREE.DirectionalLight(light.sun, light.sunIntensity);
    sun.position.set(-4, 10, 6);
    scene.add(sun, new THREE.HemisphereLight(light.sky, light.ground, light.hemiIntensity));
}

// ---------- Granja (mapa) ----------
const farmScene = new THREE.Scene();
farmScene.background = new THREE.Color(THEME.sky);
addLights(farmScene);
const farm = new Farm(THEME, state.level);
farmScene.add(farm.root);
const farmParticles = new Particles(farmScene, 500);
const rig = new CameraRig(M);
rig.free = true;
rig.setBounds(M.view, M.view);
rig.yaw = rig.yawTarget = M.yaw;
const home = { x: 14, z: 16 };
rig.focus(home.x, home.z);
rig.snap();
farm.onLand = (m) => {
    const p = m.root.position;
    farmParticles.burst(p.x, 0.1, p.z, 18, [THEME.dust, 0xd9b77a], { speed: 2.4, up: 1.4, size: 0.14, ttl: 0.5 });
    rig.shake(0.18);
    sfx.play('drop');
};

// ---------- Francotirador ----------
const sniper = new Sniper(THEME, {
    sfx,
    onHit(target, nx, ny) {
        state.collect();
        const x = (nx * 0.5 + 0.5) * innerWidth, y = (-ny * 0.5 + 0.5) * innerHeight;
        popPlus(x, y);
        flyWheat(x, y, $('snipe-wheat'), () => updateCounts(true));
        $('left-count').textContent = sniper.field.remaining;
    },
    onFinish() {
        setTimeout(() => banner(L('ALL IN!', '¡COSECHA COMPLETA!')), 250);
        vibrate('kill');
    },
    onDone() {
        goFarm(true);
    },
    onCorner(i) {
        showCorner(i);
    },
});
addLights(sniper.scene);

renderer.onResize = (w, h) => {
    rig.resize(w / h);
    sniper.camera.aspect = w / h;
    sniper.camera.updateProjectionMatrix();
    scope.resize(w, h, canvas.style.width.replace('px', ''), canvas.style.height.replace('px', ''));
};
renderer.resize();

// ---------- Interfaz ----------
let mode = 'farm'; // 'farm' | 'toSnipe' | 'snipe' | 'toFarm'
let modeT = 0;
let time = 0;
let selected = null; // { structure } | { field }
const ray = new THREE.Raycaster();
const ndcOf = (x, y) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
};

function updateCounts(bump = false) {
    $('wheat-count').textContent = state.wheat;
    $('hud-wheat').textContent = state.wheat;
    if (bump) {
        for (const id of ['farm-wheat', 'snipe-wheat']) {
            const el = $(id);
            el.classList.remove('bump');
            void el.offsetWidth;
            el.classList.add('bump');
        }
        sfx.play('coin');
    }
}

function banner(text, cls = '') {
    const el = $('banner');
    el.className = 'banner';
    el.textContent = text;
    void el.offsetWidth;
    el.className = `banner show ${cls}`;
}

function stage(name, sub) {
    $('stage-name').textContent = name;
    $('stage-sub').textContent = sub;
    const el = $('stage');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
}

function popPlus(x, y) {
    const el = document.createElement('div');
    el.className = 'pop-plus';
    el.textContent = '+1';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// Una espiga pixelada vuela a saltos hasta el contador
function flyWheat(x, y, target, done) {
    const el = document.createElement('i');
    el.className = 'fly-wheat';
    document.body.appendChild(el);
    const r = target.getBoundingClientRect();
    const tx = r.left + 20, ty = r.top + r.height / 2;
    const anim = el.animate([
        { left: `${x}px`, top: `${y}px`, transform: 'scale(1.6)' },
        { left: `${x + (tx - x) * 0.2}px`, top: `${y - 60}px`, transform: 'scale(1.3)', offset: 0.3 },
        { left: `${tx}px`, top: `${ty}px`, transform: 'scale(.8)' },
    ], { duration: 650, easing: 'steps(8)' });
    anim.onfinish = () => {
        el.remove();
        done();
    };
}

function showCorner(i) {
    [...$('corners').children].forEach((el, k) => el.classList.toggle('on', k === i));
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

// Burbuja de "¡RECOGER!" encima del campo maduro (sale de la propia granja)
const bubble = document.createElement('button');
bubble.className = 'bubble hidden';
bubble.innerHTML = `<span class="wheat-ico"></span><span>${L('HARVEST!', '¡RECOGER!')}</span>`;
bubble.addEventListener('pointerdown', (e) => e.stopPropagation());
bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    harvest();
});
$('bubbles').appendChild(bubble);

const _b = new THREE.Vector3();
function placeBubbles() {
    const on = mode === 'farm' && farm.introT > 1.6 && state.isReady();
    if (on && bubble.classList.contains('hidden')) {
        bubble.classList.remove('hidden');
        sfx.play('itemSpawn');
    } else if (!on) bubble.classList.add('hidden');
    if (!on) return;
    farm.fieldTop(_b).project(rig.camera);
    bubble.style.left = `${(_b.x * 0.5 + 0.5) * innerWidth}px`;
    bubble.style.top = `${(-_b.y * 0.5 + 0.5) * innerHeight}px`;
}

// Ficha del edificio o del campo tocado
function select(what) {
    selected = what;
    const panel = $('panel');
    if (!what) {
        panel.classList.add('hidden');
        return;
    }
    sfx.play('ui');
    panel.classList.remove('hidden', 'in');
    void panel.offsetWidth;
    panel.classList.add('in');
    if (what.structure) {
        const m = farm.byId[what.structure];
        m.select();
        rig.focus(m.def.x, m.def.z + 1);
    } else {
        const f = farm.field;
        rig.focus(f.cx, f.cz + 1);
    }
    refreshPanel();
}

function refreshPanel() {
    if (!selected) return;
    const title = $('panel-title'), text = $('panel-text'), bar = $('panel-bar'), act = $('panel-action'), up = $('panel-upgrade');
    if (selected.structure) {
        const m = farm.byId[selected.structure];
        title.textContent = m.def.name;
        text.textContent = selected.structure === 'barn' ? `${INFO.barn} ${L('WHEAT', 'TRIGO')}: ${state.wheat}` : INFO[selected.structure];
        bar.parentElement.classList.add('hidden');
        act.classList.add('hidden');
        up.classList.add('hidden');
        return;
    }
    const p = state.progress(), ready = state.isReady();
    title.textContent = `${L('WHEAT FIELD', 'CAMPO DE TRIGO')} ${L('LV', 'NV')}.${state.level + 1}`;
    text.textContent = ready
        ? L(`RIPE! ${state.plot.left} BUNDLES TO HARVEST.`, `¡MADURO! ${state.plot.left} MATAS PARA RECOGER.`)
        : `${L('GROWING... READY IN', 'CRECIENDO... LISTO EN')} ${fmt((1 - p) * CROPS.wheat.growTime)}`;
    bar.parentElement.classList.remove('hidden');
    bar.style.width = `${Math.round(p * 20) * 5}%`;
    act.classList.toggle('hidden', !ready);
    // Mejora: más grande y con más matas, por trigo
    up.classList.remove('hidden');
    up.disabled = !state.canUpgrade;
    $('upgrade-label').textContent = state.maxed ? L('MAX LEVEL', 'NIVEL MÁXIMO') : L('UPGRADE', 'MEJORAR');
    $('upgrade-cost').textContent = state.maxed ? '' : FARM.field.upgradeCost;
    up.classList.toggle('maxed', state.maxed);
}

function upgradeField() {
    if (mode !== 'farm' || !state.upgrade()) return;
    farm.setLevel(state.level);
    const f = farm.field;
    rig.focus(f.cx, f.cz + 1);
    rig.shake(0.14);
    for (let k = 0; k < 6; k++) farmParticles.burst(f.x + Math.random() * f.w, 0.2, f.z + Math.random() * f.d, 6, [THEME.dust, 0xd9b77a, 0xffe03a], { speed: 2, up: 1.6, size: 0.12, ttl: 0.5 });
    sfx.play('power');
    vibrate('pickup');
    updateCounts();
    stage(L('FIELD UPGRADED!', '¡CAMPO MEJORADO!'), `${L('BUNDLES', 'MATAS')}: ${state.sheaves}`);
    refreshPanel();
}

function startMusic(cfg) {
    if (Settings.music) music.start(cfg, 7);
}

// ---------- Transiciones ----------
let snipeStart = 0;
function harvest() {
    if (mode !== 'farm' || !state.isReady()) return;
    sfx.unlock();
    sfx.play('go');
    vibrate('pickup');
    // Con ratón, este mismo clic bloquea el cursor: al entrar ya se mira moviéndolo
    if (matchMedia('(pointer: fine)').matches) lockMouse();
    mode = 'toSnipe';
    modeT = 0;
    select(null);
    const f = farm.field;
    rig.focus(f.cx, f.cz);
    rig.zoomTarget = M.zoomMin * 0.8;
}

function enterSnipe() {
    sniper.enter(state.plot.left);
    mode = 'snipe';
    snipeStart = time;
    renderer.flash(INK, 1);
    $('farm-ui').classList.add('hidden');
    $('bubbles').classList.add('hidden');
    $('snipe-ui').classList.remove('hidden');
    document.body.classList.add('sniping');
    $('left-count').textContent = sniper.field.remaining;
    showCorner(0);
    updateCounts();
    startMusic(THEME.sniperMusic);
    setTimeout(() => mode === 'snipe' && banner(L('HARVEST!', '¡A COSECHAR!'), 'go'), 450);
}

function goFarm(done = false) {
    if (mode !== 'snipe') return;
    mode = 'toFarm';
    modeT = 0;
    touch = null;
    sniper.release(false);
    if (document.exitPointerLock && locked()) document.exitPointerLock();
    if (!done) sfx.play('ui');
    goFarm.done = done;
}

function enterFarm() {
    sniper.leave();
    if (document.exitPointerLock && locked()) document.exitPointerLock();
    mode = 'farm';
    renderer.flash(INK, 1);
    scope.show(false);
    document.body.classList.remove('sniping');
    $('snipe-ui').classList.add('hidden');
    $('farm-ui').classList.remove('hidden');
    $('bubbles').classList.remove('hidden');
    rig.zoomTarget = 1;
    updateCounts();
    startMusic(THEME.music);
    if (goFarm.done) {
        const f = farm.field;
        farm.byId.barn.select();
        setTimeout(() => stage(L('HARVEST DONE!', '¡COSECHA HECHA!'), `${L('WHEAT', 'TRIGO')}: ${state.wheat}`), 300);
        rig.focus(f.cx, f.cz);
    }
}

// ---------- Entrada ----------
// Mapa: arrastrar desplaza, pellizcar o la rueda hacen zoom, tocar selecciona.
// Francotirador (como un shooter): la vista es libre y la mirilla está siempre en el centro.
//   Dedo: arrastrar mira; dejarlo quieto un momento sube el arma (apunta), moverlo con la
//   mira puesta la desplaza despacio y soltarlo dispara. Deslizar desde un borde cambia de torre.
//   Ratón: el cursor se bloquea y moverlo mira; mantener el botón derecho apunta y soltarlo
//   dispara; el izquierdo dispara al momento.
const pointers = new Map();
let pan = null, pinch = null, touch = null, edge = null;

function unitsPerPx() {
    return (rig.halfWidth * rig.zoom * 2) / innerWidth;
}

function panBy(dx, dy) {
    const u = unitsPerPx(), y = rig.yaw, sp = Math.sin((M.pitch * Math.PI) / 180);
    // Derecha de la pantalla y "hacia dentro" sobre el suelo
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
    rig.fx = clamp(rig.fx - rx * dx * u + fx * dy * u / sp, 2, farm.size - 2);
    rig.fz = clamp(rig.fz - rz * dx * u + fz * dy * u / sp, 2, farm.size - 2);
}

function zoomBy(k) {
    rig.zoomTarget = clamp(rig.zoomTarget * k, M.zoomMin, M.zoomMax);
}

function isUi(e) {
    return e.target.closest && e.target.closest('button, .panel, .screen');
}

const locked = () => document.pointerLockElement === canvas;
function lockMouse() {
    if (locked() || !canvas.requestPointerLock) return;
    try {
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
    } catch { /* sin bloqueo: se mira arrastrando */ }
}
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', locked()));

addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (!music.playing && Settings.music && sfx.ctx) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
    if (isUi(e)) return;
    if (mode === 'farm') {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
            pan = null;
        } else pan = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
        return;
    }
    if (mode !== 'snipe' || e.pointerType === 'mouse') return; // el ratón va por mousedown
    if (e.clientX < S.edgeSwipe || e.clientX > innerWidth - S.edgeSwipe) {
        edge = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
    }
    if (!touch) touch = { id: e.pointerId, lx: e.clientX, ly: e.clientY, ax: e.clientX, ay: e.clientY, still: performance.now(), t: performance.now(), moved: false };
});

addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
        p.x = e.clientX;
        p.y = e.clientY;
    }
    if (mode === 'farm') {
        if (pinch && pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomBy(pinch.d / d);
            pinch.d = d;
        } else if (pan && e.pointerId === pan.id) {
            const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly;
            pan.lx = e.clientX;
            pan.ly = e.clientY;
            if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 8) pan.moved = true;
            if (pan.moved) panBy(dx, dy);
        }
        return;
    }
    if (mode !== 'snipe') return;
    if (e.pointerType === 'mouse' && locked()) {
        sniper.look(e.movementX, e.movementY, S.lookMouse);
        return;
    }
    if (edge && e.pointerId === edge.id) {
        const dx = e.clientX - edge.x, dy = e.clientY - edge.y;
        if (Math.abs(dx) > S.flickDist && Math.abs(dx) > Math.abs(dy)) {
            // Desde el borde izquierdo: torre de la izquierda; desde el derecho: la de la derecha
            sniper.goSide(dx > 0 ? -1 : 1);
            edge = null;
        }
        return;
    }
    if (touch && e.pointerId === touch.id) {
        sniper.look(e.clientX - touch.lx, e.clientY - touch.ly, touch.mouse ? S.lookMouse : S.lookTouch);
        touch.lx = e.clientX;
        touch.ly = e.clientY;
        // Si el dedo se mueve, vuelve a contar el rato que lleva quieto
        if (Math.hypot(e.clientX - touch.ax, e.clientY - touch.ay) > S.holdSlop) {
            touch.ax = e.clientX;
            touch.ay = e.clientY;
            touch.still = performance.now();
            touch.moved = true;
        }
    }
});

function endPointer(e, cancel) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (mode === 'farm' && pan && e.pointerId === pan.id) {
        if (!pan.moved && !cancel) tapMap(e.clientX, e.clientY);
        pan = null;
    }
    if (edge && e.pointerId === edge.id) edge = null;
    if (touch && e.pointerId === touch.id && !touch.mouse) {
        const t = touch;
        touch = null;
        if (mode !== 'snipe' || cancel) return sniper.release(false);
        if (sniper.scoped) sniper.release(true);
        // Toque rápido sin mover el dedo: disparo desde la cadera (sin mira, impreciso)
        else if (!t.moved && performance.now() - t.t < S.tapTime) sniper.fire();
    }
}
addEventListener('pointerup', (e) => endPointer(e, false));
addEventListener('pointercancel', (e) => endPointer(e, true));

// Botones del ratón en primera persona (mousedown/mouseup también ven el segundo botón
// cuando ya hay otro pulsado, cosa que pointerdown no hace)
addEventListener('mousedown', (e) => {
    if (mode !== 'snipe' || isUi(e)) return;
    lockMouse();
    if (e.button === 2) sniper.setAds(true);
    else if (e.button === 0) {
        if (locked()) sniper.fire();
        else touch = { id: 'mouse', mouse: true, lx: e.clientX, ly: e.clientY, ax: e.clientX, ay: e.clientY, still: Infinity };
    }
});
addEventListener('mousemove', (e) => {
    if (mode === 'snipe' && touch && touch.mouse && !locked()) {
        sniper.look(e.clientX - touch.lx, e.clientY - touch.ly, S.lookMouse);
        touch.lx = e.clientX;
        touch.ly = e.clientY;
    }
});
addEventListener('mouseup', (e) => {
    if (e.button === 0 && touch && touch.mouse) touch = null;
    if (mode === 'snipe' && e.button === 2 && sniper.scoped) sniper.release(true);
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
    if (mode === 'farm') zoomBy(Math.exp(e.deltaY * 0.0012));
}, { passive: true });

// Dedo quieto un momento: sube el arma
function holdCheck() {
    if (mode === 'snipe' && touch && !touch.mouse && !sniper.scoped && performance.now() - touch.still > S.holdTime) sniper.setAds(true);
}

function tapMap(x, y) {
    ray.setFromCamera(ndcOf(x, y), rig.camera);
    const hit = farm.pick(ray);
    if (!hit) return select(null);
    if (hit.field && state.isReady() && selected && selected.field) return harvest();
    select(hit);
}

// Teclado: WASD/flechas miran, espacio/enter mantiene la mira (soltar dispara), Q/E saltan a la
// torre de la izquierda/derecha, Esc baja la mira o vuelve a la granja (con el ratón bloqueado, Esc lo suelta), H vuelve.
const keys = new Set();
addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (e.repeat) return;
    if (mode === 'farm') {
        if (k === 'escape') select(null);
        if (k === 'enter' || k === ' ') harvest();
        return;
    }
    if (mode !== 'snipe') return;
    if (k === ' ' || k === 'enter') sniper.setAds(true);
    else if (k === 'escape' || k === 'backspace') sniper.scoped ? sniper.release(false) : goFarm();
    else if (k === 'h') goFarm();
    else if (k === 'q') sniper.goSide(-1);
    else if (k === 'e') sniper.goSide(1);
});
addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (mode === 'snipe' && (k === ' ' || k === 'enter')) sniper.release(true);
});

function keyInput(dt) {
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (!x && !y) return;
    if (mode === 'snipe') sniper.look(x, y, S.lookPad * 0.6 * dt);
    else if (mode === 'farm') panBy(-x * dt * 500, -y * dt * 500);
}

// Mando: sticks miran (con curva de respuesta), LT apunta (soltarlo dispara), RT/A disparan,
// LB/RB cambian de torre, B baja la mira o sale. En la granja el stick desplaza el mapa y A
// recoge el campo si está maduro.
const padPrev = [];
const curve = (v) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * ((Math.abs(v) - 0.15) / 0.85) ** 2);
function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p);
    if (!pad) return;
    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const down = (i) => pressed(i) && !padPrev[i];
    const up = (i) => !pressed(i) && padPrev[i];
    const ax = curve(pad.axes[0] || 0) + curve(pad.axes[2] || 0), ay = curve(pad.axes[1] || 0) + curve(pad.axes[3] || 0);
    if (mode === 'farm') {
        if (ax || ay) panBy(-ax * dt * 600, -ay * dt * 600);
        if (down(0)) harvest();
    } else if (mode === 'snipe') {
        if (ax || ay) sniper.look(ax, ay, S.lookPad * dt);
        if (down(6)) sniper.setAds(true);
        if (up(6)) sniper.release(true);
        if (down(7) || down(0)) sniper.fire();
        if (down(1)) sniper.scoped ? sniper.release(false) : goFarm();
        if (down(4) || down(14)) sniper.goSide(-1);
        if (down(5) || down(15)) sniper.goSide(1);
    }
    pad.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
}

// Botones
const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.unlock();
    fn();
});
tapBtn('btn-home', () => goFarm());
tapBtn('btn-prev', () => sniper.goSide(-1));
tapBtn('btn-next', () => sniper.goSide(1));
tapBtn('panel-action', () => selected && selected.field && harvest());
tapBtn('panel-upgrade', upgradeField);
tapBtn('panel-close', () => select(null));
tapBtn('btn-settings', () => {
    sfx.play('ui');
    $('settings').classList.remove('hidden');
});
tapBtn('btn-settings-close', () => {
    sfx.play('ui');
    $('settings').classList.add('hidden');
});
tapBtn('btn-lang', switchLang);
for (const el of document.querySelectorAll('.toggle')) {
    const key = el.dataset.key;
    el.classList.toggle('off', !Settings[key]);
    el.addEventListener('click', () => {
        const on = Settings.toggle(key);
        el.classList.toggle('off', !on);
        if (key === 'sfx') sfx.enabled = on;
        if (key === 'music') {
            music.enabled = on;
            if (on) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
            else music.stop();
        }
        sfx.play('ui');
    });
}
try {
    if (sessionStorage.getItem('cofd.reopenSettings')) {
        sessionStorage.removeItem('cofd.reopenSettings');
        $('settings').classList.remove('hidden');
    }
} catch { /* sin almacenamiento */ }

// ---------- Bucle ----------
let last = performance.now();
let uiT = 0;
const _w = new THREE.Vector3();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(CONFIG.sim.maxFrame, (now - last) / 1000);
    last = now;
    time += dt;
    pollPad(dt);
    keyInput(dt);
    holdCheck();

    if (mode === 'farm' || mode === 'toSnipe') {
        const progress = state.progress();
        farm.update(dt, time, progress);
        if (mode === 'toSnipe') {
            modeT += dt;
            renderer.flash(INK, Math.max(0, (modeT - 0.35) / 0.4));
            if (modeT > 0.8) enterSnipe();
        }
        uiT -= dt;
        if (uiT <= 0) {
            uiT = 0.25;
            refreshPanel();
        }
        // Humo de la chimenea y del tractor; destellos sobre el campo maduro
        if (Math.random() < dt * 5) {
            const h = farm.byId.house;
            h.root.localToWorld(_w.copy(h.chimney));
            farmParticles.spawn(_w.x, _w.y, _w.z, 0.2 + Math.random() * 0.2, 0.7, 0.1, 0.18 + Math.random() * 0.1, 2.2, Math.random() < 0.5 ? 0xe8e4dc : 0xcfc8c0, -0.1);
        }
        // Más destellos cuanto más grande es el campo
        const f = farm.field;
        if (progress >= 1 && Math.random() < dt * 4 * Math.sqrt((f.w * f.d) / 20)) {
            weatherParticle(farmParticles, 'sparkle', f.x + Math.random() * f.w, f.z + Math.random() * f.d, Math.random() < 0.5 ? 0xffffff : 0xffe03a);
            farmParticles.y[farmParticles.n - 1] = 1.1;
        }
        if (Math.random() < dt * THEME.ambient.rate) {
            const c = THEME.ambient.colors;
            weatherParticle(farmParticles, THEME.ambient.kind, rig.fx + (Math.random() - 0.5) * 20, rig.fz + (Math.random() - 0.5) * 20, c[(Math.random() * c.length) | 0]);
        }
        farmParticles.update(dt);
        farmParticles.sync();
        rig.update(dt);
        placeBubbles();
        renderer.render(farmScene, rig.camera, dt);
    }
    if (mode === 'snipe' || mode === 'toFarm') {
        sniper.update(dt);
        $('snipe-ui').classList.toggle('scoped', sniper.scoped);
        document.body.classList.toggle('scoped', sniper.scoped);
        scope.show(sniper.fov < (S.fov + S.scopeFov) * 0.5);
        scope.setReady(sniper.canFire);
        // La mirilla se abre con la dispersión: así se ve cuánto puede fallar el tiro
        const spreadPx = (Math.tan(sniper.spread) / Math.tan((sniper.fov * Math.PI) / 360)) * (innerHeight / 2);
        $('reticle').style.setProperty('--spread', `${Math.max(5, Math.round(spreadPx))}px`);
        $('snipe-hint').classList.toggle('gone', sniper.moving || sniper.scoped || time - snipeStart > 6);
        if (mode === 'toFarm') {
            modeT += dt;
            renderer.flash(INK, Math.min(1, modeT / 0.35));
            if (modeT > 0.4) enterFarm();
        }
        if (mode !== 'farm') renderer.render(sniper.scene, sniper.camera, dt);
    }
}

updateCounts();
requestAnimationFrame(frame);
// La portada (título) se queda un momento aunque cargue rápido
setTimeout(() => (window.__loaded = true), 900);

if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Para las pruebas (Playwright)
window.game = { state, sniper, farm, rig, get mode() { return mode; }, harvest, upgradeField, goFarm, select };
