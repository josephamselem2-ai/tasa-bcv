-- Histórico de tasas (opcional pero recomendado).
--
-- La API solo devuelve la tasa de HOY. Si no la anotas, la de ayer se pierde.
-- Con esta tabla puedes comprobar semanas después si un cliente transfirió la
-- cantidad correcta — y si las APIs cerraran, lo ya registrado no se pierde.
--
-- Regla 02: los pedidos se guardan en dólares y se convierten al mostrar.
-- Lo único que se guarda en bolívares es la tasa de cada día, que es un hecho
-- que no cambia.

-- OJO con `date`: es la FECHA VALOR, el día hábil en que la tasa rige, no el
-- día en que se publicó ni el día en que la guardaste. Por eso nunca verás
-- sábados ni domingos ni feriados en esta tabla, y los saltos de tres o cuatro
-- días son normales. Si algún día la rellenas desde otra fuente, asegúrate de
-- que etiquete igual o mezclarás dos significados en la misma columna.

CREATE TABLE IF NOT EXISTS bcv_rates (
  date        DATE PRIMARY KEY,   -- fecha valor; un solo registro por día hábil
  rate        NUMERIC(12,4) NOT NULL CHECK (rate > 0),
  eur         NUMERIC(12,4) CHECK (eur IS NULL OR eur > 0),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Con `date` como clave primaria, anotarla dos veces el mismo día actualiza la
-- fila en lugar de duplicarla. Se llena con una tarea diaria (un cron) que
-- llame a obtenerTasaBcv() y ejecute esto:

-- INSERT INTO bcv_rates (date, rate, eur)
-- VALUES ($1, $2, $3)
-- ON CONFLICT (date) DO UPDATE
--   SET rate = EXCLUDED.rate, eur = EXCLUDED.eur, recorded_at = NOW();
