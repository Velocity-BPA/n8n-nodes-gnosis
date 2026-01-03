/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, explorerApiRequest, hexToDecimal, weiToXDai, isValidAddress } from '../../transport';
import type { ExplorerApiResponse, AccountTransaction, InternalTransaction, TokenTransfer } from '../../types';

export const accountsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['accounts'],
			},
		},
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get xDai balance for an address',
				action: 'Get balance',
			},
			{
				name: 'Get Token Balance',
				value: 'getTokenBalance',
				description: 'Get ERC-20 token balance for an address',
				action: 'Get token balance',
			},
			{
				name: 'Get NFTs',
				value: 'getNFTs',
				description: 'Get NFTs owned by an address',
				action: 'Get NFTs',
			},
			{
				name: 'Get Transaction History',
				value: 'getTransactionHistory',
				description: 'Get transaction history for an address',
				action: 'Get transaction history',
			},
			{
				name: 'Get Internal Transactions',
				value: 'getInternalTransactions',
				description: 'Get internal transactions for an address',
				action: 'Get internal transactions',
			},
			{
				name: 'Get Token Transfers',
				value: 'getTokenTransfers',
				description: 'Get token transfer history for an address',
				action: 'Get token transfers',
			},
		],
		default: 'getBalance',
	},
];

export const accountsFields: INodeProperties[] = [
	// Get Balance
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The address to query',
		displayOptions: {
			show: {
				resource: ['accounts'],
				operation: ['getBalance', 'getTokenBalance', 'getNFTs', 'getTransactionHistory', 'getInternalTransactions', 'getTokenTransfers'],
			},
		},
	},
	// Get Token Balance
	{
		displayName: 'Token Address',
		name: 'tokenAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The ERC-20 token contract address',
		displayOptions: {
			show: {
				resource: ['accounts'],
				operation: ['getTokenBalance'],
			},
		},
	},
	// Pagination options
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accounts'],
				operation: ['getTransactionHistory', 'getInternalTransactions', 'getTokenTransfers', 'getNFTs'],
			},
		},
		options: [
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number for pagination',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Number of results per page',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				description: 'Sort order by block number',
			},
		],
	},
];

