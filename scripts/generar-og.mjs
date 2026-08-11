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

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 2,   // el doble de nitidez en pantallas retina
});

await pagina.goto(`file://${PLANTILLA}`, { waitUntil: 'networkidle' });
await pagina.screenshot({ path: SALIDA, clip: { x: 0, y: 0, width: ANCHO, height: ALTO } });
await navegador.close();

const { size } = await import('node:fs').then((fs) => fs.statSync(SALIDA));
console.log(`demo/og.png · ${ANCHO}x${ALTO} · ${(size / 1024).toFixed(0)} KB`);

// WhatsApp descarta las vistas previas de más de 600 KB.
if (size > 600 * 1024) {
  console.warn('AVISO: pesa más de 600 KB; WhatsApp puede no mostrar la vista previa.');
}
