/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

export const GNOSIS_NETWORKS = {
	mainnet: {
		chainId: 100,
		name: 'Gnosis Chain Mainnet',
		rpcUrl: 'https://rpc.gnosischain.com/',
		explorerUrl: 'https://gnosisscan.io',
		explorerApiUrl: 'https://api.gnosisscan.io/api',
		nativeToken: 'xDAI',
		stakingToken: 'GNO',
	},
	chiado: {
		chainId: 10200,
		name: 'Chiado Testnet',
		rpcUrl: 'https://rpc.chiadochain.net/',
		explorerUrl: 'https://gnosis-chiado.blockscout.com',
		explorerApiUrl: 'https://gnosis-chiado.blockscout.com/api',
		nativeToken: 'xDAI',
		stakingToken: 'GNO',
	},
} as const;

export const GNOSIS_BRIDGES = {
	omniBridge: {
		mainnet: '0x88ad09518695c6c3712AC10a214bE5109a655671',
		ethereum: '0x88ad09518695c6c3712AC10a214bE5109a655671',
	},
	xDaiBridge: {
		mainnet: '0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6',
		ethereum: '0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016',
	},
} as const;

export const GNOSIS_CONTRACTS = {
	GNO: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
	WETH: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
	USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
	USDT: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
	stGNO: '0xA4eF9Da5BA71Cc0D2e5E877a910A37eC43420445',
} as const;

export const ERC20_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function totalSupply() view returns (uint256)',
	'function balanceOf(address owner) view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transferFrom(address from, address to, uint256 amount) returns (bool)',
	'event Transfer(address indexed from, address indexed to, uint256 value)',
	'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

export const ERC721_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function tokenURI(uint256 tokenId) view returns (string)',
	'function balanceOf(address owner) view returns (uint256)',
	'function ownerOf(uint256 tokenId) view returns (address)',
	'function safeTransferFrom(address from, address to, uint256 tokenId)',
	'function transferFrom(address from, address to, uint256 tokenId)',
	'function approve(address to, uint256 tokenId)',
	'function getApproved(uint256 tokenId) view returns (address)',
	'function setApprovalForAll(address operator, bool approved)',
	'function isApprovedForAll(address owner, address operator) view returns (bool)',
	'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
	'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
	'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];

export const DEFAULT_GAS_LIMIT = 21000;
export const DEFAULT_GAS_PRICE_GWEI = 1;

export const XDAI_DECIMALS = 18;
export const GNO_DECIMALS = 18;
