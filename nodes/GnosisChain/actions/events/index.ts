/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, isValidAddress, isValidTxHash, hexToDecimal } from '../../transport';
import { parseLogEntry } from '../../utils';

export const eventsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['events'],
			},
		},
		options: [
			{
				name: 'Get Logs',
				value: 'getLogs',
				description: 'Get event logs with filters',
				action: 'Get event logs',
			},
			{
				name: 'Subscribe To Logs',
				value: 'subscribeToLogs',
				description: 'Get WebSocket subscription information for logs',
				action: 'Get subscription info',
			},
			{
				name: 'Filter Events',
				value: 'filterEvents',
				description: 'Filter events by topics',
				action: 'Filter events by topics',
			},
			{
				name: 'Get Contract Events',
				value: 'getContractEvents',
				description: 'Get events for a specific contract',
				action: 'Get contract events',
			},
		],
		default: 'getLogs',
	},
];

export const eventsFields: INodeProperties[] = [
	// getLogs fields
	{
		displayName: 'From Block',
		name: 'fromBlock',
		type: 'string',
		default: 'latest',
		description: 'Starting block number or "earliest", "latest", "pending"',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getLogs', 'filterEvents'],
			},
		},
	},
	{
		displayName: 'To Block',
		name: 'toBlock',
		type: 'string',
		default: 'latest',
		description: 'Ending block number or "earliest", "latest", "pending"',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getLogs', 'filterEvents'],
			},
		},
	},
	{
		displayName: 'Contract Address',
		name: 'contractAddress',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Filter logs from this contract address (optional)',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getLogs', 'filterEvents', 'getContractEvents'],
			},
		},
	},
	{
		displayName: 'Topics',
		name: 'topics',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: 'Event topics to filter by',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getLogs', 'filterEvents'],
			},
		},
		options: [
			{
				name: 'topicValues',
				displayName: 'Topic',
				values: [
					{
						displayName: 'Position',
						name: 'position',
						type: 'options',
						options: [
							{ name: 'Topic 0 (Event Signature)', value: 0 },
							{ name: 'Topic 1', value: 1 },
							{ name: 'Topic 2', value: 2 },
							{ name: 'Topic 3', value: 3 },
						],
						default: 0,
						description: 'Topic position (0 = event signature)',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: '0x...',
						description: 'Topic value (32-byte hex)',
					},
				],
			},
		],
	},
	// subscribeToLogs fields
	{
		displayName: 'Subscription Address',
		name: 'subscriptionAddress',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Contract address to subscribe to (optional)',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['subscribeToLogs'],
			},
		},
	},
	{
		displayName: 'Subscription Topics',
		name: 'subscriptionTopics',
		type: 'string',
		default: '',
		placeholder: '["0xddf..."]',
		description: 'JSON array of topic filters (optional)',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['subscribeToLogs'],
			},
		},
	},
	// getContractEvents fields
	{
		displayName: 'Event Name',
		name: 'eventName',
		type: 'string',
		default: '',
		placeholder: 'Transfer',
		description: 'Name of the event to filter (optional)',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getContractEvents'],
			},
		},
	},
	{
		displayName: 'Block Range',
		name: 'blockRange',
		type: 'number',
		default: 1000,
		description: 'Number of blocks to search (max 10000)',
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getContractEvents'],
			},
		},
	},
	// Additional options
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['events'],
				operation: ['getLogs', 'filterEvents', 'getContractEvents'],
			},
		},
		options: [
			{
				displayName: 'Block Hash',
				name: 'blockHash',
				type: 'string',
				default: '',
				description: 'Filter by specific block hash (overrides from/to block)',
			},
			{
				displayName: 'Decode Logs',
				name: 'decodeLogs',
				type: 'boolean',
				default: true,
				description: 'Whether to decode log data into readable format',
			},
		],
	},
];

