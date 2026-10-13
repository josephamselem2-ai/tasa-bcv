/**
 * Toma una muestra de lo que responde cada fuente y la añade a
 * datos/registro.csv.
 *
 * PARA QUÉ: hay una pregunta abierta que nadie puede responder de memoria —
 * ¿qué fecha devuelve cada API un sábado? La teoría dice que DolarVZLA ya
 * adelanta al lunes (fecha valor) mientras DolarAPI se queda en el viernes
 * (fecha de publicación). Esto lo deja por escrito, con hora, en vez de
 * depender de que alguien se acuerde de mirar el fin de semana.
 *
 *   node scripts/registrar.mjs
 *
 * Nunca falla por culpa de una API caída: una fuente que no responde se anota
 * con los campos vacíos, que también es información.
 */

import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRINCIPAL = 'https://rates.dolarvzla.com/bcv/current.json';
const CONTRASTE = 'https://ve.dolarapi.com/v1/dolares/oficial';
const TIMEOUT_MS = 10000;

const CARPETA = fileURLToPath(new URL('../datos/', import.meta.url));
const ARCHIVO = CARPETA + 'registro.csv';

const COLUMNAS = [
  'momento_utc',
  'dia_semana',
  'vzla_fecha', 'vzla_usd', 'vzla_previa_fecha', 'vzla_previa_usd',
  'api_fecha', 'api_usd',
  'fechas_iguales', 'diferencia_pct',
];

async function pedir(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: c.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fecha = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

const [vzla, api] = await Promise.all([pedir(PRINCIPAL), pedir(CONTRASTE)]);

const vzlaFecha = fecha(vzla?.current?.date);
const vzlaUsd = numero(vzla?.current?.usd);
const apiFecha = fecha(api?.fechaActualizacion);
const apiUsd = numero(api?.promedio);

const diferencia = vzlaUsd !== null && apiUsd !== null
  ? ((Math.abs(vzlaUsd - apiUsd) / Math.min(vzlaUsd, apiUsd)) * 100).toFixed(4)
  : '';

const ahora = new Date();
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const fila = [
  ahora.toISOString(),
  // Día en Venezuela (UTC-4), que es el huso que importa para el BCV.
  DIAS[new Date(ahora.getTime() - 4 * 3600 * 1000).getUTCDay()],
  vzlaFecha ?? '',
  vzlaUsd ?? '',
  fecha(vzla?.previous?.date) ?? '',
  numero(vzla?.previous?.usd) ?? '',
  apiFecha ?? '',
  apiUsd ?? '',
  vzlaFecha !== null && apiFecha !== null ? (vzlaFecha === apiFecha ? 'si' : 'NO') : '',
  diferencia,
];

mkdirSync(CARPETA, { recursive: true });

// Si el archivo no existe o está vacío, se abre con la cabecera.
const necesitaCabecera = !existsSync(ARCHIVO) || readFileSync(ARCHIVO, 'utf8').trim() === '';
if (necesitaCabecera) appendFileSync(ARCHIVO, COLUMNAS.join(',') + '\n');

appendFileSync(ARCHIVO, fila.join(',') + '\n');

console.log(COLUMNAS.join(','));
console.log(fila.join(','));

if (vzlaFecha !== null && apiFecha !== null && vzlaFecha !== apiFecha) {
  console.log(`\nLAS FECHAS NO COINCIDEN: DolarVZLA dice ${vzlaFecha}, DolarAPI dice ${apiFecha}.`);
  console.log('Eso es exactamente lo que se queria comprobar.');
}
