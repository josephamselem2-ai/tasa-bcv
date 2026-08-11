import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { obtenerTasaBcv, convertir, TASA_RESPALDO } from './tasaBcv.ts';

const fetchOriginal = globalThis.fetch;

/** Sustituye fetch por una respuesta fija. Devuelve las llamadas registradas. */
function stubFetch(respuesta: unknown, { ok = true }: { ok?: boolean } = {}) {
  const llamadas: Array<[string, RequestInit | undefined]> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    llamadas.push([url, init]);
    return {
      ok,
      json: async () => {
        if (respuesta instanceof Error) throw respuesta;
        return respuesta;
      },
    } as Response;
  }) as typeof fetch;
  return llamadas;
}

beforeEach(() => stubFetch({ promedio: 757.5406, fechaActualizacion: '2026-08-11T09:00:00.000Z' }));
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  mock.timers.reset();
});

// ---- Camino feliz -------------------------------------------------------

test('devuelve la tasa y la fecha cuando la API responde bien', async () => {
  const tasa = await obtenerTasaBcv();
  assert.deepEqual(tasa, { rate: 757.5406, date: '2026-08-11', source: 'bcv' });
});

test('llama al endpoint oficial del BCV', async () => {
  const llamadas = stubFetch({ promedio: 100 });
  await obtenerTasaBcv();
  assert.equal(llamadas[0][0], 'https://ve.dolarapi.com/v1/dolares/oficial');
});

test('respeta las opciones que le pasan, pero impone su propia señal', async () => {
  const llamadas = stubFetch({ promedio: 100 });
  const ajena = new AbortController().signal;
  await obtenerTasaBcv({ signal: ajena, next: { revalidate: 3600 } } as RequestInit);

  const init = llamadas[0][1] as RequestInit & { next?: unknown };
  assert.deepEqual(init.next, { revalidate: 3600 });
  assert.notEqual(init.signal, ajena);
});

// ---- Regla 01: ninguna cifra es mejor que una inventada ------------------

test('fallback si la respuesta HTTP no es ok', async () => {
  stubFetch({ promedio: 757 }, { ok: false });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('fallback si la red falla', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('fallback si el cuerpo no es JSON válido', async () => {
  stubFetch(new SyntaxError('Unexpected token <'));
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('el respaldo nunca invita a mostrar bolívares', () => {
  assert.equal(TASA_RESPALDO.source, 'fallback');
  assert.equal(TASA_RESPALDO.rate, 0);
});

// ---- La línea que valida el número --------------------------------------

test('rechaza una tasa que no es número', () => {
  assert.equal(convertir({ promedio: '757,54' }), null);
});

test('rechaza cero y negativos', () => {
  assert.equal(convertir({ promedio: 0 }), null);
  assert.equal(convertir({ promedio: -5 }), null);
});

test('rechaza NaN e Infinity', () => {
  assert.equal(convertir({ promedio: Number.NaN }), null);
  assert.equal(convertir({ promedio: Number.POSITIVE_INFINITY }), null);
});

test('rechaza una tasa por encima del techo de cordura', () => {
  assert.equal(convertir({ promedio: 1_000_001 }), null);
  assert.notEqual(convertir({ promedio: 1_000_000 }), null);
});

test('rechaza respuestas vacías o sin el campo', () => {
  assert.equal(convertir(null), null);
  assert.equal(convertir(undefined), null);
  assert.equal(convertir({}), null);
  assert.equal(convertir({ error: 'not found' }), null);
});

test('una tasa rechazada acaba en fallback, no en excepción', async () => {
  stubFetch({ promedio: 'raro' });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

// ---- Fecha ---------------------------------------------------------------

test('recorta la fecha de la API a YYYY-MM-DD', () => {
  const tasa = convertir({ promedio: 100, fechaActualizacion: '2026-08-11T13:45:02.000Z' });
  assert.equal(tasa?.date, '2026-08-11');
});

test('usa la fecha de hoy si la API no manda fecha usable', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal(convertir({ promedio: 100 })?.date, hoy);
  assert.equal(convertir({ promedio: 100, fechaActualizacion: 12345 })?.date, hoy);
});

// ---- Regla 03: cinco segundos y se abandona ------------------------------

test('aborta a los 5 segundos y devuelve fallback', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });

  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolver, rechazar) => {
      init?.signal?.addEventListener('abort', () =>
        rechazar(new DOMException('This operation was aborted', 'AbortError')));
    })) as typeof fetch;

  const pendiente = obtenerTasaBcv();
  mock.timers.tick(5000);

  assert.deepEqual(await pendiente, TASA_RESPALDO);
});

test('no aborta antes de los 5 segundos', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });

  let abortada = false;
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((resolver) => {
      init?.signal?.addEventListener('abort', () => { abortada = true; });
      queueMicrotask(() => resolver({ ok: true, json: async () => ({ promedio: 757 }) } as Response));
    })) as typeof fetch;

  const pendiente = obtenerTasaBcv();
  mock.timers.tick(4999);

  assert.equal((await pendiente).source, 'bcv');
  assert.equal(abortada, false);
});
