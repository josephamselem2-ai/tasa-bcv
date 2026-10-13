# Tasa BCV

Muestra precios en bolívares al cambio oficial del día, en cualquier web.
Módulo sin dependencias + guía paso a paso para quien no programa.

**[→ Ver la demo en vivo](https://josephamselem2-ai.github.io/tasa-bcv/)** ·
29 tests · dos fuentes contrastadas · sin dependencias de runtime · MIT

<!-- La demo se publica sola con .github/workflows/pages.yml -->

![La guía funcionando](demo/capturas/guia-completa.png)

## El problema

Un negocio venezolano cobra en dólares pero el cliente transfiere en bolívares.
La tasa cambia todos los días hábiles. Ponerla a mano significa que alguien se
acuerde cada mañana; ponerla mal significa que un cliente transfiera de menos y
haya que perseguirlo por WhatsApp.

## La decisión que define el módulo

**Si no hay tasa fiable, no se muestra ninguna cifra.**

Es tentador guardar la última tasa conocida y enseñarla cuando la API falla.
Es exactamente lo que no hay que hacer: una tasa de hace tres días parece
correcta, nadie la cuestiona, y la diferencia la pagas tú. El módulo devuelve
`source: 'fallback'` y la interfaz enseña *«Al cambio del BCV del día»*.

```ts
const tasa = await obtenerTasaBcv();

tasa.source === 'bcv'
  ? `Bs. ${formatear(precioUsd * tasa.rate)}`
  : 'Al cambio del BCV del día';   // nunca una cifra vieja
```

Hay un test que falla si alguien rompe esa regla, y el CI maneja la demo en un
navegador real para comprobar que con las fuentes caídas no aparece ningún
`Bs.` en pantalla.

## La trampa de la fecha

Casi todas las APIs del dólar BCV devuelven la tasa etiquetada con **la fecha
en que se publicó**, no con **la fecha en que rige**. Son cosas distintas.

El BCV publica al cierre de cada día hábil, y esa tasa tiene **fecha valor del
día hábil siguiente**. Lo que sale el viernes por la tarde es la tasa del lunes.

Si tu fuente etiqueta por publicación, el sábado y el domingo sigues enseñando
«la tasa del viernes» cuando la que aplica ya es la del lunes. Con un feriado
de por medio puedes arrastrar tres o cuatro días.

Por eso la fuente principal es `rates.dolarvzla.com`, que etiqueta por fecha
valor. Se ve en el campo `previous`:

```json
{ "current":  { "date": "2026-10-13", "usd": 876.7976 },
  "previous": { "date": "2026-10-09", "usd": 875.6505 } }
```

Del martes 13 salta al viernes 9: sin sábado, sin domingo y sin el feriado del
lunes 12. Son días hábiles reales, no días de calendario.

## Otras cuatro decisiones que no son obvias

**Dos fuentes, y un margen del 5%.** Esto decide cuántos bolívares transfiere
un cliente, así que se consultan dos APIs en paralelo y se contrastan. Si
discrepan más de un 5%, no se muestra nada.

El margen no es arbitrario, y el número intuitivo está mal:

| | |
| --- | --- |
| Salto real entre días hábiles | 0,131% |
| Diferencia entre el euro y el dólar | 12,00% |

Un margen del 15% **no** cazaría que una fuente devolviera euros creyendo que
son dólares — cobrarías un 12% de más, en silencio. Con 5% sí se caza, y sigue
siendo 38 veces el movimiento normal de un día. Hay un test dedicado a eso.

Se contrastan los **valores**, no las fechas: que discrepen en la fecha es lo
esperado un fin de semana, y es justo para lo que está la fuente principal.

**Un techo de cordura en la validación.** Se rechaza cualquier tasa fuera de
`(0, 1.000.000]`. Si una API cambiara de escala, $100 pasarían a ser millones
de bolívares sin que nada avisara. Es una línea que parece sobrante y es la que
evita el desastre.

**El fallback no se cachea.** El dato bueno se guarda una hora; un fallo, no.
Cachear el fallo dejaría la web una hora entera sin bolívares por un tropiezo
puntual de una API.

**Contexto, no store global.** Repartir la tasa con un store sembrado durante
el render hace que el HTML del servidor salga *sin* bolívares y el precio
aparezca al cargar el JavaScript. No se ve en el navegador: se ve haciendo
`curl tu-web | grep Bs.`

## Qué te llevas

La pregunta no es si programas, es si tu web tiene build o servidor.

| Tu web | Qué usas |
| --- | --- |
| WordPress, Wix, Squarespace, Shopify | [`embed/tasa-bcv.html`](embed/tasa-bcv.html) — copiar y pegar |
| Sitio estático (HTML, Hugo, Jekyll) | [`embed/tasa-bcv.html`](embed/tasa-bcv.html) — aunque programes |
| Next.js, React, Vue, Astro | [`src/`](src/) — el módulo |
| Node/Express sirviendo HTML | [`src/tasaBcv.ts`](src/tasaBcv.ts) + [`src/tasaServidor.ts`](src/tasaServidor.ts) |

| Archivo | Qué hace |
| --- | --- |
| [`src/tasaBcv.ts`](src/tasaBcv.ts) | El núcleo. Autónomo, no importa nada. Fetch + validación + timeout de 5 s |
| [`src/tasaServidor.ts`](src/tasaServidor.ts) | Caché de 1 h. Convierte 100 visitas en 1 petición |
| [`src/TasaContext.tsx`](src/TasaContext.tsx) | Reparto por contexto + `formatearBs()` |
| [`src/PrecioBs.tsx`](src/PrecioBs.tsx) | Componente que se calla si la tasa no es real |
| [`src/RefrescoTasa.tsx`](src/RefrescoTasa.tsx) | Refresco al volver a primer plano (PWA) |
| [`sql/bcv_rates.sql`](sql/bcv_rates.sql) | Histórico opcional |

## Uso en Next.js

Resuélvela en el layout raíz, antes de generar el HTML, para que todos los
precios de la página nazcan con la misma tasa:

```tsx
// app/layout.tsx
export default async function RootLayout({ children }) {
  const tasa = await getTasaBcv();
  return <TasaContext.Provider value={tasa}>{children}</TasaContext.Provider>;
}
```

```tsx
<PrecioBs precioUsd={49.9} />
```

Si tu proyecto es JavaScript sin TypeScript, usa el compilado
(`npm run demo:build` → `demo/dist/tasaBcv.js`), que es el mismo código.

## Verificar

```bash
npm install
npm test          # 29 tests, sin red
npm run typecheck
npm run demo      # la guía en http://localhost:4173
node scripts/verificar-demo.mjs   # la maneja en un navegador real
```

Los tests cubren el camino feliz, los modos de fallo de cada fuente por
separado, cada rama de la validación, el timeout de 5 s y el caché. Tres de
ellos existen para fijar decisiones que es fácil deshacer sin querer:

- que la fecha valor de la fuente principal gana aunque la otra discrepe
- que un euro colado como dólar se caza (lo que un margen del 15% no haría)
- que una fuente colgada no arrastra a la otra

## Letra pequeña

Los datos vienen de [DolarVZLA](https://rates.dolarvzla.com/bcv/current.json)
contrastado con [DolarAPI](https://ve.dolarapi.com). Las dos son gratuitas, sin
clave y con CORS abierto. Son servicios de terceros: por eso se consultan los
dos, para que la caída de uno no te deje sin conversión. Si cayeran los dos, la
web no se rompe (oculta los bolívares y sigue enseñando dólares). Razón de más
para guardar el histórico.

Es la **tasa oficial del BCV**, no la del paralelo. Si tu negocio cobra a otra
tasa, este número no te sirve tal cual.

## Licencia

MIT
