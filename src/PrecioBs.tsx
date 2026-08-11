'use client';

/**
 * El paso que no se puede saltar: con 'fallback' NO se enseña ninguna cifra,
 * se explica la política. Ninguna cifra es mejor que una inventada.
 */

import { formatearBs, useTasaBcv } from './TasaContext.tsx';

export const TEXTO_SIN_TASA = 'Al cambio del BCV del día';

export function PrecioBs({ precioUsd }: { precioUsd: number }) {
  const tasa = useTasaBcv();
  const bolivares = formatearBs(precioUsd, tasa);

  if (bolivares === null) {
    return <span className="precio-bs precio-bs--sin-tasa">{TEXTO_SIN_TASA}</span>;
  }

  return (
    <span className="precio-bs" title={`Tasa BCV del ${tasa.date}`}>
      {bolivares}
    </span>
  );
}
