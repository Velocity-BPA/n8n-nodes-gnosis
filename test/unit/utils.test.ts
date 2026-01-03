/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  encodeFunctionSignature,
  encodeAddress,
  encodeUint256,
  encodeBytes32,
  decodeAddress,
  decodeUint256,
  decodeBool,
  formatWeiAmount,
  parseAmount,
} from '../../nodes/GnosisChain/utils';

describe('Utils', () => {
  describe('encodeFunctionSignature', () => {
    it('should encode function signatures correctly', () => {
      // transfer(address,uint256) = 0xa9059cbb
      const result = encodeFunctionSignature('transfer(address,uint256)');
      expect(result).toBe('0xa9059cbb');
    });

    it('should encode balanceOf correctly', () => {
      // balanceOf(address) = 0x70a08231
      const result = encodeFunctionSignature('balanceOf(address)');
      expect(result).toBe('0x70a08231');
    });
  });

  describe('encodeAddress', () => {
    it('should pad address to 32 bytes', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f3E8f1';
      const result = encodeAddress(address);
      expect(result).toHaveLength(64);
      expect(result).toBe('000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f3e8f1');
    });
  });

  describe('encodeUint256', () => {
    it('should encode uint256 values', () => {
      expect(encodeUint256('0')).toBe('0'.repeat(64));
      expect(encodeUint256('1')).toBe('0'.repeat(63) + '1');
      expect(encodeUint256('255')).toBe('0'.repeat(62) + 'ff');
    });

    it('should handle large numbers', () => {
      const result = encodeUint256('1000000000000000000');
      expect(result).toHaveLength(64);
    });
  });

  describe('encodeBytes32', () => {
    it('should pad bytes32 values', () => {
      const result = encodeBytes32('0x1234');
      expect(result).toHaveLength(64);
      expect(result.startsWith('1234')).toBe(true);
    });
  });

  describe('decodeAddress', () => {
    it('should decode padded address', () => {
      const encoded = '000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f3e8f1';
      const result = decodeAddress(encoded);
      expect(result).toBe('0x742d35cc6634c0532925a3b844bc9e7595f3e8f1');
    });
  });

  describe('decodeUint256', () => {
    it('should decode uint256 values', () => {
      expect(decodeUint256('0'.repeat(64))).toBe('0');
      expect(decodeUint256('0'.repeat(63) + '1')).toBe('1');
      expect(decodeUint256('0'.repeat(62) + 'ff')).toBe('255');
    });
  });

  describe('decodeBool', () => {
    it('should decode boolean values', () => {
      expect(decodeBool('0'.repeat(64))).toBe(false);
      expect(decodeBool('0'.repeat(63) + '1')).toBe(true);
    });
  });

  describe('formatWeiAmount', () => {
    it('should format wei to readable amount', () => {
      expect(formatWeiAmount('1000000000000000000', 18)).toBe('1');
      expect(formatWeiAmount('1000000', 6)).toBe('1');
    });
  });

  describe('parseAmount', () => {
    it('should parse amount to wei', () => {
      expect(parseAmount('1', 18)).toBe('1000000000000000000');
      expect(parseAmount('1', 6)).toBe('1000000');
    });
  });
});
