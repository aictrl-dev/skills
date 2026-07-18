import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProductionCatalog,
  scanProductionMcp,
} from '../scripts/smoke-production-mcp.mjs';
import { EXPECTED_PUBLIC_MCP_TOOLS } from '../scripts/public-catalog.mjs';

function catalog() {
  const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const update = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };
  const create = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
  const org = { type: 'string', minLength: 1, description: 'ID from list_organizations.' };
  const id = (description) => ({ type: 'string', minLength: 1, description });
  const array = { type: 'array', items: { type: 'string', minLength: 1 } };
  const createParams = {
    type: 'object',
    properties: {
      epic_id: id('Epic'),
      title: id('Title'),
      description: { type: 'string' },
      type: { type: 'string', enum: ['story', 'bug', 'spike'] },
      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
      depends_on: array,
      tags: array,
      stack_layer_ids: array,
    },
    required: ['epic_id', 'title'],
    additionalProperties: false,
  };
  const updateParams = {
    type: 'object',
    properties: {
      task_id: id('Task'),
      title: id('Title'),
      description: { type: 'string' },
      type: { type: 'string', enum: ['story', 'bug', 'spike'] },
      status: { type: 'string', enum: ['draft', 'ready', 'active', 'review', 'done', 'blocked', 'cancelled'] },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
      depends_on: array,
      tags: array,
      stack_layer_ids: array,
    },
    required: ['task_id'],
    additionalProperties: false,
  };

  const definitions = [
    definition('query_context', read, {
      organization_id: org,
      domain: { type: 'string', enum: ['code', 'system', 'issues', 'backlog', 'skills', 'stack'] },
      action: { type: 'string' },
      query: { type: 'string' },
      params: { type: 'object' },
      version: { type: 'string', enum: ['v1'] },
    }, ['organization_id', 'domain', 'action']),
    definition('update_backlog', update, {
      organization_id: org,
      entity: { type: 'string', enum: ['task'] },
      action: { type: 'string', enum: ['create', 'update'] },
      params: { type: 'object', oneOf: [createParams, updateParams] },
      version: { type: 'string', enum: ['v1'] },
    }, ['organization_id', 'entity', 'action', 'params']),
    definition('list_organizations', read, {}, []),
    definition('list_workflows', read, {
      organization_id: org,
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }, []),
    definition('get_workflow', read, {
      organization_id: org,
      workflow_id: id('Workflow'),
    }, ['organization_id', 'workflow_id']),
    definition('start_workflow', create, {
      organization_id: org,
      workflow_id: id('Workflow'),
      idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
      inputs: { type: 'object', additionalProperties: true },
    }, ['organization_id', 'workflow_id', 'idempotency_key']),
    definition('get_workflow_run', read, {
      organization_id: org,
      run_id: id('Run'),
    }, ['organization_id', 'run_id']),
    definition('approve_workflow_step', update, {
      organization_id: org,
      run_id: id('Run'),
      decision: { type: 'string', enum: ['approve', 'reject'] },
      expected_revision: { type: 'string', pattern: '^[0-9a-fA-F]{40}$' },
      note: { type: 'string', maxLength: 2000 },
    }, ['organization_id', 'run_id', 'decision', 'expected_revision']),
    definition('cancel_workflow_run', update, {
      organization_id: org,
      run_id: id('Run'),
      reason: { type: 'string', maxLength: 2000 },
    }, ['organization_id', 'run_id']),
  ];
  assert.deepEqual(definitions.map((tool) => tool.name), EXPECTED_PUBLIC_MCP_TOOLS);
  return definitions;
}

function definition(name, annotations, properties, required) {
  return {
    name,
    description: `${name} description`,
    annotations,
    inputSchema: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  };
}

