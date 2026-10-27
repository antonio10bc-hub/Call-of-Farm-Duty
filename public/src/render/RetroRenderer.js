import * as THREE from 'three';

// Trabajamos con los colores "tal cual" (como en una consola): sin gestión de color.
THREE.ColorManagement.enabled = false;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Cuantiza a pocos niveles con trama Bayer 4x4, satura y viñetea: el "look" DS.
const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uLevels;
uniform float uDither;
uniform float uSat;
uniform vec3 uTint;
uniform float uTintAmt;
uniform vec3 uGrade;
uniform float uGradeAmt;
varying vec2 vUv;
float bayer(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return m[q.x + q.y * 4] / 16.0 - 0.47;
}
void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    c = mix(c, c * uGrade, uGradeAmt);
    c = mix(c, uTint, uTintAmt);
    vec2 d = vUv - 0.5;
    c *= 1.0 - dot(d, d) * 0.5;
    // Modo difícil: bordes que se oscurecen hacia un rojo casi negro
    c = mix(c, vec3(0.28, 0.0, 0.04), clamp(dot(d, d) * 2.6 * uGradeAmt, 0.0, 0.85));
    c += bayer(gl_FragCoord.xy) * uDither / uLevels;
    c = floor(clamp(c, 0.0, 1.0) * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(c, 1.0);
}`;

export class RetroRenderer {
    constructor(canvas, cfg) {
        this.canvas = canvas;
        this.cfg = cfg;
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.gl.setPixelRatio(1);
        this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;

        this.target = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            depthBuffer: true,
        });

        this.uniforms = {
            tDiffuse: { value: this.target.texture },
            uLevels: { value: cfg.colorLevels },
            uDither: { value: cfg.dither },
            uSat: { value: cfg.saturation },
            uTint: { value: new THREE.Color(0xffffff) },
            uTintAmt: { value: 0 },
            uGrade: { value: new THREE.Color(1, 1, 1) },
            uGradeAmt: { value: 0 },
        };
        const quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false })
        );
        quad.frustumCulled = false;
        this.postScene = new THREE.Scene();
        this.postScene.add(quad);
        this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.onResize = null;
        window.addEventListener('resize', () => this.resize());
        // iOS (sobre todo la app guardada en la pantalla de inicio) da a veces una altura menor
        // que la real al abrir y no avisa cuando la corrige: se vuelve a medir en esos momentos
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
        window.addEventListener('pageshow', () => this.resize());
        if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
        for (const ms of [100, 400, 1200]) setTimeout(() => this.resize(), ms);
    }

    // Tamaño de la pantalla: lo que ocupa de verdad un elemento fijo a pantalla completa
    // (cubre también la zona del indicador de inicio), nunca menos que innerWidth/innerHeight
    screenSize() {
        let probe = document.getElementById('screen-probe');
        if (!probe) {
            probe = document.createElement('div');
            probe.id = 'screen-probe';
            probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
            document.body.appendChild(probe);
        }
        const r = probe.getBoundingClientRect();
        return [Math.max(window.innerWidth, Math.round(r.width)), Math.max(window.innerHeight, Math.round(r.height))];
    }

    resize() {
        const [sw, sh] = this.screenSize();
        if (sw === this.lastW && sh === this.lastH && this.width) return;
        this.lastW = sw;
        this.lastH = sh;
        const w = Math.max(1, sw);
        const h = Math.max(1, sh);
        const { targetPixels, maxScale } = this.cfg;
        const lines = this.lines || targetPixels;
        const scale = Math.min(maxScale, Math.max(1, Math.round(Math.min(w, h) / lines)));
        const lw = Math.ceil(w / scale);
        const lh = Math.ceil(h / scale);
        this.gl.setSize(lw, lh, false);
        this.canvas.style.width = `${lw * scale}px`;
        this.canvas.style.height = `${lh * scale}px`;
        this.target.setSize(lw, lh);
        this.width = lw;
        this.height = lh;
        if (this.onResize) this.onResize(lw, lh);
    }

    // Tamaño del píxel (Ajustes, en el ordenador): líneas en el lado corto de la pantalla
    setLines(lines) {
        this.lines = lines;
        this.lastW = 0; // fuerza a recalcular aunque la ventana no haya cambiado
        this.resize();
    }

    // Gradación de color fija (modo difícil: todo teñido de rojo y con bordes oscuros).
    setGrade(r, g, b, amount) {
        this.uniforms.uGrade.value.setRGB(r, g, b);
        this.uniforms.uGradeAmt.value = amount;
    }

    // Tinte de pantalla completa que se desvanece (daño, explosiones...).
    flash(color, amount) {
        this.uniforms.uTint.value.setHex(color);
        this.uniforms.uTintAmt.value = Math.max(this.uniforms.uTintAmt.value, amount);
    }

    // Pantalla partida (duelo): "bottom" en la mitad de abajo y "top" en la de arriba, con el
    // mismo pixelado y la misma trama que el resto
    renderSplit(scene, bottom, top, dt) {
        const tint = this.uniforms.uTintAmt;
        tint.value = Math.max(0, tint.value - dt * 2.5);
        const t = this.target, w = this.width, h = this.height, hb = Math.floor(h / 2);
        this.gl.setRenderTarget(t);
        this.gl.clear();
        t.scissorTest = true;
        for (const [cam, y, hh] of [[bottom, 0, hb], [top, hb, h - hb]]) {
            t.viewport.set(0, y, w, hh);
            t.scissor.set(0, y, w, hh);
            this.gl.setRenderTarget(t); // aplica el nuevo recorte
            this.gl.render(scene, cam);
        }
        t.scissorTest = false;
        t.viewport.set(0, 0, w, h);
        t.scissor.set(0, 0, w, h);
        this.gl.setRenderTarget(null);
        this.gl.render(this.postScene, this.postCamera);
    }

    render(scene, camera, dt) {
        const tint = this.uniforms.uTintAmt;
        tint.value = Math.max(0, tint.value - dt * 2.5);
        this.gl.setRenderTarget(this.target);
        this.gl.render(scene, camera);
        this.gl.setRenderTarget(null);
        this.gl.render(this.postScene, this.postCamera);
    }
}
