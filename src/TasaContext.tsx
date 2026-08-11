'use client';

/**
 * Reparto de la tasa por contexto, NO por store global.
 *
 * El contexto garantiza que todo lo que hay debajo vea el valor ya en el
 * primer render, así que el HTML del servidor sale CON los bolívares puestos.
 * Con un store sembrado durante el render el HTML salía sin ellos y el precio
 * aparecía al cargar el JavaScript.
 */

import { createContext, useContext } from 'react';
import { TASA_RESPALDO, type TasaBcv } from './tasaBcv.ts';

export const TasaContext = createContext<TasaBcv>(TASA_RESPALDO);

export function useTasaBcv(): TasaBcv {
  return useContext(TasaContext);
}

/**
 * Formatea bolívares en el locale venezolano. Devuelve null cuando la tasa no
 * es real: quien llame debe enseñar el texto de política, no una cifra.
 */
export function formatearBs(precioUsd: number, tasa: TasaBcv): string | null {
  if (tasa.source !== 'bcv') return null;

  return 'Bs. ' + (precioUsd * tasa.rate).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
