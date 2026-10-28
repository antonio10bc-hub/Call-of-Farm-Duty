// Pruebas del juego en un navegador de verdad (npm test). Arrancan el servidor local y juegan
// partidas cortas usando window.game (y el botón secreto, que en localhost siempre está).
const { defineConfig } = require('@playwright/test');

// SITE_DIR=dist: las pruebas van contra la versión empaquetada (npm run build)
const PORT = process.env.SITE_DIR ? 3298 : 3299;
// En el Mac (fuera de CI): Chromium completo con la GPU real (Metal) en vez del headless shell
// con WebGL por software, que pone la CPU al 100% (medido: ~1060% de CPU media frente a ~60%).
// En CI (Linux, sin GPU) o con PW_GPU=soft, WebGL por software como siempre.
const GPU = process.env.PW_GPU ? process.env.PW_GPU === 'metal' : process.platform === 'darwin' && !process.env.CI;
const GL_ARGS = GPU ? ['--use-angle=metal'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

module.exports = defineConfig({
    testDir: './tests',
    timeout: 120_000,
    expect: { timeout: 15_000 },
    fullyParallel: true,
    workers: 2, // en local y en CI (más workers en local saturan la CPU: cada uno renderiza el juego)
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['github']] : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        browserName: 'chromium',
        viewport: { width: 390, height: 760 },
        hasTouch: true,
        locale: 'es-ES',
        serviceWorkers: 'block',
        // WebGL por software: funciona igual en una máquina sin tarjeta gráfica
        // PW_CHROMIUM: navegador ya instalado en la máquina (si no coincide con la versión de Playwright)
        ...(GPU ? { channel: 'chromium' } : {}),
        launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: GL_ARGS },
    },
    webServer: {
        command: `PORT=${PORT} SITE_DIR=${process.env.SITE_DIR || 'public'} node server.js`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
    },
});
