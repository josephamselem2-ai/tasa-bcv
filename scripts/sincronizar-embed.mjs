/**
 * Mete el contenido de embed/tasa-bcv.html dentro de demo/index.html, entre
 * los marcadores SNIPPET.
 *
 * Existe para que el bloque que la gente copia de la web sea, byte a byte, el
 * mismo que está versionado en embed/. Mantenerlos a mano es garantía de que
 * un día dejen de coincidir y nadie se entere.
 *
 *   node scripts/sincronizar-embed.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORIGEN = fileURLToPath(new URL('../embed/tasa-bcv.html', import.meta.url));
const DESTINO = fileURLToPath(new URL('../demo/index.html', import.meta.url));

const INICIO = '<!--SNIPPET-->';
const FIN = '<!--/SNIPPET-->';

/** Quita el comentario de cabecera: en la web ya está explicado alrededor. */
function cuerpoDelEmbed(texto) {
  return texto.replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
}

/** Los marcadores son comentarios HTML: textContent no los incluye, así que
 *  el botón de copiar entrega el bloque limpio. */
function escaparParaHtml(texto) {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const bloque = escaparParaHtml(cuerpoDelEmbed(readFileSync(ORIGEN, 'utf8')));
const pagina = readFileSync(DESTINO, 'utf8');

const desde = pagina.indexOf(INICIO);
const hasta = pagina.indexOf(FIN);

if (desde === -1 || hasta === -1) {
  console.error(`FALLO: no encuentro ${INICIO} ... ${FIN} en demo/index.html`);
  process.exit(1);
}

const actualizada =
  pagina.slice(0, desde + INICIO.length) + bloque + pagina.slice(hasta);

if (actualizada === pagina) {
  console.log('el bloque ya estaba al día');
} else {
  writeFileSync(DESTINO, actualizada);
  console.log(`bloque sincronizado desde embed/tasa-bcv.html (${bloque.length} caracteres)`);
}
