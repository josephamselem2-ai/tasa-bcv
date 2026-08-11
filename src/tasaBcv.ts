/**
 * Tasa oficial del BCV, vía DolarAPI.
 *
 * REGLA: si la consulta falla devuelve source 'fallback'. Quien lo use debe
 * OCULTAR los bolívares en ese caso, nunca enseñar una cifra inventada.
 *
 * Es autónomo: no importa nada del resto del proyecto.
 */

const API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const TIMEOUT_MS = 5000;

/** Techo de cordura. Si la API cambiara de escala, $100 pasarían a ser millones. */
const TASA_MAXIMA = 1_000_000;

export interface TasaBcv {
  /** Bolívares por 1 USD. */
  rate: number;
  /** Fecha de publicación, 'YYYY-MM-DD'. */
  date: string;
  /** 'bcv' = dato real. 'fallback' = no se pudo, no mostrar bolívares. */
  source: 'bcv' | 'fallback';
}

export const TASA_RESPALDO: TasaBcv = {
  rate: 0,
  date: '1970-01-01',
  source: 'fallback',
};

/**
 * Valida antes de dejar que el número toque un precio. El techo no es
 * paranoia: es lo que evita pintar un precio absurdo si la API devuelve
 * algo raro. Es la típica línea que alguien quita por parecer sobrante.
 */
export function convertir(json: unknown): TasaBcv | null {
  const datos = json as { promedio?: unknown; fechaActualizacion?: unknown } | null;
  const tasa = datos?.promedio;

  if (typeof tasa !== 'number' || !Number.isFinite(tasa)
      || tasa <= 0 || tasa > TASA_MAXIMA) return null;

  const fecha = typeof datos?.fechaActualizacion === 'string'
    ? datos.fechaActualizacion.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return { rate: tasa, date: fecha, source: 'bcv' };
}

export async function obtenerTasaBcv(init?: RequestInit): Promise<TasaBcv> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(API_URL, { ...init, signal: controlador.signal });
    if (!r.ok) return TASA_RESPALDO;
    return convertir(await r.json()) ?? TASA_RESPALDO;
  } catch {
    return TASA_RESPALDO;
  } finally {
    clearTimeout(temporizador);
  }
}
