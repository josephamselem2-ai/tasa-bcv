/**
 * Tasa oficial del BCV, contrastando dos fuentes independientes.
 *
 * POR QUÉ DOS FUENTES: esto decide cuántos bolívares transfiere un cliente.
 * Una sola fuente que devuelva un dato corrupto no tiene quien la contradiga.
 *
 * POR QUÉ DOLARVZLA ES LA PRINCIPAL: etiqueta con la FECHA VALOR — el día
 * hábil en que la tasa rige — y no con la fecha en que se publicó. El BCV
 * publica al cierre de cada día hábil y esa tasa aplica el día hábil
 * SIGUIENTE. Son cosas distintas: lo que se publica el viernes por la tarde
 * es la tasa del lunes.
 *
 * REGLA: si la consulta falla devuelve source 'fallback'. Quien lo use debe
 * OCULTAR los bolívares en ese caso, nunca enseñar una cifra inventada.
 */

const API_PRINCIPAL = 'https://rates.dolarvzla.com/bcv/current.json';
const API_CONTRASTE = 'https://ve.dolarapi.com/v1/dolares/oficial';

const TIMEOUT_MS = 5000;

/** Techo de cordura. Si una API cambiara de escala, $100 serían millones. */
const TASA_MAXIMA = 1_000_000;

/**
 * Cuánto pueden discrepar las dos fuentes antes de no mostrar nada.
 *
 * 5% y no 15%: el salto real entre días hábiles es de ~0,13%, mientras que el
 * euro cotiza solo un ~12% por encima del dólar. Con 15% una fuente que
 * devolviera euros creyendo que son dólares pasaría el filtro en silencio y
 * cobrarías un 12% de más. Con 5% se caza, y sigue siendo 38 veces el
 * movimiento normal de un día.
 */
const DIFERENCIA_MAXIMA = 0.05;

export interface TasaBcv {
  /** Bolívares por 1 USD. */
  rate: number;
  /** Fecha VALOR, 'YYYY-MM-DD': el día hábil en que esta tasa rige. */
  date: string;
  /** 'bcv' = dato real. 'fallback' = no se pudo, no mostrar bolívares. */
  source: 'bcv' | 'fallback';
  /** Bolívares por 1 EUR, si la fuente lo da. */
  eur: number | null;
  /** La tasa del día hábil anterior, para calcular la variación. */
  previous: { rate: number; date: string } | null;
  /**
   * true  = dos fuentes independientes coincidieron.
   * false = solo respondió una; el dato es utilizable pero sin contrastar.
   */
  contrastada: boolean;
}

export const TASA_RESPALDO: TasaBcv = {
  rate: 0,
  date: '1970-01-01',
  source: 'fallback',
  eur: null,
  previous: null,
  contrastada: false,
};

/** Valida que un número pueda tocar un precio sin hacer daño. */
function tasaUsable(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
    && valor > 0 && valor <= TASA_MAXIMA;
}

/** 'YYYY-MM-DD' a secas. Recorta marcas de tiempo tipo '...T00:00:00-04:00'. */
function soloFecha(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)
    ? valor.slice(0, 10)
    : null;
}

/** Diferencia relativa entre dos tasas, 0.12 = 12%. */
export function diferenciaRelativa(a: number, b: number): number {
  return Math.abs(a - b) / Math.min(a, b);
}

/** rates.dolarvzla.com — trae fecha valor, euro y el día hábil anterior. */
export function convertirPrincipal(json: unknown): TasaBcv | null {
  const d = json as {
    current?: { usd?: unknown; eur?: unknown; date?: unknown };
    previous?: { usd?: unknown; date?: unknown };
  } | null;

  const tasa = d?.current?.usd;
  const fecha = soloFecha(d?.current?.date);
  if (!tasaUsable(tasa) || fecha === null) return null;

  const tasaPrevia = d?.previous?.usd;
  const fechaPrevia = soloFecha(d?.previous?.date);

  return {
    rate: tasa,
    date: fecha,
    source: 'bcv',
    eur: tasaUsable(d?.current?.eur) ? d.current.eur : null,
    previous: tasaUsable(tasaPrevia) && fechaPrevia !== null
      ? { rate: tasaPrevia, date: fechaPrevia }
      : null,
    contrastada: false,
  };
}

/** ve.dolarapi.com — solo sirve para contrastar el valor. */
export function convertirContraste(json: unknown): TasaBcv | null {
  const d = json as { promedio?: unknown; fechaActualizacion?: unknown } | null;

  const tasa = d?.promedio;
  if (!tasaUsable(tasa)) return null;

  return {
    rate: tasa,
    date: soloFecha(d?.fechaActualizacion) ?? new Date().toISOString().slice(0, 10),
    source: 'bcv',
    eur: null,
    previous: null,
    contrastada: false,
  };
}

/** Una petición con su propio límite de tiempo. Nunca lanza: null si falla. */
async function pedir<T>(
  url: string,
  convertir: (json: unknown) => T | null,
  init?: RequestInit,
): Promise<T | null> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, { ...init, signal: controlador.signal });
    if (!r.ok) return null;
    return convertir(await r.json());
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

export async function obtenerTasaBcv(init?: RequestInit): Promise<TasaBcv> {
  // En paralelo y con temporizadores independientes: si una fuente se cuelga,
  // la otra no se cae con ella.
  const [principal, contraste] = await Promise.all([
    pedir(API_PRINCIPAL, convertirPrincipal, init),
    pedir(API_CONTRASTE, convertirContraste, init),
  ]);

  if (principal === null && contraste === null) return TASA_RESPALDO;

  if (principal !== null && contraste !== null) {
    // Se contrastan los VALORES, no las fechas. Que discrepen en la fecha es
    // lo esperado: la de contraste etiqueta por publicación y se queda atrás
    // los fines de semana. Mandar en la fecha es el trabajo de la principal.
    if (diferenciaRelativa(principal.rate, contraste.rate) > DIFERENCIA_MAXIMA) {
      return TASA_RESPALDO;
    }
    return { ...principal, contrastada: true };
  }

  // Solo respondió una. Se muestra —perder la conversión cada vez que un
  // proveedor tiene un tropiezo cuesta ventas— pero queda marcada como
  // no contrastada por si quieres tratarla distinto.
  return { ...(principal ?? contraste)!, contrastada: false };
}
