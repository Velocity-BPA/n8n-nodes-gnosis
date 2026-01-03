/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  hexToDecimal,
  weiToXDai,
  xDaiToWei,
  gweiToWei,
  weiToGwei,
  isValidAddress,
  isValidTxHash,
  formatAddress,
  formatBlockNumber,
} from '../../nodes/GnosisChain/transport';

describe('Transport Layer', () => {
  describe('hexToDecimal', () => {
    it('should convert hex string to decimal string', () => {
      expect(hexToDecimal('0x64')).toBe('100');
      expect(hexToDecimal('0x0')).toBe('0');
      expect(hexToDecimal('0xff')).toBe('255');
    });

    it('should handle hex without 0x prefix', () => {
      expect(hexToDecimal('0x64')).toBe('100');
    });
  });

  describe('weiToXDai', () => {
    it('should convert wei to xDai', () => {
      expect(weiToXDai('1000000000000000000')).toBe('1');
      expect(weiToXDai('500000000000000000')).toBe('0.5');
      expect(weiToXDai('0')).toBe('0');
    });

    it('should handle large values', () => {
      expect(weiToXDai('1000000000000000000000')).toBe('1000');
    });
  });

  describe('xDaiToWei', () => {
    it('should convert xDai to wei', () => {
      expect(xDaiToWei('1')).toBe('1000000000000000000');
      expect(xDaiToWei('0.5')).toBe('500000000000000000');
    });

    it('should handle decimal values', () => {
      expect(xDaiToWei('0.001')).toBe('1000000000000000');
    });
  });

  describe('gweiToWei', () => {
    it('should convert gwei to wei', () => {
      expect(gweiToWei('1')).toBe('1000000000');
      expect(gweiToWei('10')).toBe('10000000000');
    });
  });

  describe('weiToGwei', () => {
    it('should convert wei to gwei', () => {
      expect(weiToGwei('1000000000')).toBe('1');
      expect(weiToGwei('10000000000')).toBe('10');
    });
  });

  describe('isValidAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f3E8f1')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('not-an-address')).toBe(false);
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f3E8f1')).toBe(false);
    });
  });

  describe('isValidTxHash', () => {
    it('should validate correct transaction hashes', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(64))).toBe(true);
      expect(isValidTxHash('0x' + '0'.repeat(64))).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidTxHash('0x123')).toBe(false);
      expect(isValidTxHash('not-a-hash')).toBe(false);
      expect(isValidTxHash('')).toBe(false);
    });
  });

  describe('formatAddress', () => {
    it('should lowercase addresses', () => {
      expect(formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f3E8f1')).toBe(
        '0x742d35cc6634c0532925a3b844bc9e7595f3e8f1',
      );
    });
  });

  describe('formatBlockNumber', () => {
    it('should return special values as-is', () => {
      expect(formatBlockNumber('latest')).toBe('latest');
      expect(formatBlockNumber('earliest')).toBe('earliest');
      expect(formatBlockNumber('pending')).toBe('pending');
    });

    it('should convert numbers to hex', () => {
      expect(formatBlockNumber('100')).toBe('0x64');
      expect(formatBlockNumber('0')).toBe('0x0');
    });

    it('should pass through hex values', () => {
      expect(formatBlockNumber('0x64')).toBe('0x64');
    });
  });
});
