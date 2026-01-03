/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, explorerApiRequest, hexToDecimal, formatBlockNumber } from '../../transport';
import type { BlockResponse, TransactionResponse, ExplorerApiResponse } from '../../types';

export const blocksOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['blocks'],
			},
		},
		options: [
			{
				name: 'Get Block',
				value: 'getBlock',
				description: 'Get block details by number or hash',
				action: 'Get block',
			},
			{
				name: 'Get Latest Block',
				value: 'getLatestBlock',
				description: 'Get the current/latest block',
				action: 'Get latest block',
			},
			{
				name: 'Get Block Transactions',
				value: 'getBlockTransactions',
				description: 'Get all transactions in a block',
				action: 'Get block transactions',
			},
			{
				name: 'Get Block by Timestamp',
				value: 'getBlockByTimestamp',
				description: 'Find block closest to a timestamp',
				action: 'Get block by timestamp',
			},
		],
		default: 'getBlock',
	},
];

export const blocksFields: INodeProperties[] = [
	// Block Identifier
	{
		displayName: 'Block Identifier',
		name: 'blockIdentifier',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Block number or hash',
		description: 'Block number (e.g., 12345678) or block hash (0x...)',
		displayOptions: {
			show: {
				resource: ['blocks'],
				operation: ['getBlock', 'getBlockTransactions'],
			},
		},
	},
	// Timestamp
	{
		displayName: 'Timestamp',
		name: 'timestamp',
		type: 'number',
		required: true,
		default: 0,
		description: 'Unix timestamp in seconds',
		displayOptions: {
			show: {
				resource: ['blocks'],
				operation: ['getBlockByTimestamp'],
			},
		},
	},
	{
		displayName: 'Closest',
		name: 'closest',
		type: 'options',
		options: [
			{ name: 'Before', value: 'before' },
			{ name: 'After', value: 'after' },
		],
		default: 'before',
		description: 'Whether to find block before or after timestamp',
		displayOptions: {
			show: {
				resource: ['blocks'],
				operation: ['getBlockByTimestamp'],
			},
		},
	},
	// Include transactions option
	{
		displayName: 'Include Transactions',
		name: 'includeTransactions',
		type: 'boolean',
		default: false,
		description: 'Whether to include full transaction objects',
		displayOptions: {
			show: {
				resource: ['blocks'],
				operation: ['getBlock', 'getLatestBlock'],
			},
		},
	},
];

function parseBlock(block: BlockResponse, includeFullTx: boolean): Record<string, unknown> {
	const result: Record<string, unknown> = {
		number: parseInt(block.number, 16),
		hash: block.hash,
		parentHash: block.parentHash,
		miner: block.miner,
		difficulty: hexToDecimal(block.difficulty),
		totalDifficulty: hexToDecimal(block.totalDifficulty),
		gasLimit: hexToDecimal(block.gasLimit),
		gasUsed: hexToDecimal(block.gasUsed),
		gasUtilization: ((parseInt(block.gasUsed, 16) / parseInt(block.gasLimit, 16)) * 100).toFixed(2) + '%',
		timestamp: parseInt(block.timestamp, 16),
		timestampISO: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
		size: hexToDecimal(block.size),
		transactionCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
		extraData: block.extraData,
		logsBloom: block.logsBloom,
		stateRoot: block.stateRoot,
		transactionsRoot: block.transactionsRoot,
		receiptsRoot: block.receiptsRoot,
		sha3Uncles: block.sha3Uncles,
		unclesCount: block.uncles.length,
	};

	if (block.baseFeePerGas) {
		result.baseFeePerGas = hexToDecimal(block.baseFeePerGas);
		result.baseFeePerGasGwei = (Number(hexToDecimal(block.baseFeePerGas)) / 1e9).toFixed(4);
	}

	if (includeFullTx && Array.isArray(block.transactions)) {
		result.transactions = (block.transactions as TransactionResponse[]).map((tx) => ({
			hash: tx.hash,
			from: tx.from,
			to: tx.to,
			value: hexToDecimal(tx.value),
			gasPrice: hexToDecimal(tx.gasPrice),
			gas: hexToDecimal(tx.gas),
			nonce: parseInt(tx.nonce, 16),
		}));
	} else if (Array.isArray(block.transactions)) {
		result.transactionHashes = block.transactions;
	}

	return result;
}

export async function executeBlocksOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getBlock': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			let block: BlockResponse | null;

			if (blockIdentifier.startsWith('0x') && blockIdentifier.length === 66) {
				// Block hash
				block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByHash', [blockIdentifier, includeTransactions]) as BlockResponse | null;
			} else {
				// Block number
				const blockNumber = formatBlockNumber(blockIdentifier);
				block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', [blockNumber, includeTransactions]) as BlockResponse | null;
			}

			if (!block) {
				throw new NodeOperationError(this.getNode(), 'Block not found', { itemIndex: index });
			}

			result = parseBlock(block, includeTransactions);
			break;
		}

		case 'getLatestBlock': {
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			const block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['latest', includeTransactions]) as BlockResponse;

			if (!block) {
				throw new NodeOperationError(this.getNode(), 'Failed to get latest block', { itemIndex: index });
			}

			result = parseBlock(block, includeTransactions);
			break;
		}

		case 'getBlockTransactions': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;

			let block: BlockResponse | null;

			if (blockIdentifier.startsWith('0x') && blockIdentifier.length === 66) {
				block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByHash', [blockIdentifier, true]) as BlockResponse | null;
			} else {
				const blockNumber = formatBlockNumber(blockIdentifier);
				block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', [blockNumber, true]) as BlockResponse | null;
			}

			if (!block) {
				throw new NodeOperationError(this.getNode(), 'Block not found', { itemIndex: index });
			}

			const transactions = (block.transactions as TransactionResponse[]).map((tx) => ({
				hash: tx.hash,
				transactionIndex: parseInt(tx.transactionIndex || '0', 16),
				from: tx.from,
				to: tx.to,
				value: hexToDecimal(tx.value),
				valueXDai: (Number(hexToDecimal(tx.value)) / 1e18).toString(),
				gas: hexToDecimal(tx.gas),
				gasPrice: hexToDecimal(tx.gasPrice),
				gasPriceGwei: (Number(hexToDecimal(tx.gasPrice)) / 1e9).toFixed(4),
				nonce: parseInt(tx.nonce, 16),
				input: tx.input,
				type: tx.type ? parseInt(tx.type, 16) : 0,
			}));

			result = {
				blockNumber: parseInt(block.number, 16),
				blockHash: block.hash,
				timestamp: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
				transactions,
				transactionCount: transactions.length,
			};
			break;
		}

		case 'getBlockByTimestamp': {
			const timestamp = this.getNodeParameter('timestamp', index) as number;
			const closest = this.getNodeParameter('closest', index) as string;

			const response = await explorerApiRequest.call(this, {
				module: 'block',
				action: 'getblocknobytime',
				timestamp: timestamp.toString(),
				closest,
			}) as ExplorerApiResponse<string>;

			const blockNumber = response.result;

			// Get full block details
			const block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', [formatBlockNumber(blockNumber), false]) as BlockResponse;

			if (!block) {
				throw new NodeOperationError(this.getNode(), 'Block not found', { itemIndex: index });
			}

			result = {
				requestedTimestamp: timestamp,
				requestedTimestampISO: new Date(timestamp * 1000).toISOString(),
				closest,
				...parseBlock(block, false),
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
