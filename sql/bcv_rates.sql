-- Histórico de tasas (opcional pero recomendado).
--
-- La API solo devuelve la tasa de HOY. Si no la anotas, la de ayer se pierde.
-- Con esta tabla puedes comprobar semanas después si un cliente transfirió la
-- cantidad correcta — y si DolarAPI cerrara, lo ya registrado no se pierde.
--
-- Regla 02: los pedidos se guardan en dólares y se convierten al mostrar.
-- Lo único que se guarda en bolívares es la tasa de cada día, que es un hecho
-- que no cambia.

CREATE TABLE IF NOT EXISTS bcv_rates (
  date        DATE PRIMARY KEY,   -- un solo registro por día
  rate        NUMERIC(12,4) NOT NULL CHECK (rate > 0),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Con `date` como clave primaria, anotarla dos veces el mismo día actualiza la
-- fila en lugar de duplicarla. Se llena con una tarea diaria (un cron) que
-- llame a obtenerTasaBcv() y ejecute esto:

-- INSERT INTO bcv_rates (date, rate)
-- VALUES ($1, $2)
-- ON CONFLICT (date) DO UPDATE
--   SET rate = EXCLUDED.rate, recorded_at = NOW();
