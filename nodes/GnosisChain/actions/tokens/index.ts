/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties, IHttpRequestMethods } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { jsonRpcRequestWithContext, explorerApiRequest, isValidAddress, hexToDecimal } from '../../transport';
import type { ExplorerApiResponse, TokenTransfer } from '../../types';
import { GNOSIS_CONTRACTS } from '../../constants';

// CoinGecko API for price data
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export const tokensOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['tokens'],
			},
		},
		options: [
			{
				name: 'Get Token Info',
				value: 'getTokenInfo',
				description: 'Get token details (name, symbol, decimals, supply)',
				action: 'Get token info',
			},
			{
				name: 'Get Token Holders',
				value: 'getTokenHolders',
				description: 'Get list of token holders',
				action: 'Get token holders',
			},
			{
				name: 'Get Token Transfers',
				value: 'getTokenTransfers',
				description: 'Get token transfer history',
				action: 'Get token transfers',
			},
			{
				name: 'Get Bridged Tokens',
				value: 'getBridgedTokens',
				description: 'Get tokens bridged from Ethereum',
				action: 'Get bridged tokens',
			},
			{
				name: 'Get Token Price',
				value: 'getTokenPrice',
				description: 'Get current token price',
				action: 'Get token price',
			},
		],
		default: 'getTokenInfo',
	},
];

export const tokensFields: INodeProperties[] = [
	// Token address
	{
		displayName: 'Token Address',
		name: 'tokenAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x... or GNO, WETH, USDC, USDT',
		description: 'Token contract address or symbol',
		displayOptions: {
			show: {
				resource: ['tokens'],
				operation: ['getTokenInfo', 'getTokenHolders', 'getTokenTransfers', 'getTokenPrice'],
			},
		},
	},
	// Options for token holders and transfers
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['tokens'],
				operation: ['getTokenHolders', 'getTokenTransfers'],
			},
		},
		options: [
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number for pagination',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Number of results per page',
			},
		],
	},
	// Price options
	{
		displayName: 'Currency',
		name: 'currency',
		type: 'options',
		options: [
			{ name: 'USD', value: 'usd' },
			{ name: 'EUR', value: 'eur' },
			{ name: 'GBP', value: 'gbp' },
			{ name: 'ETH', value: 'eth' },
			{ name: 'BTC', value: 'btc' },
		],
		default: 'usd',
		displayOptions: {
			show: {
				resource: ['tokens'],
				operation: ['getTokenPrice'],
			},
		},
	},
];

function resolveTokenAddress(tokenInput: string): string {
	const upperInput = tokenInput.toUpperCase();
	const knownTokens: Record<string, string> = {
		GNO: GNOSIS_CONTRACTS.GNO,
		WETH: GNOSIS_CONTRACTS.WETH,
		USDC: GNOSIS_CONTRACTS.USDC,
		USDT: GNOSIS_CONTRACTS.USDT,
		STGNO: GNOSIS_CONTRACTS.stGNO,
	};

	if (knownTokens[upperInput]) {
		return knownTokens[upperInput];
	}

	return tokenInput;
}

async function getTokenDetails(
	context: IExecuteFunctions,
	tokenAddress: string,
): Promise<{ name: string; symbol: string; decimals: number; totalSupply: string }> {
	// Get name
	const nameData = '0x06fdde03'; // name()
	const nameResult = await jsonRpcRequestWithContext.call(context, 'eth_call', [
		{ to: tokenAddress, data: nameData },
		'latest',
	]) as string;

	let name = 'Unknown';
	try {
		const hexStr = nameResult.replace('0x', '');
		if (hexStr.length >= 128) {
			const length = parseInt(hexStr.slice(64, 128), 16);
			const nameBytes = hexStr.slice(128, 128 + length * 2);
			name = '';
			for (let i = 0; i < nameBytes.length; i += 2) {
				const charCode = parseInt(nameBytes.slice(i, i + 2), 16);
				if (charCode !== 0) name += String.fromCharCode(charCode);
			}
		}
	} catch {
		name = 'Unknown';
	}

	// Get symbol
	const symbolData = '0x95d89b41'; // symbol()
	const symbolResult = await jsonRpcRequestWithContext.call(context, 'eth_call', [
		{ to: tokenAddress, data: symbolData },
		'latest',
	]) as string;

	let symbol = 'UNKNOWN';
	try {
		const hexStr = symbolResult.replace('0x', '');
		if (hexStr.length >= 128) {
			const length = parseInt(hexStr.slice(64, 128), 16);
			const symbolBytes = hexStr.slice(128, 128 + length * 2);
			symbol = '';
			for (let i = 0; i < symbolBytes.length; i += 2) {
				const charCode = parseInt(symbolBytes.slice(i, i + 2), 16);
				if (charCode !== 0) symbol += String.fromCharCode(charCode);
			}
		}
	} catch {
		symbol = 'UNKNOWN';
	}

	// Get decimals
	const decimalsData = '0x313ce567'; // decimals()
	const decimalsResult = await jsonRpcRequestWithContext.call(context, 'eth_call', [
		{ to: tokenAddress, data: decimalsData },
		'latest',
	]) as string;
	const decimals = parseInt(hexToDecimal(decimalsResult), 10);

	// Get total supply
	const supplyData = '0x18160ddd'; // totalSupply()
	const supplyResult = await jsonRpcRequestWithContext.call(context, 'eth_call', [
		{ to: tokenAddress, data: supplyData },
		'latest',
	]) as string;
	const totalSupply = hexToDecimal(supplyResult);

	return { name, symbol, decimals, totalSupply };
}

