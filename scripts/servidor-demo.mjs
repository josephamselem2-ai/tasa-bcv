/**
 * Servidor estático mínimo para ver la demo. Sin dependencias.
 * Existe porque abrir el HTML con file:// bloquea los módulos ES.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no .pathname: la ruta lleva espacios y en Windows un
// prefijo de unidad, que .pathname devuelve como '/C:/...%20...'.
const RAIZ = fileURLToPath(new URL('../demo/', import.meta.url));
const PUERTO = Number(process.env.PORT) || 4173;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relativa = normalize(pedido === '/' ? 'index.html' : pedido).replace(/^(\.\.[/\\])+/, '');

  try {
    const cuerpo = await readFile(join(RAIZ, relativa));
    res.writeHead(200, { 'content-type': TIPOS[extname(relativa)] ?? 'application/octet-stream' });
    res.end(cuerpo);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PUERTO, () => {
  console.log(`Demo en http://localhost:${PUERTO}`);
});
