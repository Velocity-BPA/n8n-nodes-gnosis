/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, hexToDecimal, weiToXDai, isValidTxHash, isValidAddress, xDaiToWei, decimalToHex } from '../../transport';
import type { TransactionResponse, TransactionReceiptResponse } from '../../types';

export const transactionsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['transactions'],
			},
		},
		options: [
			{
				name: 'Get Transaction',
				value: 'getTransaction',
				description: 'Get transaction details by hash',
				action: 'Get transaction',
			},
			{
				name: 'Get Transaction Receipt',
				value: 'getTransactionReceipt',
				description: 'Get transaction receipt',
				action: 'Get transaction receipt',
			},
			{
				name: 'Send Transaction',
				value: 'sendTransaction',
				description: 'Send a signed transaction',
				action: 'Send transaction',
			},
			{
				name: 'Get Pending Transactions',
				value: 'getPendingTransactions',
				description: 'Get pending transactions from mempool',
				action: 'Get pending transactions',
			},
			{
				name: 'Estimate Gas',
				value: 'estimateGas',
				description: 'Estimate gas for a transaction',
				action: 'Estimate gas',
			},
			{
				name: 'Get Transaction Status',
				value: 'getTransactionStatus',
				description: 'Get transaction confirmation status',
				action: 'Get transaction status',
			},
		],
		default: 'getTransaction',
	},
];

export const transactionsFields: INodeProperties[] = [
	// Transaction Hash
	{
		displayName: 'Transaction Hash',
		name: 'txHash',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The transaction hash',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['getTransaction', 'getTransactionReceipt', 'getTransactionStatus'],
			},
		},
	},
	// Send Transaction
	{
		displayName: 'Signed Transaction',
		name: 'signedTx',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The signed transaction data (hex encoded)',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['sendTransaction'],
			},
		},
	},
	// Estimate Gas
	{
		displayName: 'From Address',
		name: 'from',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The sender address',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['estimateGas'],
			},
		},
	},
	{
		displayName: 'To Address',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The recipient address',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['estimateGas'],
			},
		},
	},
	{
		displayName: 'Value (xDai)',
		name: 'value',
		type: 'string',
		default: '0',
		description: 'Amount in xDai to send',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['estimateGas'],
			},
		},
	},
	{
		displayName: 'Data',
		name: 'data',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Contract call data (hex encoded)',
		displayOptions: {
			show: {
				resource: ['transactions'],
				operation: ['estimateGas'],
			},
		},
	},
];

