import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEME } from './content/theme.js';
import { CROPS } from './content/crops.js';
import { INFO } from './content/farm.js';
import { RetroRenderer } from './render/RetroRenderer.js';
import { CameraRig } from './render/CameraRig.js';
import { Particles } from './render/Particles.js';
import { weatherParticle } from './render/weather.js';
import { Farm } from './world/Farm.js';
import { FarmState, PLOT_COUNT } from './game/FarmState.js';
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
const farm = new Farm(THEME);
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
        state.collect(target.plot);
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

// Burbujas de "¡RECOGER!" encima de cada campo maduro (salen de la propia granja)
const bubbles = [];
for (let i = 0; i < PLOT_COUNT; i++) {
    const b = document.createElement('button');
    b.className = 'bubble hidden';
    b.innerHTML = `<span class="wheat-ico"></span><span>${L('HARVEST!', '¡RECOGER!')}</span>`;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        harvest(i);
    });
    $('bubbles').appendChild(b);
    bubbles.push(b);
}

function placeBubbles() {
    const show = mode === 'farm' && farm.introT > 1.6;
    const v = new THREE.Vector3();
    for (let i = 0; i < PLOT_COUNT; i++) {
        const b = bubbles[i];
        const on = show && state.isReady(i);
        if (on && b.classList.contains('hidden')) {
            b.classList.remove('hidden');
            sfx.play('itemSpawn');
        } else if (!on) b.classList.add('hidden');
        if (!on) continue;
        farm.fieldTop(i, v).project(rig.camera);
        b.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
        b.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    }
}

// Ficha del edificio o campo tocado
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
        const f = farm.fields[what.field];
        rig.focus(f.cx, f.cz + 1);
    }
    refreshPanel();
}

function refreshPanel() {
    if (!selected) return;
    const title = $('panel-title'), text = $('panel-text'), bar = $('panel-bar'), act = $('panel-action');
    if (selected.structure) {
        const m = farm.byId[selected.structure];
        title.textContent = m.def.name;
        text.textContent = selected.structure === 'barn' ? `${INFO.barn} ${L('WHEAT', 'TRIGO')}: ${state.wheat}` : INFO[selected.structure];
        bar.parentElement.classList.add('hidden');
        act.classList.add('hidden');
        return;
    }
    const i = selected.field, p = state.progress(i), ready = state.isReady(i);
    title.textContent = `${L('WHEAT FIELD', 'CAMPO DE TRIGO')} ${i + 1}`;
    text.textContent = ready
        ? L(`RIPE! ${state.plots[i].left} BUNDLES TO HARVEST.`, `¡MADURO! ${state.plots[i].left} MATAS PARA RECOGER.`)
        : `${L('GROWING... READY IN', 'CRECIENDO... LISTO EN')} ${fmt((1 - p) * CROPS.wheat.growTime)}`;
    bar.parentElement.classList.remove('hidden');
    bar.style.width = `${Math.round(p * 20) * 5}%`;
    act.classList.toggle('hidden', !ready);
}

function startMusic(cfg) {
    if (Settings.music) music.start(cfg, 7);
}

// ---------- Transiciones ----------
let harvestField = -1;
function harvest(i) {
    if (mode !== 'farm' || !state.isReady(i)) return;
    sfx.unlock();
    sfx.play('go');
    vibrate('pickup');
    harvestField = i;
    mode = 'toSnipe';
    modeT = 0;
    select(null);
    const f = farm.fields[i];
    rig.focus(f.cx, f.cz);
    rig.zoomTarget = M.zoomMin * 0.8;
}

function enterSnipe() {
    sniper.enter([{ plot: harvestField, count: state.plots[harvestField].left }]);
    mode = 'snipe';
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
    aim = null;
    sniper.release(false);
    if (!done) sfx.play('ui');
    goFarm.done = done;
}

function enterFarm() {
    sniper.leave();
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
        const f = farm.fields[harvestField];
        farm.byId.barn.select();
        setTimeout(() => stage(L('HARVEST DONE!', '¡COSECHA HECHA!'), `${L('WHEAT', 'TRIGO')}: ${state.wheat}`), 300);
        rig.focus(f.cx, f.cz);
    }
}

// ---------- Entrada ----------
// Mapa: arrastrar desplaza, pellizcar o la rueda hacen zoom, tocar selecciona.
// Francotirador: mantener apunta, mover desplaza la mira despacio, soltar dispara. Un
// deslizamiento rápido en horizontal cambia de torre (sin disparar).
const pointers = new Map();
let pan = null, pinch = null, aim = null;

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

addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (!music.playing && Settings.music && sfx.ctx) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
    if (isUi(e)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'farm') {
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
            pan = null;
        } else pan = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    } else if (mode === 'snipe' && !aim) {
        // Ratón: botón derecho (o izquierdo) mantiene la mira; dedo: cualquier toque
        aim = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() };
        const n = ndcOf(e.clientX, e.clientY);
        sniper.press(n.x, n.y);
    }
});

addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') moveReticle(e.clientX, e.clientY);
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
    } else if (mode === 'snipe' && aim && e.pointerId === aim.id) {
        sniper.drag(e.clientX - aim.lx, e.clientY - aim.ly);
        aim.lx = e.clientX;
        aim.ly = e.clientY;
    }
});

