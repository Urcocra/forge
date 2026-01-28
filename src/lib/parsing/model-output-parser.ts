// Parsing Layer (FIXED)
// - Cleans model outputs -> Extracts JSON -> Validates schema -> Builds CombinedModelOutput
// - Designed to be a HARD GATE: returns null on any parsing/contract failure
// - Supports fenced JSON, mixed text, common JSON issues (comments, trailing commas)

import {
  FileTreeSpec,
  FileArtifactsSpec,
  CombinedModelOutput,
} from '../types';

/**
 * Minimal structural validation to prevent "false-valid" artifacts.
 * We keep it strict-but-not-fragile: validate required shapes only.
 */
function validateTreeSpec(tree: any): tree is FileTreeSpec {
  // Expect something like: { files: [{ path, type? }, ...] } OR a similar structure your system uses
  if (!tree || typeof tree !== 'object') return false;

  // Accept both:
  // - tree.files: Array<{path:string,...}>
  // - tree: Array<{path:string,...}>
  const files = Array.isArray((tree as any).files) ? (tree as any).files : (Array.isArray(tree) ? tree : null);
  if (!files) return false;

  for (const f of files) {
    if (!f || typeof f !== 'object') return false;
    if (typeof f.path !== 'string' || f.path.trim().length === 0) return false;
  }
  return true;
}

function validateArtifactsSpec(artifacts: any): artifacts is FileArtifactsSpec {
  if (!artifacts || typeof artifacts !== 'object') return false;
  // Expect: { files: { [path:string]: string } } or your current artifacts shape
  const files = (artifacts as any).files;
  if (!files || typeof files !== 'object') return false;

  // At least one file; values should be strings
  const keys = Object.keys(files);
  if (keys.length === 0) return false;

  for (const k of keys) {
    if (typeof k !== 'string' || k.trim().length === 0) return false;
    if (typeof (files as any)[k] !== 'string') return false;
  }
  return true;
}

/**
 * Parses the model output to build a unified CombinedModelOutput.
 *
 * IMPORTANT:
 * - This function is now a strict gate.
 * - It returns null if:
 *   - the provided tree/artifacts are malformed
 *   - any embedded JSON cannot be parsed/validated
 *
 * Your current pipeline calls parseModelOutput(tree, artifactsSpec).
 * Some adapters pass already-structured objects.
 * We validate shape and return a CombinedModelOutput.
 */
export function parseModelOutput(
  tree: FileTreeSpec,
  artifacts: FileArtifactsSpec
): CombinedModelOutput | null {
  // 1) Strict shape checks
  if (!validateTreeSpec(tree)) return null;
  if (!validateArtifactsSpec(artifacts)) return null;

  // 2) Build combined output (truthy only if validated)
  return {
    tree,
    artifacts,
    raw: JSON.stringify({ tree, artifacts }),
  };
}

/**
 * Extracts JSON code blocks from raw text.
 * Supports:
 * - ```json ... ```
 * - ``` ... ``` (heuristic)
 * - Inline JSON objects/arrays embedded in text
 */
export function extractJsonBlocks(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return [];

  const blocks: string[] = [];

  // 1) fenced blocks: ```json ... ```
  const fenced = raw.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi);
  for (const m of fenced) {
    const body = (m[1] || '').trim();
    if (body) blocks.push(body);
  }

  // 2) If no fenced blocks, attempt to find the largest JSON substring
  if (blocks.length === 0) {
    const stripped = stripNonJsonText(raw).trim();
    if (stripped) blocks.push(stripped);
  }

  return blocks;
}

/**
 * Strips markdown fences if present (helper).
 */
export function stripMarkdownFences(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * Removes obvious non-JSON prefix/suffix text.
 * Heuristic: keep the substring from the first '{' or '[' to the matching last '}' or ']'.
 */
export function stripNonJsonText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const s = raw;

  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');

  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start === -1) return '';

  const lastObj = s.lastIndexOf('}');
  const lastArr = s.lastIndexOf(']');

  let end = -1;
  if (lastObj === -1) end = lastArr;
  else if (lastArr === -1) end = lastObj;
  else end = Math.max(lastObj, lastArr);

  if (end === -1 || end <= start) return '';

  return s.slice(start, end + 1);
}

/**
 * Sanitizes JSON string:
 * - strips markdown fences
 * - removes JS-style comments
 * - removes trailing commas
 */
export function sanitizeJsonString(jsonStr: string): string {
  let s = (jsonStr || '').trim();
  if (!s) return s;

  s = stripMarkdownFences(s);

  // Remove // comments
  s = s.replace(/^\s*\/\/.*$/gm, '');

  // Remove /* */ comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove trailing commas in objects/arrays: {...,} or [...,]
  // This is a common LLM issue.
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s.trim();
}

/**
 * Safe JSON parse with fallback:
 * - attempts direct JSON.parse
 * - if fails, attempts sanitize and parse again
 */
export function parseJsonSafe(jsonStr: string): any {
  if (!jsonStr || typeof jsonStr !== 'string') return null;

  try {
    return JSON.parse(jsonStr);
  } catch {
    // try sanitized
    try {
      const s = sanitizeJsonString(jsonStr);
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
}

/**
 * Optional helper (not required by your current pipeline):
 * Parses a raw text blob that may contain JSON blocks.
 * Returns the first valid parsed JSON object/array.
 */
export function parseFirstJsonFromRaw(raw: string): any {
  const blocks = extractJsonBlocks(raw);
  for (const b of blocks) {
    const parsed = parseJsonSafe(b);
    if (parsed !== null) return parsed;
  }
  return null;
}