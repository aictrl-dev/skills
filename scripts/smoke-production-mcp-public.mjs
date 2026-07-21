#!/usr/bin/env node

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_PUBLIC_MCP_TOOLS,
  PUBLIC_MCP_URL,
  PUBLIC_MCP_ANNOTATIONS,
} from './public-catalog.mjs';

const {
  read,
  update,
  create,
} = PUBLIC_MCP_ANNOTATIONS;

const EXPECTED_TOOL_CONTRACTS = Object.freeze({
  query_context: {
    annotations: read,
    required: ['organization_id', 'domain', 'action'],
    properties: ['organization_id', 'domain', 'action', 'query', 'params', 'version'],
  },
  update_backlog: {
    annotations: update,
    required: ['organization_id', 'entity', 'action', 'params'],
    properties: ['organization_id', 'entity', 'action', 'params', 'version'],
  },
  list_organizations: {
    annotations: read,
    required: [],
    properties: [],
  },
  list_workflows: {
    annotations: read,
    required: [],
    properties: ['organization_id', 'limit'],
  },
  get_workflow: {
    annotations: read,
    required: ['organization_id', 'workflow_id'],
    properties: ['organization_id', 'workflow_id'],
  },
  start_workflow: {
    annotations: create,
    required: ['organization_id', 'workflow_id', 'idempotency_key'],
    properties: ['organization_id', 'workflow_id', 'idempotency_key', 'inputs'],
  },
  get_workflow_run: {
    annotations: read,
    required: ['organization_id', 'run_id'],
    properties: ['organization_id', 'run_id'],
  },
  approve_workflow_step: {
    annotations: update,
    required: ['organization_id', 'run_id', 'decision', 'expected_revision'],
    properties: ['organization_id', 'run_id', 'decision', 'expected_revision', 'note'],
  },
  cancel_workflow_run: {
    annotations: update,
    required: ['organization_id', 'run_id'],
    properties: ['organization_id', 'run_id', 'reason'],
  },
});

const FORBIDDEN_OUTPUT_KEY_STEMS =
  /token|secret|password|passwd|credential|cookie|session|privatekey|signingkey|apikey|authorization|hmac/;

export function assertProductionCatalog(tools) {
  assert.ok(Array.isArray(tools), 'Production MCP tools/list did not return a tools array.');
  assert.deepEqual(
    Object.keys(EXPECTED_TOOL_CONTRACTS),
    EXPECTED_PUBLIC_MCP_TOOLS,
    'Production MCP contract metadata differs from the canonical tool allow-list.',
  );
  assert.deepEqual(
    tools.map((tool) => tool?.name).sort(),
    [...EXPECTED_PUBLIC_MCP_TOOLS].sort(),
    'Production MCP catalog differs from the approved exact-nine contract.',
  );

  for (const tool of tools) {
    const name = tool.name;
    const contract = EXPECTED_TOOL_CONTRACTS[name];
    assert.ok(contract, `No approved production contract exists for ${name}.`);
    assert.equal(typeof tool.description, 'string', `${name} has no description.`);
    assert.ok(tool.description.trim(), `${name} has an empty description.`);
    assert.deepEqual(tool.annotations, contract.annotations, `${name} annotations drifted.`);
    assert.equal(tool.inputSchema?.type, 'object', `${name} input schema is not an object.`);
    assert.equal(
      tool.inputSchema?.additionalProperties,
      false,
      `${name} must reject unknown top-level inputs.`,
    );
    assert.deepEqual(tool.inputSchema?.required, contract.required, `${name} required inputs drifted.`);
    assert.deepEqual(
      Object.keys(tool.inputSchema?.properties ?? {}).sort(),
      [...contract.properties].sort(),
      `${name} input properties drifted.`,
    );
    assert.equal(
      hasCustomUi(tool),
      false,
      `${name} unexpectedly links to a custom UI resource.`,
    );
  }

  assertSharedOrganizationSchemas(tools);
  assertContextSchema(toolByName(tools, 'query_context').inputSchema);
  assertBacklogSchema(toolByName(tools, 'update_backlog').inputSchema);
  assertWorkflowSchemas(tools);
}

