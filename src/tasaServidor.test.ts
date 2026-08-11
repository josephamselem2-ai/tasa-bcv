import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getTasaBcvMem, limpiarCacheTasa, TTL_SEGUNDOS } from './tasaServidor.ts';

const fetchOriginal = globalThis.fetch;
let llamadas = 0;

function stubFetch({ ok = true, promedio = 757.5406 } = {}) {
  llamadas = 0;
  globalThis.fetch = (async () => {
    llamadas++;
    return { ok, json: async () => ({ promedio, fechaActualizacion: '2026-08-11' }) } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  limpiarCacheTasa();
  stubFetch();
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test('cien visitantes seguidos son una sola petición a la API', async () => {
  const todas = await Promise.all(Array.from({ length: 100 }, () => getTasaBcvMem()));

  assert.equal(llamadas, 1);
  assert.equal(new Set(todas.map((t) => t.rate)).size, 1, 'todos ven la misma tasa');
});

test('sirve del caché mientras no expire', async () => {
  const t0 = 1_000_000;
  await getTasaBcvMem(t0);
  await getTasaBcvMem(t0 + TTL_SEGUNDOS * 1000 - 1);

  assert.equal(llamadas, 1);
});

test('vuelve a pedir cuando el caché expira', async () => {
  const t0 = 1_000_000;
  await getTasaBcvMem(t0);
  await getTasaBcvMem(t0 + TTL_SEGUNDOS * 1000);

  assert.equal(llamadas, 2);
});

test('un fallback no se cachea: la siguiente visita reintenta', async () => {
  stubFetch({ ok: false });

  const primera = await getTasaBcvMem();
  const segunda = await getTasaBcvMem();

  assert.equal(primera.source, 'fallback');
  assert.equal(segunda.source, 'fallback');
  assert.equal(llamadas, 2, 'no debe quedarse una hora sin bolívares por un fallo puntual');
});
