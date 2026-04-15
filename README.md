# budget-openrouter

Muestra en el status bar el gasto acumulado de OpenRouter y refresca al hacer click.

## Configuracion

Define la API key en una de estas opciones:

- `Settings` -> `budgetOpenrouter.apiKey`
- Variable de entorno `OPENROUTER_API_KEY`

## Como funciona

- Al activar la extension, hace una request a `GET https://openrouter.ai/api/v1/key`
- Muestra en el status bar el gasto total (`usage`)
- En el tooltip muestra tambien credito restante y uso diario
- Al hacer click en el item del status bar, vuelve a consultar la API

## Comando

- `OpenRouter: Refresh Budget`
