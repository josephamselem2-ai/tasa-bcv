'use client';

/**
 * Regla 04: si es una app instalable, la gente la deja abierta días. Al
 * retomarla tras un rato hay que volver a pedir los datos; si no, alguien paga
 * el miércoles el monto que calculaste el lunes.
 *
 * Va sin dependencias del framework a propósito: recibe qué hacer al caducar.
 * En Next.js eso es `router.refresh()`; en otro sitio, lo que toque.
 */

import { useEffect } from 'react';
import { useTasaBcv } from './TasaContext.tsx';

/** Misma hora que el caché del servidor: pedir antes no traería nada nuevo. */
const MAX_EDAD_MS = 3600 * 1000;

export function useRefrescoAlVolver(alCaducar: () => void, maxEdadMs = MAX_EDAD_MS): void {
  useEffect(() => {
    let visibleDesde = Date.now();

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'hidden') {
        visibleDesde = Date.now();
        return;
      }
      if (Date.now() - visibleDesde >= maxEdadMs) alCaducar();
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  }, [alCaducar, maxEdadMs]);
}

/**
 * Variante que decide por la fecha de la tasa en vez de por el reloj: si la
 * pestaña vuelve y la tasa que tenemos ya no es de hoy, está caduca seguro.
 */
export function useRefrescoSiCambioElDia(alCaducar: () => void): void {
  const tasa = useTasaBcv();

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== 'visible') return;
      const hoy = new Date().toISOString().slice(0, 10);
      if (tasa.source !== 'bcv' || tasa.date !== hoy) alCaducar();
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  }, [alCaducar, tasa.source, tasa.date]);
}
