import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { evaluateToolPolicy } from '../src/agent/tool-policy';
import type { ToolPolicyConfig } from '../src/agent/pi-types';

describe('agents tool policy', () => {
  test('applies layered allow/deny with provider/model overrides', () => {
    const policy: ToolPolicyConfig = {
      global: {
        allow: ['read_file', 'write_file', 'run_terminal_command', 'git_status'],
      },
      providers: {
        google: {
          deny: ['run_terminal_command'],
        },
      },
      models: {
        'gemini-2.5-pro': {
          rules: [{ effect: 'allow', tools: ['run_terminal_command'] }],
        },
      },
      session: {
        deny: ['git_status'],
      },
    };

    const decision = evaluateToolPolicy(
      ['read_file', 'write_file', 'run_terminal_command', 'git_status'],
      'google',
      'gemini-2.5-pro',
      policy,
    );

    assert.deepEqual(
      decision.allowedToolNames.sort(),
      ['read_file', 'run_terminal_command', 'write_file'],
    );
    assert.equal(decision.blockedTools.some((tool) => tool.name === 'git_status'), true);
  });

  test('expands named groups in allow and deny lists', () => {
    const policy: ToolPolicyConfig = {
      groups: {
        safe: ['read_file', 'search_files'],
      },
      global: {
        allow: ['safe', 'run_terminal_command'],
      },
      session: {
        deny: ['run_terminal_command'],
      },
    };

    const decision = evaluateToolPolicy(
      ['read_file', 'search_files', 'run_terminal_command', 'write_file'],
      'google',
      'gemini-3-flash-preview',
      policy,
    );

    assert.deepEqual(decision.allowedToolNames.sort(), ['read_file', 'search_files']);
    assert.equal(decision.blockedTools.some((tool) => tool.name === 'write_file'), true);
  });
});
