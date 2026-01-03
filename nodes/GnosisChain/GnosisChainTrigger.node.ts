/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { jsonRpcRequest, hexToDecimal, weiToXDai, isValidAddress } from './transport';

// Helper to convert hex to number
function hexToNumber(hex: string): number {
	return parseInt(hexToDecimal(hex), 10);
}

export class GnosisChainTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Gnosis Chain Trigger',
		name: 'gnosisChainTrigger',
		icon: 'file:gnosischain.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["triggerType"]}}',
		description: 'Trigger workflows on Gnosis Chain events',
		defaults: {
			name: 'Gnosis Chain Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'gnosisChainApi',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Trigger Type',
				name: 'triggerType',
				type: 'options',
				options: [
					{
						name: 'New Block',
						value: 'newBlock',
						description: 'Trigger when a new block is produced',
					},
					{
						name: 'New Transaction to Address',
						value: 'newTransactionToAddress',
						description: 'Trigger when an address receives a transaction',
					},
					{
						name: 'Token Transfer',
						value: 'tokenTransfer',
						description: 'Trigger on ERC-20 token transfers',
					},
					{
						name: 'Contract Event',
						value: 'contractEvent',
						description: 'Trigger on specific contract events',
					},
					{
						name: 'Bridge Transaction',
						value: 'bridgeTransaction',
						description: 'Trigger on cross-chain bridge transactions',
					},
					{
						name: 'Large Transaction',
						value: 'largeTransaction',
						description: 'Trigger on transactions above a threshold',
					},
				],
				default: 'newBlock',
				required: true,
			},
			// newTransactionToAddress fields
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				default: '',
				placeholder: '0x...',
				description: 'Address to monitor for transactions',
				displayOptions: {
					show: {
						triggerType: ['newTransactionToAddress'],
					},
				},
				required: true,
			},
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				options: [
					{ name: 'Incoming', value: 'incoming' },
					{ name: 'Outgoing', value: 'outgoing' },
					{ name: 'Both', value: 'both' },
				],
				default: 'incoming',
				description: 'Transaction direction to monitor',
				displayOptions: {
					show: {
						triggerType: ['newTransactionToAddress'],
					},
				},
			},
			// tokenTransfer fields
			{
				displayName: 'Token Address',
				name: 'tokenAddress',
				type: 'string',
				default: '',
				placeholder: '0x... (leave empty for all tokens)',
				description: 'Token contract address to monitor (leave empty for all)',
				displayOptions: {
					show: {
						triggerType: ['tokenTransfer'],
					},
				},
			},
			{
				displayName: 'Watched Address',
				name: 'watchedAddress',
				type: 'string',
				default: '',
				placeholder: '0x...',
				description: 'Address to monitor for token transfers (sender or receiver)',
				displayOptions: {
					show: {
						triggerType: ['tokenTransfer'],
					},
				},
				required: true,
			},
			// contractEvent fields
			{
				displayName: 'Contract Address',
				name: 'contractAddress',
				type: 'string',
				default: '',
				placeholder: '0x...',
				description: 'Contract address to monitor',
				displayOptions: {
					show: {
						triggerType: ['contractEvent'],
					},
				},
				required: true,
			},
			{
				displayName: 'Event Signature',
				name: 'eventSignature',
				type: 'string',
				default: '',
				placeholder: '0xddf252... or leave empty for all events',
				description: 'Event signature hash (topic0) to filter',
				displayOptions: {
					show: {
						triggerType: ['contractEvent'],
					},
				},
			},
			// bridgeTransaction fields
			{
				displayName: 'Bridge Type',
				name: 'bridgeType',
				type: 'options',
				options: [
					{ name: 'All Bridges', value: 'all' },
					{ name: 'OmniBridge (ERC-20)', value: 'omnibridge' },
					{ name: 'xDai Bridge (DAI)', value: 'xdaibridge' },
				],
				default: 'all',
				description: 'Which bridge to monitor',
				displayOptions: {
					show: {
						triggerType: ['bridgeTransaction'],
					},
				},
			},
			{
				displayName: 'Bridge Address Filter',
				name: 'bridgeAddressFilter',
				type: 'string',
				default: '',
				placeholder: '0x... (leave empty for all)',
				description: 'Only trigger for this address (sender or receiver)',
				displayOptions: {
					show: {
						triggerType: ['bridgeTransaction'],
					},
				},
			},
			// largeTransaction fields
			{
				displayName: 'Threshold (xDai)',
				name: 'threshold',
				type: 'number',
				default: 100,
				description: 'Minimum transaction value in xDai',
				displayOptions: {
					show: {
						triggerType: ['largeTransaction'],
					},
				},
			},
			{
				displayName: 'Large TX Address Filter',
				name: 'largeTxAddressFilter',
				type: 'string',
				default: '',
				placeholder: '0x... (leave empty for all)',
				description: 'Only trigger for transactions involving this address',
				displayOptions: {
					show: {
						triggerType: ['largeTransaction'],
					},
				},
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('gnosisChainApi');
		const rpcUrl = credentials.rpcUrl as string || 'https://rpc.gnosischain.com/';
		const triggerType = this.getNodeParameter('triggerType') as string;

		// Get workflow static data for state persistence
		const workflowStaticData = this.getWorkflowStaticData('node');
		const lastBlockKey = 'lastProcessedBlock';

		// Get current block number
		const currentBlockHex = await jsonRpcRequest<string>(rpcUrl, 'eth_blockNumber', []);
		const currentBlock = hexToNumber(currentBlockHex);

		// Initialize last block if not set
		let lastBlock = workflowStaticData[lastBlockKey] as number | undefined;
		if (lastBlock === undefined) {
			// On first run, start from current block minus a small buffer
			lastBlock = Math.max(0, currentBlock - 5);
			workflowStaticData[lastBlockKey] = lastBlock;
			return null; // Don't trigger on first run
		}

		// No new blocks
		if (currentBlock <= lastBlock) {
			return null;
		}

		const returnData: INodeExecutionData[] = [];

		try {
			switch (triggerType) {
				case 'newBlock': {
					// Return info for each new block
					for (let blockNum = lastBlock + 1; blockNum <= currentBlock; blockNum++) {
						const blockHex = '0x' + blockNum.toString(16);
						const block = await jsonRpcRequest<Record<string, unknown>>(rpcUrl, 'eth_getBlockByNumber', [blockHex, false]);

						if (block) {
							const timestamp = hexToNumber(block.timestamp as string);
							returnData.push({
								json: {
									blockNumber: blockNum,
									blockHash: block.hash,
									timestamp,
									timestampISO: new Date(timestamp * 1000).toISOString(),
									transactionCount: (block.transactions as string[])?.length || 0,
									gasUsed: hexToDecimal(block.gasUsed as string),
									gasLimit: hexToDecimal(block.gasLimit as string),
									miner: block.miner,
								} as IDataObject,
							});
						}
					}
					break;
				}

				case 'newTransactionToAddress': {
					const address = this.getNodeParameter('address') as string;
					const direction = this.getNodeParameter('direction') as string;

					if (!isValidAddress(address)) {
						throw new Error('Invalid address format');
					}

					const addressLower = address.toLowerCase();

					// Check each new block for transactions
					for (let blockNum = lastBlock + 1; blockNum <= currentBlock; blockNum++) {
						const blockHex = '0x' + blockNum.toString(16);
						const block = await jsonRpcRequest<Record<string, unknown>>(rpcUrl, 'eth_getBlockByNumber', [blockHex, true]);

						if (block) {
							const transactions = block.transactions as Array<Record<string, unknown>>;

							for (const tx of transactions || []) {
								const from = (tx.from as string)?.toLowerCase();
								const to = (tx.to as string)?.toLowerCase();

								const isIncoming = to === addressLower;
								const isOutgoing = from === addressLower;

								if (
									(direction === 'incoming' && isIncoming) ||
									(direction === 'outgoing' && isOutgoing) ||
									(direction === 'both' && (isIncoming || isOutgoing))
								) {
									returnData.push({
										json: {
											type: isIncoming ? 'incoming' : 'outgoing',
											hash: tx.hash,
											from: tx.from,
											to: tx.to,
											value: weiToXDai(hexToDecimal(tx.value as string)),
											valueWei: hexToDecimal(tx.value as string),
											blockNumber: blockNum,
											gasPrice: hexToDecimal(tx.gasPrice as string),
											nonce: hexToNumber(tx.nonce as string),
										} as IDataObject,
									});
								}
							}
						}
					}
					break;
				}

				case 'tokenTransfer': {
					const tokenAddress = this.getNodeParameter('tokenAddress') as string;
					const watchedAddress = this.getNodeParameter('watchedAddress') as string;

					if (!isValidAddress(watchedAddress)) {
						throw new Error('Invalid watched address format');
					}

					// ERC-20 Transfer event signature
					const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

					// Pad address for topic matching
					const paddedAddress = '0x000000000000000000000000' + watchedAddress.slice(2).toLowerCase();

					// Build filter - check both from and to positions
					const fromBlockHex = '0x' + (lastBlock + 1).toString(16);
					const toBlockHex = '0x' + currentBlock.toString(16);

					// Filter for transfers TO watched address
					const filterTo: Record<string, unknown> = {
						fromBlock: fromBlockHex,
						toBlock: toBlockHex,
						topics: [transferTopic, null, paddedAddress],
					};

					// Filter for transfers FROM watched address
					const filterFrom: Record<string, unknown> = {
						fromBlock: fromBlockHex,
						toBlock: toBlockHex,
						topics: [transferTopic, paddedAddress],
					};

					if (tokenAddress && isValidAddress(tokenAddress)) {
						filterTo.address = tokenAddress;
						filterFrom.address = tokenAddress;
					}

					const [logsTo, logsFrom] = await Promise.all([
						jsonRpcRequest<Array<Record<string, unknown>>>(rpcUrl, 'eth_getLogs', [filterTo]),
						jsonRpcRequest<Array<Record<string, unknown>>>(rpcUrl, 'eth_getLogs', [filterFrom]),
					]);

					const allLogs = [...(logsTo || []), ...(logsFrom || [])];

					// Dedupe by transaction hash + log index
					const seen = new Set<string>();
					for (const log of allLogs) {
						const key = `${log.transactionHash}-${log.logIndex}`;
						if (seen.has(key)) continue;
						seen.add(key);

						const topics = log.topics as string[];
						const from = '0x' + (topics[1] as string)?.slice(26);
						const to = '0x' + (topics[2] as string)?.slice(26);
						const value = hexToDecimal(log.data as string);

						returnData.push({
							json: {
								type: 'tokenTransfer',
								tokenContract: log.address,
								from,
								to,
								value,
								transactionHash: log.transactionHash,
								blockNumber: hexToNumber(log.blockNumber as string),
								logIndex: hexToNumber(log.logIndex as string),
							} as IDataObject,
						});
					}
					break;
				}

				case 'contractEvent': {
					const contractAddress = this.getNodeParameter('contractAddress') as string;
					const eventSignature = this.getNodeParameter('eventSignature') as string;

					if (!isValidAddress(contractAddress)) {
						throw new Error('Invalid contract address format');
					}

					const filter: Record<string, unknown> = {
						address: contractAddress,
						fromBlock: '0x' + (lastBlock + 1).toString(16),
						toBlock: '0x' + currentBlock.toString(16),
					};

					if (eventSignature) {
						filter.topics = [eventSignature];
					}

					const logs = await jsonRpcRequest<Array<Record<string, unknown>>>(rpcUrl, 'eth_getLogs', [filter]);

					for (const log of logs || []) {
						returnData.push({
							json: {
								type: 'contractEvent',
								contract: log.address,
								eventSignature: (log.topics as string[])?.[0],
								topics: log.topics,
								data: log.data,
								transactionHash: log.transactionHash,
								blockNumber: hexToNumber(log.blockNumber as string),
								logIndex: hexToNumber(log.logIndex as string),
							} as IDataObject,
						});
					}
					break;
				}

				case 'bridgeTransaction': {
					const bridgeType = this.getNodeParameter('bridgeType') as string;
					const addressFilter = this.getNodeParameter('bridgeAddressFilter') as string;

					// Bridge contract addresses
					const OMNIBRIDGE = '0x88ad09518695c6c3712AC10a214bE5109a655671';
					const XDAI_BRIDGE = '0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6';

					const addresses: string[] = [];
					if (bridgeType === 'all' || bridgeType === 'omnibridge') {
						addresses.push(OMNIBRIDGE);
					}
					if (bridgeType === 'all' || bridgeType === 'xdaibridge') {
						addresses.push(XDAI_BRIDGE);
					}

					for (const bridgeAddress of addresses) {
						const filter: Record<string, unknown> = {
							address: bridgeAddress,
							fromBlock: '0x' + (lastBlock + 1).toString(16),
							toBlock: '0x' + currentBlock.toString(16),
						};

						const logs = await jsonRpcRequest<Array<Record<string, unknown>>>(rpcUrl, 'eth_getLogs', [filter]);

						for (const log of logs || []) {
							const topics = log.topics as string[];

							// Extract addresses from topics if possible
							let sender = '';
							let recipient = '';
							if (topics.length > 1) {
								sender = '0x' + topics[1].slice(26);
							}
							if (topics.length > 2) {
								recipient = '0x' + topics[2].slice(26);
							}

							// Apply address filter if set
							if (addressFilter && isValidAddress(addressFilter)) {
								const filterLower = addressFilter.toLowerCase();
								if (sender.toLowerCase() !== filterLower && recipient.toLowerCase() !== filterLower) {
									continue;
								}
							}

							returnData.push({
								json: {
									type: 'bridgeTransaction',
									bridge: bridgeAddress === OMNIBRIDGE ? 'OmniBridge' : 'xDai Bridge',
									bridgeContract: bridgeAddress,
									eventSignature: topics[0],
									sender,
									recipient,
									data: log.data,
									transactionHash: log.transactionHash,
									blockNumber: hexToNumber(log.blockNumber as string),
								} as IDataObject,
							});
						}
					}
					break;
				}

				case 'largeTransaction': {
					const threshold = this.getNodeParameter('threshold') as number;
					const addressFilter = this.getNodeParameter('largeTxAddressFilter') as string;

					const thresholdWei = BigInt(Math.floor(threshold * 1e18));

					for (let blockNum = lastBlock + 1; blockNum <= currentBlock; blockNum++) {
						const blockHex = '0x' + blockNum.toString(16);
						const block = await jsonRpcRequest<Record<string, unknown>>(rpcUrl, 'eth_getBlockByNumber', [blockHex, true]);

						if (block) {
							const transactions = block.transactions as Array<Record<string, unknown>>;
							const blockTimestamp = hexToNumber(block.timestamp as string);

							for (const tx of transactions || []) {
								const valueWei = BigInt(hexToDecimal(tx.value as string));

								if (valueWei >= thresholdWei) {
									const from = (tx.from as string)?.toLowerCase();
									const to = (tx.to as string)?.toLowerCase();

									// Apply address filter if set
									if (addressFilter && isValidAddress(addressFilter)) {
										const filterLower = addressFilter.toLowerCase();
										if (from !== filterLower && to !== filterLower) {
											continue;
										}
									}

									returnData.push({
										json: {
											type: 'largeTransaction',
											hash: tx.hash,
											from: tx.from,
											to: tx.to,
											value: weiToXDai(valueWei.toString()),
											valueWei: valueWei.toString(),
											threshold,
											blockNumber: blockNum,
											timestamp: blockTimestamp,
										} as IDataObject,
									});
								}
							}
						}
					}
					break;
				}
			}
		} finally {
			// Update last processed block
			workflowStaticData[lastBlockKey] = currentBlock;
		}

		if (returnData.length === 0) {
			return null;
		}

		return [returnData];
	}
}
