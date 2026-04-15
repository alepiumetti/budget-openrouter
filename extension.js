// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REFRESH_COMMAND = 'budget-openrouter.refresh';
const SHOW_TOP_MODELS_COMMAND = 'budget-openrouter.showTopModels';
const MAX_MODELS_PER_SECTION = 8;

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

function parseFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 'N/A';
  }

  return parsed.toLocaleString('es-ES');
}

function isCodingCandidate(model) {
  const id = String(model?.id || '').toLowerCase();
  const name = String(model?.name || '').toLowerCase();
  const text = `${id} ${name}`;

  if (text.includes(':free')) {
    return false;
  }

  const hardKeywords = ['codex', 'coder', 'codestral', 'code'];
  if (hardKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  const generalKeywords = [
    'claude',
    'gpt',
    'gemini',
    'deepseek',
    'qwen',
    'command',
    'grok',
  ];

  return generalKeywords.some((keyword) => text.includes(keyword));
}

function codingCapabilityScore(model) {
  const id = String(model?.id || '').toLowerCase();
  const name = String(model?.name || '').toLowerCase();
  const text = `${id} ${name}`;

  let score = 0;

  if (text.includes('codex')) {
    score += 12;
  }
  if (text.includes('coder')) {
    score += 10;
  }
  if (text.includes('codestral')) {
    score += 9;
  }
  if (text.includes('code')) {
    score += 3;
  }

  if (text.includes('claude')) {
    score += 7;
  }
  if (text.includes('gpt')) {
    score += 7;
  }
  if (text.includes('gemini')) {
    score += 6;
  }
  if (text.includes('deepseek')) {
    score += 6;
  }
  if (text.includes('qwen')) {
    score += 5;
  }
  if (text.includes('grok')) {
    score += 4;
  }

  const contextLength = parseFiniteNumber(
    model?.top_provider?.context_length,
    0,
  );
  if (contextLength > 0) {
    score += Math.log10(contextLength) * 1.5;
  }

  return score;
}

function modelCostPerMillion(model) {
  const promptPerToken = parseFiniteNumber(model?.pricing?.prompt, NaN);
  const completionPerToken = parseFiniteNumber(model?.pricing?.completion, NaN);

  if (
    !Number.isFinite(promptPerToken) ||
    !Number.isFinite(completionPerToken)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return (promptPerToken + completionPerToken) * 1000000;
}

function buildModelPick(model, rankLabel, rankPosition) {
  const promptCost = formatUsdPerMillion(model?.pricing?.prompt);
  const completionCost = formatUsdPerMillion(model?.pricing?.completion);
  const contextLength = formatInteger(model?.top_provider?.context_length);

  return {
    label: `${rankPosition}. ${model.id}`,
    description: `${rankLabel} | In: $${promptCost}/1M | Out: $${completionCost}/1M`,
    detail: `${model.name || 'Sin nombre'} | Contexto: ${contextLength}`,
    modelId: model.id,
  };
}

function rankTopCodingModels(allModels) {
  const candidates = allModels
    .filter((model) => isCodingCandidate(model))
    .map((model) => {
      const quality = codingCapabilityScore(model);
      const costPer1m = modelCostPerMillion(model);
      const value = quality / Math.max(costPer1m, 0.01);

      return {
        model,
        quality,
        costPer1m,
        value,
      };
    })
    .filter((entry) => Number.isFinite(entry.quality) && entry.quality > 0);

  const topQuality = [...candidates]
    .sort((a, b) => b.quality - a.quality || a.costPer1m - b.costPer1m)
    .slice(0, MAX_MODELS_PER_SECTION)
    .map((entry) => entry.model);

  const topValue = [...candidates]
    .filter((entry) => Number.isFinite(entry.costPer1m) && entry.costPer1m > 0)
    .sort((a, b) => b.value - a.value || a.costPer1m - b.costPer1m)
    .slice(0, MAX_MODELS_PER_SECTION)
    .map((entry) => entry.model);

  return { topQuality, topValue };
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
      const { topQuality, topValue } = rankTopCodingModels(allModels);

      const picks = [
        {
          label: 'Top calidad (ranking dinamico)',
          kind: vscode.QuickPickItemKind.Separator,
        },
        ...topQuality.map((model, index) =>
          buildModelPick(model, 'Top calidad', index + 1),
        ),
        {
          label: 'Mejor costo/rendimiento (ranking dinamico)',
          kind: vscode.QuickPickItemKind.Separator,
        },
        ...topValue.map((model, index) =>
          buildModelPick(model, 'Mejor costo/rendimiento', index + 1),
        ),
      ];

      if (!picks.length) {
        throw new Error(
          'No se encontraron modelos recomendados en el catalogo actual',
        );
      }

      return vscode.window.showQuickPick(picks, {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder:
          'Selecciona un modelo para copiar su ID (calculado en vivo)',
      });
    },
  );

  if (!picked || !picked.modelId) {
    return;
  }

  await vscode.env.clipboard.writeText(picked.modelId);
  vscode.window.showInformationMessage(`Modelo copiado: ${picked.modelId}`);
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
