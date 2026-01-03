/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, explorerApiRequest, isValidAddress, hexToDecimal, formatBlockNumber } from '../../transport';
import { encodeFunctionSignature, encodeAddress, encodeUint256 } from '../../utils';
import type { ExplorerApiResponse, ContractSource, LogEntry } from '../../types';

export const smartContractsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['smartContracts'],
			},
		},
		options: [
			{
				name: 'Get Contract ABI',
				value: 'getContractABI',
				description: 'Get verified contract ABI',
				action: 'Get contract ABI',
			},
			{
				name: 'Read Contract',
				value: 'readContract',
				description: 'Call a view/pure function',
				action: 'Read contract',
			},
			{
				name: 'Write Contract',
				value: 'writeContract',
				description: 'Send transaction to contract',
				action: 'Write contract',
			},
			{
				name: 'Get Contract Source',
				value: 'getContractSource',
				description: 'Get verified source code',
				action: 'Get contract source',
			},
			{
				name: 'Get Contract Events',
				value: 'getContractEvents',
				description: 'Get event logs from contract',
				action: 'Get contract events',
			},
		],
		default: 'getContractABI',
	},
];

export const smartContractsFields: INodeProperties[] = [
	// Contract address
	{
		displayName: 'Contract Address',
		name: 'contractAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The contract address',
		displayOptions: {
			show: {
				resource: ['smartContracts'],
			},
		},
	},
	// Read Contract fields
	{
		displayName: 'Function Signature',
		name: 'functionSignature',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'balanceOf(address)',
		description: 'The function signature to call',
		displayOptions: {
			show: {
				resource: ['smartContracts'],
				operation: ['readContract'],
			},
		},
	},
	{
		displayName: 'Function Parameters',
		name: 'functionParams',
		type: 'fixedCollection',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['smartContracts'],
				operation: ['readContract'],
			},
		},
		options: [
			{
				name: 'params',
				displayName: 'Parameters',
				values: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Address', value: 'address' },
							{ name: 'Uint256', value: 'uint256' },
							{ name: 'Bytes32', value: 'bytes32' },
							{ name: 'Bool', value: 'bool' },
							{ name: 'String', value: 'string' },
						],
						default: 'address',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	// Write Contract fields
	{
		displayName: 'Function Data',
		name: 'functionData',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The encoded function call data',
		displayOptions: {
			show: {
				resource: ['smartContracts'],
				operation: ['writeContract'],
			},
		},
	},
	{
		displayName: 'Value (xDai)',
		name: 'value',
		type: 'string',
		default: '0',
		description: 'Amount of xDai to send with transaction',
		displayOptions: {
			show: {
				resource: ['smartContracts'],
				operation: ['writeContract'],
			},
		},
	},
	// Event filters
	{
		displayName: 'Event Filter Options',
		name: 'eventOptions',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['smartContracts'],
				operation: ['getContractEvents'],
			},
		},
		options: [
			{
				displayName: 'From Block',
				name: 'fromBlock',
				type: 'string',
				default: 'latest',
				description: 'Starting block number or "latest"',
			},
			{
				displayName: 'To Block',
				name: 'toBlock',
				type: 'string',
				default: 'latest',
				description: 'Ending block number or "latest"',
			},
			{
				displayName: 'Topic 0 (Event Signature)',
				name: 'topic0',
				type: 'string',
				default: '',
				placeholder: '0x...',
				description: 'Event signature hash to filter',
			},
			{
				displayName: 'Topic 1',
				name: 'topic1',
				type: 'string',
				default: '',
				placeholder: '0x...',
			},
			{
				displayName: 'Topic 2',
				name: 'topic2',
				type: 'string',
				default: '',
				placeholder: '0x...',
			},
		],
	},
];

