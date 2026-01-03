/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties, IHttpRequestMethods } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { isValidAddress } from '../../transport';

// Gnosis Beacon Chain API endpoints
const BEACON_API_URL = 'https://beacon.gnosischain.com/api/v1';

export const stakingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['staking'],
			},
		},
		options: [
			{
				name: 'Get Validator Info',
				value: 'getValidatorInfo',
				description: 'Get validator details by index or pubkey',
				action: 'Get validator info',
			},
			{
				name: 'List Validators',
				value: 'listValidators',
				description: 'List all validators',
				action: 'List validators',
			},
			{
				name: 'Get Deposits',
				value: 'getDeposits',
				description: 'Get staking deposits for an address',
				action: 'Get deposits',
			},
			{
				name: 'Get Withdrawals',
				value: 'getWithdrawals',
				description: 'Get withdrawal history',
				action: 'Get withdrawals',
			},
			{
				name: 'Get Beacon Chain Info',
				value: 'getBeaconChainInfo',
				description: 'Get consensus layer information',
				action: 'Get beacon chain info',
			},
			{
				name: 'Get Staking Stats',
				value: 'getStakingStats',
				description: 'Get network staking statistics',
				action: 'Get staking stats',
			},
		],
		default: 'getValidatorInfo',
	},
];

export const stakingFields: INodeProperties[] = [
	// Validator identifier
	{
		displayName: 'Validator Identifier',
		name: 'validatorId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Validator index or pubkey',
		description: 'Validator index number or public key (0x...)',
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getValidatorInfo'],
			},
		},
	},
	// Depositor address
	{
		displayName: 'Depositor Address',
		name: 'depositorAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The address that made deposits',
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getDeposits'],
			},
		},
	},
	// Withdrawal address
	{
		displayName: 'Withdrawal Address',
		name: 'withdrawalAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The withdrawal credentials address',
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getWithdrawals'],
			},
		},
	},
	// Pagination for list validators
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['listValidators'],
			},
		},
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Active', value: 'active' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Exited', value: 'exited' },
					{ name: 'Slashed', value: 'slashed' },
				],
				default: 'all',
				description: 'Filter validators by status',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum number of validators to return',
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				description: 'Offset for pagination',
			},
		],
	},
];

