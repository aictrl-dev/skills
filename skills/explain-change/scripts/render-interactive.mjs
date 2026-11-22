#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { cliPath, verifyMermaidSource } from './verify-mermaid.mjs';

const assets = new URL('../assets/', import.meta.url);
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function checkSourceLink(value) {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function checkSteps(stepsByDiagram, diagramCount) {
  if (!Array.isArray(stepsByDiagram) || stepsByDiagram.length !== diagramCount) {
    throw new Error('Provide one interactive entry for each Mermaid fence, in document order.');
  }
  for (const [index, entry] of stepsByDiagram.entries()) {
    if (!isText(entry?.title) || !Array.isArray(entry.steps) || !entry.steps.length) {
      throw new Error(`Diagram ${index + 1} requires a title and at least one step.`);
    }
    const ids = new Set();
    for (const step of entry.steps) {
      if (!isText(step?.id) || ids.has(step.id) || !isText(step.label) || !isText(step.summary)) {
        throw new Error(`Diagram ${index + 1} has a step with a missing or duplicate ID, label, or summary.`);
      }
      ids.add(step.id);
      if (step.outcome !== undefined && !['ok', 'retry', 'fail'].includes(step.outcome)) {
        throw new Error(`Diagram ${index + 1} has an unknown outcome for ${step.id}.`);
      }
      if (step.source !== undefined && (!isText(step.source?.label) || !isText(step.source.code) || !checkSourceLink(step.source.url))) {
        throw new Error(`Diagram ${index + 1} has an invalid code reference for ${step.id}.`);
      }
    }
    if (entry.traces === undefined) continue;
    if (!Array.isArray(entry.traces) || entry.traces.some((trace) => !isText(trace?.label) ||
        !Array.isArray(trace.steps) || trace.steps.length < 2 || trace.steps.some((id) => !ids.has(id)))) {
      throw new Error(`Diagram ${index + 1} has an invalid trace. Use at least two IDs from that diagram.`);
    }
  }
}

async function markdownHtml(markdown, count) {
  // Use the Markdown parser installed alongside the pinned Mermaid renderer.
  const require = createRequire(await realpath(cliPath()));
  const { marked } = require('marked');
  const renderer = new marked.Renderer();
  const defaultCode = renderer.code.bind(renderer);
  let index = 0;
  renderer.html = escapeHtml;
  renderer.image = (_href, _title, text) => escapeHtml(text);
  renderer.link = (href, _title, text) => checkSourceLink(href)
    ? `<a href="${escapeHtml(href)}" rel="noreferrer">${text}</a>`
    : text;
  renderer.code = (code, info) => /^mermaid(?:\s|$)/i.test(info ?? '')
    ? `<div data-diagram="${index++}"></div>\n`
    : defaultCode(code, info);
  const html = marked.parse(markdown, { renderer, headerIds: false, mangle: false });
  if (index !== count) throw new Error('Markdown and Mermaid disagree on the number of diagrams.');
  return html;
}

export async function writeInteractive({ input, steps, output }) {
  if ([input, steps].some((path) => resolve(output) === resolve(path))) {
    throw new Error('Choose an output file separate from the Markdown and steps inputs.');
  }
  const markdown = await readFile(input, 'utf8');
  const entries = JSON.parse(await readFile(steps, 'utf8'));
  const report = await verifyMermaidSource(markdown, { includeSvg: true });
  if (!report.valid) {
    const reasons = report.failures.map(({ index, error }) => `${index ? `Diagram ${index}: ` : ''}${error}`);
    throw new Error(reasons.join('\n'));
  }
  checkSteps(entries, report.diagrams.length);
  const body = await markdownHtml(markdown, report.diagrams.length);
  const [style, script] = await Promise.all([
    readFile(new URL('interactive.css', assets), 'utf8'),
    readFile(new URL('interactive.js', assets), 'utf8'),
  ]);
  const hash = createHash('sha256').update(script).digest('base64');
  const data = JSON.stringify(entries.map((entry, index) => ({
    ...entry,
    svg: report.diagrams[index].svg,
  }))).replaceAll('<', '\\u003c');
  const policy = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`;
  const title = /^#\s+([^\r\n]+)/m.exec(markdown)?.[1] ?? 'Change explanation';
  await writeFile(output, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${policy}">
  <title>${escapeHtml(title)}</title>
  <style>${style}</style>
</head>
<body>
  <main>${body}</main>
  <script id="diagram-data" type="application/json">${data}</script>
  <script>${script}</script>
</body>
</html>
`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      steps: { type: 'string' },
      output: { type: 'string' },
    },
  });
  if (!values.input || !values.steps || !values.output) {
    throw new Error(`Usage: ${fileURLToPath(import.meta.url)} --input <explainer.md> --steps <steps.json> --output <explain-change.html>`);
  }
  await writeInteractive(values);
  process.stdout.write(`Wrote ${values.output}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
