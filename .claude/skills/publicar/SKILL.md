---
name: publicar
description: Cerrar un cambio y publicarlo en la web (build, pruebas, commit, push a main y comprobar el despliegue en Vercel). Úsala al terminar cualquier cambio, como pide CLAUDE.md.
---

# Publicar un cambio

1. **Build**: `npm run build`. Si falla, arréglalo antes de seguir.
2. **Pruebas** (en la nube, con `PW_CHROMIUM` puesto; lo hace el hook de inicio):
   - `npm run test:related` (solo lo afectado por lo que ha cambiado, un worker).
   - `npm run test:smoke` antes de dar la tarea por terminada.
   - La suite completa (`npm test`) solo al final de una tarea grande o si la piden.
   - Para correrlas sin llenar la conversación, delega en el agente `pruebas`.
   - Si una falla: repítela sola (`npx playwright test -g "<nombre>" --workers=1`). Si pasa sola, dilo como inestable; si vuelve a fallar, es real: arréglala.
3. **README**: si cambia algo que el jugador ve o un control de DEBUG, actualiza su sección.
4. **Commit** (mensaje en español, qué cambia para el jugador):
   ```sh
   git add -A
   git -c user.email=antonioasis10bc@gmail.com -c user.name=antonio10bc-hub commit -q -m "<mensaje>

   Co-Authored-By: Claude <noreply@anthropic.com>
   Claude-Session: <url de la sesión, si la hay>"
   ```
   (Si el sistema da otras líneas de autoría, usa esas.)
5. **Push a main**: `git pull -q --rebase origin main && git push -q origin main`.
6. **Despliegue**: con el MCP de Vercel (`list_deployments` del proyecto, el más reciente de `main`) comprueba que el commit subido termina en `READY`. Si queda en `ERROR`, mira sus logs de build (`get_deployment`) y arréglalo.
7. **Resumen** al usuario, corto y en español: qué ha cambiado, el commit y si alguna prueba falló o es inestable.
