# Registro de lo que devuelve cada fuente

`registro.csv` se llena solo, dos veces al día, con lo que responden las dos
APIs en ese momento. Lo escribe
[`.github/workflows/registro.yml`](../.github/workflows/registro.yml).

## Para qué existe

Hay una afirmación en este proyecto que conviene poder demostrar en vez de
repetir: **que las dos fuentes etiquetan la fecha de forma distinta.**

- `rates.dolarvzla.com` etiqueta por **fecha valor** — el día hábil en que la
  tasa rige.
- `ve.dolarapi.com` etiqueta por **fecha de publicación**.

Entre semana da igual: coinciden. La diferencia solo se ve cuando hay días no
hábiles de por medio, y eso pasa dos días de cada siete. Si nadie estaba
mirando ese sábado, la prueba se pierde.

## Cómo leerlo

La columna que importa es **`fechas_iguales`**:

| Valor | Qué significa |
| --- | --- |
| `si` | Las dos fuentes dicen la misma fecha. Lo normal entre semana. |
| `NO` | **Discrepan.** Mira `vzla_fecha` y `api_fecha` para ver quién adelanta. |

Busca las filas con `dia_semana` igual a `sabado` o `domingo`. Si en ellas
`fechas_iguales` vale `NO` y `vzla_fecha` es el **lunes siguiente** mientras
`api_fecha` es el **viernes anterior**, la teoría queda confirmada.

Si en cambio sale `si` todo el fin de semana, entonces las dos etiquetan igual
y la ventaja de cambiar de fuente es menor de lo que parecía — en ese caso hay
que decirlo y ajustar lo que promete el README.

## Las demás columnas

| Columna | Qué es |
| --- | --- |
| `momento_utc` | Cuándo se tomó la muestra |
| `dia_semana` | Día en Venezuela (UTC−4), que es el huso que importa |
| `vzla_fecha` · `vzla_usd` | Lo que devuelve la fuente principal |
| `vzla_previa_fecha` · `vzla_previa_usd` | El día hábil anterior según ella |
| `api_fecha` · `api_usd` | Lo que devuelve la fuente de contraste |
| `diferencia_pct` | Cuánto discrepan los **valores**, en % |

Campos vacíos significan que esa API no respondió. También es información: es
el registro de su disponibilidad real.

`diferencia_pct` debería quedarse siempre muy por debajo de 5, que es el umbral
a partir del cual el módulo deja de mostrar bolívares. Si alguna vez lo supera,
ahí tienes la fecha y la hora exactas de lo que pasó.
