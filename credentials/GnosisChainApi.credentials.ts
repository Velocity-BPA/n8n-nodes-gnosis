/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GnosisChainApi implements ICredentialType {
	name = 'gnosisChainApi';
	displayName = 'Gnosis Chain API';
	documentationUrl = 'https://docs.gnosischain.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'Network',
			name: 'network',
			type: 'options',
			options: [
				{
					name: 'Mainnet',
					value: 'mainnet',
				},
				{
					name: 'Chiado (Testnet)',
					value: 'chiado',
				},
			],
			default: 'mainnet',
			description: 'The Gnosis Chain network to connect to',
		},
		{
			displayName: 'RPC Endpoint',
			name: 'rpcEndpoint',
			type: 'string',
			default: '',
			placeholder: 'https://rpc.gnosischain.com/',
			description: 'Custom RPC endpoint URL. Leave empty to use default endpoint for selected network.',
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Private key for signing transactions. Required for write operations.',
		},
		{
			displayName: 'Gnosisscan API Key',
			name: 'gnosisscanApiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'API key for Gnosisscan. Optional but recommended for higher rate limits.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.rpcEndpoint || ($credentials.network === "chiado" ? "https://rpc.chiadochain.net" : "https://rpc.gnosischain.com")}}',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'eth_chainId',
				params: [],
				id: 1,
			}),
		},
	};
}
