#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const MAX_DIAGRAM_BYTES = 64 * 1024;
const MAX_ERROR_CHARS = 4_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const REMOTE_PROTOCOL = /\b(?:https?|file|data|javascript):/i;

export function extractMermaid(markdown) {
  const lines = markdown.split(/\r?\n/);
  const diagrams = [];
  const errors = [];
  let open = null;

  for (let offset = 0; offset < lines.length; offset += 1) {
    const line = lines[offset];
    if (!open) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})\s*mermaid(?:\s.*)?$/i);
      if (match) {
        open = { fence: match[1], line: offset + 1, content: [] };
      }
      continue;
    }

    const closing = new RegExp(`^ {0,3}${open.fence[0]}{${open.fence.length},}\\s*$`);
    if (closing.test(line)) {
      diagrams.push({
        index: diagrams.length + 1,
        startLine: open.line,
        source: open.content.join('\n'),
      });
      open = null;
      continue;
    }
    open.content.push(line);
  }

  if (open) {
    errors.push({
      index: diagrams.length + 1,
      startLine: open.line,
      code: 'UNTERMINATED_FENCE',
      error: 'Mermaid fence is not closed.',
      source: open.content.join('\n'),
    });
  }
  return { diagrams, errors };
}

function clip(value) {
  return value.replaceAll(process.cwd(), '<cwd>').slice(0, MAX_ERROR_CHARS);
}

function cliPath(root) {
  if (process.env.MERMAID_CLI) return process.env.MERMAID_CLI;
  return join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc');
}

function run(command, args, { cwd, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        ALL_PROXY: '',
        NO_PROXY: '*',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolveRun({ code: null, error: error.message, stderr, stdout, timedOut });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code, error: null, stderr, stdout, timedOut });
    });
  });
}

async function rendererVersion(command, cwd) {
  const result = await run(command, ['--version'], { cwd, timeoutMs: 5_000 });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

function safeDiagramError(diagram) {
  if (Buffer.byteLength(diagram.source) > MAX_DIAGRAM_BYTES) {
    return 'Diagram exceeds the 64 KiB source limit.';
  }
  if (REMOTE_PROTOCOL.test(diagram.source)) {
    return 'Diagram contains a remote or executable URI, which render validation forbids.';
  }
  return null;
}

export async function verifyMarkdown(inputPath, { root = ROOT, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const markdown = await readFile(inputPath, 'utf8');
  const extracted = extractMermaid(markdown);
  const failures = [...extracted.errors];
  const diagrams = extracted.diagrams.map((diagram) => ({
    index: diagram.index,
    startLine: diagram.startLine,
    status: 'pending',
  }));

  if (extracted.diagrams.length === 0 && extracted.errors.length === 0) {
    return { valid: true, renderer: null, diagrams, failures };
  }

  const command = cliPath(root);
  if (!existsSync(command)) {
    return {
      valid: false,
      renderer: null,
      diagrams,
      failures: [{
        code: 'MISSING_RENDERER',
        error: `Mermaid CLI is unavailable at ${command}. Install the pinned renderer before claiming render verification.`,
      }],
    };
  }

  const scratch = await mkdtemp(join(tmpdir(), 'aictrl-mermaid-'));
  try {
    const mermaidConfig = join(scratch, 'mermaid.config.json');
    const browserConfig = join(scratch, 'puppeteer.config.json');
    await writeFile(mermaidConfig, `${JSON.stringify({
      securityLevel: 'strict',
      startOnLoad: false,
      maxTextSize: MAX_DIAGRAM_BYTES,
    })}\n`);
    await writeFile(browserConfig, `${JSON.stringify({
      headless: true,
      args: [
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-sync',
        '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost',
        '--no-first-run',
        ...(process.env.MERMAID_ALLOW_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
      ],
    })}\n`);

    const renderer = await rendererVersion(command, scratch);
    for (const diagram of extracted.diagrams) {
      const result = diagrams[diagram.index - 1];
      const preflightError = safeDiagramError(diagram);
      if (preflightError) {
        result.status = 'failed';
        failures.push({
          index: diagram.index,
          startLine: diagram.startLine,
          code: 'UNSAFE_DIAGRAM',
          error: preflightError,
          source: diagram.source,
        });
        continue;
      }

      const input = join(scratch, `diagram-${diagram.index}.mmd`);
      const output = join(scratch, `diagram-${diagram.index}.svg`);
      await writeFile(input, `${diagram.source}\n`);
      const rendered = await run(command, [
        '--input', input,
        '--output', output,
        '--configFile', mermaidConfig,
        '--puppeteerConfigFile', browserConfig,
        '--quiet',
      ], { cwd: scratch, timeoutMs });

      if (rendered.code !== 0 || rendered.timedOut) {
        result.status = 'failed';
        failures.push({
          index: diagram.index,
          startLine: diagram.startLine,
          code: rendered.timedOut ? 'RENDER_TIMEOUT' : 'RENDER_ERROR',
          error: clip(rendered.error || rendered.stderr || rendered.stdout || 'Mermaid renderer failed.'),
          source: diagram.source,
        });
        continue;
      }
      if (!existsSync(output)) {
        result.status = 'failed';
        failures.push({
          index: diagram.index,
          startLine: diagram.startLine,
          code: 'RENDER_ERROR',
          error: 'Mermaid renderer completed without producing an SVG.',
          source: diagram.source,
        });
        continue;
      }
      result.status = 'rendered';
    }
    return { valid: failures.length === 0, renderer, diagrams, failures };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  const inputIndex = args.indexOf('--input');
  if (inputIndex === -1 || !args[inputIndex + 1]) {
    throw new Error('Usage: verify-mermaid.mjs --input <markdown-file>');
  }
  return { input: args[inputIndex + 1] };
}

async function main() {
  try {
    const { input } = parseArgs(process.argv.slice(2));
    const result = await verifyMarkdown(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