// Common event signatures
const EVENT_SIGNATURES: Record<string, string> = {
	Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
	Approval: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
	TransferSingle: '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62',
	TransferBatch: '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb',
	Deposit: '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
	Withdrawal: '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65',
};

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('gnosisChainApi');
	// Using jsonRpcRequestWithContext which gets credentials internally

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getLogs': {
			const fromBlock = this.getNodeParameter('fromBlock', index) as string;
			const toBlock = this.getNodeParameter('toBlock', index) as string;
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const topicsParam = this.getNodeParameter('topics', index) as {
				topicValues?: Array<{ position: number; value: string }>;
			};
			const options = this.getNodeParameter('options', index) as {
				blockHash?: string;
				decodeLogs?: boolean;
			};

			// Build filter object
			const filter: Record<string, unknown> = {};

			if (options.blockHash) {
				if (!isValidTxHash(options.blockHash)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid block hash format',
						{ itemIndex: index },
					);
				}
				filter.blockHash = options.blockHash;
			} else {
				// Convert block numbers to hex if numeric
				filter.fromBlock = formatBlockParam(fromBlock);
				filter.toBlock = formatBlockParam(toBlock);
			}

			if (contractAddress) {
				if (!isValidAddress(contractAddress)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid contract address',
						{ itemIndex: index },
					);
				}
				filter.address = contractAddress;
			}

			// Build topics array
			if (topicsParam.topicValues && topicsParam.topicValues.length > 0) {
				const topics: (string | null)[] = [null, null, null, null];
				for (const topic of topicsParam.topicValues) {
					if (topic.value) {
						topics[topic.position] = topic.value;
					}
				}
				// Trim trailing nulls
				while (topics.length > 0 && topics[topics.length - 1] === null) {
					topics.pop();
				}
				if (topics.length > 0) {
					filter.topics = topics;
				}
			}

			const logs = await jsonRpcRequestWithContext.call(this, 'eth_getLogs', [filter]);

			const parsedLogs = (logs as Array<Record<string, unknown>>).map((log) =>
				parseLogEntry(log),
			);

			result = {
				logs: parsedLogs,
				count: parsedLogs.length,
				filter: {
					fromBlock,
					toBlock,
					address: contractAddress || null,
				},
			};
			break;
		}

		case 'subscribeToLogs': {
			const address = this.getNodeParameter('subscriptionAddress', index) as string;
			const topicsJson = this.getNodeParameter('subscriptionTopics', index) as string;

			// Build subscription params
			const params: Record<string, unknown> = {};

			if (address) {
				if (!isValidAddress(address)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid subscription address',
						{ itemIndex: index },
					);
				}
				params.address = address;
			}

			if (topicsJson) {
				try {
					params.topics = JSON.parse(topicsJson);
				} catch {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid topics JSON format',
						{ itemIndex: index },
					);
				}
			}

			// Determine WebSocket URL
			const network = credentials.network as string || 'mainnet';
			const wsUrl = network === 'mainnet'
				? 'wss://rpc.gnosischain.com/wss'
				: 'wss://rpc.chiadochain.net/wss';

			// Generate subscription request
			const subscriptionRequest = {
				jsonrpc: '2.0',
				id: 1,
				method: 'eth_subscribe',
				params: ['logs', Object.keys(params).length > 0 ? params : {}],
			};

			result = {
				websocketUrl: wsUrl,
				subscriptionRequest,
				subscriptionRequestJson: JSON.stringify(subscriptionRequest, null, 2),
				usage: {
					description: 'Connect to the WebSocket URL and send the subscription request',
					steps: [
						'Open a WebSocket connection to the websocketUrl',
						'Send the subscriptionRequest as JSON',
						'Receive subscription ID in response',
						'Receive log notifications as they occur',
						'Send {"jsonrpc":"2.0","id":1,"method":"eth_unsubscribe","params":["<subscription_id>"]} to unsubscribe',
					],
				},
				commonEventSignatures: EVENT_SIGNATURES,
			};
			break;
		}

		case 'filterEvents': {
			const fromBlock = this.getNodeParameter('fromBlock', index) as string;
			const toBlock = this.getNodeParameter('toBlock', index) as string;
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const topicsParam = this.getNodeParameter('topics', index) as {
				topicValues?: Array<{ position: number; value: string }>;
			};
			const options = this.getNodeParameter('options', index) as {
				blockHash?: string;
				decodeLogs?: boolean;
			};

			// Build filter object
			const filter: Record<string, unknown> = {};

			if (options.blockHash) {
				filter.blockHash = options.blockHash;
			} else {
				filter.fromBlock = formatBlockParam(fromBlock);
				filter.toBlock = formatBlockParam(toBlock);
			}

			if (contractAddress) {
				if (!isValidAddress(contractAddress)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid contract address',
						{ itemIndex: index },
					);
				}
				filter.address = contractAddress;
			}

			// Build topics array with support for OR conditions
			if (topicsParam.topicValues && topicsParam.topicValues.length > 0) {
				const topicsByPosition: Map<number, string[]> = new Map();

				for (const topic of topicsParam.topicValues) {
					if (topic.value) {
						const existing = topicsByPosition.get(topic.position) || [];
						existing.push(topic.value);
						topicsByPosition.set(topic.position, existing);
					}
				}

				// Find max position
				const maxPosition = Math.max(...topicsByPosition.keys());
				const topics: (string | string[] | null)[] = [];

				for (let i = 0; i <= maxPosition; i++) {
					const values = topicsByPosition.get(i);
					if (values) {
						topics.push(values.length === 1 ? values[0] : values);
					} else {
						topics.push(null);
					}
				}

				filter.topics = topics;
			}

			const logs = await jsonRpcRequestWithContext.call(this, 'eth_getLogs', [filter]);

			// Group logs by event signature
			const groupedLogs: Record<string, Array<Record<string, unknown>>> = {};
			const parsedLogs: Array<Record<string, unknown>> = [];

			for (const log of logs as Array<Record<string, unknown>>) {
				const parsed = parseLogEntry(log);
				parsedLogs.push(parsed);

				const signature = (log.topics as string[])?.[0] || 'unknown';
				const eventName = Object.entries(EVENT_SIGNATURES).find(
					([, sig]) => sig === signature,
				)?.[0] || signature.slice(0, 10);

				if (!groupedLogs[eventName]) {
					groupedLogs[eventName] = [];
				}
				groupedLogs[eventName].push(parsed);
			}

			result = {
				logs: parsedLogs,
				count: parsedLogs.length,
				groupedByEvent: groupedLogs,
				eventCounts: Object.fromEntries(
					Object.entries(groupedLogs).map(([name, logs]) => [name, logs.length]),
				),
			};
			break;
		}

		case 'getContractEvents': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const eventName = this.getNodeParameter('eventName', index) as string;
			const blockRange = this.getNodeParameter('blockRange', index) as number;

			if (!contractAddress) {
				throw new NodeOperationError(
					this.getNode(),
					'Contract address is required',
					{ itemIndex: index },
				);
			}

			if (!isValidAddress(contractAddress)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid contract address',
					{ itemIndex: index },
				);
			}

			// Get latest block
			const latestBlockHex = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []);
			const latestBlock = Number(hexToDecimal(latestBlockHex as string));

			// Calculate from block
			const effectiveRange = Math.min(blockRange, 10000);
			const fromBlockNum = Math.max(0, latestBlock - effectiveRange);

			// Build filter
			const filter: Record<string, unknown> = {
				address: contractAddress,
				fromBlock: '0x' + fromBlockNum.toString(16),
				toBlock: 'latest',
			};

			// Add event signature topic if specified
			if (eventName && EVENT_SIGNATURES[eventName]) {
				filter.topics = [EVENT_SIGNATURES[eventName]];
			}

			const logs = await jsonRpcRequestWithContext.call(this, 'eth_getLogs', [filter]);

			// Parse and group logs
			const parsedLogs = (logs as Array<Record<string, unknown>>).map((log) =>
				parseLogEntry(log),
			);

			// Group by event signature
			const eventGroups: Record<string, Array<Record<string, unknown>>> = {};

			for (const log of parsedLogs) {
				const signature = (log.topics as string[])?.[0] || 'unknown';
				const detectedName = Object.entries(EVENT_SIGNATURES).find(
					([, sig]) => sig === signature,
				)?.[0] || 'Unknown';

				if (!eventGroups[detectedName]) {
					eventGroups[detectedName] = [];
				}
				eventGroups[detectedName].push(log);
			}

			result = {
				contract: contractAddress,
				blockRange: {
					from: fromBlockNum,
					to: latestBlock,
					scanned: effectiveRange,
				},
				events: parsedLogs,
				eventCount: parsedLogs.length,
				eventsByType: eventGroups,
				eventTypeCounts: Object.fromEntries(
					Object.entries(eventGroups).map(([name, logs]) => [name, logs.length]),
				),
				knownEventSignatures: EVENT_SIGNATURES,
			};
			break;
		}

		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown operation: ${operation}`,
				{ itemIndex: index },
			);
	}

	return [{ json: result as IDataObject }];
}

function formatBlockParam(block: string): string {
	if (['earliest', 'latest', 'pending'].includes(block)) {
		return block;
	}
	// If numeric, convert to hex
	const num = parseInt(block, 10);
	if (!isNaN(num)) {
		return '0x' + num.toString(16);
	}
	// If already hex, return as is
	if (block.startsWith('0x')) {
		return block;
	}
	return block;
}
