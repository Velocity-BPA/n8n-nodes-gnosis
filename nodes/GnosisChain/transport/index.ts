/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, ILoadOptionsFunctions, IHttpRequestMethods } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { GNOSIS_NETWORKS } from '../constants';

export interface JsonRpcRequest {
	jsonrpc: string;
	method: string;
	params: unknown[];
	id: number;
}

export interface JsonRpcResponse<T = unknown> {
	jsonrpc: string;
	id: number;
	result?: T;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

export interface GnosisCredentials {
	network: 'mainnet' | 'chiado';
	rpcEndpoint: string;
	privateKey: string;
	gnosisscanApiKey: string;
}

let requestId = 1;

export function getNextRequestId(): number {
	return requestId++;
}

export function getRpcEndpoint(credentials: GnosisCredentials): string {
	if (credentials.rpcEndpoint && credentials.rpcEndpoint.trim() !== '') {
		return credentials.rpcEndpoint;
	}
	const network = credentials.network || 'mainnet';
	return GNOSIS_NETWORKS[network].rpcUrl;
}

export function getExplorerApiUrl(credentials: GnosisCredentials): string {
	const network = credentials.network || 'mainnet';
	return GNOSIS_NETWORKS[network].explorerApiUrl;
}

export async function jsonRpcRequest<T>(
	rpcEndpoint: string,
	method: string,
	params: unknown[] = [],
): Promise<T> {
	const requestBody: JsonRpcRequest = {
		jsonrpc: '2.0',
		method,
		params,
		id: getNextRequestId(),
	};

	const response = await fetch(rpcEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	const jsonRpcResponse = await response.json() as JsonRpcResponse<T>;

	if (jsonRpcResponse.error) {
		throw new Error(`JSON-RPC Error (${jsonRpcResponse.error.code}): ${jsonRpcResponse.error.message}`);
	}

	return jsonRpcResponse.result as T;
}

// Method version for use with IExecuteFunctions context
export async function jsonRpcRequestWithContext<T>(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	params: unknown[] = [],
): Promise<T> {
	const credentials = await this.getCredentials('gnosisChainApi') as GnosisCredentials;
	const rpcEndpoint = getRpcEndpoint(credentials);

	const requestBody: JsonRpcRequest = {
		jsonrpc: '2.0',
		method,
		params,
		id: getNextRequestId(),
	};

	const response = await this.helpers.httpRequest({
		method: 'POST' as IHttpRequestMethods,
		url: rpcEndpoint,
		headers: {
			'Content-Type': 'application/json',
		},
		body: requestBody,
		json: true,
	});

	const jsonRpcResponse = response as JsonRpcResponse<T>;

	if (jsonRpcResponse.error) {
		throw new NodeApiError(this.getNode(), {
			message: jsonRpcResponse.error.message,
			description: `JSON-RPC Error (${jsonRpcResponse.error.code}): ${jsonRpcResponse.error.message}`,
		});
	}

	return jsonRpcResponse.result as T;
}

export async function explorerApiRequest<T>(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	params: Record<string, string>,
): Promise<T> {
	const credentials = await this.getCredentials('gnosisChainApi') as GnosisCredentials;
	const explorerApiUrl = getExplorerApiUrl(credentials);

	const queryParams: Record<string, string> = { ...params };
	if (credentials.gnosisscanApiKey) {
		queryParams.apikey = credentials.gnosisscanApiKey;
	}

	const response = await this.helpers.httpRequest({
		method: 'GET' as IHttpRequestMethods,
		url: explorerApiUrl,
		qs: queryParams,
		json: true,
	});

	if (response.status === '0' && response.message !== 'No transactions found') {
		throw new NodeApiError(this.getNode(), {
			message: response.message || 'Explorer API Error',
			description: response.result || 'Unknown error occurred',
		});
	}

	return response as T;
}

export function hexToDecimal(hex: string): string {
	if (!hex || hex === '0x') return '0';
	return BigInt(hex).toString();
}

export function decimalToHex(decimal: string | number): string {
	return '0x' + BigInt(decimal).toString(16);
}

export function weiToXDai(wei: string): string {
	const weiValue = BigInt(wei);
	const xDaiValue = Number(weiValue) / 1e18;
	return xDaiValue.toString();
}

export function xDaiToWei(xDai: string | number): string {
	const xDaiValue = typeof xDai === 'string' ? parseFloat(xDai) : xDai;
	return BigInt(Math.floor(xDaiValue * 1e18)).toString();
}

export function gweiToWei(gwei: string | number): string {
	const gweiValue = typeof gwei === 'string' ? parseFloat(gwei) : gwei;
	return BigInt(Math.floor(gweiValue * 1e9)).toString();
}

export function weiToGwei(wei: string): string {
	const weiValue = BigInt(wei);
	return (Number(weiValue) / 1e9).toString();
}

export function isValidAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidTxHash(hash: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function formatAddress(address: string): string {
	return address.toLowerCase();
}

export function formatBlockNumber(blockNumber: string | number): string {
	// Handle special block identifiers
	const specialBlocks = ['latest', 'earliest', 'pending', 'safe', 'finalized'];
	if (typeof blockNumber === 'string') {
		if (specialBlocks.includes(blockNumber.toLowerCase())) {
			return blockNumber.toLowerCase();
		}
		if (blockNumber.startsWith('0x')) {
			return blockNumber;
		}
		return '0x' + BigInt(blockNumber).toString(16);
	}
	return '0x' + BigInt(blockNumber).toString(16);
}
