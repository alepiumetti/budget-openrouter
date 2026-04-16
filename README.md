# budget-openrouter

Muestra en el status bar el gasto acumulado de OpenRouter y refresca al hacer click.

## Configuracion

Define la API key en una de estas opciones:

- `Settings` -> `budgetOpenrouter.apiKey`
- Variable de entorno `OPENROUTER_API_KEY`

## Como funciona

- Al activar la extension, hace una request a `GET https://openrouter.ai/api/v1/key`
- Muestra en el status bar el credito restante sobre el total (`limit_remaining / limit`)
- El color del item varia de verde (presupuesto lleno) a rojo (presupuesto agotado)
- En el tooltip muestra:
  - Presupuesto total y ciclo de reset (`limit`, `limit_reset`)
  - Credito restante (`limit_remaining`)
  - Gasto acumulado total (`usage`)
  - Gasto del mes en curso (`usage_monthly`)
  - Gasto de la semana en curso (`usage_weekly`)
  - Gasto del dia (`usage_daily`)
- Al hacer click en el item del status bar, vuelve a consultar la API

## Comando

- `OpenRouter: Refresh Budget`
- `OpenRouter: Show Top Coding Models`

# budget-openrouter

Muestra en el status bar el gasto acumulado de OpenRouter y refresca automaticamente.

## Configuracion

Define la API key en una de estas opciones:

- `Settings` -> `budgetOpenrouter.apiKey`
- Variable de entorno `OPENROUTER_API_KEY`

Para ajustar el intervalo de refresco automatico:

- `Settings` -> `budgetOpenrouter.refreshIntervalMinutes` (default: `30`, minimo: `1`)

## Como funciona

- Al activar la extension, hace una request a `GET https://openrouter.ai/api/v1/key`
- Muestra en el status bar el credito restante sobre el total (`limit_remaining / limit`)
- El color del item varia de verde (presupuesto lleno) a rojo (presupuesto agotado)
- Se refresca automaticamente cada X minutos segun la configuracion
- En el tooltip muestra:
  - Presupuesto total y ciclo de reset (`limit`, `limit_reset`)
  - Credito restante (`limit_remaining`)
  - Gasto acumulado total (`usage`)
  - Gasto del mes en curso (`usage_monthly`)
  - Gasto de la semana en curso (`usage_weekly`)
  - Gasto del dia (`usage_daily`)
- Al hacer click en el item del status bar, refresca manualmente

## Comando

- `OpenRouter: Refresh Budget` — refresca manualmente los datos del status bar

## Logs

La extension escribe en el canal `Budget OpenRouter` del panel Output de VS Code (`View → Output → Budget OpenRouter`).
Cada entrada incluye timestamp y el origen del refresh (`startup`, `manual`, `auto`, `config-change`).

## API REFERENCE

JSON: [https://openrouter.ai/openapi.json](https://openrouter.ai/openapi.json)
