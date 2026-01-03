/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, isValidAddress, isValidTxHash, formatBlockNumber } from '../../transport';
import { GNOSIS_BRIDGES } from '../../constants';
import type { LogEntry } from '../../types';

// Bridge event signatures
const BRIDGE_EVENTS = {
	// xDai Bridge events
	userRequestForAffirmation: '0x7c71c3869e6c2f51c4e3cfba4e82a7e4fdf0e2c7e0f8f51e6d78db6f25f87bf5',
	affirmationCompleted: '0xe194ef610f9150a2db4110b3db5116fd623175dca3528d7ae7046a3f593b53e5',
	// OmniBridge events
	tokensBridgingInitiated: '0x59a9a8027b9c87b961e254899821c9a276b5efc35d1f7409ea4f291470f1629a',
	tokensBridged: '0x9afd47907e25028cdaca8af5caaa7e40f0f48db2f3e8b1e88e7e77c8e04db4e8',
};

export const bridgeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['bridge'],
			},
		},
		options: [
			{
				name: 'Get Bridge Transactions',
				value: 'getBridgeTransactions',
				description: 'Get cross-chain bridge transactions',
				action: 'Get bridge transactions',
			},
			{
				name: 'Get Pending Bridges',
				value: 'getPendingBridges',
				description: 'Get in-progress bridge transfers',
				action: 'Get pending bridges',
			},
			{
				name: 'Get Bridge Stats',
				value: 'getBridgeStats',
				description: 'Get bridge volume and usage statistics',
				action: 'Get bridge stats',
			},
			{
				name: 'Track Bridge TX',
				value: 'trackBridgeTX',
				description: 'Monitor bridge transfer status',
				action: 'Track bridge TX',
			},
		],
		default: 'getBridgeTransactions',
	},
];

export const bridgeFields: INodeProperties[] = [
	// Bridge type
	{
		displayName: 'Bridge Type',
		name: 'bridgeType',
		type: 'options',
		options: [
			{ name: 'xDai Bridge (DAI ↔ xDai)', value: 'xdai' },
			{ name: 'OmniBridge (ERC-20)', value: 'omni' },
			{ name: 'All Bridges', value: 'all' },
		],
		default: 'all',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeTransactions', 'getPendingBridges', 'getBridgeStats'],
			},
		},
	},
	// Address filter
	{
		displayName: 'Filter by Address',
		name: 'filterAddress',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Filter transactions by sender or receiver address',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeTransactions'],
			},
		},
	},
	// Transaction hash for tracking
	{
		displayName: 'Transaction Hash',
		name: 'txHash',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The bridge transaction hash to track',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['trackBridgeTX'],
			},
		},
	},
	// Source chain for tracking
	{
		displayName: 'Source Chain',
		name: 'sourceChain',
		type: 'options',
		options: [
			{ name: 'Ethereum', value: 'ethereum' },
			{ name: 'Gnosis Chain', value: 'gnosis' },
		],
		default: 'ethereum',
		description: 'The chain where the bridge transaction was initiated',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['trackBridgeTX'],
			},
		},
	},
	// Options
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeTransactions'],
			},
		},
		options: [
			{
				displayName: 'From Block',
				name: 'fromBlock',
				type: 'number',
				default: 0,
				description: 'Starting block number',
			},
			{
				displayName: 'To Block',
				name: 'toBlock',
				type: 'string',
				default: 'latest',
				description: 'Ending block number or "latest"',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum number of transactions to return',
			},
		],
	},
];

async function getBridgeLogs(
	context: IExecuteFunctions,
	bridgeAddress: string,
	topics: string[],
	fromBlock: string,
	toBlock: string,
): Promise<LogEntry[]> {
	const filterParams = {
		address: bridgeAddress,
		fromBlock,
		toBlock,
		topics: [topics],
	};

	try {
		const logs = await jsonRpcRequestWithContext.call(context, 'eth_getLogs', [filterParams]) as LogEntry[];
		return logs;
	} catch {
		return [];
	}
}

function parseBridgeLog(log: LogEntry, bridgeType: string): Record<string, unknown> {
	return {
		transactionHash: log.transactionHash,
		blockNumber: parseInt(log.blockNumber, 16),
		bridgeType,
		logIndex: parseInt(log.logIndex, 16),
		data: log.data,
		topics: log.topics,
		bridgeContract: log.address,
	};
}

