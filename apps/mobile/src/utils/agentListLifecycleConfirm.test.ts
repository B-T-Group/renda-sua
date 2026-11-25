import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_LIST_LIFECYCLE_CONFIRM,
  isAgentListLifecycleBusy,
} from './agentListLifecycleConfirm';

describe('AGENT_LIST_LIFECYCLE_CONFIRM', () => {
  it('covers every list-card lifecycle action with unique copy', () => {
    const keys = ['pickUp', 'startTransit', 'outForDelivery'] as const;
    const titles = new Set(keys.map((key) => AGENT_LIST_LIFECYCLE_CONFIRM[key].titleDef));
    const messages = new Set(keys.map((key) => AGENT_LIST_LIFECYCLE_CONFIRM[key].messageDef));
    expect(titles.size).toBe(keys.length);
    expect(messages.size).toBe(keys.length);
  });
});

describe('isAgentListLifecycleBusy', () => {
  it('treats a pending confirm as busy so a second home/list CTA cannot stack', () => {
    expect(isAgentListLifecycleBusy('order-a', null, 'order-a')).toBe(true);
    expect(isAgentListLifecycleBusy('order-b', null, 'order-a')).toBe(false);
  });

  it('treats an in-flight status change as busy', () => {
    expect(isAgentListLifecycleBusy('order-a', 'order-a', null)).toBe(true);
    expect(isAgentListLifecycleBusy('order-b', 'order-a', null)).toBe(false);
  });
});

describe('agent list lifecycle confirm UI', () => {
  it('uses an in-tree dialog instead of Alert.alert during render', () => {
    for (const file of ['HomeScreen.tsx', 'OrdersScreen.tsx']) {
      const src = readFileSync(join(__dirname, '../screens/agent', file), 'utf8');
      expect(src).toContain('ConfirmActionDialog');
      expect(src).not.toMatch(/Alert\.alert\(\s*cfg\./);
      expect(src).not.toMatch(/lifecycle \? \(\(\(\) =>/);
    }
  });
});

