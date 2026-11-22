#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { browserOptions, toolingPath, verifyMermaidSource } from './verify-mermaid.mjs';

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

function markdownHtml(markdown, count, Marked, Renderer) {
  const renderer = new Renderer();
  const defaultCode = renderer.code.bind(renderer);
  let index = 0;
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.image = ({ text }) => escapeHtml(text);
  renderer.link = function ({ href, tokens }) {
    const label = this.parser.parseInline(tokens);
    return checkSourceLink(href)
      ? `<a href="${escapeHtml(href)}" rel="noreferrer">${label}</a>`
      : label;
  };
  renderer.code = (token) => /^mermaid(?:\s|$)/i.test(token.lang ?? '')
    ? `<div data-diagram="${index++}"></div>\n`
    : defaultCode(token);
  const html = new Marked({ renderer }).parse(markdown);
  if (index !== count) throw new Error('Place executable Mermaid fences at the top level. Quoted examples can stay inside ordinary code fences.');
  return html;
}

// Snapshot the rendered presentation without carrying SVG rules into the reader's page.
export async function drawingTrees(diagrams, puppeteer) {
  if (!diagrams.length) return [];
  const browser = await puppeteer.launch(browserOptions());
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => request.abort());
    return await page.evaluate((sources) => {
      const svgNamespace = 'http://www.w3.org/2000/svg';
      const htmlNamespace = 'http://www.w3.org/1999/xhtml';
      const svgTags = new Set(['svg', 'g', 'path', 'polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'defs',
        'marker', 'style', 'foreignObject', 'title', 'desc', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop', 'use']);
      const htmlTags = new Set(['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'code', 'small', 'sub', 'sup']);
      const presentation = ['color', 'background-color', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray',
        'stroke-linecap', 'stroke-linejoin', 'paint-order', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
        'text-anchor', 'text-align', 'dominant-baseline', 'white-space', 'letter-spacing', 'line-height', 'max-width'];
      const htmlLayout = ['display', 'margin', 'padding', 'width', 'height', 'box-sizing'];
      const localPaint = (value) => !/\burl\s*\(/i.test(value) || /^url\(["']?#[\w:.-]+["']?\)$/.test(value);
      function isAllowed(node) {
        if (node.namespaceURI === svgNamespace) return svgTags.has(node.localName);
        if (node.namespaceURI === htmlNamespace) return htmlTags.has(node.localName);
        return false;
      }

      function encode(node) {
        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) return node.nodeValue;
        if (node.nodeType !== Node.ELEMENT_NODE || node.localName === 'style') return null;
        const attributes = [...node.attributes]
          .filter(({ localName }) => localName !== 'style')
          .map(({ namespaceURI, name, value }) => [namespaceURI, name, value]);
        const computed = getComputedStyle(node);
        const names = node.namespaceURI === htmlNamespace ? [...presentation, ...htmlLayout] : presentation;
        const styles = names.map((name) => [name, computed.getPropertyValue(name)]).filter(([, value]) => value && localPaint(value));
        const children = [...node.childNodes].map(encode).filter((child) => child !== null);
        return [node.namespaceURI, node.localName, attributes, children, styles];
      }

      return sources.map((markup) => {
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
        const root = parsed.documentElement;
        if (root.namespaceURI !== svgNamespace || root.localName !== 'svg') {
          throw new Error('Mermaid output is not a valid SVG.');
        }
        for (const node of [root, ...root.querySelectorAll('*')]) {
          if (!isAllowed(node)) {
            node.remove();
            continue;
          }
          for (const attribute of [...node.attributes]) {
            const { localName, value } = attribute;
            if (/^on/i.test(localName) || ['src', 'srcdoc', 'srcset'].includes(localName) ||
                (localName === 'href' && !/^#[\w:.-]+$/.test(value)) ||
                (localName !== 'style' && !localPaint(value))) {
              node.removeAttributeNode(attribute);
            }
          }
        }
        const drawing = document.importNode(root, true);
        document.body.append(drawing);
        try {
          return encode(drawing);
        } finally {
          drawing.remove();
        }
      });
    }, diagrams.map((diagram) => diagram.svg));
  } finally {
    await browser.close();
  }
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
  // Markdown and browser tooling are independent of the selected mmdc binary.
  const require = createRequire(join(toolingPath(), 'package.json'));
  const { Marked, Renderer } = require('marked');
  const { default: puppeteer } = require('puppeteer');
  const body = markdownHtml(markdown, report.diagrams.length, Marked, Renderer);
  const [style, script, drawings] = await Promise.all([
    readFile(new URL('interactive.css', assets), 'utf8'),
    readFile(new URL('interactive.js', assets), 'utf8'),
    drawingTrees(report.diagrams, puppeteer),
  ]);
  const hash = createHash('sha256').update(script).digest('base64');
  const data = JSON.stringify(entries.map((entry, index) => ({
    ...entry,
    drawing: drawings[index],
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
