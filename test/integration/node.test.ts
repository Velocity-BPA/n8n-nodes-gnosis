/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { GnosisChain } from '../../nodes/GnosisChain/GnosisChain.node';
import { GnosisChainTrigger } from '../../nodes/GnosisChain/GnosisChainTrigger.node';

describe('GnosisChain Node', () => {
  let node: GnosisChain;

  beforeEach(() => {
    node = new GnosisChain();
  });

  describe('Node Description', () => {
    it('should have correct display name', () => {
      expect(node.description.displayName).toBe('Gnosis Chain');
    });

    it('should have correct name', () => {
      expect(node.description.name).toBe('gnosisChain');
    });

    it('should have icon', () => {
      expect(node.description.icon).toBe('file:gnosischain.svg');
    });

    it('should require credentials', () => {
      expect(node.description.credentials).toHaveLength(1);
      expect(node.description.credentials?.[0].name).toBe('gnosisChainApi');
    });

    it('should have all 11 resources', () => {
      const resourceProperty = node.description.properties.find(
        (p) => p.name === 'resource',
      );
      expect(resourceProperty).toBeDefined();
      expect(resourceProperty?.options).toHaveLength(11);
    });

    it('should include all expected resources', () => {
      const resourceProperty = node.description.properties.find(
        (p) => p.name === 'resource',
      );
      const resourceValues = resourceProperty?.options?.map((o) => (o as { value: string }).value);
      
      expect(resourceValues).toContain('accounts');
      expect(resourceValues).toContain('transactions');
      expect(resourceValues).toContain('blocks');
      expect(resourceValues).toContain('staking');
      expect(resourceValues).toContain('smartContracts');
      expect(resourceValues).toContain('tokens');
      expect(resourceValues).toContain('nfts');
      expect(resourceValues).toContain('bridge');
      expect(resourceValues).toContain('network');
      expect(resourceValues).toContain('events');
      expect(resourceValues).toContain('utility');
    });
  });
});

describe('GnosisChainTrigger Node', () => {
  let trigger: GnosisChainTrigger;

  beforeEach(() => {
    trigger = new GnosisChainTrigger();
  });

  describe('Trigger Description', () => {
    it('should have correct display name', () => {
      expect(trigger.description.displayName).toBe('Gnosis Chain Trigger');
    });

    it('should have correct name', () => {
      expect(trigger.description.name).toBe('gnosisChainTrigger');
    });

    it('should be a polling trigger', () => {
      expect(trigger.description.polling).toBe(true);
    });

    it('should have trigger type options', () => {
      const triggerTypeProperty = trigger.description.properties.find(
        (p) => p.name === 'triggerType',
      );
      expect(triggerTypeProperty).toBeDefined();
      expect(triggerTypeProperty?.options?.length).toBeGreaterThan(0);
    });

    it('should include all 6 trigger types', () => {
      const triggerTypeProperty = trigger.description.properties.find(
        (p) => p.name === 'triggerType',
      );
      const triggerValues = triggerTypeProperty?.options?.map((o) => (o as { value: string }).value);
      
      expect(triggerValues).toContain('newBlock');
      expect(triggerValues).toContain('newTransactionToAddress');
      expect(triggerValues).toContain('tokenTransfer');
      expect(triggerValues).toContain('contractEvent');
      expect(triggerValues).toContain('bridgeTransaction');
      expect(triggerValues).toContain('largeTransaction');
    });
  });
});
