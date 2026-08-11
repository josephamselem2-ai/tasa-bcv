/**
 * Genera demo/og.png (1200x630) — la imagen que se ve al compartir el enlace
 * en WhatsApp, Facebook, X o LinkedIn.
 *
 * Ejecutar tras cualquier cambio en scripts/og-card.html:
 *   node scripts/generar-og.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const PLANTILLA = fileURLToPath(new URL('og-card.html', import.meta.url));
const SALIDA = fileURLToPath(new URL('../demo/og.png', import.meta.url));

// Medidas que piden Facebook, X, LinkedIn y WhatsApp. No las cambies sin
// actualizar también og:image:width / og:image:height en demo/index.html.
const ANCHO = 1200;
const ALTO = 630;

// El peso manda sobre la nitidez. WhatsApp solo enseña la vista previa GRANDE
// si la imagen es ligera; por encima de ~300 KB la degrada a miniatura. Por eso
// se renderiza a 1x (los 1200x630 exactos) y no a 2x: a 2x pesaba 529 KB y
// WhatsApp la rechazaba.
const LIMITE_WHATSAPP = 300 * 1024;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 1,
});

await pagina.goto(`file://${PLANTILLA}`, { waitUntil: 'networkidle' });
await pagina.screenshot({ path: SALIDA, clip: { x: 0, y: 0, width: ANCHO, height: ALTO } });
await navegador.close();

const { statSync } = await import('node:fs');
const { size } = statSync(SALIDA);
const kb = (size / 1024).toFixed(0);

if (size > LIMITE_WHATSAPP) {
  console.error(`demo/og.png · ${ANCHO}x${ALTO} · ${kb} KB`);
  console.error(`FALLO: supera los ${LIMITE_WHATSAPP / 1024} KB. WhatsApp la degradará`);
  console.error('a miniatura. Simplifica el fondo de scripts/og-card.html (los');
  console.error('degradados engordan mucho el PNG) o baja el tamaño del texto.');
  process.exit(1);
}

console.log(`demo/og.png · ${ANCHO}x${ALTO} · ${kb} KB · vista previa grande OK`);
