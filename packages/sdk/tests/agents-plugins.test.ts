import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  registerTool,
  listRegisteredTools,
  clearRegisteredTools,
  registerService,
  listRegisteredServices,
  clearRegisteredServices,
} from '../src/agents';

describe('agents plugin registry', () => {
  test('registerTool and unregister callback manage global tools', () => {
    clearRegisteredTools();

    const unregister = registerTool({
      name: 'lookup_order',
      description: 'Find an order by id',
      parameters: {
        orderId: { type: 'string', required: true },
      },
    });

    assert.equal(listRegisteredTools().length, 1);
    assert.equal(listRegisteredTools()[0]?.name, 'lookup_order');

    unregister();
    assert.equal(listRegisteredTools().length, 0);
  });

  test('registerService and unregister callback manage plugin services', () => {
    clearRegisteredServices();

    const unregister = registerService({
      name: 'metrics',
      start: () => undefined,
      stop: () => undefined,
    });

    assert.equal(listRegisteredServices().length, 1);
    assert.equal(listRegisteredServices()[0]?.name, 'metrics');

    unregister();
    assert.equal(listRegisteredServices().length, 0);
  });
});
