import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProductionCatalog,
  scanProductionMcp,
} from '../scripts/smoke-production-mcp-public.mjs';
import {
  EXPECTED_PUBLIC_MCP_TOOLS,
  PUBLIC_MCP_ANNOTATIONS,
} from '../scripts/public-catalog.mjs';

function catalog() {
  // Independently authored from deployed aictrl 12a866d437dcb238f39e491f38597ea8583ece69:
  // server/mcp/{workflow-tools,code-review-public-tools,tools/code-review}.ts.
  // Do not derive fixture annotations/schemas/names from the smoke contract.
  const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const update = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
  const create = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
  const readIdempotent = { ...read, idempotentHint: true };
  const readOpenWorld = { ...read, openWorldHint: true };
  const readOpenWorldIdempotent = { ...readOpenWorld, idempotentHint: true };
  const createIdempotent = { ...create, idempotentHint: true };
  const updateOpenWorld = { ...create, destructiveHint: true };
  const updateOpenWorldIdempotent = { ...updateOpenWorld, idempotentHint: true };
  const org = { type: 'string', minLength: 1, description: 'ID from list_organizations.' };
  const reviewOrg = { type: 'string', description: 'Call list_organizations for the owning organization.' };
  const id = (description) => ({ type: 'string', minLength: 1, description });
  const repository = { type: 'object', properties: {
    full_name: { type: 'string' },
    platform: { type: 'string', enum: ['github', 'gitlab', 'bitbucket', 'azure-devops'] },
  }, required: ['full_name', 'platform'] };
  const pr = { type: 'object', properties: {
    number: { type: 'integer' }, url: { type: 'string' },
  }, required: ['number', 'url'] };
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
    definition('start_workflow', updateOpenWorldIdempotent, {
      organization_id: org,
      workflow_id: id('Workflow'),
      idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
      inputs: { type: 'object', additionalProperties: true },
      repository_id: { type: 'string' },
    }, ['organization_id', 'workflow_id', 'idempotency_key']),
    definition('list_workflow_runs', read, {
      organization_id: org,
      issue_id: { type: 'string', minLength: 1, maxLength: 200 },
      epic_id: { type: 'string', minLength: 1, maxLength: 200 },
      workflow_id: id('Workflow'),
      status: { type: 'array', minItems: 1, maxItems: 9, items: { type: 'string', enum: [
        'queued', 'running', 'pausing', 'cancelling', 'completed', 'failed', 'cancelled', 'paused', 'needs_approval',
      ] } },
      started_by: { type: 'string', minLength: 1, maxLength: 200 },
      since: { type: 'string', format: 'date-time' },
      until: { type: 'string', format: 'date-time' },
      needs_attention: { type: 'boolean' },
      cursor: { type: 'string', minLength: 1, maxLength: 2048 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    }, ['organization_id']),
    definition('get_workflow_run', read, {
      organization_id: org,
      run_id: id('Run'),
    }, ['organization_id', 'run_id']),
    definition('approve_workflow_step', update, {
      organization_id: org,
      run_id: id('Run'),
      decision: { type: 'string', enum: ['approve', 'reject'] },
      expected_revision: { type: 'string', pattern: '^[0-9a-fA-F]{40}$' },
      expected_digest: { type: 'string', pattern: '^[0-9a-fA-F]{64}$' },
      note: { type: 'string', maxLength: 2000 },
      expected_gate: { type: 'object', properties: {
        after_wave: { type: 'integer', minimum: 1 },
        gate_index: { type: 'integer', minimum: 0 },
      }, required: ['after_wave', 'gate_index'], additionalProperties: false },
    }, ['organization_id', 'run_id', 'decision', 'expected_revision']),
    definition('cancel_workflow_run', update, {
      organization_id: org,
      run_id: id('Run'),
      reason: { type: 'string', maxLength: 2000 },
    }, ['organization_id', 'run_id']),
    definition('list_tasks', readOpenWorldIdempotent, {
      organization_id: org,
      repository_full_name: id('Repository'),
    }, ['organization_id', 'repository_full_name']),
    definition('start_task', createIdempotent, {
      organization_id: org,
      task_id: id('Task'),
      pull_request: { type: 'object' },
      audience: { type: 'string' },
      idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
    }, ['organization_id', 'task_id', 'pull_request', 'idempotency_key']),
    definition('get_task_execution', readIdempotent, {
      organization_id: org,
      execution_id: id('Execution'),
    }, ['organization_id', 'execution_id']),
    definition('list_pr_findings', read, {
      organization_id: reviewOrg, repository, pr,
      include_history: { type: 'boolean' }, include_obsolete: { type: 'boolean' },
    }, ['organization_id', 'repository', 'pr']),
    definition('record_finding_verdict', updateOpenWorld, {
      organization_id: reviewOrg, repository, pr,
      finding_id: { type: 'string' },
      verdict: { type: 'string', enum: ['TRUE', 'FALSE', 'UNCERTAIN'] },
      action: { type: 'string', enum: ['FIX', 'DEFER', 'IGNORE'] },
      reason: { type: 'string' },
      reasoning: { type: 'object', properties: {
        observed: { type: 'string' }, root_cause: { type: 'string' }, proof: { type: 'string' },
      }, required: ['observed', 'root_cause', 'proof'], additionalProperties: false },
      evidence: { type: 'array', maxItems: 10, items: { type: 'object', properties: {
        file: { type: 'string', maxLength: 500 }, line: { type: 'integer', minimum: 1 },
      }, required: ['file'], additionalProperties: false } },
      judged_at_sha: { type: 'string' },
    }, ['organization_id', 'repository', 'pr', 'finding_id', 'verdict', 'reasoning', 'judged_at_sha']),
    definition('get_started', readOpenWorld, {
      intent: { type: 'string' },
    }, []),
  ];
  // This omission is present in the deployed public wrapper, not a global relaxation.
  delete definitions.find((tool) => tool.name === 'list_pr_findings').inputSchema.additionalProperties;
  return definitions;
}

