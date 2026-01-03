# n8n-nodes-gnosis

> **[Velocity BPA Licensing Notice]**
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

A comprehensive n8n community node for **Gnosis Chain** (formerly xDai), the Ethereum-compatible blockchain featuring low transaction costs, fast ~5-second block times, and POSDAO consensus with GNO staking. This node provides full blockchain interaction capabilities including account queries, transaction management, GNO staking, cross-chain bridge tracking, token/NFT operations, and smart contract interactions.

![n8n](https://img.shields.io/badge/n8n-community--node-orange)
![Gnosis Chain](https://img.shields.io/badge/Gnosis-Chain-04795B)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## Features

- **11 Resource Categories** with 50+ operations
- **Full Account Management** - balances, transaction history, token holdings, NFTs
- **Transaction Operations** - send, track, estimate gas, monitor confirmations
- **GNO Staking** - validators, deposits, withdrawals, beacon chain info
- **Bridge Tracking** - OmniBridge and xDai Bridge transaction monitoring
- **Smart Contracts** - read/write functions, ABI encoding, event queries
- **Token Operations** - ERC-20 info, transfers, prices, bridged tokens
- **NFT Support** - metadata, transfers, collection info
- **Event Monitoring** - log queries, topic filtering, contract events
- **6 Trigger Types** - new blocks, transactions, transfers, bridge events
- **HTTP-Only** - no web3.js dependencies, pure JSON-RPC

## Installation

### Community Nodes (Recommended)

1. Open your n8n instance
2. Go to **Settings** > **Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-gnosis`
5. Click **Install**

### Manual Installation

```bash
# Navigate to your n8n custom nodes directory
cd ~/.n8n/custom

# Clone the repository
git clone https://github.com/Velocity-BPA/n8n-nodes-gnosis.git

# Install dependencies and build
cd n8n-nodes-gnosis
npm install
npm run build

# Restart n8n
```

### Development Installation

```bash
# Extract and enter directory
unzip n8n-nodes-gnosis.zip
cd n8n-nodes-gnosis

# Install dependencies
npm install

# Build the project
npm run build

# Create symlink to n8n custom nodes
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-gnosis

# Restart n8n
n8n start
```

## Credentials Setup

Configure the **Gnosis Chain API** credentials:

| Field | Description | Required |
|-------|-------------|----------|
| **Network** | Mainnet or Chiado testnet | Yes |
| **RPC Endpoint** | JSON-RPC URL (default: https://rpc.gnosischain.com/) | Yes |
| **Private Key** | For signing transactions (keep secure!) | No |
| **Gnosisscan API Key** | For enhanced explorer features | No |

### Getting API Keys

1. **RPC Endpoint**: Use the default public RPC or get a dedicated endpoint from providers like Ankr, QuickNode, or GetBlock
2. **Gnosisscan API Key**: Register at [gnosisscan.io](https://gnosisscan.io/apis) for free API access
3. **Private Key**: Export from your wallet (MetaMask, etc.) - never share this!

## Resources & Operations

### Account
| Operation | Description |
|-----------|-------------|
| Get Balance | Get xDai balance for an address |
| Get Token Balance | Get ERC-20 token balance |
| Get NFTs | List owned NFTs |
| Get Transaction History | Account transaction history |
| Get Internal Transactions | Internal contract calls |
| Get Token Transfers | ERC-20 transfer history |

### Transaction
| Operation | Description |
|-----------|-------------|
| Get Transaction | Transaction details by hash |
| Get Transaction Receipt | Receipt with logs and status |
| Send Transaction | Submit signed transaction |
| Get Pending Transactions | Mempool transactions |
| Estimate Gas | Gas estimation with cost |
| Get Transaction Status | Confirmation count and finality |

### Block
| Operation | Description |
|-----------|-------------|
| Get Block | Block details by number/hash |
| Get Latest Block | Current block info |
| Get Block Transactions | All transactions in block |
| Get Block By Timestamp | Find block at specific time |

### Staking (GNO)
| Operation | Description |
|-----------|-------------|
| Get Validator Info | Validator details (balance, status) |
| List Validators | Paginated validator list |
| Get Deposits | Staking deposits by address |
| Get Withdrawals | Withdrawal history |
| Get Beacon Chain Info | Epoch, slot, finalization |
| Get Staking Stats | Network staking statistics |

### Smart Contract
| Operation | Description |
|-----------|-------------|
| Get Contract ABI | Verified contract interface |
| Read Contract | Call view/pure functions |
| Write Contract | Prepare write transactions |
| Get Contract Source | Verified source code |
| Get Contract Events | Event log queries |

### Token
| Operation | Description |
|-----------|-------------|
| Get Token Info | Name, symbol, decimals, supply |
| Get Token Holders | Holder list |
| Get Token Transfers | Transfer history |
| Get Bridged Tokens | Common bridged tokens |
| Get Token Price | CoinGecko price data |

### NFT
| Operation | Description |
|-----------|-------------|
| Get NFT Metadata | Token URI and metadata |
| Get NFT Transfers | Transfer history |
| Get Collection Info | Collection details |

### Bridge
| Operation | Description |
|-----------|-------------|
| Get Bridge Transactions | Cross-chain transfers |
| Get Pending Bridges | In-progress transfers |
| Get Bridge Stats | Volume and usage |
| Track Bridge TX | Monitor transfer status |

### Network
| Operation | Description |
|-----------|-------------|
| Get Network Status | Chain status and sync |
| Get Gas Price | Current gas prices |
| Get Chain Stats | Network metrics |
| Get Finality | Finality information |

### Events
| Operation | Description |
|-----------|-------------|
| Get Logs | Event logs with filters |
| Subscribe To Logs | WebSocket subscription info |
| Filter Events | Filter by topics |
| Get Contract Events | Events for specific contract |

### Utility
| Operation | Description |
|-----------|-------------|
| Convert Units | xDai/Wei/Gwei conversion |
| Encode Function | ABI encode function calls |
| Decode Data | ABI decode return data |
| Get API Health | Check service status |

## Trigger Node

The **Gnosis Chain Trigger** polls for blockchain events:

| Trigger | Description |
|---------|-------------|
| New Block | Fires on each new block |
| New Transaction to Address | Incoming/outgoing transactions |
| Token Transfer | ERC-20 transfer events |
| Contract Event | Specific contract events |
| Bridge Transaction | Cross-chain transfers |
| Large Transaction | Transactions above threshold |

## Usage Examples

### Get Account Balance

```json
{
  "resource": "accounts",
  "operation": "getBalance",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f3E8f1"
}
```

### Monitor Large Transactions

Configure the trigger node:
- **Trigger Type**: Large Transaction
- **Threshold**: 100 (xDai)
- **Address Filter**: (optional)

### Track Bridge Transfer

```json
{
  "resource": "bridge",
  "operation": "trackBridgeTX",
  "transactionHash": "0x123..."
}
```

### Read Smart Contract

```json
{
  "resource": "smartContracts",
  "operation": "readContract",
  "contractAddress": "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
  "functionName": "balanceOf",
  "parameters": {
    "params": [
      { "type": "address", "value": "0x742d35Cc..." }
    ]
  }
}
```

## Gnosis Chain Concepts

| Concept | Description |
|---------|-------------|
| **xDai** | Native gas token (bridged DAI, 18 decimals) |
| **GNO** | Gnosis staking/governance token |
| **POSDAO** | Proof of Stake DAO consensus mechanism |
| **OmniBridge** | Cross-chain ERC-20 token bridge |
| **xDai Bridge** | DAI ↔ xDai native bridge |
| **Chiado** | Gnosis Chain testnet |
| **Beacon Chain** | Consensus layer for GNO staking |

## Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Mainnet | 100 | https://rpc.gnosischain.com/ |
| Chiado | 10200 | https://rpc.chiadochain.net/ |

## Error Handling

The node provides detailed error messages:

- **Invalid Address**: Address validation failed
- **RPC Error**: Network or endpoint issues
- **Contract Error**: Smart contract execution failed
- **Rate Limit**: Too many requests (add API key)

Enable **Continue on Fail** to handle errors gracefully in workflows.

## Security Best Practices

1. **Never share private keys** - Use n8n credentials storage
2. **Use testnet first** - Test workflows on Chiado
3. **Validate addresses** - The node validates all addresses
4. **Monitor gas costs** - Use estimateGas before transactions
5. **Rate limiting** - Add Gnosisscan API key for higher limits

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service, or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code passes linting and tests before submitting.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Velocity-BPA/n8n-nodes-gnosis/issues)
- **Documentation**: [Gnosis Chain Docs](https://docs.gnosischain.com/)
- **n8n Community**: [n8n Community Forum](https://community.n8n.io/)

## Acknowledgments

- [Gnosis Chain](https://gnosischain.com/) - The blockchain platform
- [n8n](https://n8n.io/) - Workflow automation platform
- [Gnosisscan](https://gnosisscan.io/) - Block explorer API
- [CoinGecko](https://coingecko.com/) - Token price data
