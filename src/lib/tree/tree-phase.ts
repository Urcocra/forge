// src/lib/tree/tree-phase.ts

import {
  ModelGenerateFn,
  FileTreeSpec,
  TreeRules,
  TreePhaseOutput,
  ModelRequest
} from '../types';

export enum TreePhaseError {
  ModelCallFailed = 'ModelCallFailed',
  InvalidTreeStructure = 'InvalidTreeStructure',
  MissingRequiredFile = 'MissingRequiredFile',
  InvalidPath = 'InvalidPath'
}

export interface TreePhaseInput {
  taskId: string;
  size: string;
  description: string;
  treeRules: TreeRules;
}

function isValidPath(p: string): boolean {
  if (typeof p !== 'string') return false;
  if (p.startsWith('/') || p.startsWith('\\')) return false;
  if (p.includes('..')) return false;
  return true;
}

function validateTree(tree: unknown): tree is FileTreeSpec {
  if (!tree || typeof tree !== 'object') return false;
  const files = (tree as any).files;
  if (!Array.isArray(files) || files.length === 0) return false;

  for (const f of files) {
    if (!f || typeof f !== 'object') return false;
    if (typeof (f as any).path !== 'string') return false;
    if (!isValidPath((f as any).path)) return false;
  }
  return true;
}

function extractPaths(tree: FileTreeSpec): Set<string> {
  return new Set(tree.files.map(f => f.path));
}

function findMissingRequiredFile(tree: FileTreeSpec, required?: string[]): string | null {
  if (!required || required.length === 0) return null;
  const paths = extractPaths(tree);
  for (const r of required) {
    if (!paths.has(r)) return r;
  }
  return null;
}

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj ?? {});
  } catch {
    return '{"__stringify_failed__":true}';
  }
}

export async function enforceTreePhase(
  input: TreePhaseInput,
  modelGenerateFn: ModelGenerateFn
): Promise<TreePhaseOutput> {
  const logs: string[] = [];
  let modelOutput: any = null;
  let rawModelOutput = '';

  // 1) Call model
  try {
    const req: ModelRequest = {
      taskId: input.taskId,
      size: input.size as any,
      description: input.description,
      expectedArtifacts: [],
      phase: 'tree'
    };

    modelOutput = await modelGenerateFn(req);
    rawModelOutput = safeStringify(modelOutput);
  } catch (e: any) {
    rawModelOutput = safeStringify({
      __error__: TreePhaseError.ModelCallFailed,
      message: e?.message ?? String(e)
    });

    return {
      success: false,
      error: TreePhaseError.ModelCallFailed,
      rawModelOutput,
      details: e?.message ?? String(e),
      logs
    };
  }

  // 2) Extract tree
  const tree = modelOutput?.tree;

  // 3) Validate structure + paths
  if (!validateTree(tree)) {
    return {
      success: false,
      error: TreePhaseError.InvalidTreeStructure,
      rawModelOutput,
      details: 'Expected { files: [{ path: string, ... }] } with legal relative paths',
      logs
    };
  }

  // 4) Check required files
  const missing = findMissingRequiredFile(tree, input.treeRules.requiredFiles);
  if (missing) {
    return {
      success: false,
      error: TreePhaseError.MissingRequiredFile,
      rawModelOutput,
      details: missing,
      logs
    };
  }

  // 5) Success
  const outLogs = Array.isArray(modelOutput?.logs)
    ? modelOutput.logs.map((x: any) => String(x))
    : [];

  return {
    success: true,
    tree,
    rawModelOutput,
    logs: outLogs
  };
}