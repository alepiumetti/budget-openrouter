# Changelog

Todos los cambios importantes de la extensión `budget-openrouter` se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- Comando `OpenRouter: Set API Key (Secure)` para guardar la API key en `Secret Storage` de VS Code.
- Comando `OpenRouter: Clear Stored API Key` para eliminar la API key guardada.
- Migración automática de `budgetOpenrouter.apiKey` (texto plano) hacia `Secret Storage` cuando corresponde.

### Changed
- Compatibilidad mínima de VS Code ajustada a `1.115.0`.
- El estado sin API key ahora guía al usuario para configurar la clave de forma segura desde el status bar.

### Security
- Se prioriza almacenamiento seguro (`Secret Storage`) sobre configuración en texto plano.

## [1.0.2] - 2026-04-16

### Added
- Refresh automático configurable con `budgetOpenrouter.refreshIntervalMinutes` (mínimo 1 minuto).

### Changed
- Refresco periódico del presupuesto además del refresco manual.
- Canal de logs `Budget OpenRouter` en Output con timestamp y origen de refresh (`startup`, `manual`, `auto`, `config-change`).

## [1.0.1] - 2026-04-16

### Changed
- Mejora visual en el status bar con color dinámico según el porcentaje de crédito restante.
- Tooltip extendido con más métricas: total, restante, gasto total, mensual, semanal y diario.
- Correcciones de presentación del ícono de la extensión.

## [1.0.0] - 2026-04-16

### Added
- Publicación estable inicial de la extensión.
- Visualización de presupuesto de OpenRouter en status bar.
- Comando `OpenRouter: Refresh Budget` para refrescar manualmente.
- Soporte de API key por configuración (`budgetOpenrouter.apiKey`) o variable de entorno (`OPENROUTER_API_KEY`).

## [0.0.7] - 2026-04-16

### Changed
- Ajustes de documentación y pulido previo al release estable.

## [0.0.6] - 2026-04-16

### Added
- Ícono de la extensión para Marketplace.

## [0.0.5] - 2026-04-16

### Added
- Automatización de bump de versión en flujo de desarrollo.

## [0.0.4] - 2026-04-16

### Added
- Workflow de GitHub Actions para soporte del proceso de release.

### Fixed
- Ajustes en actions/herramientas de CI.

## [0.0.3] - 2026-04-16

### Added
- Prototipo inicial de consulta de presupuesto a OpenRouter y visualización en status bar.

### Fixed
- Correcciones iniciales en la muestra de datos.