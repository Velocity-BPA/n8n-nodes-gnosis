/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Import resource operations and fields
import {
	accountsOperations,
	accountsFields,
	executeAccountsOperation,
} from './actions/accounts';

import {
	transactionsOperations,
	transactionsFields,
	executeTransactionsOperation,
} from './actions/transactions';

import {
	blocksOperations,
	blocksFields,
	executeBlocksOperation,
} from './actions/blocks';

import {
	stakingOperations,
	stakingFields,
	executeStakingOperation,
} from './actions/staking';

import {
	smartContractsOperations,
	smartContractsFields,
	executeSmartContractsOperation,
} from './actions/smartContracts';

import {
	tokensOperations,
	tokensFields,
	executeTokensOperation,
} from './actions/tokens';

import {
	nftsOperations,
	nftsFields,
	executeNftsOperation,
} from './actions/nfts';

import {
	bridgeOperations,
	bridgeFields,
	executeBridgeOperation,
} from './actions/bridge';

import {
	networkOperations,
	networkFields,
	executeNetworkOperation,
} from './actions/network';

import {
	eventsOperations,
	eventsFields,
	execute as executeEvents,
} from './actions/events';

import {
	utilityOperations,
	utilityFields,
	execute as executeUtility,
} from './actions/utility';

// Log licensing notice once on module load
const LICENSING_LOGGED = Symbol.for('n8n-nodes-gnosis.licensing.logged');
if (!(globalThis as Record<symbol, boolean>)[LICENSING_LOGGED]) {
	console.warn(`[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`);
	(globalThis as Record<symbol, boolean>)[LICENSING_LOGGED] = true;
}

export class GnosisChain implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Gnosis Chain',
		name: 'gnosisChain',
		icon: 'file:gnosischain.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Gnosis Chain blockchain - accounts, transactions, staking, bridges, and more',
		defaults: {
			name: 'Gnosis Chain',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'gnosisChainApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'accounts',
						description: 'Query account balances, transactions, and token holdings',
					},
					{
						name: 'Block',
						value: 'blocks',
						description: 'Get block information and transactions',
					},
					{
						name: 'Bridge',
						value: 'bridge',
						description: 'Track cross-chain bridge transactions (OmniBridge, xDai Bridge)',
					},
					{
						name: 'Event',
						value: 'events',
						description: 'Query and filter event logs',
					},
					{
						name: 'Network',
						value: 'network',
						description: 'Get network status, gas prices, and chain statistics',
					},
					{
						name: 'NFT',
						value: 'nfts',
						description: 'Query NFT metadata, ownership, and transfers',
					},
					{
						name: 'Smart Contract',
						value: 'smartContracts',
						description: 'Read and interact with smart contracts',
					},
					{
						name: 'Staking',
						value: 'staking',
						description: 'Query GNO staking, validators, and beacon chain',
					},
					{
						name: 'Token',
						value: 'tokens',
						description: 'Get token information, holders, and transfers',
					},
					{
						name: 'Transaction',
						value: 'transactions',
						description: 'Get transaction details, receipts, and status',
					},
					{
						name: 'Utility',
						value: 'utility',
						description: 'Convert units, encode/decode data, check API health',
					},
				],
				default: 'accounts',
			},
			// Operations for each resource
			...accountsOperations,
			...transactionsOperations,
			...blocksOperations,
			...stakingOperations,
			...smartContractsOperations,
			...tokensOperations,
			...nftsOperations,
			...bridgeOperations,
			...networkOperations,
			...eventsOperations,
			...utilityOperations,
			// Fields for each resource
			...accountsFields,
			...transactionsFields,
			...blocksFields,
			...stakingFields,
			...smartContractsFields,
			...tokensFields,
			...nftsFields,
			...bridgeFields,
			...networkFields,
			...eventsFields,
			...utilityFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				let result: INodeExecutionData[];

				switch (resource) {
					case 'accounts':
						result = await executeAccountsOperation.call(this, i);
						break;
					case 'transactions':
						result = await executeTransactionsOperation.call(this, i);
						break;
					case 'blocks':
						result = await executeBlocksOperation.call(this, i);
						break;
					case 'staking':
						result = await executeStakingOperation.call(this, i);
						break;
					case 'smartContracts':
						result = await executeSmartContractsOperation.call(this, i);
						break;
					case 'tokens':
						result = await executeTokensOperation.call(this, i);
						break;
					case 'nfts':
						result = await executeNftsOperation.call(this, i);
						break;
					case 'bridge':
						result = await executeBridgeOperation.call(this, i);
						break;
					case 'network':
						result = await executeNetworkOperation.call(this, i);
						break;
					case 'events':
						result = await executeEvents.call(this, i);
						break;
					case 'utility':
						result = await executeUtility.call(this, i);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown resource: ${resource}`,
							{ itemIndex: i },
						);
				}

				returnData.push(...result);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