export async function executeTokensOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;

	let result: Record<string, unknown>;

	switch (operation) {
		case 'getTokenInfo': {
			const tokenInput = this.getNodeParameter('tokenAddress', index) as string;
			const tokenAddress = resolveTokenAddress(tokenInput);

			if (!isValidAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address format', { itemIndex: index });
			}

			const { name, symbol, decimals, totalSupply } = await getTokenDetails(this, tokenAddress);

			// Check if contract is verified
			let verified = false;
			try {
				const abiResponse = await explorerApiRequest.call(this, {
					module: 'contract',
					action: 'getabi',
					address: tokenAddress,
				}) as ExplorerApiResponse<string>;
				verified = abiResponse.status === '1';
			} catch {
				verified = false;
			}

			result = {
				address: tokenAddress,
				name,
				symbol,
				decimals,
				totalSupply,
				totalSupplyFormatted: (Number(totalSupply) / Math.pow(10, decimals)).toString(),
				verified,
				network: 'Gnosis Chain',
			};
			break;
		}

		case 'getTokenHolders': {
			const tokenInput = this.getNodeParameter('tokenAddress', index) as string;
			const tokenAddress = resolveTokenAddress(tokenInput);
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
			};

			if (!isValidAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address format', { itemIndex: index });
			}

			// Get token details first
			const { symbol, decimals } = await getTokenDetails(this, tokenAddress);

			// Note: Gnosisscan may not support token holders directly
			// This is a best-effort implementation
			try {
				const response = await explorerApiRequest.call(this, {
					module: 'token',
					action: 'tokenholderlist',
					contractaddress: tokenAddress,
					page: (options.page || 1).toString(),
					offset: (options.limit || 100).toString(),
				}) as ExplorerApiResponse<Array<{ address: string; value: string }>>;

				const holders = Array.isArray(response.result) ? response.result.map((h) => ({
					address: h.address,
					balance: h.value,
					balanceFormatted: (Number(h.value) / Math.pow(10, decimals)).toString(),
				})) : [];

				result = {
					tokenAddress,
					symbol,
					holders,
					totalHolders: holders.length,
				};
			} catch {
				result = {
					tokenAddress,
					symbol,
					holders: [],
					message: 'Token holder list not available for this token',
				};
			}
			break;
		}

		case 'getTokenTransfers': {
			const tokenInput = this.getNodeParameter('tokenAddress', index) as string;
			const tokenAddress = resolveTokenAddress(tokenInput);
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
			};

			if (!isValidAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address format', { itemIndex: index });
			}

			const response = await explorerApiRequest.call(this, {
				module: 'token',
				action: 'tokentx',
				contractaddress: tokenAddress,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: 'desc',
			}) as ExplorerApiResponse<TokenTransfer[]>;

			const transfers = Array.isArray(response.result) ? response.result.map((tx) => ({
				hash: tx.hash,
				blockNumber: parseInt(tx.blockNumber, 10),
				timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
				from: tx.from,
				to: tx.to,
				value: tx.value,
				valueFormatted: (Number(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal, 10))).toString(),
				tokenName: tx.tokenName,
				tokenSymbol: tx.tokenSymbol,
				tokenDecimal: parseInt(tx.tokenDecimal, 10),
			})) : [];

			result = {
				tokenAddress,
				transfers,
				totalTransfers: transfers.length,
			};
			break;
		}

		case 'getBridgedTokens': {
			// Get commonly bridged tokens on Gnosis Chain
			const bridgedTokens = [
				{ address: GNOSIS_CONTRACTS.WETH, ethereumAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
				{ address: GNOSIS_CONTRACTS.USDC, ethereumAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
				{ address: GNOSIS_CONTRACTS.USDT, ethereumAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
				{ address: GNOSIS_CONTRACTS.GNO, ethereumAddress: '0x6810e776880C02933D47DB1b9fc05908e5386b96', symbol: 'GNO' },
			];

			const tokenDetails = await Promise.all(
				bridgedTokens.map(async (token) => {
					try {
						const details = await getTokenDetails(this, token.address);
						return {
							...token,
							name: details.name,
							decimals: details.decimals,
							totalSupply: details.totalSupply,
							totalSupplyFormatted: (Number(details.totalSupply) / Math.pow(10, details.decimals)).toString(),
						};
					} catch {
						return {
							...token,
							name: 'Unknown',
							decimals: 18,
							totalSupply: '0',
							totalSupplyFormatted: '0',
						};
					}
				}),
			);

			result = {
				bridgedTokens: tokenDetails,
				bridgeContracts: {
					omniBridge: '0x88ad09518695c6c3712AC10a214bE5109a655671',
					xDaiBridge: '0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6',
				},
				network: 'Gnosis Chain',
			};
			break;
		}

		case 'getTokenPrice': {
			const tokenInput = this.getNodeParameter('tokenAddress', index) as string;
			const currency = this.getNodeParameter('currency', index, 'usd') as string;
			const tokenAddress = resolveTokenAddress(tokenInput);

			// Map known tokens to CoinGecko IDs
			const tokenToCoingecko: Record<string, string> = {
				[GNOSIS_CONTRACTS.GNO.toLowerCase()]: 'gnosis',
				[GNOSIS_CONTRACTS.WETH.toLowerCase()]: 'weth',
				[GNOSIS_CONTRACTS.USDC.toLowerCase()]: 'usd-coin',
				[GNOSIS_CONTRACTS.USDT.toLowerCase()]: 'tether',
			};

			const coingeckoId = tokenToCoingecko[tokenAddress.toLowerCase()];

			if (!coingeckoId) {
				// Try to get price from CoinGecko by contract address
				try {
					const response = await this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${COINGECKO_API}/simple/token_price/xdai`,
						qs: {
							contract_addresses: tokenAddress,
							vs_currencies: currency,
							include_24hr_change: 'true',
							include_market_cap: 'true',
						},
						json: true,
					});

					const tokenData = response[tokenAddress.toLowerCase()];
					if (tokenData) {
						result = {
							tokenAddress,
							price: tokenData[currency],
							currency: currency.toUpperCase(),
							priceChange24h: tokenData[`${currency}_24h_change`],
							marketCap: tokenData[`${currency}_market_cap`],
							source: 'CoinGecko',
						};
					} else {
						result = {
							tokenAddress,
							message: 'Price data not available for this token',
						};
					}
				} catch {
					result = {
						tokenAddress,
						message: 'Unable to fetch price data',
					};
				}
			} else {
				try {
					const response = await this.helpers.httpRequest({
						method: 'GET' as IHttpRequestMethods,
						url: `${COINGECKO_API}/simple/price`,
						qs: {
							ids: coingeckoId,
							vs_currencies: currency,
							include_24hr_change: 'true',
							include_market_cap: 'true',
							include_24hr_vol: 'true',
						},
						json: true,
					});

					const tokenData = response[coingeckoId];
					if (tokenData) {
						result = {
							tokenAddress,
							tokenId: coingeckoId,
							price: tokenData[currency],
							currency: currency.toUpperCase(),
							priceChange24h: tokenData[`${currency}_24h_change`],
							marketCap: tokenData[`${currency}_market_cap`],
							volume24h: tokenData[`${currency}_24h_vol`],
							source: 'CoinGecko',
						};
					} else {
						result = {
							tokenAddress,
							message: 'Price data not available',
						};
					}
				} catch {
					result = {
						tokenAddress,
						message: 'Unable to fetch price data from CoinGecko',
					};
				}
			}
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
