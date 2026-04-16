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

## Ver modelos top sin status bar

Usa el comando `OpenRouter: Show Top Coding Models` desde la paleta de comandos.

- Calcula en vivo un ranking dinamico en cada ejecucion usando `GET https://openrouter.ai/api/v1/models`
- Muestra un Quick Pick con modelos recomendados para programacion
- Incluye costo de entrada y salida por 1M tokens
- Al seleccionar un modelo, copia automaticamente su `model id`

## Como se calcula

### Costo por 1M tokens

OpenRouter devuelve precios por token en `pricing.prompt` y `pricing.completion`.

- Input por 1M = `pricing.prompt * 1_000_000`
- Output por 1M = `pricing.completion * 1_000_000`

Ejemplo:

- Si `pricing.prompt = 0.00000125`, entonces input = `$1.25 / 1M`
- Si `pricing.completion = 0.00001`, entonces output = `$10.00 / 1M`

### Ranking dinamico de modelos

En cada ejecucion del comando:

1. Se descarga el catalogo actual de `GET https://openrouter.ai/api/v1/models`.
2. Se filtran candidatos de programacion por palabras clave en `id`/`name` (por ejemplo `codex`, `coder`, `codestral`, `gpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`) y se excluyen modelos `:free`.
3. Se calcula un score de calidad (heuristico) ponderando:
   - Senales de coding (por ejemplo `codex`, `coder`, `code`)
   - Familia del modelo (por ejemplo `gpt`, `claude`, `gemini`, etc.)
   - Contexto disponible (`top_provider.context_length`)
4. Se calcula costo total por 1M:
   - `costPer1m = (pricing.prompt + pricing.completion) * 1_000_000`
5. Se calcula score de valor:
   - `value = quality / max(costPer1m, 0.01)`
6. Se muestran dos listas:
   - `Top calidad`: mayor `quality`
   - `Mejor costo/rendimiento`: mayor `value`

Nota: este ranking es orientativo (heuristico) y puede variar cuando OpenRouter agrega/cambia modelos o precios.

### API REFERENCE

(https://openrouter.ai/openapi.json)[https://openrouter.ai/openapi.json]
