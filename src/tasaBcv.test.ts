import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  obtenerTasaBcv,
  convertirPrincipal,
  convertirContraste,
  diferenciaRelativa,
  TASA_RESPALDO,
} from './tasaBcv.ts';

const fetchOriginal = globalThis.fetch;

// Cifras reales del martes 13/10/2026, con el feriado del lunes 12 de por medio.
const USD = 876.7976;
const EUR = 982.00454402;
const USD_PREVIO = 875.6505;

const dolarVzla = () => ({
  current: { usd: USD, eur: EUR, date: '2026-10-13' },
  previous: { usd: USD_PREVIO, eur: 980.61472543, date: '2026-10-09' },
});

const dolarApi = (promedio = USD, fecha = '2026-10-13T00:00:00-04:00') =>
  ({ promedio, fechaActualizacion: fecha });

/**
 * Lo que puede devolver una fuente en los tests: un cuerpo JSON, un Error al
 * leerlo, o uno de los dos centinelas de fallo.
 */
type Respuesta = Record<string, unknown> | Error | 'caida' | 'http-500';

/** Responde distinto a cada fuente segun la URL que se pida. */
function stub(
  { principal = dolarVzla(), contraste = dolarApi() }:
  { principal?: Respuesta; contraste?: Respuesta } = {},
) {
  const llamadas: string[] = [];

  globalThis.fetch = (async (url: string) => {
    const cuerpo = String(url).includes('dolarvzla') ? principal : contraste;
    llamadas.push(String(url));

    if (cuerpo === 'caida') throw new TypeError('fetch failed');

    return {
      ok: cuerpo !== 'http-500',
      json: async () => {
        if (cuerpo instanceof Error) throw cuerpo;
        return cuerpo;
      },
    } as unknown as Response;
  }) as typeof fetch;

  return llamadas;
}

beforeEach(() => stub());
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  mock.timers.reset();
});

// ---- Camino feliz --------------------------------------------------------

test('con las dos fuentes de acuerdo, devuelve el dato contrastado', async () => {
  const t = await obtenerTasaBcv();
  assert.equal(t.source, 'bcv');
  assert.equal(t.rate, USD);
  assert.equal(t.date, '2026-10-13');
  assert.equal(t.contrastada, true);
});

test('pide las dos fuentes, no solo una', async () => {
  const llamadas = stub();
  await obtenerTasaBcv();

  assert.equal(llamadas.length, 2);
  assert.ok(llamadas.some((u) => u.includes('dolarvzla')));
  assert.ok(llamadas.some((u) => u.includes('dolarapi')));
});

test('recoge el euro y el dia habil anterior', async () => {
  const t = await obtenerTasaBcv();
  assert.equal(t.eur, EUR);
  assert.deepEqual(t.previous, { rate: USD_PREVIO, date: '2026-10-09' });
});

// ---- Fecha valor: el motivo del cambio de API ----------------------------

test('manda la fecha VALOR de la principal, no la de la fuente de contraste', async () => {
  // Esto es lo que pasa un sabado: la de contraste se queda en el viernes
  // mientras la principal ya adelanta al dia habil en que la tasa rige.
  stub({ contraste: dolarApi(USD, '2026-10-09T00:00:00-04:00') });

  const t = await obtenerTasaBcv();
  assert.equal(t.date, '2026-10-13', 'debe ganar la fecha valor');
  assert.equal(t.contrastada, true, 'discrepar en la fecha NO invalida el dato');
});

test('el dia habil anterior salta el fin de semana y el feriado', async () => {
  const t = await obtenerTasaBcv();
  // Del martes 13 al viernes 9: sin sabado 10, domingo 11 ni feriado 12.
  assert.equal(t.previous?.date, '2026-10-09');
});

// ---- El contraste: lo que evita cobrar de mas ----------------------------

