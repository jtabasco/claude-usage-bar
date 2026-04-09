import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess, exec } from 'child_process';

let statusBarItem: vscode.StatusBarItem;
let pollTimer: NodeJS.Timeout | undefined;
let serverProcess: ChildProcess | undefined;
let usageFile: string;
let storageDir: string;

export async function activate(context: vscode.ExtensionContext) {
  storageDir = context.globalStorageUri.fsPath;
  usageFile  = path.join(storageDir, 'claude-usage.json');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  statusBarItem.tooltip = 'Claude.ai usage — click to refresh';
  statusBarItem.command = 'claudeUsage.refresh';
  statusBarItem.text = '$(cloud) Claude…';
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand('claudeUsage.refresh', () => restartServer(context))
  );

  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('claudeUsage.cookies')) restartServer(context);
  });

  await ensureSetup(context);
  startServer(context);
  pollTimer = setInterval(readAndShow, 5000);
}

// ── Setup: copy scripts + install deps ────────────────────────────────────────

async function ensureSetup(context: vscode.ExtensionContext) {
  fs.mkdirSync(storageDir, { recursive: true });

  // Always copy the latest server script from the extension bundle
  const src = path.join(context.extensionPath, 'scripts', 'server.js');
  const dst = path.join(storageDir, 'server.js');
  fs.copyFileSync(src, dst);

  const depsMarker = path.join(storageDir, 'node_modules', 'playwright-extra');
  if (fs.existsSync(depsMarker)) return; // already installed

  // Copy package.json and install
  const pkgSrc = path.join(context.extensionPath, 'scripts', 'package.json');
  const pkgDst = path.join(storageDir, 'package.json');
  fs.copyFileSync(pkgSrc, pkgDst);

  statusBarItem.text = '$(sync~spin) Claude: instalando (1 vez, ~2 min)…';

  await runCommand('npm install', storageDir);
  // PLAYWRIGHT_BROWSERS_PATH keeps browser inside extension storage (cross-platform)
  await runCommand('npx playwright install chromium', storageDir);

  statusBarItem.text = '$(cloud) Claude: listo';
}

function runCommand(cmd: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // shell:true ensures PATH is resolved correctly on all platforms (Mac/Linux/Windows)
    exec(cmd, { cwd, timeout: 300_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

function startServer(context: vscode.ExtensionContext) {
  const cookies = vscode.workspace.getConfiguration('claudeUsage').get<string>('cookies', '').trim();
  if (!cookies) {
    statusBarItem.text = '$(cloud) Claude: configura cookies';
    return;
  }

  const match = cookies.match(/sessionKey=([^;]+)/);
  const sessionKey = (match ? match[1] : cookies).trim();

  const serverScript = path.join(storageDir, 'server.js');
  const nodePath = path.join(storageDir, 'node_modules', '.bin', 'node') || 'node';

  serverProcess = spawn('node', [serverScript, usageFile, sessionKey], {
    cwd: storageDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout?.on('data', () => readAndShow());
  serverProcess.stderr?.on('data', (d: Buffer) => console.error('[claude-usage]', d.toString()));
  serverProcess.on('exit', code => {
    if (code !== 0 && code !== null) statusBarItem.text = '$(cloud) Claude: reiniciando…';
  });
}

function restartServer(context: vscode.ExtensionContext) {
  if (serverProcess) { serverProcess.kill(); serverProcess = undefined; }
  startServer(context);
}

// ── Status bar update ─────────────────────────────────────────────────────────

function readAndShow() {
  try {
    if (!fs.existsSync(usageFile)) return;
    const data = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    if (data.ok) {
      statusBarItem.text = `$(cloud) ${data.five_hour}% · ${data.seven_day}%`;
      statusBarItem.tooltip = buildTooltip(data);
      statusBarItem.backgroundColor = data.five_hour >= 80
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
    } else {
      statusBarItem.text = '$(cloud) Claude: error';
      const errMd = new vscode.MarkdownString(`**Error:** ${data.error}\n\n*Click para reintentar*`);
      statusBarItem.tooltip = errMd;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  } catch { /* file not ready */ }
}

function timeUntil(isoDate: string | null): string {
  if (!isoDate) return '—';
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'reseteando…';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildTooltip(data: any): vscode.MarkdownString {
  const r5 = timeUntil(data.five_hour_resets_at);
  const r7 = timeUntil(data.seven_day_resets_at);
  const md = new vscode.MarkdownString(
    `**Claude.ai Usage** *(click to refresh)*\n\n` +
    `| | Uso | Resetea en |\n` +
    `|---|---|---|\n` +
    `| 5h | ${data.five_hour}% | ${r5} |\n` +
    `| 7d | ${data.seven_day}% | ${r7} |\n\n` +
    `*Actualizado: ${new Date(data.updated).toLocaleTimeString()}*`
  );
  md.isTrusted = true;
  return md;
}

export function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
  if (serverProcess) serverProcess.kill();
}
