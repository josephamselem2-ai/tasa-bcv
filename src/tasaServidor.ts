/**
 * Punto de entrada del servidor. Es la diferencia que más pesa: si la tasa la
 * pide el navegador de cada visitante, con cien clientes son cien peticiones y
 * el precio aparece medio segundo tarde, saltando en pantalla. Cacheada en el
 * servidor es UNA petición por hora para todos, y el HTML ya sale con la cifra.
 */

import { obtenerTasaBcv, type TasaBcv } from './tasaBcv.ts';

/** El BCV publica una vez al día; refrescar cada hora va sobrado. */
export const TTL_SEGUNDOS = 3600;

/**
 * Next.js: `next.revalidate` hace el cacheado. En Nuxt es `revalidate`, en
 * SvelteKit un `load` con caché, y en un servidor propio vale `getTasaBcvMem`.
 */
export function getTasaBcv(): Promise<TasaBcv> {
  return obtenerTasaBcv({ next: { revalidate: TTL_SEGUNDOS } } as RequestInit);
}

/**
 * Equivalente sin framework: caché en memoria de 1 hora, con la petición en
 * vuelo compartida para que un pico de visitas no dispare N llamadas a la API.
 *
 * Solo se cachea el dato bueno. Un 'fallback' no se guarda: reintentar en la
 * siguiente visita es mejor que arrastrar una hora sin bolívares.
 */
let cache: { tasa: TasaBcv; expira: number } | null = null;
let enVuelo: Promise<TasaBcv> | null = null;

export function getTasaBcvMem(ahora = Date.now()): Promise<TasaBcv> {
  if (cache && cache.expira > ahora) return Promise.resolve(cache.tasa);
  if (enVuelo) return enVuelo;

  enVuelo = obtenerTasaBcv()
    .then((tasa) => {
      if (tasa.source === 'bcv') {
        cache = { tasa, expira: ahora + TTL_SEGUNDOS * 1000 };
      }
      return tasa;
    })
    .finally(() => {
      enVuelo = null;
    });

  return enVuelo;
}

/** Para tests y para forzar un refresco tras volver a primer plano. */
export function limpiarCacheTasa(): void {
  cache = null;
  enVuelo = null;
}
