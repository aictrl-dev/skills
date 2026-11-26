(() => {
  'use strict';

  const diagrams = JSON.parse(document.getElementById('diagram-data').textContent);
  const normalise = (value) => value.replace(/\s+/g, ' ').trim();
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    if (tag === 'button') node.type = 'button';
    return node;
  }

  function createDrawing(tree) {
    if (typeof tree === 'string') return document.createTextNode(tree);
    const [namespace, tag, attributes, children, styles] = tree;
    const node = document.createElementNS(namespace, tag);
    for (const [attributeNamespace, name, value] of attributes) {
      node.setAttributeNS(attributeNamespace, name, value);
    }
    for (const [name, value] of styles) {
      node.style.setProperty(name, value);
    }
    node.append(...children.map(createDrawing));
    return node;
  }

  function candidatesFor(svg) {
    return [...svg.querySelectorAll('g.node, text.messageText, text.taskText, text.taskTextOutsideLeft, text.taskTextOutsideRight')];
  }

  function matchTarget(candidates, step) {
    const flow = candidates.find((node) => node.id.startsWith(`flowchart-${step.id}-`) &&
      /^\d+$/.test(node.id.slice(`flowchart-${step.id}-`.length)));
    if (flow) return flow;
    const matches = candidates.filter((node) => {
      const label = node.querySelector('.nodeLabel') ?? node;
      return normalise(label.textContent) === normalise(step.label);
    });
    return matches.length === 1 ? matches[0] : undefined;
  }

  function mount(slot, diagram) {
    const svg = createDrawing(diagram.drawing);
    const wrapper = element('section', '', 'explorer');
    const heading = element('h2', diagram.title);
    wrapper.append(heading);

    const drawing = element('div', '', 'drawing');
    drawing.append(svg);
    wrapper.append(drawing);

    const inspector = element('section', '', 'inspector');
    inspector.setAttribute('aria-label', 'Step details');
    const detailTitle = element('h3', 'Select a step');
    detailTitle.tabIndex = -1;
    const detailBody = element('p');
    const source = element('div');
    inspector.append(detailTitle, detailBody, source);

    const steps = element('div', '', 'steps');
    steps.setAttribute('role', 'group');
    steps.setAttribute('aria-label', 'Diagram steps');
    const controls = element('div', '', 'traces');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Trace paths');
    const status = element('p', '', 'sr-only');
    status.setAttribute('role', 'status');

    const entries = new Map();
    const candidates = candidatesFor(svg);
    let selection;
    let selectedTrace;
    const routeButtons = [];
    const pathElements = [...svg.querySelectorAll('path.flowchart-link[data-trace-from][data-trace-to]')];

    function showStep(id, moveFocus = false) {
      const { step, button, target } = entries.get(id);
      selection?.button.setAttribute('aria-pressed', 'false');
      selection?.target?.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
      target?.setAttribute('aria-pressed', 'true');
      selection = { button, target };
      detailTitle.textContent = step.label;
      detailBody.textContent = step.summary;
      source.replaceChildren();
      if (step.source) {
        const link = element('a', step.source.label);
        link.href = step.source.url;
        link.rel = 'noreferrer';
        const code = element('code', step.source.code);
        const block = element('pre');
        block.append(code);
        source.append(link, block);
      }
      if (moveFocus) detailTitle.focus({ preventScroll: true });
      status.textContent = `Showing ${step.label}.`;
    }

    for (const step of diagram.steps) {
      const button = element('button', step.label);
      button.setAttribute('aria-pressed', 'false');
      if (step.outcome) button.dataset.outcome = step.outcome;
      button.addEventListener('click', () => showStep(step.id));
      steps.append(button);
      const target = matchTarget(candidates, step);
      if (target && !target.hasAttribute('data-explore-step')) {
        target.dataset.exploreStep = step.id;
        if (step.outcome) target.dataset.outcome = step.outcome;
        target.setAttribute('role', 'button');
        target.setAttribute('tabindex', '0');
        target.setAttribute('aria-label', step.label);
        target.setAttribute('aria-pressed', 'false');
        target.addEventListener('click', () => showStep(step.id));
        target.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          showStep(step.id, true);
        });
      }
      entries.set(step.id, { step, button, target: target?.dataset.exploreStep === step.id ? target : undefined });
    }

    function showTrace(trace) {
      const ids = new Set(trace?.steps);
      drawing.toggleAttribute('data-tracing', Boolean(trace));
      for (const [id, { button, target }] of entries) {
        button.toggleAttribute('data-on-path', ids.has(id));
        target?.toggleAttribute('data-on-path', ids.has(id));
      }
      for (const path of pathElements) {
        const { traceFrom, traceTo } = path.dataset;
        const lit = Boolean(trace?.steps.some((step, index) => step === traceFrom && trace.steps[index + 1] === traceTo));
        path.toggleAttribute('data-on-path', lit);
      }
      for (const [entry, button] of routeButtons) button.setAttribute('aria-pressed', String(entry === trace));
      selectedTrace = trace;
      if (trace) showStep(trace.steps.at(-1));
      status.textContent = trace ? `Showing path: ${trace.label}.` : 'Trace cleared.';
    }

    for (const trace of diagram.traces ?? []) {
      const button = element('button', trace.label);
      button.setAttribute('aria-pressed', 'false');
      routeButtons.push([trace, button]);
      button.addEventListener('click', () => showTrace(selectedTrace === trace ? undefined : trace));
      controls.append(button);
    }
    if (routeButtons.length) wrapper.append(controls);
    wrapper.append(steps, inspector, status);
    slot.replaceWith(wrapper);
  }

  for (const slot of document.querySelectorAll('[data-diagram]')) {
    try {
      mount(slot, diagrams[Number(slot.dataset.diagram)]);
    } catch (error) {
      console.error(error);
      slot.replaceChildren(element('p', 'The interactive diagram could not be displayed.'));
    }
  }
})();