function definition(name, annotations, properties, required) {
  return structuredClone({
    name,
    description: `${name} description`,
    annotations,
    inputSchema: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  });
}

function rpcResult(id, result, eventStream = false) {
  const message = { jsonrpc: '2.0', id, result };
  const serialized = JSON.stringify(message);
  const splitAt = serialized.indexOf(',"result"') + 1;
  return new Response(
    eventStream
      ? `event: message\ndata: ${serialized.slice(0, splitAt)}\ndata: ${serialized.slice(splitAt)}\n\n`
      : serialized,
    { status: 200, headers: { 'content-type': eventStream ? 'text/event-stream' : 'application/json' } },
  );
}

test('accepts exactly the public catalog with approved schemas and safety annotations', () => {
  assert.deepEqual(
    Object.keys(PUBLIC_MCP_ANNOTATIONS),
    ['read', 'update', 'readIdempotent', 'readOpenWorld', 'readOpenWorldIdempotent', 'create', 'createIdempotent', 'updateOpenWorld', 'updateOpenWorldIdempotent'],
  );
  assert.equal(catalog().length, 16);
  assert.doesNotThrow(() => assertProductionCatalog(catalog()));

  const reordered = catalog().reverse();
  reordered[0].inputSchema.properties = Object.fromEntries(
    Object.entries(reordered[0].inputSchema.properties).reverse(),
  );
  assert.doesNotThrow(() => assertProductionCatalog(reordered));
});

for (const name of ['list_workflow_runs', 'list_pr_findings', 'record_finding_verdict']) {
  test(`rejects missing public tool ${name}`, () => {
    assert.throws(() => assertProductionCatalog(catalog().filter((tool) => tool.name !== name)), /public catalog contract/);
  });
}

const schemaMutations = [
  ['list_workflow_runs', (s) => { s.required = []; }],
  ['list_workflow_runs', (s) => { delete s.properties.organization_id; }],
  ['list_workflow_runs', (s) => { s.properties.organization_id.type = 'number'; }],
  ['list_workflow_runs', (s) => { delete s.properties.organization_id.minLength; }],
  ['list_workflow_runs', (s) => { s.properties.organization_id.description = 'An arbitrary tenant'; }],
  ['list_workflow_runs', (s) => { s.properties.status.items.enum.pop(); }],
  ['list_workflow_runs', (s) => { s.properties.limit.maximum = 1000; }],
  ['list_workflow_runs', (s) => { s.properties.cursor.maxLength = 10000; }],
  ['list_pr_findings', (s) => { s.additionalProperties = true; }],
  ['list_pr_findings', (s) => { s.additionalProperties = false; }],
  ['list_pr_findings', (s) => { s.properties.organization_id.minLength = 1; }],
  ['list_pr_findings', (s) => { s.required.shift(); }],
  ['list_pr_findings', (s) => { s.properties.repository.properties.platform.enum = ['github']; }],
  ['record_finding_verdict', (s) => { delete s.additionalProperties; }],
  ['record_finding_verdict', (s) => { s.properties.organization_id.type = 'number'; }, /record_finding_verdict\.organization_id/],
  ['record_finding_verdict', (s) => { s.properties.organization_id.description = ''; }, /record_finding_verdict\.organization_id/],
  ['record_finding_verdict', (s) => { s.properties.organization_id.minLength = 1; }, /record_finding_verdict\.organization_id/],
  ['record_finding_verdict', (s) => { s.properties.verdict.enum.push('MAYBE'); }],
  ['record_finding_verdict', (s) => { s.properties.reasoning.required.pop(); }],
  ['record_finding_verdict', (s) => { s.properties.evidence.items.additionalProperties = true; }],
  ['start_workflow', (s) => { s.properties.repository_id.type = 'number'; }],
  ['approve_workflow_step', (s) => { s.properties.expected_digest.pattern = '.*'; }],
  ['approve_workflow_step', (s) => { s.properties.expected_gate.additionalProperties = true; }],
  ['get_workflow', (s) => { delete s.properties.organization_id.minLength; }, /get_workflow\.organization_id/],
  ['get_workflow', (s) => { delete s.additionalProperties; }],
];
for (const [index, [name, mutate, message]] of schemaMutations.entries()) {
  test(`rejects schema drift ${index + 1} in ${name}`, () => {
    const tools = catalog();
    mutate(tools.find((tool) => tool.name === name).inputSchema);
    assert.throws(() => assertProductionCatalog(tools), message);
  });
}

