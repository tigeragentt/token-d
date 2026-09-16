# token-d

A Chainlink CRE workflow that tracks cross-chain token supply distribution between Ethereum Sepolia and XDC Apothem. Runs on a cron schedule, reads `totalSupply()` from both chains, and logs the distribution percentages.

## What it does

- Reads `totalSupply` from a token on **Ethereum Sepolia** via the CRE EVM capability
- Reads `totalSupply` from a token on **XDC Apothem** via the CRE HTTP capability (JSON-RPC)
- Computes the combined total supply and each chain's percentage
- Returns and logs the result as JSON every 5 minutes

## Smart Contract Addresses

| Network | Address | Explorer |
|---|---|---|
| Ethereum Sepolia | `0xCdb840cc3cfc53dc94BC427D657A4E9D47B44cE4` | [View on Etherscan ✅](https://sepolia.etherscan.io/address/0xCdb840cc3cfc53dc94BC427D657A4E9D47B44cE4#code) |
| XDC Apothem | `0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9` | [View on XDCScan ✅](https://testnet.xdcscan.com/address/0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9) |

## Prerequisites

- **Git** - [Download here](https://git-scm.com/downloads)
- **Node.js v20 or later** - [Download here](https://nodejs.org/)
- **Bun v1.3 or later** - [Download here](https://bun.sh/docs/installation)
- **CRE CLI** - [Installation guide](https://docs.chain.link/cre/getting-started/cli-installation)
- **CRE account** - Sign up at [cre.chain.link](https://cre.chain.link) and complete `cre login` (see [CRE CLI Quick Setup](./cre-cli-setup.md))

### Optional (only needed for the onchain part)

- Add Networks to your wallet
  - **Ethereum Sepolia** - [Add it here](https://chainlist.org/chain/11155111)
- **Get Sepolia ETH from a faucet**


## Install

```bash
bun install --cwd ./workflow-token-d
```

`bun install` runs `cre-setup` automatically via the `postinstall` hook.

## Simulate locally

```bash
cre workflow simulate workflow-token-d --target staging-settings
```

Run from the **project root** (`token-d/`), not from inside the workflow folder. No secrets required for simulation.

## Configuration

`config/config.staging.json` (and `config.production.json`) hold the workflow parameters:

| Field | Description |
|---|---|
| `schedule` | Cron expression — default `@every 5m` |
| `sepoliaTokenAddress` | Token contract address on Ethereum Sepolia |
| `xdcTokenAddress` | Token contract address on XDC Apothem |
| `xdcRpcUrl` | XDC JSON-RPC endpoint |


---

## workflow-xdc — Send transactions to XDC via HTTP trigger

HTTP-triggered workflow that receives calldata from an external caller, signs a transaction with a CRE-managed private key, and submits it to XDC Apothem via JSON-RPC.

### Setup

```bash
bun install --cwd ./workflow-xdc
```

### Secrets

The workflow requires a signing key stored as a CRE secret:

```yaml
# secrets.yaml (already at project root — do not commit)
secretsNames:
  cre_transaction_private_key:
    - CRE_TRANSACTION_PRIVATE_KEY
```

Set the value in `.env` (project root):

```
CRE_TRANSACTION_PRIVATE_KEY=0x<your-private-key>
```

### Simulate

```bash
cre workflow simulate workflow-xdc --target staging-settings
```

The simulation starts an HTTP server at `http://localhost:2000/trigger`. In a separate terminal, send a trigger:

```bash
curl -X POST http://localhost:2000/trigger \
  -H 'Content-Type: application/json' \
  -d '{"input":{"to":"0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9","data":"0x<calldata>","gasLimit":100000}}'
```

Or use the frontend CRE page — paste `http://localhost:2000/trigger` into the **CRE Write Trigger** field and click **Send via CRE** on any write function. The Vite dev server proxies the request automatically.

### Configuration

| Field | Description |
|---|---|
| `xdcRpcUrl` | XDC JSON-RPC endpoint |
| `xdcChainId` | Chain ID — `51` for Apothem |

---

## workflow-xdc-monitor — Watch XDC Transfer events via cron trigger

Cron-triggered workflow that polls `eth_getLogs` on XDC Apothem for `Transfer` events on the token contract. Since CRE does not natively support XDC event triggers, this workflow uses the HTTP capability to query the XDC JSON-RPC directly on each scheduled tick.

### Setup

```bash
bun install --cwd ./workflow-xdc-monitor
```

No secrets required.

### Simulate

```bash
cre workflow simulate workflow-xdc-monitor --target staging-settings
```

The cron trigger fires immediately in simulation — no HTTP request needed. The output shows any `Transfer` events found in the last 60 blocks, decoded as `from → to, amount`.

The simulation also starts an HTTP trigger server at `http://localhost:2000/trigger`. You can query it on demand:

```bash
curl -X POST http://localhost:2000/trigger \
  -H 'Content-Type: application/json' \
  -d '{"input":{}}'
```

Or paste `http://localhost:2000/trigger` into the **CRE Monitor Trigger** field on the frontend CRE page and click **Fetch via CRE Monitor**.

### Configuration

| Field | Description |
|---|---|
| `xdcRpcUrl` | XDC JSON-RPC endpoint |
| `tokenAddress` | Token contract to monitor for Transfer events |
| `lookbackBlocks` | Blocks to scan on each tick (default: `60` ≈ 2 min on Apothem) |
| `schedule` | Cron expression — default `0 */1 * * * *` (every minute) |

### How it works

1. Calls `eth_blockNumber` to get the current block
2. Calls `eth_getLogs` from `currentBlock - lookbackBlocks` to `latest`, filtering for `Transfer(address,address,uint256)` on the token
3. Decodes each log and logs `from`, `to`, raw `amount`
4. Returns a summary JSON with all events found in that window

---

## Project structure

```
token-d/
├── project.yaml              # CRE project config (chain selectors, RPC URLs)
├── secrets.yaml              # Private key + secrets (never commit this)
├── .env                      # Local env vars including CRE_TRANSACTION_PRIVATE_KEY (never commit)
├── CRE-token-d.json          # Exported scaffold-cre diagram
├── workflow-token-d/         # Cron workflow: cross-chain supply tracker
│   ├── main.ts
│   ├── workflow.ts
│   ├── workflow.yaml
│   └── config/
├── workflow-xdc/             # HTTP trigger: send transactions to XDC
│   ├── main.ts
│   ├── workflow.ts
│   ├── workflow.yaml
│   └── config/
└── workflow-xdc-monitor/     # Cron trigger: watch Transfer events on XDC
    ├── main.ts
    ├── workflow.ts
    ├── workflow.yaml
    └── config/
```