export async function executeStakingOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getValidatorInfo': {
			const validatorId = this.getNodeParameter('validatorId', index) as string;

			try {
				const response = await this.helpers.httpRequest({
					method: 'GET' as IHttpRequestMethods,
					url: `${BEACON_API_URL}/validator/${validatorId}`,
					json: true,
				});

				if (!response || !response.data) {
					throw new NodeOperationError(this.getNode(), 'Validator not found', { itemIndex: index });
				}

				const validator = response.data;
				result = {
					index: validator.validatorindex,
					pubkey: validator.pubkey,
					withdrawalCredentials: validator.withdrawalcredentials,
					balance: validator.balance,
					balanceGNO: (validator.balance / 1e9).toFixed(4),
					effectiveBalance: validator.effectivebalance,
					status: validator.status,
					slashed: validator.slashed,
					activationEpoch: validator.activationepoch,
					activationEligibilityEpoch: validator.activationeligibilityepoch,
					exitEpoch: validator.exitepoch,
					withdrawableEpoch: validator.withdrawableepoch,
					lastAttestationSlot: validator.lastattestationslot,
				};
			} catch (error) {
				// Fallback to basic info if beacon API is not available
				result = {
					validatorId,
					status: 'unknown',
					message: 'Unable to fetch validator info from beacon chain API',
				};
			}
			break;
		}

		case 'listValidators': {
			const options = this.getNodeParameter('options', index, {}) as {
				status?: string;
				limit?: number;
				offset?: number;
			};

			try {
				const queryParams: Record<string, string> = {
					limit: (options.limit || 100).toString(),
					offset: (options.offset || 0).toString(),
				};

				if (options.status && options.status !== 'all') {
					queryParams.status = options.status;
				}

				const response = await this.helpers.httpRequest({
					method: 'GET' as IHttpRequestMethods,
					url: `${BEACON_API_URL}/validators`,
					qs: queryParams,
					json: true,
				});

				const validators = Array.isArray(response.data) ? response.data.map((v: Record<string, unknown>) => ({
					index: v.validatorindex,
					pubkey: v.pubkey,
					balance: v.balance,
					balanceGNO: (Number(v.balance) / 1e9).toFixed(4),
					status: v.status,
					slashed: v.slashed,
				})) : [];

				result = {
					validators,
					total: validators.length,
					limit: options.limit || 100,
					offset: options.offset || 0,
				};
			} catch (error) {
				result = {
					validators: [],
					total: 0,
					message: 'Unable to fetch validators from beacon chain API',
				};
			}
			break;
		}

		case 'getDeposits': {
			const depositorAddress = this.getNodeParameter('depositorAddress', index) as string;

			if (!isValidAddress(depositorAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid depositor address format', { itemIndex: index });
			}

			try {
				const response = await this.helpers.httpRequest({
					method: 'GET' as IHttpRequestMethods,
					url: `${BEACON_API_URL}/deposits`,
					qs: { address: depositorAddress },
					json: true,
				});

				const deposits = Array.isArray(response.data) ? response.data.map((d: Record<string, unknown>) => ({
					pubkey: d.publickey,
					withdrawalCredentials: d.withdrawalcredentials,
					amount: d.amount,
					amountGNO: (Number(d.amount) / 1e9).toFixed(4),
					signature: d.signature,
					blockNumber: d.block_number,
					blockTimestamp: d.block_ts,
					txHash: d.tx_hash,
					validatorIndex: d.validatorindex,
				})) : [];

				result = {
					depositorAddress,
					deposits,
					totalDeposits: deposits.length,
					totalAmountGNO: deposits.reduce((sum: number, d: Record<string, number>) => sum + Number(d.amountGNO), 0).toFixed(4),
				};
			} catch (error) {
				result = {
					depositorAddress,
					deposits: [],
					totalDeposits: 0,
					message: 'Unable to fetch deposits from beacon chain API',
				};
			}
			break;
		}

		case 'getWithdrawals': {
			const withdrawalAddress = this.getNodeParameter('withdrawalAddress', index) as string;

			if (!isValidAddress(withdrawalAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid withdrawal address format', { itemIndex: index });
			}

			try {
				const response = await this.helpers.httpRequest({
					method: 'GET' as IHttpRequestMethods,
					url: `${BEACON_API_URL}/withdrawals`,
					qs: { address: withdrawalAddress },
					json: true,
				});

				const withdrawals = Array.isArray(response.data) ? response.data.map((w: Record<string, unknown>) => ({
					validatorIndex: w.validatorindex,
					address: w.address,
					amount: w.amount,
					amountGNO: (Number(w.amount) / 1e9).toFixed(4),
					slot: w.slot,
					epoch: w.epoch,
					blockNumber: w.block_number,
				})) : [];

				result = {
					withdrawalAddress,
					withdrawals,
					totalWithdrawals: withdrawals.length,
					totalAmountGNO: withdrawals.reduce((sum: number, w: Record<string, number>) => sum + Number(w.amountGNO), 0).toFixed(4),
				};
			} catch (error) {
				result = {
					withdrawalAddress,
					withdrawals: [],
					totalWithdrawals: 0,
					message: 'Unable to fetch withdrawals from beacon chain API',
				};
			}
			break;
		}

		case 'getBeaconChainInfo': {
			try {
				const [epochResponse, syncResponse] = await Promise.all([
					this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${BEACON_API_URL}/epoch/latest`,
						json: true,
					}),
					this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${BEACON_API_URL}/sync/committee/latest`,
						json: true,
					}),
				]);

				result = {
					currentEpoch: epochResponse.data?.epoch,
					currentSlot: epochResponse.data?.lastslot,
					validatorsCount: epochResponse.data?.validatorscount,
					averageValidatorBalance: epochResponse.data?.averagevalidatorbalance,
					totalValidatorBalance: epochResponse.data?.totalvalidatorbalance,
					eligibleEther: epochResponse.data?.eligibleether,
					votedEther: epochResponse.data?.votedether,
					participationRate: epochResponse.data?.globalparticipationrate,
					finalized: epochResponse.data?.finalized,
					syncCommittee: syncResponse.data?.validators?.length || 0,
				};
			} catch (error) {
				result = {
					message: 'Unable to fetch beacon chain info',
					error: 'Beacon chain API may be unavailable',
				};
			}
			break;
		}

		case 'getStakingStats': {
			try {
				const [epochResponse, networkResponse] = await Promise.all([
					this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${BEACON_API_URL}/epoch/latest`,
						json: true,
					}),
					this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${BEACON_API_URL}/networkstats`,
						json: true,
					}),
				]);

				const epoch = epochResponse.data || {};
				const network = networkResponse.data || {};

				result = {
					totalValidators: epoch.validatorscount || 0,
					activeValidators: epoch.activevalidatorscount || 0,
					pendingValidators: epoch.pendingvalidatorscount || 0,
					exitingValidators: epoch.exitingvalidatorscount || 0,
					slashedValidators: epoch.slashedvalidatorscount || 0,
					totalStakedGNO: ((epoch.totalvalidatorbalance || 0) / 1e9).toFixed(4),
					averageBalanceGNO: ((epoch.averagevalidatorbalance || 0) / 1e9).toFixed(4),
					participationRate: epoch.globalparticipationrate || 0,
					depositCount: network.depositcount || 0,
					networkName: 'Gnosis Chain',
					stakingToken: 'GNO',
					minDepositAmount: '1 GNO',
				};
			} catch (error) {
				result = {
					message: 'Unable to fetch staking stats',
					networkName: 'Gnosis Chain',
					stakingToken: 'GNO',
					minDepositAmount: '1 GNO',
				};
			}
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