function endPointer(e, cancel) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (mode === 'farm' && pan && e.pointerId === pan.id) {
        if (!pan.moved && !cancel) tapMap(e.clientX, e.clientY);
        pan = null;
    }
    if (mode === 'snipe' && aim && e.pointerId === aim.id) {
        const dx = e.clientX - aim.x, dy = e.clientY - aim.y, dur = performance.now() - aim.t;
        aim = null;
        if (cancel) sniper.release(false);
        else if (dur < S.flickTime && Math.abs(dx) > S.flickDist && Math.abs(dx) > Math.abs(dy) * 1.3) {
            // Deslizamiento rápido: cambio de torre, sin disparar
            sniper.release(false);
            sniper.goCorner(dx < 0 ? 1 : -1);
        } else sniper.release(true);
    }
}
addEventListener('pointerup', (e) => endPointer(e, false));
addEventListener('pointercancel', (e) => endPointer(e, true));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
    if (mode === 'farm') zoomBy(Math.exp(e.deltaY * 0.0012));
}, { passive: true });

function tapMap(x, y) {
    ray.setFromCamera(ndcOf(x, y), rig.camera);
    const hit = farm.pick(ray);
    if (!hit) return select(null);
    if (hit.field !== undefined && state.isReady(hit.field) && selected && selected.field === hit.field) return harvest(hit.field);
    select(hit);
}

// Mirilla del ratón (ordenador): una cruz pixelada que sigue al cursor en primera persona
function moveReticle(x, y) {
    const r = $('reticle');
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
}

// Teclado: espacio/enter mantiene la mira (soltar dispara), WASD/flechas la mueven;
// A/D o Q/E sin mira cambian de torre; Esc vuelve a la granja.
const keys = new Set();
addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (e.repeat) return;
    if (mode === 'farm') {
        if (k === 'escape') select(null);
        if (k === 'enter' || k === ' ') {
            const i = state.readyPlots()[0];
            if (i !== undefined) harvest(i);
        }
        return;
    }
    if (mode !== 'snipe') return;
    if (k === ' ' || k === 'enter') sniper.press(0, 0);
    else if (k === 'escape' || k === 'backspace') sniper.scoped ? sniper.release(false) : goFarm();
    else if (k === 'q' || (!sniper.scoped && (k === 'a' || k === 'arrowleft'))) sniper.goCorner(-1);
    else if (k === 'e' || (!sniper.scoped && (k === 'd' || k === 'arrowright'))) sniper.goCorner(1);
});
addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (mode === 'snipe' && (k === ' ' || k === 'enter') && !aim) sniper.release(true);
});

function keyInput(dt) {
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (!x && !y) return;
    if (mode === 'snipe' && sniper.scoped) sniper.drag(x * dt * 260, y * dt * 260);
    else if (mode === 'farm') panBy(-x * dt * 500, -y * dt * 500);
}

// Mando: A/RT mantienen la mira (soltar dispara), stick izquierdo la mueve, LB/RB cambian de
// torre, B sale. En la granja el stick desplaza el mapa y A recoge el primer campo maduro.
const padPrev = [];
function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p);
    if (!pad) return;
    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const down = (i) => pressed(i) && !padPrev[i];
    const up = (i) => !pressed(i) && padPrev[i];
    const ax = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0, ay = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : 0;
    if (mode === 'farm') {
        if (ax || ay) panBy(-ax * dt * 600, -ay * dt * 600);
        if (down(0)) {
            const i = state.readyPlots()[0];
            if (i !== undefined) harvest(i);
        }
    } else if (mode === 'snipe') {
        if (sniper.scoped) sniper.drag(ax * dt * 300, ay * dt * 300);
        if (down(0) || down(7)) sniper.press(0, 0);
        if (up(0) || up(7)) sniper.release(true);
        if (down(1)) sniper.scoped ? sniper.release(false) : goFarm();
        if (down(4) || down(14)) sniper.goCorner(-1);
        if (down(5) || down(15)) sniper.goCorner(1);
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
tapBtn('btn-prev', () => sniper.goCorner(-1));
tapBtn('btn-next', () => sniper.goCorner(1));
tapBtn('panel-action', () => selected && selected.field !== undefined && harvest(selected.field));
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

    if (mode === 'farm' || mode === 'toSnipe') {
        const progress = [];
        for (let i = 0; i < PLOT_COUNT; i++) progress.push(state.progress(i));
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
        // Humo de la chimenea y del tractor; destellos sobre los campos maduros
        if (Math.random() < dt * 5) {
            const h = farm.byId.house;
            h.root.localToWorld(_w.copy(h.chimney));
            farmParticles.spawn(_w.x, _w.y, _w.z, 0.2 + Math.random() * 0.2, 0.7, 0.1, 0.18 + Math.random() * 0.1, 2.2, Math.random() < 0.5 ? 0xe8e4dc : 0xcfc8c0, -0.1);
        }
        progress.forEach((p, i) => {
            if (p >= 1 && Math.random() < dt * 4) {
                const f = farm.fields[i];
                weatherParticle(farmParticles, 'sparkle', f.x + Math.random() * f.w, f.z + Math.random() * f.d, Math.random() < 0.5 ? 0xffffff : 0xffe03a);
                farmParticles.y[farmParticles.n - 1] = 1.1;
            }
        });
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
        $('snipe-hint').classList.toggle('gone', sniper.moving || sniper.scoped);
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
window.game = { state, sniper, farm, rig, get mode() { return mode; }, harvest, goFarm, select };