for (const description of [{ type: 'string' }, false]) {
  test(`rejects a nested input property named description: ${JSON.stringify(description)}`, () => {
    const tools = catalog();
    tools.find((tool) => tool.name === 'record_finding_verdict')
      .inputSchema.properties.reasoning.properties.description = description;
    assert.throws(() => assertProductionCatalog(tools), /record_finding_verdict schema drifted/);
  });
}

for (const [name, change] of [
  ['list_workflow_runs', { readOnlyHint: false }],
  ['list_pr_findings', { destructiveHint: true }],
  ['record_finding_verdict', { readOnlyHint: true }],
  ['record_finding_verdict', { destructiveHint: false }],
  ['start_workflow', { destructiveHint: false }],
  ['record_finding_verdict', { openWorldHint: false }],
  ['record_finding_verdict', { idempotentHint: true }],
]) {
  test(`rejects unsafe or invented annotations on ${name}: ${JSON.stringify(change)}`, () => {
    const tools = catalog();
    const tool = tools.find((candidate) => candidate.name === name);
    tool.annotations = { ...tool.annotations, ...change };
    assert.throws(() => assertProductionCatalog(tools), /annotations drifted/);
  });
}

test('rejects catalog, schema, annotation, description, and custom-UI drift', () => {
  const extra = catalog();
  extra.push(extra.find((tool) => tool.name === 'query_context'));
  assert.throws(() => assertProductionCatalog(extra), /public catalog contract/);
  const unknown = [...catalog(), definition('unexpected_write', { readOnlyHint: false }, {}, [])];
  assert.throws(() => assertProductionCatalog(unknown), /public catalog contract/);

  const schema = catalog();
  schema.find((tool) => tool.name === 'list_workflows').inputSchema.required = ['organization_id'];
  assert.throws(() => assertProductionCatalog(schema), /required inputs drifted/);

  const annotation = catalog();
  const workflowRun = annotation.find((tool) => tool.name === 'get_workflow_run');
  workflowRun.annotations = { ...workflowRun.annotations, readOnlyHint: false };
  assert.throws(() => assertProductionCatalog(annotation), /annotations drifted/);

  const description = catalog();
  description.find((tool) => tool.name === 'query_context').description = '';
  assert.throws(() => assertProductionCatalog(description), /empty description/);

  const ui = catalog();
  ui.find((tool) => tool.name === 'query_context')._meta = { 'openai/outputTemplate': 'ui://unexpected' };
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
          organizations: [{ role: 'admin', name: 'Fixture', slug: 'fixture', id: 'org-1' }],
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
  assert.equal(result.tools.length, EXPECTED_PUBLIC_MCP_TOOLS.length);
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

  call = 0;
  await assert.rejects(
    () => scanProductionMcp({
      apiKey: 'secret',
      fetchImpl: async () => {
        call += 1;
        if (call === 1) return rpcResult(1, { tools: catalog() });
        return rpcResult(call, {
          content: [{ type: 'text', text: JSON.stringify({
            organizations: [{
              id: 'org-1',
              slug: 'fixture',
              name: 'Fixture',
              role: 'admin',
              'ＡＰＩＫＥＹ': 'opaque-value',
            }],
          }) }],
        });
      },
    }),
    /Sensitive key/,
  );

  const leakingCatalog = catalog();
  leakingCatalog[0].description = 'Example Authorization: Bearer abcdefghijklmnopqrstuvwxyz';
  await assert.rejects(
    () => scanProductionMcp({
      apiKey: 'secret',
      fetchImpl: async () => rpcResult(1, { tools: leakingCatalog }),
    }),
    /credential-shaped value/,
  );

  for (const credential of [
    ['ghr', 'abcdefghijklmnopqrstuvwxyz123456'].join('_'),
    ['eyJabcdefghijklmno', 'abcdefghijklmnop', 'abcdefghijklmnop'].join('.'),
  ]) {
    const catalogWithCredential = catalog();
    catalogWithCredential[0].description = `Unsafe example ${credential}`;
    await assert.rejects(
      () => scanProductionMcp({
        apiKey: 'secret',
        fetchImpl: async () => rpcResult(1, { tools: catalogWithCredential }),
      }),
      /credential-shaped value/,
    );
  }

  const catalogEchoingKey = catalog();
  catalogEchoingKey[0].description = 'exact-production-key';
  await assert.rejects(
    () => scanProductionMcp({
      apiKey: 'exact-production-key',
      fetchImpl: async () => rpcResult(1, { tools: catalogEchoingKey }),
    }),
    /echoed the production API key/,
  );
});
