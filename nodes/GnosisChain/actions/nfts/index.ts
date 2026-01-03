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

export const nftsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['nfts'],
			},
		},
		options: [
			{
				name: 'Get NFT Metadata',
				value: 'getNFTMetadata',
				description: 'Get NFT token metadata',
				action: 'Get NFT metadata',
			},
			{
				name: 'Get NFT Transfers',
				value: 'getNFTTransfers',
				description: 'Get NFT transfer history',
				action: 'Get NFT transfers',
			},
			{
				name: 'Get Collection Info',
				value: 'getCollectionInfo',
				description: 'Get NFT collection details',
				action: 'Get collection info',
			},
		],
		default: 'getNFTMetadata',
	},
];

export const nftsFields: INodeProperties[] = [
	// Contract address
	{
		displayName: 'Contract Address',
		name: 'contractAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The NFT contract address',
		displayOptions: {
			show: {
				resource: ['nfts'],
			},
		},
	},
	// Token ID
	{
		displayName: 'Token ID',
		name: 'tokenId',
		type: 'string',
		required: true,
		default: '',
		description: 'The NFT token ID',
		displayOptions: {
			show: {
				resource: ['nfts'],
				operation: ['getNFTMetadata'],
			},
		},
	},
	// Options for transfers
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['nfts'],
				operation: ['getNFTTransfers'],
			},
		},
		options: [
			{
				displayName: 'Token ID',
				name: 'tokenId',
				type: 'string',
				default: '',
				description: 'Filter by specific token ID',
			},
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
];

async function fetchMetadataFromUri(
	context: IExecuteFunctions,
	uri: string,
): Promise<Record<string, unknown> | null> {
	try {
		// Handle IPFS URIs
		let fetchUri = uri;
		if (uri.startsWith('ipfs://')) {
			fetchUri = `https://ipfs.io/ipfs/${uri.slice(7)}`;
		} else if (uri.startsWith('ar://')) {
			fetchUri = `https://arweave.net/${uri.slice(5)}`;
		}

		// Handle data URIs
		if (uri.startsWith('data:application/json')) {
			const base64Match = uri.match(/data:application\/json;base64,(.+)/);
			if (base64Match) {
				const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
				return JSON.parse(decoded);
			}
			const jsonMatch = uri.match(/data:application\/json,(.+)/);
			if (jsonMatch) {
				return JSON.parse(decodeURIComponent(jsonMatch[1]));
			}
		}

		const response = await context.helpers.httpRequest({
			method: 'GET' as IHttpRequestMethods,
			url: fetchUri,
			json: true,
		});

		return response;
	} catch {
		return null;
	}
}

