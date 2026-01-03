/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

export interface BlockResponse {
	number: string;
	hash: string;
	parentHash: string;
	nonce: string;
	sha3Uncles: string;
	logsBloom: string;
	transactionsRoot: string;
	stateRoot: string;
	receiptsRoot: string;
	miner: string;
	difficulty: string;
	totalDifficulty: string;
	extraData: string;
	size: string;
	gasLimit: string;
	gasUsed: string;
	timestamp: string;
	transactions: string[] | TransactionResponse[];
	uncles: string[];
	baseFeePerGas?: string;
}

export interface TransactionResponse {
	hash: string;
	nonce: string;
	blockHash: string | null;
	blockNumber: string | null;
	transactionIndex: string | null;
	from: string;
	to: string | null;
	value: string;
	gasPrice: string;
	gas: string;
	input: string;
	v: string;
	r: string;
	s: string;
	type?: string;
	accessList?: Array<{ address: string; storageKeys: string[] }>;
	maxFeePerGas?: string;
	maxPriorityFeePerGas?: string;
}

export interface TransactionReceiptResponse {
	transactionHash: string;
	transactionIndex: string;
	blockHash: string;
	blockNumber: string;
	from: string;
	to: string | null;
	cumulativeGasUsed: string;
	gasUsed: string;
	contractAddress: string | null;
	logs: LogEntry[];
	logsBloom: string;
	status: string;
	effectiveGasPrice?: string;
	type?: string;
}

export interface LogEntry {
	address: string;
	topics: string[];
	data: string;
	blockNumber: string;
	transactionHash: string;
	transactionIndex: string;
	blockHash: string;
	logIndex: string;
	removed: boolean;
}

export interface TokenInfo {
	address: string;
	name: string;
	symbol: string;
	decimals: number;
	totalSupply: string;
}

export interface NFTMetadata {
	tokenId: string;
	contractAddress: string;
	name?: string;
	description?: string;
	image?: string;
	attributes?: Array<{ trait_type: string; value: string | number }>;
}

export interface ValidatorInfo {
	address: string;
	pubkey: string;
	status: string;
	balance: string;
	effectiveBalance: string;
	slashed: boolean;
	activationEpoch: string;
	exitEpoch: string;
	withdrawableEpoch: string;
}

export interface StakingStats {
	totalValidators: number;
	activeValidators: number;
	totalStaked: string;
	averageBalance: string;
	participationRate: string;
}

export interface BridgeTransaction {
	txHash: string;
	sourceChain: string;
	destinationChain: string;
	token: string;
	amount: string;
	sender: string;
	receiver: string;
	status: 'pending' | 'completed' | 'failed';
	timestamp: string;
}

export interface NetworkStatus {
	chainId: number;
	networkName: string;
	latestBlock: number;
	gasPrice: string;
	syncing: boolean | SyncStatus;
}

export interface SyncStatus {
	startingBlock: string;
	currentBlock: string;
	highestBlock: string;
}

export interface GasEstimate {
	gasLimit: string;
	gasPrice: string;
	maxFeePerGas?: string;
	maxPriorityFeePerGas?: string;
	estimatedCost: string;
}

export interface ContractSource {
	sourceCode: string;
	abi: string;
	contractName: string;
	compilerVersion: string;
	optimizationUsed: boolean;
	runs: number;
	constructorArguments: string;
	library: string;
}

export interface ExplorerApiResponse<T> {
	status: string;
	message: string;
	result: T;
}

export interface AccountTransaction {
	blockNumber: string;
	timeStamp: string;
	hash: string;
	nonce: string;
	blockHash: string;
	transactionIndex: string;
	from: string;
	to: string;
	value: string;
	gas: string;
	gasPrice: string;
	isError: string;
	txreceipt_status: string;
	input: string;
	contractAddress: string;
	cumulativeGasUsed: string;
	gasUsed: string;
	confirmations: string;
	methodId: string;
	functionName: string;
}

export interface InternalTransaction {
	blockNumber: string;
	timeStamp: string;
	hash: string;
	from: string;
	to: string;
	value: string;
	contractAddress: string;
	input: string;
	type: string;
	gas: string;
	gasUsed: string;
	traceId: string;
	isError: string;
	errCode: string;
}

export interface TokenTransfer {
	blockNumber: string;
	timeStamp: string;
	hash: string;
	nonce: string;
	blockHash: string;
	from: string;
	contractAddress: string;
	to: string;
	value: string;
	tokenName: string;
	tokenSymbol: string;
	tokenDecimal: string;
	transactionIndex: string;
	gas: string;
	gasPrice: string;
	gasUsed: string;
	cumulativeGasUsed: string;
	input: string;
	confirmations: string;
}

export interface TokenHolder {
	address: string;
	balance: string;
	percentage: string;
}

export interface ParsedBlock {
	number: number;
	hash: string;
	parentHash: string;
	miner: string;
	gasLimit: number;
	gasUsed: number;
	timestamp: string;
	transactionCount: number;
	size: number;
	baseFeePerGas?: string;
}

export interface ParsedTransaction {
	hash: string;
	blockNumber: number | null;
	from: string;
	to: string | null;
	value: string;
	valueInXDai: string;
	gasPrice: string;
	gasLimit: number;
	nonce: number;
	input: string;
	status: 'pending' | 'confirmed';
}

export interface ParsedReceipt {
	transactionHash: string;
	blockNumber: number;
	from: string;
	to: string | null;
	contractAddress: string | null;
	gasUsed: number;
	status: 'success' | 'failed';
	logs: ParsedLog[];
}

export interface ParsedLog {
	address: string;
	topics: string[];
	data: string;
	blockNumber: number;
	transactionHash: string;
	logIndex: number;
}