export async function executeTransactionsOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getTransaction': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			if (!isValidTxHash(txHash)) {
				throw new NodeOperationError(this.getNode(), 'Invalid transaction hash format', { itemIndex: index });
			}

			const tx = await jsonRpcRequestWithContext.call(this, 'eth_getTransactionByHash', [txHash]) as TransactionResponse | null;
			
			if (!tx) {
				throw new NodeOperationError(this.getNode(), 'Transaction not found', { itemIndex: index });
			}

			result = {
				hash: tx.hash,
				blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
				blockHash: tx.blockHash,
				transactionIndex: tx.transactionIndex ? parseInt(tx.transactionIndex, 16) : null,
				from: tx.from,
				to: tx.to,
				value: hexToDecimal(tx.value),
				valueXDai: weiToXDai(hexToDecimal(tx.value)),
				gas: hexToDecimal(tx.gas),
				gasPrice: hexToDecimal(tx.gasPrice),
				gasPriceGwei: (Number(hexToDecimal(tx.gasPrice)) / 1e9).toFixed(4),
				nonce: parseInt(tx.nonce, 16),
				input: tx.input,
				type: tx.type ? parseInt(tx.type, 16) : 0,
				status: tx.blockNumber ? 'confirmed' : 'pending',
			};
			break;
		}

		case 'getTransactionReceipt': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			if (!isValidTxHash(txHash)) {
				throw new NodeOperationError(this.getNode(), 'Invalid transaction hash format', { itemIndex: index });
			}

			const receipt = await jsonRpcRequestWithContext.call(this, 'eth_getTransactionReceipt', [txHash]) as TransactionReceiptResponse | null;
			
			if (!receipt) {
				result = {
					hash: txHash,
					status: 'pending',
					message: 'Transaction is still pending or not found',
				};
				break;
			}

			const gasUsed = hexToDecimal(receipt.gasUsed);
			const effectiveGasPrice = receipt.effectiveGasPrice ? hexToDecimal(receipt.effectiveGasPrice) : hexToDecimal(receipt.gasUsed);
			const txFee = BigInt(gasUsed) * BigInt(effectiveGasPrice);

			result = {
				transactionHash: receipt.transactionHash,
				blockNumber: parseInt(receipt.blockNumber, 16),
				blockHash: receipt.blockHash,
				transactionIndex: parseInt(receipt.transactionIndex, 16),
				from: receipt.from,
				to: receipt.to,
				contractAddress: receipt.contractAddress,
				status: receipt.status === '0x1' ? 'success' : 'failed',
				gasUsed,
				cumulativeGasUsed: hexToDecimal(receipt.cumulativeGasUsed),
				effectiveGasPrice: receipt.effectiveGasPrice ? hexToDecimal(receipt.effectiveGasPrice) : null,
				transactionFee: txFee.toString(),
				transactionFeeXDai: weiToXDai(txFee.toString()),
				logsCount: receipt.logs.length,
				logs: receipt.logs.map((log) => ({
					address: log.address,
					topics: log.topics,
					data: log.data,
					logIndex: parseInt(log.logIndex, 16),
				})),
			};
			break;
		}

		case 'sendTransaction': {
			const signedTx = this.getNodeParameter('signedTx', index) as string;
			
			if (!signedTx.startsWith('0x')) {
				throw new NodeOperationError(this.getNode(), 'Signed transaction must be hex encoded (start with 0x)', { itemIndex: index });
			}

			const txHash = await jsonRpcRequestWithContext.call(this, 'eth_sendRawTransaction', [signedTx]) as string;

			result = {
				transactionHash: txHash,
				status: 'submitted',
				message: 'Transaction submitted to the network',
			};
			break;
		}

		case 'getPendingTransactions': {
			const pendingBlock = await jsonRpcRequestWithContext.call(this, 'eth_getBlockByNumber', ['pending', true]) as {
				transactions: TransactionResponse[];
			} | null;

			if (!pendingBlock || !pendingBlock.transactions) {
				result = {
					pendingTransactions: [],
					count: 0,
				};
				break;
			}

			const transactions = pendingBlock.transactions.map((tx) => ({
				hash: tx.hash,
				from: tx.from,
				to: tx.to,
				value: hexToDecimal(tx.value),
				valueXDai: weiToXDai(hexToDecimal(tx.value)),
				gasPrice: hexToDecimal(tx.gasPrice),
				nonce: parseInt(tx.nonce, 16),
			}));

			result = {
				pendingTransactions: transactions,
				count: transactions.length,
			};
			break;
		}

		case 'estimateGas': {
			const from = this.getNodeParameter('from', index) as string;
			const to = this.getNodeParameter('to', index) as string;
			const value = this.getNodeParameter('value', index) as string;
			const data = this.getNodeParameter('data', index, '') as string;

			if (!isValidAddress(from)) {
				throw new NodeOperationError(this.getNode(), 'Invalid from address format', { itemIndex: index });
			}
			if (!isValidAddress(to)) {
				throw new NodeOperationError(this.getNode(), 'Invalid to address format', { itemIndex: index });
			}

			const txObject: Record<string, string> = {
				from,
				to,
			};

			if (value && value !== '0') {
				txObject.value = decimalToHex(xDaiToWei(value));
			}

			if (data) {
				txObject.data = data;
			}

			const gasEstimate = await jsonRpcRequestWithContext.call(this, 'eth_estimateGas', [txObject]) as string;
			const gasPrice = await jsonRpcRequestWithContext.call(this, 'eth_gasPrice', []) as string;

			const gasLimit = hexToDecimal(gasEstimate);
			const gasPriceWei = hexToDecimal(gasPrice);
			const estimatedCost = BigInt(gasLimit) * BigInt(gasPriceWei);

			result = {
				gasLimit,
				gasPrice: gasPriceWei,
				gasPriceGwei: (Number(gasPriceWei) / 1e9).toFixed(4),
				estimatedCost: estimatedCost.toString(),
				estimatedCostXDai: weiToXDai(estimatedCost.toString()),
			};
			break;
		}

		case 'getTransactionStatus': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			if (!isValidTxHash(txHash)) {
				throw new NodeOperationError(this.getNode(), 'Invalid transaction hash format', { itemIndex: index });
			}

			const tx = await jsonRpcRequestWithContext.call(this, 'eth_getTransactionByHash', [txHash]) as TransactionResponse | null;
			const receipt = await jsonRpcRequestWithContext.call(this, 'eth_getTransactionReceipt', [txHash]) as TransactionReceiptResponse | null;
			const latestBlock = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []) as string;

			if (!tx) {
				result = {
					hash: txHash,
					status: 'not_found',
					message: 'Transaction not found',
				};
				break;
			}

			let status: string;
			let confirmations = 0;

			if (!receipt) {
				status = 'pending';
			} else {
				const txBlockNumber = parseInt(receipt.blockNumber, 16);
				const currentBlockNumber = parseInt(latestBlock, 16);
				confirmations = currentBlockNumber - txBlockNumber + 1;
				status = receipt.status === '0x1' ? 'success' : 'failed';
			}

			result = {
				hash: txHash,
				status,
				confirmations,
				blockNumber: receipt ? parseInt(receipt.blockNumber, 16) : null,
				finalized: confirmations >= 12,
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
