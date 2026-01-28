// Sandbox Runner Layer (FIXED)
// - Strict runtime truth reporter
// - Browser errors === runtime failure
// - No silent success

import { ExecutionArtifacts, TaskSpec, SandboxResult } from '../types';
import { SandboxManifest } from '../../types/sandbox';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { runInBrowser, BrowserError, BrowserLog } from './browser-runner';

export function runInSandbox(
  artifacts: ExecutionArtifacts,
  taskSpec: TaskSpec,
  manifest?: SandboxManifest
): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const tempDir = tmp.dirSync({ unsafeCleanup: false });

    const logs: string[] = [];
    let browserErrors: BrowserError[] = [];
    let browserLogs: BrowserLog[] = [];

    const cleanup = () => {
      setTimeout(() => {
        try {
          fs.rmSync(tempDir.name, { recursive: true, force: true });
        } catch { }
      }, 300);
    };

    try {
      // Write files
      for (const [filePath, content] of Object.entries(artifacts.files || {})) {
        const fullPath = path.join(tempDir.name, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }

      const runtimeType = taskSpec.runtime?.type;
      const entryPoint = taskSpec.runtime?.entry;
      const buildCommand = taskSpec.runtime?.buildCommand;

      (async () => {
        // ---------- Build ----------
        if (buildCommand) {
          logs.push(`[Sandbox] Build: ${buildCommand}`);
          const code = await runCommand(buildCommand, tempDir.name, 30000, logs);
          if (code !== 0) {
            cleanup();
            return resolve({
              success: false,
              logs,
              browserErrors,
              browserLogs
            });
          }
        }

        // ---------- Runtime ----------
        if (!entryPoint) {
          cleanup();
          return resolve({ success: true, logs, manifest });
        }

        if (runtimeType === 'browser') {
          let html = entryPoint.endsWith('.html') ? entryPoint : 'index.html';
          const htmlPath = path.join(tempDir.name, html);

          logs.push(`[Sandbox] Browser Runtime: ${html}`);

          if (!fs.existsSync(htmlPath)) {
            logs.push(`[Sandbox] Missing browser entry: ${html}`);
            cleanup();
            return resolve({ success: false, logs });
          }

          try {
            const result = await runInBrowser(htmlPath, 10000);
            browserErrors = result.browserErrors || [];
            browserLogs = result.browserLogs || [];
            const externalAccess = result.externalAccess || [];

            logs.push(
              `[Sandbox] Browser completed: ${browserErrors.length} errors, ${browserLogs.length} logs`
            );

            const success = browserErrors.length === 0;

            cleanup();
            return resolve({
              success,
              logs,
              manifest,
              browserErrors,
              browserLogs,
              externalAccess
            });

          } catch (e) {
            logs.push(`[Sandbox] Browser crashed: ${(e as Error).message}`);
            cleanup();
            return resolve({ success: false, logs });
          }
        }

        if (runtimeType === 'node') {
          logs.push(`[Sandbox] Node Runtime: ${entryPoint}`);
          // Inject FS Guard (Compiled JS)
          const guardPath = path.resolve(__dirname, '../../../dist/fs-guard.js');

          const cmd = `node -r "${guardPath}" "${entryPoint}"`;
          logs.push(`[Sandbox] Cmd: ${cmd}`);

          const code = await runCommand(cmd, tempDir.name, 5000, logs);
          cleanup();
          return resolve({
            success: code === 0,
            logs,
            manifest
          });
        }

        logs.push(`[Sandbox] Unknown runtime type`);
        cleanup();
        return resolve({ success: false, logs });

      })();

    } catch (e) {
      logs.push(`[Sandbox] Internal error: ${(e as Error).message}`);
      cleanup();
      logs.push(`[Sandbox] Internal error: ${(e as Error).message}`);
      cleanup();
      resolve({ success: false, logs, manifest });
    }
  });
}

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  logs: string[]
): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(command, { shell: true, cwd });
    const timer = setTimeout(() => {
      logs.push(`[Sandbox] Timeout after ${timeoutMs}ms: ${command}`);
      proc.kill();
    }, timeoutMs);

    proc.stdout?.on('data', d => logs.push(d.toString()));
    proc.stderr?.on('data', d => logs.push(d.toString()));

    proc.on('close', code => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });

    proc.on('error', err => {
      clearTimeout(timer);
      logs.push(`[Sandbox] Process error: ${err.message}`);
      resolve(1);
    });
  });
}