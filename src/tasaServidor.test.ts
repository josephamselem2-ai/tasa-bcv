import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getTasaBcvMem, limpiarCacheTasa, TTL_SEGUNDOS } from './tasaServidor.ts';

const fetchOriginal = globalThis.fetch;

const USD = 876.7976;

/**
 * Cada consulta lanza DOS peticiones (una por fuente), asi que lo que cuenta
 * aqui son rondas: se cuenta solo la fuente principal.
 */
let rondas = 0;

function stub({ ok = true, usd = USD } = {}) {
  rondas = 0;

  globalThis.fetch = (async (url: string) => {
    const esPrincipal = String(url).includes('dolarvzla');
    if (esPrincipal) rondas++;

    return {
      ok,
      json: async () => (esPrincipal
        ? { current: { usd, eur: 982.004, date: '2026-10-13' },
            previous: { usd: 875.6505, date: '2026-10-09' } }
        : { promedio: usd, fechaActualizacion: '2026-10-13T00:00:00-04:00' }),
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  limpiarCacheTasa();
  stub();
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test('cien visitantes seguidos son una sola consulta a las APIs', async () => {
  const todas = await Promise.all(Array.from({ length: 100 }, () => getTasaBcvMem()));

  assert.equal(rondas, 1);
  assert.equal(new Set(todas.map((t) => t.rate)).size, 1, 'todos ven la misma tasa');
});

test('sirve del cache mientras no expire', async () => {
  const t0 = 1_000_000;
  await getTasaBcvMem(t0);
  await getTasaBcvMem(t0 + TTL_SEGUNDOS * 1000 - 1);

  assert.equal(rondas, 1);
});

test('vuelve a consultar cuando el cache expira', async () => {
  const t0 = 1_000_000;
  await getTasaBcvMem(t0);
  await getTasaBcvMem(t0 + TTL_SEGUNDOS * 1000);

  assert.equal(rondas, 2);
});

test('un fallback no se cachea: la siguiente visita reintenta', async () => {
  stub({ ok: false });

  const primera = await getTasaBcvMem();
  const segunda = await getTasaBcvMem();

  assert.equal(primera.source, 'fallback');
  assert.equal(segunda.source, 'fallback');
  assert.equal(rondas, 2, 'no debe quedarse una hora sin bolívares por un fallo puntual');
});

test('cachea el dato contrastado tal cual, con su fecha valor', async () => {
  const t = await getTasaBcvMem();

  assert.equal(t.source, 'bcv');
  assert.equal(t.date, '2026-10-13');
  assert.equal(t.contrastada, true);
});
