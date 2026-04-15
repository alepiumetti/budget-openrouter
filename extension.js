// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REFRESH_COMMAND = 'budget-openrouter.refresh';
const SHOW_TOP_MODELS_COMMAND = 'budget-openrouter.showTopModels';

const TOP_CODING_MODELS = [
  { id: 'openai/gpt-5.3-codex', tier: 'Top calidad' },
  { id: 'anthropic/claude-sonnet-4.6', tier: 'Top calidad' },
  { id: 'openai/gpt-5-codex', tier: 'Top calidad' },
  { id: 'google/gemini-2.5-pro', tier: 'Top calidad' },
  { id: 'anthropic/claude-opus-4.6', tier: 'Top calidad' },
  { id: 'deepseek/deepseek-v3.2', tier: 'Mejor costo/rendimiento' },
  { id: 'qwen/qwen3-coder-next', tier: 'Mejor costo/rendimiento' },
  { id: 'qwen/qwen3-coder', tier: 'Mejor costo/rendimiento' },
  { id: 'mistralai/codestral-2508', tier: 'Mejor costo/rendimiento' },
  { id: 'x-ai/grok-code-fast-1', tier: 'Mejor costo/rendimiento' },
];

function parseNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCredits(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return String(value);
  }

  return num.toFixed(2);
}

function formatUsdPerMillion(pricePerToken) {
  const parsed = Number(pricePerToken);
  if (!Number.isFinite(parsed)) {
    return 'N/A';
  }

  return (parsed * 1000000).toFixed(2);
}

function getApiKey() {
  const config = vscode.workspace.getConfiguration('budgetOpenrouter');
  return config.get('apiKey') || process.env.OPENROUTER_API_KEY || '';
}

function ratioToColor(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const red = Math.round(255 * clamped);
  const green = Math.round(255 * (1 - clamped));
  const blue = 80;

  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue
    .toString(16)
    .padStart(2, '0')}`;
}

async function fetchKeyUsage(apiKey) {
  const response = await fetch(OPENROUTER_KEY_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let details = '';
    try {
      const errorBody = await response.json();
      details = errorBody?.error?.message || errorBody?.message || '';
    } catch {
      // Ignore JSON parsing errors and fallback to status text.
    }

    const suffix = details ? `: ${details}` : ` (${response.statusText})`;
    throw new Error(`HTTP ${response.status}${suffix}`);
  }

  const payload = await response.json();
  if (!payload?.data) {
    throw new Error('Respuesta sin campo data');
  }

  return payload.data;
}

async function fetchModelsCatalog() {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.data)) {
    throw new Error('Catalogo de modelos invalido');
  }

  return payload.data;
}

async function showTopCodingModels() {
  const picked = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'OpenRouter: cargando modelos top para programacion...',
      cancellable: false,
    },
    async () => {
      const allModels = await fetchModelsCatalog();
      const byId = new Map(allModels.map((model) => [model.id, model]));

      const picks = TOP_CODING_MODELS.map((entry, index) => {
        const model = byId.get(entry.id);
        if (!model) {
          return null;
        }

        const promptCost = formatUsdPerMillion(model?.pricing?.prompt);
        const completionCost = formatUsdPerMillion(model?.pricing?.completion);
        const contextLength = model?.top_provider?.context_length || 'N/A';

        return {
          label: `${index + 1}. ${entry.id}`,
          description: `${entry.tier} | In: $${promptCost}/1M | Out: $${completionCost}/1M`,
          detail: `${model.name || 'Sin nombre'} | Contexto: ${contextLength}`,
          modelId: entry.id,
        };
      }).filter(Boolean);

      if (!picks.length) {
        throw new Error('No se encontraron modelos recomendados en el catalogo actual');
      }

      return vscode.window.showQuickPick(picks, {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Selecciona un modelo para copiar su ID',
      });
    },
  );

  if (!picked) {
    return;
  }

  await vscode.env.clipboard.writeText(picked.modelId);
  vscode.window.showInformationMessage(
    `Modelo copiado: ${picked.modelId}`,
  );
}

async function updateStatusBar(statusBarItem) {
  const apiKey = getApiKey();

  if (!apiKey) {
    statusBarItem.text = '$(key) OpenRouter: sin API key';
    statusBarItem.color = undefined;
    statusBarItem.tooltip =
      'Configura budgetOpenrouter.apiKey o la variable OPENROUTER_API_KEY.';
    return;
  }

  statusBarItem.text = '$(sync~spin) OpenRouter: actualizando...';
  statusBarItem.tooltip = 'Consultando uso en OpenRouter...';

  try {
    const data = await fetchKeyUsage(apiKey);
    const used = formatCredits(data.usage);
    const usageValue = parseNullableNumber(data.usage) || 0;
    const limitValue = parseNullableNumber(data.limit);
    const remainingValue = parseNullableNumber(data.limit_remaining);

    const totalValue =
      limitValue !== null
        ? limitValue
        : remainingValue !== null
          ? usageValue + remainingValue
          : null;

    const total = totalValue === null ? '∞' : `$${formatCredits(totalValue)}`;
    const remaining =
      remainingValue === null
        ? 'Ilimitado'
        : `$${formatCredits(remainingValue)}`;

    if (totalValue !== null && totalValue > 0) {
      const ratio = usageValue / totalValue;
      statusBarItem.color = ratioToColor(ratio);
    } else {
      statusBarItem.color = undefined;
    }

    statusBarItem.text = `$(graph) OpenRouter: ${remaining}/${total}`;
    statusBarItem.tooltip = [
      `Presupuesto total: ${total}`,
      `Restante: ${remaining}`,
      `Gasto total: $${used}`,
      `Hoy: $${formatCredits(data.usage_daily)}`,
      'Click para refrescar',
    ].join('\n');
  } catch (error) {
    statusBarItem.text = '$(warning) OpenRouter: error';
    statusBarItem.tooltip = `No se pudo consultar OpenRouter.\n${error.message}`;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  statusBarItem.command = REFRESH_COMMAND;
  statusBarItem.show();

  const refreshDisposable = vscode.commands.registerCommand(
    REFRESH_COMMAND,
    async function () {
      await updateStatusBar(statusBarItem);
    },
  );

  const showTopModelsDisposable = vscode.commands.registerCommand(
    SHOW_TOP_MODELS_COMMAND,
    async function () {
      try {
        await showTopCodingModels();
      } catch (error) {
        vscode.window.showErrorMessage(
          `No se pudieron cargar los modelos top: ${error.message}`,
        );
      }
    },
  );

  const configurationDisposable = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      if (event.affectsConfiguration('budgetOpenrouter.apiKey')) {
        await updateStatusBar(statusBarItem);
      }
    },
  );

  context.subscriptions.push(
    refreshDisposable,
    showTopModelsDisposable,
    configurationDisposable,
    statusBarItem,
  );

  updateStatusBar(statusBarItem);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
