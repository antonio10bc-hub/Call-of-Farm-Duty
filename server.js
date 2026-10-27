// Servidor estático mínimo: el juego corre 100% en el navegador.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SITE_DIR=dist sirve la versión empaquetada (npm run build) para probarla en local
app.use(express.static(path.join(__dirname, process.env.SITE_DIR || 'public')));

app.listen(PORT, () => {
    console.log(`Call of Farm Duty listo en http://localhost:${PORT}`);
});