function rpcResult(id, result, eventStream = false) {
  const message = { jsonrpc: '2.0', id, result };
  return new Response(
    eventStream ? `event: message\ndata: ${JSON.stringify(message)}\n\n` : JSON.stringify(message),
    { status: 200, headers: { 'content-type': eventStream ? 'text/event-stream' : 'application/json' } },
  );
}

test('accepts exactly nine tools with approved schemas and safety annotations', () => {
  assert.doesNotThrow(() => assertProductionCatalog(catalog()));
});

test('rejects catalog, schema, annotation, description, and custom-UI drift', () => {
  const extra = [...catalog(), catalog()[0]];
  assert.throws(() => assertProductionCatalog(extra), /exact-nine/);

  const schema = catalog();
  schema[3].inputSchema.required = ['organization_id'];
  assert.throws(() => assertProductionCatalog(schema), /required inputs drifted/);

  const annotation = catalog();
  annotation[6].annotations = { ...annotation[6].annotations, readOnlyHint: false };
  assert.throws(() => assertProductionCatalog(annotation), /annotations drifted/);

  const description = catalog();
  description[0].description = '';
  assert.throws(() => assertProductionCatalog(description), /empty description/);

  const ui = catalog();
  ui[0]._meta = { 'openai/outputTemplate': 'ui://unexpected' };
  assert.throws(() => assertProductionCatalog(ui), /custom UI/);
});

test('runs authenticated organization, no-org workflow, and fail-closed probes', async () => {
  const tools = catalog();
  const requests = [];
  const fetchImpl = async (_url, init) => {
    assert.equal(init.headers['X-API-Key'], 'secret-key');
    assert.doesNotMatch(String(init.body), /secret-key/);
    const request = JSON.parse(String(init.body));
    requests.push(request);
    if (request.method === 'tools/list') return rpcResult(request.id, { tools }, true);

    const name = request.params.name;
    if (name === 'list_organizations') {
      return rpcResult(request.id, {
        content: [{ type: 'text', text: JSON.stringify({
          organizations: [{ id: 'org-1', slug: 'fixture', name: 'Fixture', role: 'admin' }],
        }) }],
      });
    }
    if (name === 'list_workflows' && Object.hasOwn(request.params.arguments, 'organization_id')) {
      return rpcResult(request.id, {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: 'not_found' }) }],
      });
    }
    return rpcResult(request.id, {
      content: [{ type: 'text', text: JSON.stringify({
        workflows: [{ id: 'wf-1', organization: { id: 'org-1', slug: 'fixture', name: 'Fixture' } }],
      }) }],
    });
  };

  const result = await scanProductionMcp({ apiKey: 'secret-key', fetchImpl });
  assert.equal(result.tools.length, 9);
  assert.equal(result.organizations.organizations.length, 1);
  assert.equal(result.workflows.workflows.length, 1);
  assert.deepEqual(
    requests.map((request) => [request.method, request.params?.name]),
    [
      ['tools/list', undefined],
      ['tools/call', 'list_organizations'],
      ['tools/call', 'list_workflows'],
      ['tools/call', 'list_workflows'],
    ],
  );
  assert.deepEqual(requests[2].params.arguments, {});
});

test('fails closed without authentication, on HTTP rejection, and on sensitive output', async () => {
  await assert.rejects(() => scanProductionMcp(), /AICTRL_API_KEY is required/);
  await assert.rejects(
    () => scanProductionMcp({
      apiKey: 'invalid',
      fetchImpl: async () => new Response('unauthorized', { status: 401 }),
    }),
    /HTTP 401/,
  );

  let call = 0;
  await assert.rejects(
    () => scanProductionMcp({
      apiKey: 'secret',
      fetchImpl: async () => {
        call += 1;
        if (call === 1) return rpcResult(1, { tools: catalog() });
        return rpcResult(call, {
          content: [{ type: 'text', text: JSON.stringify({
            organizations: [{ id: 'org-1', installationToken: 'leak' }],
          }) }],
        });
      },
    }),
    /Sensitive key/,
  );
});