export async function executeAccountsOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const address = this.getNodeParameter('address', index) as string;

	if (!isValidAddress(address)) {
		throw new NodeOperationError(this.getNode(), 'Invalid Ethereum address format', { itemIndex: index });
	}

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getBalance': {
			const balance = await jsonRpcRequestWithContext.call(this, 'eth_getBalance', [address, 'latest']);
			const balanceWei = hexToDecimal(balance as string);
			result = {
				address,
				balanceWei,
				balanceXDai: weiToXDai(balanceWei),
			};
			break;
		}

		case 'getTokenBalance': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			if (!isValidAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address format', { itemIndex: index });
			}

			// balanceOf(address) function selector
			const data = '0x70a08231' + address.toLowerCase().replace('0x', '').padStart(64, '0');
			const balance = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: tokenAddress, data },
				'latest',
			]);

			// Get token decimals
			const decimalsData = '0x313ce567'; // decimals()
			const decimalsResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: tokenAddress, data: decimalsData },
				'latest',
			]);
			const decimals = parseInt(hexToDecimal(decimalsResult as string), 10);

			// Get token symbol
			const symbolData = '0x95d89b41'; // symbol()
			const symbolResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: tokenAddress, data: symbolData },
				'latest',
			]);
			let symbol = '';
			try {
				const hexStr = (symbolResult as string).replace('0x', '');
				if (hexStr.length >= 128) {
					const length = parseInt(hexStr.slice(64, 128), 16);
					const symbolBytes = hexStr.slice(128, 128 + length * 2);
					for (let i = 0; i < symbolBytes.length; i += 2) {
						const charCode = parseInt(symbolBytes.slice(i, i + 2), 16);
						if (charCode !== 0) symbol += String.fromCharCode(charCode);
					}
				}
			} catch {
				symbol = 'UNKNOWN';
			}

			const balanceRaw = hexToDecimal(balance as string);
			const balanceFormatted = (Number(balanceRaw) / Math.pow(10, decimals)).toString();

			result = {
				address,
				tokenAddress,
				symbol,
				decimals,
				balanceRaw,
				balance: balanceFormatted,
			};
			break;
		}

		case 'getNFTs': {
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
			};

			const response = await explorerApiRequest.call(this, {
				module: 'account',
				action: 'tokennfttx',
				address,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: 'desc',
			}) as ExplorerApiResponse<TokenTransfer[]>;

			// Group NFTs by contract and token ID
			const nfts: Record<string, { contractAddress: string; tokenId: string; tokenName: string; count: number }> = {};
			
			if (Array.isArray(response.result)) {
				for (const transfer of response.result) {
					if (transfer.to.toLowerCase() === address.toLowerCase()) {
						const key = `${transfer.contractAddress}-${transfer.value}`;
						if (!nfts[key]) {
							nfts[key] = {
								contractAddress: transfer.contractAddress,
								tokenId: transfer.value,
								tokenName: transfer.tokenName,
								count: 1,
							};
						} else {
							nfts[key].count++;
						}
					}
				}
			}

			result = {
				address,
				nfts: Object.values(nfts),
				total: Object.keys(nfts).length,
			};
			break;
		}

		case 'getTransactionHistory': {
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
				sort?: string;
			};

			const response = await explorerApiRequest.call(this, {
				module: 'account',
				action: 'txlist',
				address,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: options.sort || 'desc',
			}) as ExplorerApiResponse<AccountTransaction[]>;

			const transactions = Array.isArray(response.result) ? response.result.map((tx) => ({
				hash: tx.hash,
				blockNumber: parseInt(tx.blockNumber, 10),
				timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
				from: tx.from,
				to: tx.to,
				value: tx.value,
				valueXDai: weiToXDai(tx.value),
				gasUsed: tx.gasUsed,
				gasPrice: tx.gasPrice,
				isError: tx.isError === '1',
				functionName: tx.functionName,
			})) : [];

			result = {
				address,
				transactions,
				total: transactions.length,
			};
			break;
		}

		case 'getInternalTransactions': {
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
				sort?: string;
			};

			const response = await explorerApiRequest.call(this, {
				module: 'account',
				action: 'txlistinternal',
				address,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: options.sort || 'desc',
			}) as ExplorerApiResponse<InternalTransaction[]>;

			const transactions = Array.isArray(response.result) ? response.result.map((tx) => ({
				hash: tx.hash,
				blockNumber: parseInt(tx.blockNumber, 10),
				timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
				from: tx.from,
				to: tx.to,
				value: tx.value,
				valueXDai: weiToXDai(tx.value),
				type: tx.type,
				gasUsed: tx.gasUsed,
				isError: tx.isError === '1',
				errCode: tx.errCode,
			})) : [];

			result = {
				address,
				transactions,
				total: transactions.length,
			};
			break;
		}

		case 'getTokenTransfers': {
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
				sort?: string;
			};

			const response = await explorerApiRequest.call(this, {
				module: 'account',
				action: 'tokentx',
				address,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: options.sort || 'desc',
			}) as ExplorerApiResponse<TokenTransfer[]>;

			const transfers = Array.isArray(response.result) ? response.result.map((tx) => ({
				hash: tx.hash,
				blockNumber: parseInt(tx.blockNumber, 10),
				timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
				from: tx.from,
				to: tx.to,
				contractAddress: tx.contractAddress,
				tokenName: tx.tokenName,
				tokenSymbol: tx.tokenSymbol,
				tokenDecimal: parseInt(tx.tokenDecimal, 10),
				value: tx.value,
				formattedValue: (Number(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal, 10))).toString(),
			})) : [];

			result = {
				address,
				transfers,
				total: transfers.length,
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
