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
| Ethereum Sepolia | `0x326baD54071c50830B1EF2C00d160f511fd2E39e` | [View on Etherscan ✅](https://sepolia.etherscan.io/address/0x326baD54071c50830B1EF2C00d160f511fd2E39e#code) |
| XDC Apothem | `0x85ec3EB6Caad348aeC8CF3Ada0Da494c641C1E1b` | [View on XDCScan](https://apothem.xdcscan.io/address/0x85ec3EB6Caad348aeC8CF3Ada0Da494c641C1E1b) |

## Prerequisites

- [Bun](https://bun.sh) — `npm install -g bun`
- [CRE CLI](https://docs.chain.link/chainlink-automation/concepts/automation-architecture) — `npm install -g @chainlink/cre-cli`
- A funded CRE account with a private key in `secrets.yaml`

## Install

```bash
cd workflow-token-d
bun install
```

`bun install` runs `cre-setup` automatically via the `postinstall` hook.

## Simulate locally

```bash
cre workflow simulate workflow-token-d --target staging-settings
```

Run from the **project root** (`token-d/`), not from inside the workflow folder. No secrets required for simulation.

## Deploy

### Staging

```bash
cd workflow-token-d
cre workflow deploy \
  --workflow-path ./main.ts \
  --config-path ./config/config.staging.json \
  --secrets-path ../secrets.yaml \
  --workflow-name token-d-staging
```

### Production

```bash
cd workflow-token-d
cre workflow deploy \
  --workflow-path ./main.ts \
  --config-path ./config/config.production.json \
  --secrets-path ../secrets.yaml \
  --workflow-name token-d-production
```

## Configuration

`config/config.staging.json` (and `config.production.json`) hold the workflow parameters:

| Field | Description |
|---|---|
| `schedule` | Cron expression — default `@every 5m` |
| `sepoliaTokenAddress` | Token contract address on Ethereum Sepolia |
| `xdcTokenAddress` | Token contract address on XDC Apothem |
| `xdcRpcUrl` | XDC JSON-RPC endpoint |

## To Do

### Verify TokenD on XDC Apothem block explorer

`apothem.xdcscan.io` API was down (Cloudflare 521) when verification was attempted. Once it recovers, submit via the Blockscout API:

```bash
POST https://apothem.xdcscan.io/api/v2/smart-contracts/0x85ec3EB6Caad348aeC8CF3Ada0Da494c641C1E1b/verification/via/flattened-code
```

| Parameter | Value |
|---|---|
| Contract address | `0x85ec3EB6Caad348aeC8CF3Ada0Da494c641C1E1b` |
| Contract name | `TokenD` |
| Compiler version | `v0.8.36+commit.8d97d7ba` |
| EVM version | `cancun` |
| Optimizer | disabled |
| Flattened source | `smart-contracts/tokenD_flat.sol` |

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