test('si las fuentes discrepan mas del 5%, no se muestra ninguna cifra', async () => {
  stub({ contraste: dolarApi(USD * 1.4) });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('CAZA que una fuente devuelva EUROS creyendo que son dolares', async () => {
  // El error que un umbral del 15% dejaria pasar: el euro esta solo un 12%
  // por encima del dolar, asi que colarse cobraria un 12% de mas.
  assert.ok(diferenciaRelativa(USD, EUR) < 0.15, 'un umbral del 15% no lo cazaria');

  stub({ contraste: dolarApi(EUR) });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO, 'el del 5% si lo caza');
});

test('caza que una fuente devuelva centimos', async () => {
  stub({ contraste: dolarApi(USD * 100) });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('el desfase normal entre dias habiles no bloquea nada', async () => {
  // 0,131% real del viernes 9 al martes 13.
  stub({ contraste: dolarApi(USD_PREVIO) });

  const t = await obtenerTasaBcv();
  assert.equal(t.source, 'bcv');
  assert.equal(t.contrastada, true);
});

// ---- Cuando una fuente se cae -------------------------------------------

test('si solo responde la principal, sirve el dato marcado sin contrastar', async () => {
  stub({ contraste: 'caida' });

  const t = await obtenerTasaBcv();
  assert.equal(t.source, 'bcv');
  assert.equal(t.rate, USD);
  assert.equal(t.date, '2026-10-13');
  assert.equal(t.contrastada, false);
});

test('si solo responde la de contraste, tambien sirve', async () => {
  stub({ principal: 'caida' });

  const t = await obtenerTasaBcv();
  assert.equal(t.source, 'bcv');
  assert.equal(t.rate, USD);
  assert.equal(t.contrastada, false);
  assert.equal(t.previous, null, 'esa fuente no da el dia anterior');
});

test('si se caen las dos, fallback', async () => {
  stub({ principal: 'caida', contraste: 'caida' });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('un HTTP 500 cuenta como caida, no como dato', async () => {
  stub({ principal: 'http-500', contraste: 'http-500' });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('un cuerpo que no es JSON valido cuenta como caida', async () => {
  stub({ principal: new SyntaxError('<html>'), contraste: new SyntaxError('<html>') });
  assert.deepEqual(await obtenerTasaBcv(), TASA_RESPALDO);
});

test('el respaldo nunca invita a mostrar bolivares', () => {
  assert.equal(TASA_RESPALDO.source, 'fallback');
  assert.equal(TASA_RESPALDO.rate, 0);
  assert.equal(TASA_RESPALDO.contrastada, false);
});

// ---- La validacion que no hay que borrar --------------------------------

test('rechaza tasas que no son numeros usables', () => {
  const malos = ['876,79', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -5];

  for (const malo of malos) {
    assert.equal(
      convertirPrincipal({ current: { usd: malo, date: '2026-10-13' } }), null,
      `deberia rechazar ${String(malo)}`,
    );
  }
});

test('rechaza una tasa por encima del techo de cordura', () => {
  assert.equal(convertirPrincipal({ current: { usd: 1_000_001, date: '2026-10-13' } }), null);
  assert.notEqual(convertirPrincipal({ current: { usd: 1_000_000, date: '2026-10-13' } }), null);
});

test('rechaza respuestas vacias o con otra forma', () => {
  assert.equal(convertirPrincipal(null), null);
  assert.equal(convertirPrincipal({}), null);
  assert.equal(convertirPrincipal({ error: 'not found' }), null);
  assert.equal(convertirContraste({ promedio: 'raro' }), null);
});

// ---- Fechas --------------------------------------------------------------

test('sin fecha valor usable, la principal no sirve', () => {
  // Sin fecha no hay fecha valor, y la fecha valor es el motivo de usar esta
  // fuente. Inventar "hoy" aqui seria volver al problema de origen.
  assert.equal(convertirPrincipal({ current: { usd: USD } }), null);
  assert.equal(convertirPrincipal({ current: { usd: USD, date: '13/10/2026' } }), null);
});

test('recorta la marca de tiempo de la fuente de contraste', () => {
  const t = convertirContraste(dolarApi(USD, '2026-10-13T00:00:00-04:00'));
  assert.equal(t?.date, '2026-10-13');
});

test('descarta un dia anterior incompleto en vez de inventarlo', () => {
  const t = convertirPrincipal({
    current: { usd: USD, date: '2026-10-13' },
    previous: { usd: USD_PREVIO },
  });
  assert.equal(t?.previous, null);
});

test('descarta un euro invalido pero conserva el dolar', () => {
  const t = convertirPrincipal({ current: { usd: USD, eur: 'raro', date: '2026-10-13' } });
  assert.equal(t?.rate, USD);
  assert.equal(t?.eur, null);
});

// ---- Cinco segundos y se abandona ---------------------------------------

test('aborta a los 5 segundos y devuelve fallback', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });

  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolver, rechazar) => {
      init?.signal?.addEventListener('abort', () =>
        rechazar(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;

  const pendiente = obtenerTasaBcv();
  mock.timers.tick(5000);

  assert.deepEqual(await pendiente, TASA_RESPALDO);
});

test('una fuente colgada no arrastra a la otra', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });

  globalThis.fetch = ((url: string, init?: RequestInit) => {
    if (String(url).includes('dolarvzla')) {
      return new Promise((_r, rechazar) => {
        init?.signal?.addEventListener('abort', () =>
          rechazar(new DOMException('aborted', 'AbortError')));
      });
    }
    return Promise.resolve({ ok: true, json: async () => dolarApi() } as Response);
  }) as typeof fetch;

  const pendiente = obtenerTasaBcv();
  mock.timers.tick(5000);

  const t = await pendiente;
  assert.equal(t.source, 'bcv', 'la fuente sana debe salvar la peticion');
  assert.equal(t.rate, USD);
  assert.equal(t.contrastada, false);
});
