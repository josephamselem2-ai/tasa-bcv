/**
 * Maneja la demo en un navegador real. Comprueba que el paso a paso funciona
 * de verdad: la tasa en vivo, la calculadora, las pestañas de plataforma, el
 * botón de copiar, y que al caer la API desaparecen los bolívares.
 *
 * Requiere el servidor levantado: `npm run demo`.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const URL_DEMO = process.env.DEMO_URL ?? 'http://localhost:4173/';
const CAPTURAS = fileURLToPath(new URL('../demo/capturas/', import.meta.url));
mkdirSync(CAPTURAS, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1000, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const pagina = await contexto.newPage();

const errores = [];
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pagina.on('pageerror', (e) => errores.push(String(e)));

const comprobar = (condicion, mensaje) => {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`  ok  ${mensaje}`);
};

await pagina.goto(URL_DEMO, { waitUntil: 'networkidle' });

// --- 1. Tasa en vivo ------------------------------------------------------
console.log('\n1. Tasa en vivo');
await pagina.waitForFunction(() => document.querySelector('#estado')?.dataset.source === 'bcv',
  null, { timeout: 15000 });

const tasa = (await pagina.textContent('#tasa'))?.trim();
comprobar(/^\d/.test(tasa ?? ''), `la tasa se pinta: ${tasa}`);
comprobar((await pagina.textContent('#previa-bs'))?.startsWith('Bs.'),
  'la vista previa muestra bolívares');

// --- 2. Calculadora -------------------------------------------------------
console.log('\n2. Calculadora');
await pagina.fill('#usd', '100');
await pagina.waitForFunction(() => document.querySelector('#resultado')?.textContent?.startsWith('Bs.'));
const cien = await pagina.textContent('#resultado');
comprobar(cien?.startsWith('Bs.'), `$100 → ${cien}`);

await pagina.fill('#usd', '');
comprobar((await pagina.textContent('#resultado')) === 'Escribe un importe',
  'un importe vacío no pinta una cifra');
await pagina.fill('#usd', '49.90');

// --- 3. Pestañas de plataforma -------------------------------------------
console.log('\n3. Pestañas de plataforma');
for (const plataforma of ['wordpress', 'wix', 'squarespace', 'shopify', 'html']) {
  await pagina.click(`[data-plataforma="${plataforma}"]`);
  const pasos = await pagina.$$eval('#panel-plataforma li', (n) => n.length);
  comprobar(pasos >= 3, `${plataforma}: ${pasos} pasos`);
}
await pagina.click('[data-plataforma="wordpress"]');

// --- 4. Botón de copiar ---------------------------------------------------
console.log('\n4. Botón de copiar');
await pagina.click('#copiar');
const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
comprobar(copiado.includes('ve.dolarapi.com'), 'el portapapeles lleva el endpoint');
comprobar(copiado.includes('tasa > 1000000'), 'el portapapeles lleva la línea que valida');
comprobar(!copiado.includes('&lt;'), 'el HTML va sin escapar, listo para pegar');
comprobar((await pagina.textContent('#copiar')) === '¡Copiado!', 'el botón confirma');

await pagina.screenshot({ path: CAPTURAS + 'guia-completa.png', fullPage: true });
await pagina.screenshot({ path: CAPTURAS + 'con-tasa.png' });

// --- 5. Regla 01: la API cae ---------------------------------------------
console.log('\n5. Regla 01 — la API cae');
await pagina.click('#romper');
await pagina.waitForFunction(() => document.querySelector('#estado')?.dataset.source === 'fallback');

const tras = await pagina.evaluate(() => ({
  resultado: document.querySelector('#resultado').textContent,
  previa: document.querySelector('#previa-bs').textContent,
  tasa: document.querySelector('#tasa').textContent,
}));

comprobar(!tras.resultado.includes('Bs.'), `la calculadora se calla: "${tras.resultado}"`);
comprobar(!tras.previa.includes('Bs.'), `la vista previa se calla: "${tras.previa}"`);
comprobar(tras.tasa === '—', 'la tasa grande no inventa un número');

await pagina.screenshot({ path: CAPTURAS + 'sin-tasa.png' });

if (errores.length) throw new Error(`errores en consola: ${errores.join(' | ')}`);
console.log('\nTodo OK — sin errores de consola.');

await navegador.close();
