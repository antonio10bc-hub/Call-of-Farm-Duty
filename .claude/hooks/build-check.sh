#!/bin/bash
# Tras editar el juego (public/src, index.html, style.css): build rápido con esbuild (~1 s). Si
# falla (sintaxis, una importación que no existe...), se le devuelve el error a Claude al momento
# en vez de descubrirlo a mitad de una prueba de minutos
FILE=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')
case "$FILE" in
    */public/src/*.js|*/public/index.html|*/public/style.css) ;;
    *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
OUT=$(npm run build --silent 2>&1)
if [ $? -ne 0 ]; then
    echo "El build falla tras editar $FILE:" >&2
    ERR=$(echo "$OUT" | grep -E "ERROR|error:" | grep -v "^Error: Build failed" | head -8)
    echo "${ERR:-$(echo "$OUT" | tail -8)}" >&2
    exit 2
fi
exit 0
