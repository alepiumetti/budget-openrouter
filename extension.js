// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const REFRESH_COMMAND = 'budget-openrouter.refresh';
const SET_API_KEY_COMMAND = 'budget-openrouter.setApiKey';
const CLEAR_API_KEY_COMMAND = 'budget-openrouter.clearApiKey';
const SECRET_API_KEY_STORAGE_KEY = 'openrouterApiKey';

const outputChannel = vscode.window.createOutputChannel('Budget OpenRouter');

function log(message) {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}

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

function getConfiguredApiKey() {
  const config = vscode.workspace.getConfiguration('budgetOpenrouter');
  return config.get('apiKey') || '';
}

async function getApiKey(context) {
  const secretApiKey = await context.secrets.get(SECRET_API_KEY_STORAGE_KEY);
  return secretApiKey || getConfiguredApiKey() || process.env.OPENROUTER_API_KEY || '';
}

function getRefreshIntervalMs() {
  const config = vscode.workspace.getConfiguration('budgetOpenrouter');
  const minutes = config.get('refreshIntervalMinutes');
  const parsed = Number(minutes);
  const clamped = Number.isFinite(parsed) && parsed >= 1 ? parsed : 30;
  return clamped * 60 * 1000;
}

function ratioToColor(remainingRatio) {
  const clamped = Math.max(0, Math.min(1, remainingRatio));
  const red = Math.round(255 * (1 - clamped));
  const green = Math.round(255 * clamped);
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

async function updateStatusBar(context, statusBarItem, source = 'manual') {
  const apiKey = await getApiKey(context);

  if (!apiKey) {
    statusBarItem.command = SET_API_KEY_COMMAND;
    statusBarItem.text = '$(key) OpenRouter: configurar API key';
    statusBarItem.color = undefined;
    statusBarItem.tooltip =
      'No hay API key configurada. Click para pegarla de forma segura.';
    return;
  }

  statusBarItem.command = REFRESH_COMMAND;

  log(`Refresh iniciado (origen: ${source})`);
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
      const remainingRatio =
        remainingValue !== null
          ? remainingValue / totalValue
          : 1 - usageValue / totalValue;
      statusBarItem.color = ratioToColor(remainingRatio);
    } else {
      statusBarItem.color = undefined;
    }

    const resetCycle =
      data.limit_reset === 'monthly'
        ? 'mensual'
        : data.limit_reset
          ? String(data.limit_reset)
          : null;

    log(`Refresh completado. Restante: ${remaining} / Total: ${total}`);
    statusBarItem.text = `$(graph) OpenRouter: ${remaining}/${total}`;
    statusBarItem.tooltip = [
      `Presupuesto total: ${total}${resetCycle ? ` (ciclo ${resetCycle})` : ''}`,
      `Restante: ${remaining}`,
      `Gasto total: $${used}`,
      `Este mes: $${formatCredits(data.usage_monthly)}`,
      `Esta semana: $${formatCredits(data.usage_weekly)}`,
      `Hoy: $${formatCredits(data.usage_daily)}`,
      'Click para refrescar',
    ].join('\n');
  } catch (error) {
    log(`Refresh fallido: ${error.message}`);
    statusBarItem.text = '$(warning) OpenRouter: error';
    statusBarItem.tooltip = `No se pudo consultar OpenRouter.\n${error.message}`;
  }
}

async function migrateApiKeyFromConfiguration(context) {
  const secretApiKey = await context.secrets.get(SECRET_API_KEY_STORAGE_KEY);
  if (secretApiKey) {
    return;
  }

  const configuredApiKey = getConfiguredApiKey();
  if (!configuredApiKey) {
    return;
  }

  await context.secrets.store(SECRET_API_KEY_STORAGE_KEY, configuredApiKey);
  await vscode.workspace
    .getConfiguration('budgetOpenrouter')
    .update('apiKey', '', vscode.ConfigurationTarget.Global);

  log('API key migrada desde configuración a Secret Storage.');
}

async function promptAndStoreApiKey(context) {
  const input = await vscode.window.showInputBox({
    title: 'OpenRouter API Key',
    prompt: 'Pega tu API key de OpenRouter',
    placeHolder: 'sk-or-v1-...',
    password: true,
    ignoreFocusOut: true,
  });

  if (input === undefined) {
    return false;
  }

  const apiKey = input.trim();
  if (!apiKey) {
    vscode.window.showWarningMessage('No se guardó ninguna API key (valor vacío).');
    return false;
  }

  await context.secrets.store(SECRET_API_KEY_STORAGE_KEY, apiKey);
  await vscode.workspace
    .getConfiguration('budgetOpenrouter')
    .update('apiKey', '', vscode.ConfigurationTarget.Global);

  log('API key guardada en Secret Storage.');
  vscode.window.showInformationMessage('API key guardada de forma segura.');
  return true;
}

async function clearStoredApiKey(context) {
  await context.secrets.delete(SECRET_API_KEY_STORAGE_KEY);
  log('API key eliminada de Secret Storage.');
  vscode.window.showInformationMessage('API key eliminada.');
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

  let autoRefreshTimer = null;

  function scheduleAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
    }
    const intervalMs = getRefreshIntervalMs();
    log(`Auto-refresh programado cada ${intervalMs / 60000} minuto(s)`);
    autoRefreshTimer = setInterval(async () => {
      await updateStatusBar(context, statusBarItem, 'auto');
    }, intervalMs);
  }

  const refreshDisposable = vscode.commands.registerCommand(
    REFRESH_COMMAND,
    async function () {
      await updateStatusBar(context, statusBarItem, 'manual');
    },
  );

  const setApiKeyDisposable = vscode.commands.registerCommand(
    SET_API_KEY_COMMAND,
    async function () {
      const saved = await promptAndStoreApiKey(context);
      if (saved) {
        await updateStatusBar(context, statusBarItem, 'set-api-key');
      }
    },
  );

  const clearApiKeyDisposable = vscode.commands.registerCommand(
    CLEAR_API_KEY_COMMAND,
    async function () {
      await clearStoredApiKey(context);
      await updateStatusBar(context, statusBarItem, 'clear-api-key');
    },
  );

  const configurationDisposable = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      if (event.affectsConfiguration('budgetOpenrouter.apiKey')) {
        await updateStatusBar(context, statusBarItem, 'config-change');
      }
      if (
        event.affectsConfiguration('budgetOpenrouter.refreshIntervalMinutes')
      ) {
        scheduleAutoRefresh();
      }
    },
  );

  context.subscriptions.push(
    refreshDisposable,
    setApiKeyDisposable,
    clearApiKeyDisposable,
    configurationDisposable,
    statusBarItem,
    {
      dispose: () => {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
        }
      },
    },
    outputChannel,
  );

  (async () => {
    await migrateApiKeyFromConfiguration(context);
    await updateStatusBar(context, statusBarItem, 'startup');
    scheduleAutoRefresh();
  })();
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
