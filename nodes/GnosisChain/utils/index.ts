/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { keccak256 as keccak256Impl } from 'js-sha3';

export function keccak256(data: string): string {
	// Proper Ethereum keccak256 implementation
	return '0x' + keccak256Impl(data);
}

export function encodeFunctionSignature(signature: string): string {
	// Get the first 4 bytes (8 hex chars) of the keccak256 hash
	const hash = keccak256(signature);
	return hash.slice(0, 10);
}

export function encodeAddress(address: string): string {
	// Pad address to 32 bytes
	const cleanAddress = address.toLowerCase().replace('0x', '');
	return cleanAddress.padStart(64, '0');
}

export function encodeUint256(value: string | number | bigint): string {
	const bigValue = BigInt(value);
	return bigValue.toString(16).padStart(64, '0');
}

export function encodeBytes32(value: string): string {
	const cleanValue = value.replace('0x', '');
	return cleanValue.padEnd(64, '0');
}

export function decodeAddress(data: string): string {
	const cleanData = data.replace('0x', '');
	return '0x' + cleanData.slice(-40);
}

export function decodeUint256(data: string): string {
	const cleanData = data.replace('0x', '');
	return BigInt('0x' + cleanData).toString();
}

export function decodeBool(data: string): boolean {
	const cleanData = data.replace('0x', '');
	return BigInt('0x' + cleanData) !== BigInt(0);
}

export function decodeString(data: string): string {
	const cleanData = data.replace('0x', '');
	// String encoding: first 32 bytes = offset, next 32 bytes = length, then data
	const offset = parseInt(cleanData.slice(0, 64), 16) * 2;
	const length = parseInt(cleanData.slice(offset, offset + 64), 16);
	const stringData = cleanData.slice(offset + 64, offset + 64 + length * 2);
	
	let result = '';
	for (let i = 0; i < stringData.length; i += 2) {
		const charCode = parseInt(stringData.slice(i, i + 2), 16);
		if (charCode !== 0) {
			result += String.fromCharCode(charCode);
		}
	}
	return result;
}

export function encodeCallData(functionSignature: string, params: string[]): string {
	const selector = encodeFunctionSignature(functionSignature);
	const encodedParams = params.join('');
	return selector + encodedParams;
}

export function formatTimestamp(timestamp: string | number): string {
	const ts = typeof timestamp === 'string' ? parseInt(timestamp, 16) : timestamp;
	return new Date(ts * 1000).toISOString();
}

export function parseTopics(topics: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	topics.forEach((topic, index) => {
		result[`topic${index}`] = topic;
	});
	return result;
}

export interface TransactionData {
	to: string;
	value?: string;
	data?: string;
	gas?: string;
	gasPrice?: string;
	nonce?: string;
}

export function buildTransactionObject(params: {
	to: string;
	value?: string;
	data?: string;
	gas?: string;
	gasPrice?: string;
	nonce?: number;
	from?: string;
}): TransactionData {
	const tx: TransactionData = {
		to: params.to,
	};

	if (params.value) {
		tx.value = params.value.startsWith('0x') ? params.value : '0x' + BigInt(params.value).toString(16);
	}

	if (params.data) {
		tx.data = params.data;
	}

	if (params.gas) {
		tx.gas = params.gas.startsWith('0x') ? params.gas : '0x' + BigInt(params.gas).toString(16);
	}

	if (params.gasPrice) {
		tx.gasPrice = params.gasPrice.startsWith('0x') ? params.gasPrice : '0x' + BigInt(params.gasPrice).toString(16);
	}

	if (params.nonce !== undefined) {
		tx.nonce = '0x' + params.nonce.toString(16);
	}

	return tx;
}

export function parseLogEntry(log: Record<string, unknown>): Record<string, unknown> {
	return {
		address: log.address as string,
		topics: log.topics as string[],
		data: log.data as string,
		blockNumber: parseInt(log.blockNumber as string, 16),
		transactionHash: log.transactionHash as string,
		transactionIndex: parseInt(log.transactionIndex as string, 16),
		blockHash: log.blockHash as string,
		logIndex: parseInt(log.logIndex as string, 16),
		removed: log.removed as boolean,
	};
}

export function formatWeiAmount(wei: string, decimals: number = 18): string {
	const weiValue = BigInt(wei);
	const divisor = BigInt(10 ** decimals);
	const wholePart = weiValue / divisor;
	const fractionalPart = weiValue % divisor;
	
	if (fractionalPart === BigInt(0)) {
		return wholePart.toString();
	}
	
	const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
	return `${wholePart}.${fractionalStr}`;
}

export function parseAmount(amount: string, decimals: number = 18): string {
	if (amount.includes('.')) {
		const [whole, fraction] = amount.split('.');
		const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
		return BigInt(whole + paddedFraction).toString();
	}
	return (BigInt(amount) * BigInt(10 ** decimals)).toString();
}
