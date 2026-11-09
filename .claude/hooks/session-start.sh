#!/bin/bash
# Al empezar una sesión: si hay un Chromium preinstalado (las sesiones en la nube), Playwright lo
# usa (PW_CHROMIUM); en el Mac no hay nada que hacer
CHROME=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)
if [ -n "$CHROME" ] && [ -n "$CLAUDE_ENV_FILE" ]; then
    echo "export PW_CHROMIUM=$CHROME" >> "$CLAUDE_ENV_FILE"
fi
# Las dependencias, si faltan (un contenedor recién creado)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null && [ ! -d node_modules ] && npm install --silent >/dev/null 2>&1
exit 0
