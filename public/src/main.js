import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEME } from './content/theme.js';
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

const $ = (id) => document.getElementById(id);
const INK = 0x1b0b33;

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

// ---------- Granja ----------
const farmScene = new THREE.Scene();
addLights(farmScene);
const farm = new Farm(THEME);
farmScene.add(farm.root);
const farmParticles = new Particles(farmScene, 400);
const rig = new CameraRig(CONFIG.camera);
rig.free = true;
rig.setBounds(farm.cols, farm.rows);
rig.focus(farm.cx, farm.cz + 0.6);
rig.snap();

// ---------- Francotirador ----------
const sniper = new Sniper(THEME, {
    sfx,
    onHit(sheaf, nx, ny) {
        state.collect(sheaf.plot);
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
let mode = 'farm';   // 'farm' | 'toSnipe' | 'snipe' | 'toFarm'
let modeT = 0;
let time = 0;
let lastReady = -1;

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
    const el = $('stage');
    $('stage-name').textContent = name;
    $('stage-sub').textContent = sub;
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

// Un haz pixelado vuela a saltos hasta el contador
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
    anim.onfinish = () => { el.remove(); done(); };
}

function showCorner(i) {
    [...$('corners').children].forEach((el, k) => el.classList.toggle('on', k === i));
}

function refreshFarmUi(force = false) {
    const ready = state.readyPlots().length;
    const btn = $('btn-harvest'), tag = $('next-tag');
    if (ready !== lastReady || force) {
        btn.classList.toggle('hidden', ready === 0);
        tag.classList.toggle('hidden', ready > 0);
        if (ready > 0 && lastReady <= 0) {
            btn.classList.remove('pop');
            void btn.offsetWidth;
            btn.classList.add('pop');
            if (lastReady === 0) sfx.play('itemSpawn');
        }
        lastReady = ready;
    }
    if (ready === 0) {
        const s = Math.ceil(state.nextReadyIn());
        tag.innerHTML = `${L('GROWING...', 'CRECIENDO...')}<br>${L('READY IN', 'LISTO EN')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
}

function startMusic(cfg) {
    if (!Settings.music) return;
    music.start(cfg, 7);
}

// ---------- Transiciones ----------
function harvest() {
    if (mode !== 'farm' || !state.readyPlots().length) return;
    sfx.unlock();
    sfx.play('go');
    vibrate('pickup');
    mode = 'toSnipe';
    modeT = 0;
    // La cámara baja hacia una de las parcelas listas
    const p = farm.plots[state.readyPlots()[0]];
    rig.focus(p.x, p.z);
    rig.zoomTarget = 0.42;
    $('btn-harvest').classList.add('hidden');
}

function enterSnipe() {
    const plots = state.readyPlots().map((plot) => ({ plot, count: state.plots[plot].left }));
    sniper.enter(plots);
    mode = 'snipe';
    renderer.flash(INK, 1);
    $('farm-ui').classList.add('hidden');
    $('snipe-ui').classList.remove('hidden');
    $('snipe-ui').classList.remove('scoped');
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
    sniper.setScoped(false);
    if (!done) sfx.play('ui');
    goFarm.done = done;
}

function enterFarm() {
    sniper.leave();
    mode = 'farm';
    renderer.flash(INK, 1);
    scope.show(false);
    $('snipe-ui').classList.add('hidden');
    $('farm-ui').classList.remove('hidden');
    rig.zoomTarget = 1;
    rig.zoom = 0.55;
    rig.focus(farm.cx, farm.cz + 0.6);
    lastReady = -1;
    refreshFarmUi(true);
    updateCounts();
    startMusic(THEME.music);
    if (goFarm.done) {
        farm.barn.cheer();
        setTimeout(() => stage(L('HARVEST DONE!', '¡COSECHA HECHA!'), `${L('WHEAT', 'TRIGO')}: ${state.wheat}`), 300);
    }
}

// ---------- Entrada: toques, ratón, teclado y mando ----------
let touch = null;
function onCanvas(e) {
    return e.target === canvas || e.target === $('scope') || e.target === document.body || e.target.classList.contains('snipe-ui');
}
const ndc = (x, y) => {
    const r = canvas.getBoundingClientRect();
    return [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
};

addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (!music.playing && Settings.music && sfx.ctx) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
    if (mode !== 'snipe' || !onCanvas(e)) return;
    if (e.button === 2) {
        sniper.scoped ? sniper.setScoped(false) : sniper.scopeAt(0, 0);
        return;
    }
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
});
addEventListener('pointermove', (e) => {
    if (!touch || e.pointerId !== touch.id || mode !== 'snipe') return;
    const dx = e.clientX - touch.lx, dy = e.clientY - touch.ly;
    touch.lx = e.clientX;
    touch.ly = e.clientY;
    if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) touch.moved = true;
    if (sniper.scoped) sniper.aim(dx, dy);
});
addEventListener('pointerup', (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const t = touch;
    touch = null;
    if (mode !== 'snipe') return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y, dur = performance.now() - t.t;
    if (sniper.scoped) {
        if (!t.moved && dur < 350) sniper.fire();
    } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dur < 700) {
        sniper.goCorner(dx < 0 ? 1 : -1);
    } else if (!t.moved) {
        sniper.scopeAt(...ndc(e.clientX, e.clientY));
    }
});
addEventListener('pointercancel', () => (touch = null));
addEventListener('contextmenu', (e) => e.preventDefault());

const keys = new Set();
addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (e.repeat) return;
    if (mode === 'farm') {
        if (k === 'enter' || k === ' ') harvest();
        return;
    }
    if (mode !== 'snipe') return;
    if (k === ' ' || k === 'enter') sniper.scoped ? sniper.fire() : sniper.scopeAt(0, 0);
    else if (k === 'escape' || k === 'backspace' || k === 'shift') sniper.scoped ? sniper.setScoped(false) : goFarm();
    else if (k === 'q' || (!sniper.scoped && (k === 'a' || k === 'arrowleft'))) sniper.goCorner(-1);
    else if (k === 'e' || (!sniper.scoped && (k === 'd' || k === 'arrowright'))) sniper.goCorner(1);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const padPrev = [];
function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p);
    if (!pad) return;
    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const down = (i) => pressed(i) && !padPrev[i];
    if (mode === 'farm' && down(0)) harvest();
    if (mode === 'snipe') {
        const ax = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0, ay = Math.abs(pad.axes[1]) > 0.15 ? pad.axes[1] : 0;
        if (sniper.scoped) sniper.aim(ax * dt * 600, ay * dt * 600);
        if (down(0) || down(7)) sniper.scoped ? sniper.fire() : sniper.scopeAt(0, 0);
        if (down(6)) sniper.scoped ? sniper.setScoped(false) : sniper.scopeAt(0, 0);
        if (down(1)) sniper.scoped ? sniper.setScoped(false) : goFarm();
        if (down(4) || down(14)) sniper.goCorner(-1);
        if (down(5) || down(15)) sniper.goCorner(1);
    }
    pad.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
}

function keyAim(dt) {
    if (mode !== 'snipe' || !sniper.scoped) return;
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (x || y) sniper.aim(x * dt * 500, y * dt * 500);
}

// Botones
const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.unlock();
    fn();
});
tapBtn('btn-harvest', harvest);
tapBtn('btn-home', () => goFarm());
tapBtn('btn-prev', () => sniper.goCorner(-1));
tapBtn('btn-next', () => sniper.goCorner(1));
tapBtn('btn-fire', () => sniper.fire());
tapBtn('btn-unscope', () => sniper.setScoped(false));
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
// Botones de la interfaz: no cuentan como toque en el campo
for (const el of document.querySelectorAll('button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());
try {
    if (sessionStorage.getItem('cofd.reopenSettings')) {
        sessionStorage.removeItem('cofd.reopenSettings');
        $('settings').classList.remove('hidden');
    }
} catch { /* sin almacenamiento */ }

// ---------- Bucle ----------
let last = performance.now();
let uiT = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(CONFIG.sim.maxFrame, (now - last) / 1000);
    last = now;
    time += dt;
    pollPad(dt);
    keyAim(dt);

    if (mode === 'farm' || mode === 'toSnipe') {
        const progress = [];
        for (let i = 0; i < PLOT_COUNT; i++) progress.push(state.progress(i));
        farm.update(dt, time, progress);
        if (mode === 'farm') {
            // La cámara pasea despacio sobre la granja
            rig.yawTarget = Math.sin(time * 0.09) * 0.45;
            rig.focus(farm.cx + Math.sin(time * 0.13) * 0.5, farm.cz + 0.6 + Math.cos(time * 0.1) * 0.4);
            uiT -= dt;
            if (uiT <= 0) {
                uiT = 0.25;
                refreshFarmUi();
            }
        } else {
            modeT += dt;
            renderer.flash(INK, Math.max(0, (modeT - 0.35) / 0.4));
            if (modeT > 0.8) enterSnipe();
        }
        // Destellos sobre las parcelas listas y pétalos del clima
        progress.forEach((p, i) => {
            if (p >= 1 && Math.random() < dt * 6) {
                const pl = farm.plots[i];
                weatherParticle(farmParticles, 'sparkle', pl.x + (Math.random() - 0.5) * 3, pl.z + (Math.random() - 0.5) * 3, Math.random() < 0.5 ? 0xffffff : 0xffe03a);
            }
        });
        if (Math.random() < dt * THEME.ambient.rate) {
            const c = THEME.ambient.colors;
            weatherParticle(farmParticles, THEME.ambient.kind, farm.cx + (Math.random() - 0.5) * 18, farm.cz + (Math.random() - 0.5) * 18, c[(Math.random() * c.length) | 0]);
        }
        farmParticles.update(dt);
        farmParticles.sync();
        rig.update(dt);
        renderer.render(farmScene, rig.camera, dt);
    }
    if (mode === 'snipe' || mode === 'toFarm') {
        sniper.update(dt);
        const ui = $('snipe-ui');
        ui.classList.toggle('scoped', sniper.scoped);
        scope.show(sniper.scoped && sniper.fov < (CONFIG.sniper.fov + CONFIG.sniper.scopeFov) * 0.5);
        scope.setReady(sniper.canFire);
        $('btn-fire').classList.toggle('wait', !sniper.canFire);
        $('rounds').classList.toggle('wait', !sniper.canFire);
        $('snipe-hint').classList.toggle('gone', sniper.moving);
        if (mode === 'toFarm') {
            modeT += dt;
            renderer.flash(INK, Math.min(1, modeT / 0.35));
            if (modeT > 0.4) enterFarm();
        }
        if (mode !== 'farm') renderer.render(sniper.scene, sniper.camera, dt);
    }
}

updateCounts();
refreshFarmUi(true);
requestAnimationFrame(frame);
window.__loaded = true;

// Service worker: en la web publicada (en local no, para no quedarse con versiones viejas)
if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Para las pruebas (Playwright)
window.game = { state, sniper, farm, get mode() { return mode; }, harvest, goFarm };