export async function executeSmartContractsOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const contractAddress = this.getNodeParameter('contractAddress', index) as string;

	if (!isValidAddress(contractAddress)) {
		throw new NodeOperationError(this.getNode(), 'Invalid contract address format', { itemIndex: index });
	}

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getContractABI': {
			const response = await explorerApiRequest.call(this, {
				module: 'contract',
				action: 'getabi',
				address: contractAddress,
			}) as ExplorerApiResponse<string>;

			if (response.status !== '1') {
				throw new NodeOperationError(this.getNode(), 'Contract ABI not found or not verified', { itemIndex: index });
			}

			let abi;
			try {
				abi = JSON.parse(response.result);
			} catch {
				abi = response.result;
			}

			result = {
				contractAddress,
				abi,
				verified: true,
			};
			break;
		}

		case 'readContract': {
			const functionSignature = this.getNodeParameter('functionSignature', index) as string;
			const functionParamsData = this.getNodeParameter('functionParams', index, { params: [] }) as {
				params?: Array<{ type: string; value: string }>;
			};

			const selector = encodeFunctionSignature(functionSignature);
			let encodedParams = '';

			if (functionParamsData.params && functionParamsData.params.length > 0) {
				for (const param of functionParamsData.params) {
					switch (param.type) {
						case 'address':
							encodedParams += encodeAddress(param.value);
							break;
						case 'uint256':
							encodedParams += encodeUint256(param.value);
							break;
						case 'bytes32':
							encodedParams += param.value.replace('0x', '').padEnd(64, '0');
							break;
						case 'bool':
							encodedParams += (param.value === 'true' ? '1' : '0').padStart(64, '0');
							break;
						case 'string': {
							// Simple string encoding (offset + length + data)
							const stringBytes = Buffer.from(param.value).toString('hex');
							encodedParams += '0000000000000000000000000000000000000000000000000000000000000020';
							encodedParams += param.value.length.toString(16).padStart(64, '0');
							encodedParams += stringBytes.padEnd(64, '0');
							break;
						}
					}
				}
			}

			const callData = selector + encodedParams;

			const callResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: contractAddress, data: callData },
				'latest',
			]) as string;

			result = {
				contractAddress,
				functionSignature,
				rawResult: callResult,
				decodedResult: callResult !== '0x' ? hexToDecimal(callResult) : null,
			};
			break;
		}

		case 'writeContract': {
			const functionData = this.getNodeParameter('functionData', index) as string;
			const value = this.getNodeParameter('value', index, '0') as string;

			// Note: This prepares the transaction but doesn't sign it
			// The user needs to sign and send via sendTransaction
			const gasEstimate = await jsonRpcRequestWithContext.call(this, 'eth_estimateGas', [
				{
					to: contractAddress,
					data: functionData,
					value: value !== '0' ? '0x' + BigInt(parseFloat(value) * 1e18).toString(16) : undefined,
				},
			]) as string;

			const gasPrice = await jsonRpcRequestWithContext.call(this, 'eth_gasPrice', []) as string;

			result = {
				contractAddress,
				functionData,
				value,
				estimatedGas: hexToDecimal(gasEstimate),
				gasPrice: hexToDecimal(gasPrice),
				gasPriceGwei: (Number(hexToDecimal(gasPrice)) / 1e9).toFixed(4),
				message: 'Transaction prepared. Sign and submit using sendTransaction operation.',
			};
			break;
		}

		case 'getContractSource': {
			const response = await explorerApiRequest.call(this, {
				module: 'contract',
				action: 'getsourcecode',
				address: contractAddress,
			}) as ExplorerApiResponse<ContractSource[]>;

			if (!response.result || response.result.length === 0) {
				throw new NodeOperationError(this.getNode(), 'Contract source not found or not verified', { itemIndex: index });
			}

			const source = response.result[0];

			result = {
				contractAddress,
				contractName: source.contractName,
				compilerVersion: source.compilerVersion,
				optimizationUsed: source.optimizationUsed,
				runs: source.runs,
				sourceCode: source.sourceCode,
				abi: source.abi,
				constructorArguments: source.constructorArguments,
				library: source.library,
				verified: true,
			};
			break;
		}

		case 'getContractEvents': {
			const eventOptions = this.getNodeParameter('eventOptions', index, {}) as {
				fromBlock?: string;
				toBlock?: string;
				topic0?: string;
				topic1?: string;
				topic2?: string;
			};

			const filterParams: Record<string, unknown> = {
				address: contractAddress,
				fromBlock: eventOptions.fromBlock || 'latest',
				toBlock: eventOptions.toBlock || 'latest',
			};

			// Handle block numbers
			if (filterParams.fromBlock !== 'latest' && filterParams.fromBlock !== 'earliest' && filterParams.fromBlock !== 'pending') {
				filterParams.fromBlock = formatBlockNumber(filterParams.fromBlock as string);
			}
			if (filterParams.toBlock !== 'latest' && filterParams.toBlock !== 'earliest' && filterParams.toBlock !== 'pending') {
				filterParams.toBlock = formatBlockNumber(filterParams.toBlock as string);
			}

			const topics: (string | null)[] = [];
			if (eventOptions.topic0) topics.push(eventOptions.topic0);
			if (eventOptions.topic1) topics.push(topics.length === 0 ? null : eventOptions.topic1);
			if (eventOptions.topic2) topics.push(topics.length === 0 ? null : eventOptions.topic2);

			if (topics.length > 0) {
				filterParams.topics = topics;
			}

			const logs = await jsonRpcRequestWithContext.call(this, 'eth_getLogs', [filterParams]) as LogEntry[];

			const parsedLogs = logs.map((log) => ({
				address: log.address,
				topics: log.topics,
				data: log.data,
				blockNumber: parseInt(log.blockNumber, 16),
				blockHash: log.blockHash,
				transactionHash: log.transactionHash,
				transactionIndex: parseInt(log.transactionIndex, 16),
				logIndex: parseInt(log.logIndex, 16),
				removed: log.removed,
			}));

			result = {
				contractAddress,
				fromBlock: eventOptions.fromBlock || 'latest',
				toBlock: eventOptions.toBlock || 'latest',
				logs: parsedLogs,
				logCount: parsedLogs.length,
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
