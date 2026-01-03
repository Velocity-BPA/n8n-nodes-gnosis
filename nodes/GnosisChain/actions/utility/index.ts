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
import { jsonRpcRequestWithContext, explorerApiRequest, weiToXDai, xDaiToWei, gweiToWei, weiToGwei, GnosisCredentials, getRpcEndpoint } from '../../transport';
import { encodeFunctionSignature, encodeAddress, encodeUint256, encodeBytes32, decodeAddress, decodeUint256, decodeBool, decodeString } from '../../utils';

export const utilityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['utility'],
			},
		},
		options: [
			{
				name: 'Convert Units',
				value: 'convertUnits',
				description: 'Convert between xDai, Wei, and Gwei',
				action: 'Convert units',
			},
			{
				name: 'Encode Function',
				value: 'encodeFunction',
				description: 'ABI encode a function call',
				action: 'Encode function call',
			},
			{
				name: 'Decode Data',
				value: 'decodeData',
				description: 'ABI decode return data',
				action: 'Decode data',
			},
			{
				name: 'Get API Health',
				value: 'getAPIHealth',
				description: 'Check RPC and Explorer API status',
				action: 'Check API health',
			},
		],
		default: 'convertUnits',
	},
];

export const utilityFields: INodeProperties[] = [
	// convertUnits fields
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		default: '1',
		description: 'Amount to convert',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits'],
			},
		},
	},
	{
		displayName: 'From Unit',
		name: 'fromUnit',
		type: 'options',
		options: [
			{ name: 'Wei', value: 'wei' },
			{ name: 'Gwei', value: 'gwei' },
			{ name: 'xDai', value: 'xdai' },
			{ name: 'GNO (18 decimals)', value: 'gno' },
		],
		default: 'xdai',
		description: 'Source unit',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits'],
			},
		},
	},
	{
		displayName: 'To Unit',
		name: 'toUnit',
		type: 'options',
		options: [
			{ name: 'Wei', value: 'wei' },
			{ name: 'Gwei', value: 'gwei' },
			{ name: 'xDai', value: 'xdai' },
		],
		default: 'wei',
		description: 'Target unit',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits'],
			},
		},
	},
	// encodeFunction fields
	{
		displayName: 'Function Signature',
		name: 'functionSignature',
		type: 'string',
		default: '',
		placeholder: 'transfer(address,uint256)',
		description: 'Function signature to encode',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['encodeFunction'],
			},
		},
	},
	{
		displayName: 'Parameters',
		name: 'functionParameters',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: 'Function parameters to encode',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['encodeFunction'],
			},
		},
		options: [
			{
				name: 'params',
				displayName: 'Parameter',
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
						description: 'Parameter type',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Parameter value',
					},
				],
			},
		],
	},
	// decodeData fields
	{
		displayName: 'Data to Decode',
		name: 'dataToDecode',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Hex data to decode',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['decodeData'],
			},
		},
	},
	{
		displayName: 'Data Types',
		name: 'dataTypes',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: 'Expected data types in order',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['decodeData'],
			},
		},
		options: [
			{
				name: 'types',
				displayName: 'Type',
				values: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Address', value: 'address' },
							{ name: 'Uint256', value: 'uint256' },
							{ name: 'Bool', value: 'bool' },
							{ name: 'Bytes32', value: 'bytes32' },
							{ name: 'String', value: 'string' },
						],
						default: 'uint256',
						description: 'Data type',
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Field name (optional)',
					},
				],
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('gnosisChainApi') as GnosisCredentials;
	const rpcUrl = getRpcEndpoint(credentials);

	let result: Record<string, unknown>;

	switch (operation) {
		case 'convertUnits': {
			const amount = this.getNodeParameter('amount', index) as string;
			const fromUnit = this.getNodeParameter('fromUnit', index) as string;
			const toUnit = this.getNodeParameter('toUnit', index) as string;

			// First convert to Wei
			let weiAmount: string;

			switch (fromUnit) {
				case 'wei':
					weiAmount = amount;
					break;
				case 'gwei':
					weiAmount = gweiToWei(amount);
					break;
				case 'xdai':
				case 'gno':
					weiAmount = xDaiToWei(amount);
					break;
				default:
					throw new NodeOperationError(
						this.getNode(),
						`Unknown source unit: ${fromUnit}`,
						{ itemIndex: index },
					);
			}

			// Then convert from Wei to target
			let convertedAmount: string;

			switch (toUnit) {
				case 'wei':
					convertedAmount = weiAmount;
					break;
				case 'gwei':
					convertedAmount = weiToGwei(weiAmount);
					break;
				case 'xdai':
					convertedAmount = weiToXDai(weiAmount);
					break;
				default:
					throw new NodeOperationError(
						this.getNode(),
						`Unknown target unit: ${toUnit}`,
						{ itemIndex: index },
					);
			}

			result = {
				original: {
					amount,
					unit: fromUnit,
				},
				converted: {
					amount: convertedAmount,
					unit: toUnit,
				},
				wei: weiAmount,
				conversions: {
					wei: weiAmount,
					gwei: weiToGwei(weiAmount),
					xdai: weiToXDai(weiAmount),
				},
			};
			break;
		}

		case 'encodeFunction': {
			const functionSignature = this.getNodeParameter('functionSignature', index) as string;
			const paramsInput = this.getNodeParameter('functionParameters', index) as {
				params?: Array<{ type: string; value: string }>;
			};

			if (!functionSignature) {
				throw new NodeOperationError(
					this.getNode(),
					'Function signature is required',
					{ itemIndex: index },
				);
			}

			// Get function selector
			const selector = encodeFunctionSignature(functionSignature);

			// Encode parameters
			let encodedParams = '';
			const paramDetails: Array<{ type: string; value: string; encoded: string }> = [];

			if (paramsInput.params && paramsInput.params.length > 0) {
				for (const param of paramsInput.params) {
					let encoded: string;

					switch (param.type) {
						case 'address':
							encoded = encodeAddress(param.value);
							break;
						case 'uint256':
							encoded = encodeUint256(param.value);
							break;
						case 'bytes32':
							encoded = encodeBytes32(param.value);
							break;
						case 'bool':
							encoded = param.value.toLowerCase() === 'true' || param.value === '1'
								? '0000000000000000000000000000000000000000000000000000000000000001'
								: '0000000000000000000000000000000000000000000000000000000000000000';
							break;
						case 'string': {
							// Simple string encoding (position + length + data)
							// For complex strings, a full ABI encoder would be needed
							const bytes = Buffer.from(param.value, 'utf8');
							const length = encodeUint256(bytes.length.toString());
							const data = bytes.toString('hex').padEnd(64, '0');
							encoded = length + data;
							break;
						}
						default:
							throw new NodeOperationError(
								this.getNode(),
								`Unsupported parameter type: ${param.type}`,
								{ itemIndex: index },
							);
					}

					paramDetails.push({
						type: param.type,
						value: param.value,
						encoded,
					});
					encodedParams += encoded;
				}
			}

			const fullCallData = selector + encodedParams;

			result = {
				functionSignature,
				selector,
				parameters: paramDetails,
				encodedParameters: encodedParams ? '0x' + encodedParams : null,
				callData: fullCallData,
				callDataLength: fullCallData.length / 2 - 1, // bytes, excluding 0x
			};
			break;
		}

		case 'decodeData': {
			const data = this.getNodeParameter('dataToDecode', index) as string;
			const typesInput = this.getNodeParameter('dataTypes', index) as {
				types?: Array<{ type: string; name?: string }>;
			};

			if (!data) {
				throw new NodeOperationError(
					this.getNode(),
					'Data to decode is required',
					{ itemIndex: index },
				);
			}

			// Remove 0x prefix
			const cleanData = data.startsWith('0x') ? data.slice(2) : data;

			const decoded: Array<{
				name: string;
				type: string;
				value: string | number | boolean;
				raw: string;
			}> = [];

			if (typesInput.types && typesInput.types.length > 0) {
				let offset = 0;

				for (let i = 0; i < typesInput.types.length; i++) {
					const typeInfo = typesInput.types[i];
					const chunk = cleanData.slice(offset, offset + 64);

					if (chunk.length < 64) {
						break; // Not enough data
					}

					let value: string | number | boolean;

					switch (typeInfo.type) {
						case 'address':
							value = decodeAddress(chunk);
							break;
						case 'uint256':
							value = decodeUint256(chunk);
							break;
						case 'bool':
							value = decodeBool(chunk);
							break;
						case 'bytes32':
							value = '0x' + chunk;
							break;
						case 'string':
							value = decodeString(chunk);
							break;
						default:
							value = '0x' + chunk;
					}

					decoded.push({
						name: typeInfo.name || `param${i}`,
						type: typeInfo.type,
						value,
						raw: '0x' + chunk,
					});

					offset += 64;
				}
			} else {
				// Auto-decode as 32-byte chunks
				for (let i = 0; i < cleanData.length; i += 64) {
					const chunk = cleanData.slice(i, i + 64);
					if (chunk.length < 64) break;

					decoded.push({
						name: `word${i / 64}`,
						type: 'bytes32',
						value: '0x' + chunk,
						raw: '0x' + chunk,
					});
				}
			}

			// Create named result object
			const namedResult: Record<string, unknown> = {};
			for (const item of decoded) {
				namedResult[item.name] = item.value;
			}

			result = {
				originalData: data,
				dataLength: cleanData.length / 2,
				decoded,
				values: namedResult,
			};
			break;
		}

		case 'getAPIHealth': {
			const healthChecks: Record<string, unknown> = {
				timestamp: new Date().toISOString(),
				rpc: { url: rpcUrl, status: 'unknown' },
				explorer: { status: 'unknown' },
			};

			// Check RPC health
			const rpcStart = Date.now();
			try {
				const chainId = await jsonRpcRequestWithContext.call(this, 'eth_chainId', []);
				const blockNumber = await jsonRpcRequestWithContext.call(this, 'eth_blockNumber', []);
				const rpcLatency = Date.now() - rpcStart;

				healthChecks.rpc = {
					url: rpcUrl,
					status: 'healthy',
					chainId: parseInt(chainId as string, 16),
					latestBlock: parseInt(blockNumber as string, 16),
					latencyMs: rpcLatency,
				};
			} catch (error) {
				healthChecks.rpc = {
					url: rpcUrl,
					status: 'unhealthy',
					error: error instanceof Error ? error.message : 'Unknown error',
					latencyMs: Date.now() - rpcStart,
				};
			}

			// Check Explorer API health
			const explorerStart = Date.now();
			try {
				const explorerResponse = await explorerApiRequest.call(
					this,
					{
						module: 'stats',
						action: 'ethprice',
					},
				);
				const explorerLatency = Date.now() - explorerStart;

				healthChecks.explorer = {
					status: explorerResponse ? 'healthy' : 'degraded',
					latencyMs: explorerLatency,
				};
			} catch (error) {
				healthChecks.explorer = {
					status: 'unhealthy',
					error: error instanceof Error ? error.message : 'Unknown error',
					latencyMs: Date.now() - explorerStart,
				};
			}

			// Check sync status
			try {
				const syncStatus = await jsonRpcRequestWithContext.call(this, 'eth_syncing', []);
				healthChecks.syncStatus = syncStatus === false
					? { synced: true }
					: { synced: false, details: syncStatus };
			} catch {
				healthChecks.syncStatus = { error: 'Could not determine sync status' };
			}

			// Check peer count
			try {
				const peerCount = await jsonRpcRequestWithContext.call(this, 'net_peerCount', []);
				healthChecks.peerCount = parseInt(peerCount as string, 16);
			} catch {
				healthChecks.peerCount = null;
			}

			// Overall status
			const rpcHealthy = (healthChecks.rpc as Record<string, unknown>).status === 'healthy';
			const explorerHealthy = (healthChecks.explorer as Record<string, unknown>).status === 'healthy';

			healthChecks.overall = {
				status: rpcHealthy && explorerHealthy ? 'healthy' : rpcHealthy ? 'degraded' : 'unhealthy',
				rpcHealthy,
				explorerHealthy,
			};

			result = healthChecks;
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
