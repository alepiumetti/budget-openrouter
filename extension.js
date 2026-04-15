// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const REFRESH_COMMAND = 'budget-openrouter.refresh';

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

    statusBarItem.text = `$(graph) OpenRouter: $${used}/${total}`;
    statusBarItem.tooltip = [
      `Gasto total: $${used}`,
      `Presupuesto total: ${total}`,
      `Restante: ${remaining}`,
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

  const configurationDisposable = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      if (event.affectsConfiguration('budgetOpenrouter.apiKey')) {
        await updateStatusBar(statusBarItem);
      }
    },
  );

  context.subscriptions.push(
    refreshDisposable,
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
