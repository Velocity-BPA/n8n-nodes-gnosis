/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, hexToDecimal, weiToGwei, GnosisCredentials, getRpcEndpoint } from '../../transport';
import { GNOSIS_NETWORKS } from '../../constants';
import type { BlockResponse, SyncStatus } from '../../types';

export const networkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['network'],
			},
		},
		options: [
			{
				name: 'Get Network Status',
				value: 'getNetworkStatus',
				description: 'Get chain status and health',
				action: 'Get network status',
			},
			{
				name: 'Get Gas Price',
				value: 'getGasPrice',
				description: 'Get current gas price',
				action: 'Get gas price',
			},
			{
				name: 'Get Chain Stats',
				value: 'getChainStats',
				description: 'Get network metrics',
				action: 'Get chain stats',
			},
			{
				name: 'Get Finality',
				value: 'getFinality',
				description: 'Get finality information',
				action: 'Get finality',
			},
		],
		default: 'getNetworkStatus',
	},
];

export const networkFields: INodeProperties[] = [];

export async function executeNetworkOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getNetworkStatus': {
			const credentials = await this.getCredentials('gnosisChainApi') as GnosisCredentials;
			const network = credentials.network || 'mainnet';
			const networkConfig = GNOSIS_NETWORKS[network];

			// Get chain ID
			const chainId = await jsonRpcRequestWithContext.call(this, 'eth_chainId', []) as string;

			// Get syncing status
			const syncing = await jsonRpcRequestWithContext.call(this, 'eth_syncing', []) as boolean | SyncStatus;

			// Get latest block
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['latest', false]) as BlockResponse;

			// Get peer count
			let peerCount = 0;
			try {
				const peers = await jsonRpcRequestWithContext.call(this, 'net_peerCount', []) as string;
				peerCount = parseInt(peers, 16);
			} catch {
				peerCount = -1; // Not supported
			}

			// Get protocol version
			let protocolVersion = 'unknown';
			try {
				protocolVersion = await jsonRpcRequestWithContext.call(this, 'eth_protocolVersion', []) as string;
			} catch {
				protocolVersion = 'not available';
			}

			const isSyncing = typeof syncing === 'object';
			let syncProgress = null;
			if (isSyncing && syncing) {
				const currentBlock = parseInt(syncing.currentBlock, 16);
				const highestBlock = parseInt(syncing.highestBlock, 16);
				syncProgress = ((currentBlock / highestBlock) * 100).toFixed(2) + '%';
			}

			result = {
				network: networkConfig.name,
				chainId: parseInt(chainId, 16),
				rpcEndpoint: getRpcEndpoint(credentials),
				status: isSyncing ? 'syncing' : 'healthy',
				syncing: isSyncing,
				syncProgress,
				latestBlock: parseInt(latestBlock.number, 16),
				latestBlockHash: latestBlock.hash,
				latestBlockTime: new Date(parseInt(latestBlock.timestamp, 16) * 1000).toISOString(),
				peerCount: peerCount >= 0 ? peerCount : 'not available',
				protocolVersion,
				nativeToken: networkConfig.nativeToken,
				stakingToken: networkConfig.stakingToken,
				explorerUrl: networkConfig.explorerUrl,
			};
			break;
		}

		case 'getGasPrice': {
			const gasPrice = await jsonRpcRequestWithContext.call(this, 'eth_gasPrice', []) as string;
			const gasPriceWei = hexToDecimal(gasPrice);
			const gasPriceGwei = weiToGwei(gasPriceWei);

			// Try to get max priority fee (EIP-1559)
			let maxPriorityFee = null;
			let baseFee = null;
			try {
				const priorityFee = await jsonRpcRequestWithContext.call(this, 'eth_maxPriorityFeePerGas', []) as string;
				maxPriorityFee = weiToGwei(hexToDecimal(priorityFee));
			} catch {
				// EIP-1559 not supported or not available
			}

			// Get base fee from latest block
			try {
				const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['latest', false]) as BlockResponse;
				if (latestBlock.baseFeePerGas) {
					baseFee = weiToGwei(hexToDecimal(latestBlock.baseFeePerGas));
				}
			} catch {
				// Could not get base fee
			}

			// Calculate estimated costs for different transaction types
			const simpleTransferGas = 21000;
			const erc20TransferGas = 65000;
			const contractDeployGas = 500000;

			const gasPriceNumber = Number(gasPriceWei);

			result = {
				gasPrice: gasPriceWei,
				gasPriceGwei: parseFloat(gasPriceGwei).toFixed(4),
				baseFeeGwei: baseFee ? parseFloat(baseFee).toFixed(4) : null,
				maxPriorityFeeGwei: maxPriorityFee ? parseFloat(maxPriorityFee).toFixed(4) : null,
				estimatedCosts: {
					simpleTransfer: {
						gas: simpleTransferGas,
						costWei: (gasPriceNumber * simpleTransferGas).toString(),
						costXDai: ((gasPriceNumber * simpleTransferGas) / 1e18).toFixed(8),
					},
					erc20Transfer: {
						gas: erc20TransferGas,
						costWei: (gasPriceNumber * erc20TransferGas).toString(),
						costXDai: ((gasPriceNumber * erc20TransferGas) / 1e18).toFixed(8),
					},
					contractDeploy: {
						gas: contractDeployGas,
						costWei: (gasPriceNumber * contractDeployGas).toString(),
						costXDai: ((gasPriceNumber * contractDeployGas) / 1e18).toFixed(6),
					},
				},
				note: 'Gnosis Chain has very low gas costs compared to Ethereum mainnet',
			};
			break;
		}

		case 'getChainStats': {
			// Get latest block
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['latest', true]) as BlockResponse;
			const latestBlockNum = parseInt(latestBlock.number, 16);

			// Get block from ~24 hours ago (~17280 blocks at 5s block time)
			const blocksPerDay = 17280;
			const oldBlockNum = Math.max(0, latestBlockNum - blocksPerDay);
			const oldBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', [
				'0x' + oldBlockNum.toString(16),
				false,
			]) as BlockResponse;

			// Calculate stats
			const latestTimestamp = parseInt(latestBlock.timestamp, 16);
			const oldTimestamp = parseInt(oldBlock.timestamp, 16);
			const timeDiff = latestTimestamp - oldTimestamp;
			const blocksDiff = latestBlockNum - oldBlockNum;
			const avgBlockTime = timeDiff / blocksDiff;

			// Get gas usage stats from recent blocks
			let totalGasUsed = BigInt(0);
			let totalGasLimit = BigInt(0);
			const sampleBlocks = 100;

			for (let i = 0; i < sampleBlocks; i++) {
				const blockNum = latestBlockNum - i;
				const block = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', [
					'0x' + blockNum.toString(16),
					false,
				]) as BlockResponse;
				totalGasUsed += BigInt(block.gasUsed);
				totalGasLimit += BigInt(block.gasLimit);
			}

			const avgGasUsed = Number(totalGasUsed) / sampleBlocks;
			const avgGasLimit = Number(totalGasLimit) / sampleBlocks;
			const avgUtilization = (avgGasUsed / avgGasLimit) * 100;

			// Get current gas price
			const gasPrice = await jsonRpcRequestWithContext.call(this, 'eth_gasPrice', []) as string;

			result = {
				latestBlock: latestBlockNum,
				blocksAnalyzed: blocksDiff,
				averageBlockTime: avgBlockTime.toFixed(2) + ' seconds',
				targetBlockTime: '5 seconds',
				blocksPerDay: Math.round(86400 / avgBlockTime),
				gasStats: {
					averageGasUsed: avgGasUsed.toFixed(0),
					averageGasLimit: avgGasLimit.toFixed(0),
					averageUtilization: avgUtilization.toFixed(2) + '%',
					currentGasPrice: weiToGwei(hexToDecimal(gasPrice)) + ' Gwei',
				},
				transactionsInLatestBlock: Array.isArray(latestBlock.transactions) 
					? latestBlock.transactions.length 
					: 0,
				network: 'Gnosis Chain',
				consensus: 'POSDAO',
			};
			break;
		}

		case 'getFinality': {
			// Get latest block
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['latest', false]) as BlockResponse;
			const latestBlockNum = parseInt(latestBlock.number, 16);
			const latestTimestamp = parseInt(latestBlock.timestamp, 16);

			// Get safe block (if supported)
			let safeBlock = null;
			try {
				const safe = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['safe', false]) as BlockResponse | null;
				if (safe) {
					safeBlock = parseInt(safe.number, 16);
				}
			} catch {
				// Safe block not supported
			}

			// Get finalized block (if supported)
			let finalizedBlock = null;
			try {
				const finalized = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['finalized', false]) as BlockResponse | null;
				if (finalized) {
					finalizedBlock = parseInt(finalized.number, 16);
				}
			} catch {
				// Finalized block not supported
			}

			// Calculate confirmations needed for finality
			const confirmationsForFinality = 12; // Standard for most applications
			const fastFinality = 3; // Quick confirmations

			result = {
				latestBlock: latestBlockNum,
				latestBlockTime: new Date(latestTimestamp * 1000).toISOString(),
				safeBlock,
				finalizedBlock,
				confirmationsForFinality,
				fastFinalityBlocks: fastFinality,
				estimatedFinalityTime: `${confirmationsForFinality * 5} seconds`, // ~5s block time
				consensus: 'POSDAO',
				note: 'Gnosis Chain uses Proof of Stake with ~5 second block times. Finality is typically achieved within 1-2 minutes.',
				validatorCount: 'Query staking resource for current validator count',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