export async function executeBridgeOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getBridgeTransactions': {
			const bridgeType = this.getNodeParameter('bridgeType', index) as string;
			const filterAddress = this.getNodeParameter('filterAddress', index, '') as string;
			const options = this.getNodeParameter('options', index, {}) as {
				fromBlock?: number;
				toBlock?: string;
				limit?: number;
			};

			if (filterAddress && !isValidAddress(filterAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid filter address format', { itemIndex: index });
			}

			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []) as string;
			const latestBlockNum = parseInt(latestBlock, 16);
			
			// Default to last 10000 blocks if no fromBlock specified
			const fromBlock = options.fromBlock 
				? formatBlockNumber(options.fromBlock) 
				: formatBlockNumber(Math.max(0, latestBlockNum - 10000));
			const toBlock = options.toBlock === 'latest' ? 'latest' : formatBlockNumber(options.toBlock || 'latest');

			const allTransactions: Record<string, unknown>[] = [];

			// Get xDai Bridge transactions
			if (bridgeType === 'xdai' || bridgeType === 'all') {
				const xDaiLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.xDaiBridge.mainnet,
					[BRIDGE_EVENTS.userRequestForAffirmation, BRIDGE_EVENTS.affirmationCompleted],
					fromBlock,
					toBlock,
				);

				for (const log of xDaiLogs) {
					const parsed = parseBridgeLog(log, 'xDai Bridge');
					if (!filterAddress || log.topics.some(t => t.toLowerCase().includes(filterAddress.toLowerCase().replace('0x', '')))) {
						allTransactions.push({
							...parsed,
							type: log.topics[0] === BRIDGE_EVENTS.userRequestForAffirmation ? 'deposit' : 'claim',
						});
					}
				}
			}

			// Get OmniBridge transactions
			if (bridgeType === 'omni' || bridgeType === 'all') {
				const omniLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.omniBridge.mainnet,
					[BRIDGE_EVENTS.tokensBridgingInitiated, BRIDGE_EVENTS.tokensBridged],
					fromBlock,
					toBlock,
				);

				for (const log of omniLogs) {
					const parsed = parseBridgeLog(log, 'OmniBridge');
					if (!filterAddress || log.topics.some(t => t.toLowerCase().includes(filterAddress.toLowerCase().replace('0x', '')))) {
						allTransactions.push({
							...parsed,
							type: log.topics[0] === BRIDGE_EVENTS.tokensBridgingInitiated ? 'initiated' : 'completed',
						});
					}
				}
			}

			// Sort by block number (descending) and limit
			allTransactions.sort((a, b) => (b.blockNumber as number) - (a.blockNumber as number));
			const limitedTransactions = allTransactions.slice(0, options.limit || 100);

			result = {
				bridgeType,
				transactions: limitedTransactions,
				total: limitedTransactions.length,
				fromBlock: parseInt(fromBlock, 16),
				toBlock: toBlock === 'latest' ? latestBlockNum : parseInt(toBlock, 16),
			};
			break;
		}

		case 'getPendingBridges': {
			const bridgeType = this.getNodeParameter('bridgeType', index) as string;

			// Get recent bridge initiations that may be pending
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []) as string;
			const latestBlockNum = parseInt(latestBlock, 16);
			const fromBlock = formatBlockNumber(Math.max(0, latestBlockNum - 5000)); // Last ~5000 blocks

			const pendingTransactions: Record<string, unknown>[] = [];

			if (bridgeType === 'omni' || bridgeType === 'all') {
				// Get initiated but potentially not completed bridges
				const initiatedLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.omniBridge.mainnet,
					[BRIDGE_EVENTS.tokensBridgingInitiated],
					fromBlock,
					'latest',
				);

				for (const log of initiatedLogs) {
					pendingTransactions.push({
						transactionHash: log.transactionHash,
						blockNumber: parseInt(log.blockNumber, 16),
						bridgeType: 'OmniBridge',
						status: 'pending_confirmation',
						initiatedAt: new Date().toISOString(),
						estimatedTime: '5-20 minutes',
					});
				}
			}

			if (bridgeType === 'xdai' || bridgeType === 'all') {
				const xDaiLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.xDaiBridge.mainnet,
					[BRIDGE_EVENTS.userRequestForAffirmation],
					fromBlock,
					'latest',
				);

				for (const log of xDaiLogs) {
					pendingTransactions.push({
						transactionHash: log.transactionHash,
						blockNumber: parseInt(log.blockNumber, 16),
						bridgeType: 'xDai Bridge',
						status: 'pending_confirmation',
						initiatedAt: new Date().toISOString(),
						estimatedTime: '2-5 minutes',
					});
				}
			}

			result = {
				bridgeType,
				pendingTransactions,
				total: pendingTransactions.length,
				note: 'These are recently initiated bridge transactions. Status may have changed.',
			};
			break;
		}

		case 'getBridgeStats': {
			const bridgeType = this.getNodeParameter('bridgeType', index) as string;

			// Get recent activity to calculate stats
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []) as string;
			const latestBlockNum = parseInt(latestBlock, 16);
			const fromBlock = formatBlockNumber(Math.max(0, latestBlockNum - 43200)); // ~24 hours of blocks

			let xDaiVolume = 0;
			let xDaiCount = 0;
			let omniCount = 0;

			if (bridgeType === 'xdai' || bridgeType === 'all') {
				const xDaiLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.xDaiBridge.mainnet,
					[BRIDGE_EVENTS.userRequestForAffirmation, BRIDGE_EVENTS.affirmationCompleted],
					fromBlock,
					'latest',
				);
				xDaiCount = xDaiLogs.length;

				// Parse volumes from logs
				for (const log of xDaiLogs) {
					if (log.data && log.data !== '0x') {
						const value = BigInt(log.data);
						xDaiVolume += Number(value) / 1e18;
					}
				}
			}

			if (bridgeType === 'omni' || bridgeType === 'all') {
				const omniLogs = await getBridgeLogs(
					this,
					GNOSIS_BRIDGES.omniBridge.mainnet,
					[BRIDGE_EVENTS.tokensBridgingInitiated, BRIDGE_EVENTS.tokensBridged],
					fromBlock,
					'latest',
				);
				omniCount = omniLogs.length;
			}

			result = {
				bridgeType,
				period: '24h',
				stats: {
					xDaiBridge: bridgeType === 'xdai' || bridgeType === 'all' ? {
						transactionCount: xDaiCount,
						estimatedVolume: xDaiVolume.toFixed(2) + ' xDAI',
						bridgeContract: GNOSIS_BRIDGES.xDaiBridge.mainnet,
					} : null,
					omniBridge: bridgeType === 'omni' || bridgeType === 'all' ? {
						transactionCount: omniCount,
						bridgeContract: GNOSIS_BRIDGES.omniBridge.mainnet,
					} : null,
				},
				network: 'Gnosis Chain',
				blocksAnalyzed: 43200,
			};
			break;
		}

		case 'trackBridgeTX': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			const sourceChain = this.getNodeParameter('sourceChain', index) as string;

			if (!isValidTxHash(txHash)) {
				throw new NodeOperationError(this.getNode(), 'Invalid transaction hash format', { itemIndex: index });
			}

			// Get transaction receipt
			const receipt = await jsonRpcRequestWithContext.call(this, 'eth_getTransactionReceipt', [txHash]) as {
				status: string;
				blockNumber: string;
				logs: LogEntry[];
			} | null;

			if (!receipt) {
				result = {
					txHash,
					sourceChain,
					status: 'not_found',
					message: 'Transaction not found on the source chain',
				};
				break;
			}

			const txStatus = receipt.status === '0x1' ? 'success' : 'failed';
			const blockNumber = parseInt(receipt.blockNumber, 16);

			// Check if it's a bridge transaction
			let bridgeType = 'unknown';
			let bridgeStatus = 'unknown';

			for (const log of receipt.logs) {
				if (log.address.toLowerCase() === GNOSIS_BRIDGES.xDaiBridge.mainnet.toLowerCase() ||
				    log.address.toLowerCase() === GNOSIS_BRIDGES.xDaiBridge.ethereum.toLowerCase()) {
					bridgeType = 'xDai Bridge';
					if (log.topics[0] === BRIDGE_EVENTS.userRequestForAffirmation) {
						bridgeStatus = 'initiated';
					} else if (log.topics[0] === BRIDGE_EVENTS.affirmationCompleted) {
						bridgeStatus = 'completed';
					}
				} else if (log.address.toLowerCase() === GNOSIS_BRIDGES.omniBridge.mainnet.toLowerCase() ||
				           log.address.toLowerCase() === GNOSIS_BRIDGES.omniBridge.ethereum.toLowerCase()) {
					bridgeType = 'OmniBridge';
					if (log.topics[0] === BRIDGE_EVENTS.tokensBridgingInitiated) {
						bridgeStatus = 'initiated';
					} else if (log.topics[0] === BRIDGE_EVENTS.tokensBridged) {
						bridgeStatus = 'completed';
					}
				}
			}

			// Get current block to estimate confirmations
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []) as string;
			const confirmations = parseInt(latestBlock, 16) - blockNumber;

			result = {
				txHash,
				sourceChain,
				transactionStatus: txStatus,
				bridgeType,
				bridgeStatus,
				blockNumber,
				confirmations,
				estimatedCompletion: bridgeStatus === 'initiated' 
					? bridgeType === 'xDai Bridge' ? '2-5 minutes' : '5-20 minutes'
					: null,
				message: bridgeStatus === 'completed' 
					? 'Bridge transfer completed successfully'
					: bridgeStatus === 'initiated'
					? 'Bridge transfer initiated, waiting for validators'
					: 'Unable to determine bridge status',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
