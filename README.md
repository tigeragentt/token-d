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

## Project structure

```
token-d/
├── project.yaml              # CRE project config (chain selectors, RPC URLs)
├── secrets.yaml              # Private key + secrets (never commit this)
├── CRE-token-d.json          # Exported scaffold-cre diagram
└── workflow-token-d/
    ├── main.ts               # Entry point (Runner.newRunner)
    ├── workflow.ts           # Workflow logic (cron trigger + EVM/HTTP reads)
    ├── package.json
    ├── tsconfig.json
    ├── workflow.yaml         # CRE workflow metadata
    └── config/
        ├── config.staging.json
        └── config.production.json
```