export async function executeNftsOperation(
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
		case 'getNFTMetadata': {
			const tokenId = this.getNodeParameter('tokenId', index) as string;

			// Get token URI
			const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
			const tokenUriData = '0xc87b56dd' + tokenIdHex; // tokenURI(uint256)

			const tokenUriResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: contractAddress, data: tokenUriData },
				'latest',
			]) as string;

			let tokenUri = '';
			try {
				const hexStr = tokenUriResult.replace('0x', '');
				if (hexStr.length >= 128) {
					const offset = parseInt(hexStr.slice(0, 64), 16) * 2;
					const length = parseInt(hexStr.slice(offset, offset + 64), 16);
					const uriBytes = hexStr.slice(offset + 64, offset + 64 + length * 2);
					for (let i = 0; i < uriBytes.length; i += 2) {
						const charCode = parseInt(uriBytes.slice(i, i + 2), 16);
						if (charCode !== 0) tokenUri += String.fromCharCode(charCode);
					}
				}
			} catch {
				tokenUri = '';
			}

			// Get owner
			const ownerOfData = '0x6352211e' + tokenIdHex; // ownerOf(uint256)
			let owner = '';
			try {
				const ownerResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
					{ to: contractAddress, data: ownerOfData },
					'latest',
				]) as string;
				owner = '0x' + ownerResult.slice(-40);
			} catch {
				owner = '';
			}

			// Fetch metadata from URI
			let metadata: Record<string, unknown> | null = null;
			if (tokenUri) {
				metadata = await fetchMetadataFromUri(this, tokenUri);
			}

			result = {
				contractAddress,
				tokenId,
				owner,
				tokenUri,
				metadata: metadata || {},
				name: metadata?.name || null,
				description: metadata?.description || null,
				image: metadata?.image || null,
				attributes: metadata?.attributes || [],
			};
			break;
		}

		case 'getNFTTransfers': {
			const options = this.getNodeParameter('options', index, {}) as {
				tokenId?: string;
				page?: number;
				limit?: number;
			};

			const params: Record<string, string> = {
				module: 'account',
				action: 'tokennfttx',
				contractaddress: contractAddress,
				page: (options.page || 1).toString(),
				offset: (options.limit || 100).toString(),
				sort: 'desc',
			};

			const response = await explorerApiRequest.call(this, params) as ExplorerApiResponse<TokenTransfer[]>;

			let transfers = Array.isArray(response.result) ? response.result : [];

			// Filter by token ID if specified
			if (options.tokenId) {
				transfers = transfers.filter((t) => t.value === options.tokenId);
			}

			const parsedTransfers = transfers.map((tx) => ({
				hash: tx.hash,
				blockNumber: parseInt(tx.blockNumber, 10),
				timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
				from: tx.from,
				to: tx.to,
				tokenId: tx.value,
				tokenName: tx.tokenName,
				tokenSymbol: tx.tokenSymbol,
			}));

			result = {
				contractAddress,
				tokenId: options.tokenId || 'all',
				transfers: parsedTransfers,
				totalTransfers: parsedTransfers.length,
			};
			break;
		}

		case 'getCollectionInfo': {
			// Get collection name
			const nameData = '0x06fdde03'; // name()
			const nameResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: contractAddress, data: nameData },
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

			// Get collection symbol
			const symbolData = '0x95d89b41'; // symbol()
			const symbolResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
				{ to: contractAddress, data: symbolData },
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

			// Try to get total supply (ERC721Enumerable)
			let totalSupply = '0';
			try {
				const supplyData = '0x18160ddd'; // totalSupply()
				const supplyResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
					{ to: contractAddress, data: supplyData },
					'latest',
				]) as string;
				totalSupply = hexToDecimal(supplyResult);
			} catch {
				totalSupply = 'unknown';
			}

			// Check supported interfaces
			const supportsInterface = async (interfaceId: string): Promise<boolean> => {
				try {
					const data = '0x01ffc9a7' + interfaceId.replace('0x', '').padStart(64, '0');
					const supportResult = await jsonRpcRequestWithContext.call(this, 'eth_call', [
						{ to: contractAddress, data },
						'latest',
					]) as string;
					return supportResult === '0x0000000000000000000000000000000000000000000000000000000000000001';
				} catch {
					return false;
				}
			};

			const interfaces = {
				erc721: await supportsInterface('0x80ac58cd'),
				erc721Metadata: await supportsInterface('0x5b5e139f'),
				erc721Enumerable: await supportsInterface('0x780e9d63'),
				erc1155: await supportsInterface('0xd9b67a26'),
			};

			// Get contract verification status
			let verified = false;
			try {
				const abiResponse = await explorerApiRequest.call(this, {
					module: 'contract',
					action: 'getabi',
					address: contractAddress,
				}) as ExplorerApiResponse<string>;
				verified = abiResponse.status === '1';
			} catch {
				verified = false;
			}

			result = {
				contractAddress,
				name,
				symbol,
				totalSupply,
				interfaces,
				verified,
				network: 'Gnosis Chain',
				standard: interfaces.erc1155 ? 'ERC-1155' : interfaces.erc721 ? 'ERC-721' : 'Unknown',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
	}

	return [{ json: result as IDataObject }];
}
