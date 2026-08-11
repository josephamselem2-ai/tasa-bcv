/**
 * Genera los iconos de la pestaña a partir de scripts/icono.html.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Produce en demo/:
 *   favicon-32.png       la pestaña del navegador
 *   favicon-192.png      Android / acceso directo en el escritorio
 *   apple-touch-icon.png iOS, al añadir a la pantalla de inicio (180x180)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const PLANTILLA = fileURLToPath(new URL('icono.html', import.meta.url));
const DESTINO = fileURLToPath(new URL('../demo/', import.meta.url));

const ICONOS = [
  { archivo: 'favicon-32.png', lado: 32 },
  { archivo: 'favicon-192.png', lado: 192 },
  { archivo: 'apple-touch-icon.png', lado: 180 },
];

const navegador = await chromium.launch();

for (const { archivo, lado } of ICONOS) {
  const pagina = await navegador.newPage({
    viewport: { width: lado, height: lado },
    deviceScaleFactor: 1,
  });

  // omitBackground conserva las esquinas redondeadas en vez de rellenarlas
  // de blanco, que es lo que delata un icono mal recortado sobre fondo oscuro.
  await pagina.goto(`file://${PLANTILLA}`, { waitUntil: 'networkidle' });
  await pagina.screenshot({ path: DESTINO + archivo, omitBackground: true });
  await pagina.close();

  console.log(`${archivo.padEnd(22)} ${lado}x${lado}  ${statSync(DESTINO + archivo).size} bytes`);
}

await navegador.close();