export async function scanProductionMcp({
  apiKey,
  url = PUBLIC_MCP_URL,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    throw new Error('AICTRL_API_KEY is required for the authenticated production MCP scan.');
  }

  const request = createRequester({ apiKey, url, fetchImpl });
  const catalogResponse = await request('tools/list', {});
  if (catalogResponse.error) {
    throw new Error(`Production MCP tools/list returned JSON-RPC error ${catalogResponse.error.code}.`);
  }
  const tools = catalogResponse.result?.tools;
  assertProductionCatalog(tools);
  assertSafePublicPayload(tools, '$', apiKey);

  const organizations = parseToolPayload(
    await callTool(request, 'list_organizations', {}),
    'list_organizations',
  );
  assert.ok(Array.isArray(organizations.organizations), 'list_organizations did not return an organizations array.');
  assertSafePublicPayload(organizations, '$', apiKey);
  for (const organization of organizations.organizations) {
    assert.deepEqual(
      Object.keys(organization).sort(),
      ['id', 'name', 'role', 'slug'],
      'list_organizations returned fields outside the public membership contract.',
    );
    assert.equal(typeof organization.id, 'string');
    assert.equal(typeof organization.slug, 'string');
    assert.equal(typeof organization.name, 'string');
    assert.equal(typeof organization.role, 'string');
  }

  const workflows = parseToolPayload(
    await callTool(request, 'list_workflows', {}),
    'list_workflows',
  );
  assert.ok(Array.isArray(workflows.workflows), 'list_workflows did not return a workflows array.');
  for (const workflow of workflows.workflows) {
    assert.equal(typeof workflow?.organization?.id, 'string', 'A workflow omitted owning organization metadata.');
  }
  assertSafePublicPayload(workflows, '$', apiKey);

  const denied = await callTool(request, 'list_workflows', {
    organization_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(denied?.result?.isError, true, 'A non-member organization probe did not fail closed.');
  assertSafePublicPayload(denied.result, '$', apiKey);

  return { tools, organizations, workflows };
}

function assertSharedOrganizationSchemas(tools) {
  for (const tool of tools.filter((candidate) => candidate.name !== 'list_organizations')) {
    if (!Object.hasOwn(tool.inputSchema.properties, 'organization_id')) continue;
    const organization = tool.inputSchema.properties.organization_id;
    assert.equal(organization.type, 'string', `${tool.name}.organization_id must be a string.`);
    assert.equal(organization.minLength, 1, `${tool.name}.organization_id must be non-empty.`);
    assert.match(
      organization.description ?? '',
      /list_organizations/,
      `${tool.name}.organization_id must direct agents to list_organizations.`,
    );
  }
}

function assertContextSchema(schema) {
  assert.deepEqual(
    schema.properties.domain.enum,
    ['code', 'system', 'issues', 'backlog', 'skills', 'stack'],
  );
  assert.deepEqual(schema.properties.version.enum, ['v1']);
}

function assertBacklogSchema(schema) {
  assert.deepEqual(schema.properties.entity.enum, ['task']);
  assert.deepEqual(schema.properties.action.enum, ['create', 'update']);
  assert.equal(schema.properties.params.type, 'object');
  assert.equal(schema.properties.params.oneOf?.length, 2);

  const [create, update] = schema.properties.params.oneOf;
  assert.deepEqual(create.required, ['epic_id', 'title']);
  assert.deepEqual(update.required, ['task_id']);
  assert.equal(create.additionalProperties, false);
  assert.equal(update.additionalProperties, false);
  for (const actionSchema of [create, update]) {
    for (const key of ['depends_on', 'tags', 'stack_layer_ids']) {
      assert.equal(actionSchema.properties[key].type, 'array');
      assert.deepEqual(actionSchema.properties[key].items, { type: 'string', minLength: 1 });
    }
  }
}

function assertWorkflowSchemas(tools) {
  const list = toolByName(tools, 'list_workflows').inputSchema;
  assert.equal(list.properties.limit.minimum, 1);
  assert.equal(list.properties.limit.maximum, 100);

  const start = toolByName(tools, 'start_workflow').inputSchema;
  assert.equal(start.properties.idempotency_key.minLength, 8);
  assert.equal(start.properties.idempotency_key.maxLength, 200);
  assert.equal(start.properties.inputs.additionalProperties, true);

  const approve = toolByName(tools, 'approve_workflow_step').inputSchema;
  assert.deepEqual(approve.properties.decision.enum, ['approve', 'reject']);
  assert.equal(approve.properties.expected_revision.pattern, '^[0-9a-fA-F]{40}$');
  assert.equal(approve.properties.note.maxLength, 2000);

  const cancel = toolByName(tools, 'cancel_workflow_run').inputSchema;
  assert.equal(cancel.properties.reason.maxLength, 2000);
}

function toolByName(tools, name) {
  const tool = tools.find((candidate) => candidate.name === name);
  assert.ok(tool, `Production MCP catalog omitted ${name}.`);
  return tool;
}

function hasCustomUi(tool) {
  return typeof tool?._meta?.ui?.resourceUri === 'string'
    || typeof tool?._meta?.['openai/outputTemplate'] === 'string';
}

function createRequester({ apiKey, url, fetchImpl }) {
  let id = 1;
  return async (method, params) => {
    const response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2024-11-05',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Production MCP ${method} returned HTTP ${response.status}.`);
    }
    return parseMcpResponse(body, response.headers.get('content-type'));
  };
}

async function callTool(request, name, args) {
  const response = await request('tools/call', { name, arguments: args });
  if (response.error) {
    throw new Error(`Production MCP ${name} returned JSON-RPC error ${response.error.code}.`);
  }
  return response;
}

function parseToolPayload(response, name) {
  if (response?.result?.isError) {
    throw new Error(`Production MCP ${name} returned an MCP tool error.`);
  }
  const text = response?.result?.content?.find((item) => item?.type === 'text')?.text;
  if (typeof text !== 'string') {
    throw new Error(`Production MCP ${name} returned no text payload.`);
  }
  return JSON.parse(text);
}

function assertSafePublicPayload(value, path = '$', apiKey) {
  if (path === '$') {
    assert.doesNotMatch(
      JSON.stringify(value),
      /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[opsur]_[A-Za-z0-9]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|Bearer\s+[A-Za-z0-9._~-]{16,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
      'Public MCP response contained a credential-shaped value.',
    );
    if (apiKey?.length >= 12) {
      assert.equal(
        containsString(value, apiKey),
        false,
        'Public MCP response echoed the production API key.',
      );
    }
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertSafePublicPayload(child, `${path}[${index}]`, apiKey));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key
      .normalize('NFKC')
      .replaceAll(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    assert.doesNotMatch(normalizedKey, FORBIDDEN_OUTPUT_KEY_STEMS, `Sensitive key ${path}.${key} leaked.`);
    assertSafePublicPayload(child, `${path}.${key}`, apiKey);
  }
}

function containsString(value, expected) {
  if (typeof value === 'string') return value.includes(expected);
  if (Array.isArray(value)) return value.some((child) => containsString(child, expected));
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((child) => containsString(child, expected));
}

function parseMcpResponse(body, contentType = '') {
  if (!contentType?.includes('text/event-stream')) {
    return JSON.parse(body);
  }

  const messages = body
    .split(/\r?\n\r?\n/)
    .map((event) => event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n'))
    .filter((data) => data.trim() !== '')
    .map((data) => JSON.parse(data));
  const response = messages.find((message) => Object.hasOwn(message, 'id'));
  if (!response) throw new Error('Production MCP event stream contained no JSON-RPC response.');
  return response;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  scanProductionMcp({ apiKey: process.env.AICTRL_API_KEY }).then((result) => {
    console.log(
      `Production MCP smoke passed: ${result.tools.map((tool) => tool.name).join(', ')}; `
      + `${result.organizations.organizations.length} organization(s); `
      + `${result.workflows.workflows.length} workflow(s).`,
    );
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
