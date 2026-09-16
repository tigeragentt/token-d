# To Do

## Verify TokenD on XDC Apothem block explorer

Submit via the Blockscout API:

```bash
POST https://testnet.xdcscan.com/api/v2/smart-contracts/0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9/verification/via/flattened-code
```

| Parameter | Value |
|---|---|
| Contract address | `0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9` |
| Contract name | `TokenD` |
| Compiler version | `v0.8.36+commit.8d97d7ba` |
| EVM version | `cancun` |
| Optimizer | disabled |
| Flattened source | `smart-contracts/tokenD_flat.sol` |

---

## Activate Observer reporting (workflow-xdc-monitor → Sepolia)

### 1. Deploy Observer.sol to Ethereum Sepolia

Contract: `smart-contracts/contracts/Observer.sol`

Deploy via Remix or Hardhat. After deployment, note the contract address.

### 2. Register the XDC token in the Observer

Call `registerToken` from the deployer wallet:

```
registerToken(
  "XDC",
  "0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9",
  "https://testnet.xdcscan.com/address/0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9"
)
```

### 3. Grant REPORTER_ROLE to the CRE wallet

The CRE wallet is derived from `CRE_TRANSACTION_PRIVATE_KEY` (same key used by `workflow-xdc`).

Call `grantRole` from the deployer wallet:

```
grantRole(REPORTER_ROLE, <CRE_wallet_address>)
```

Where `REPORTER_ROLE = keccak256("REPORTER_ROLE")` =
`0xd84b32251ba522d0e9eda5ea49a73e785fe4049c6eb1e21be1fa3c879f84b1a6`

### 4. Set observerAddress in workflow-xdc-monitor config

Edit `workflow-xdc-monitor/config/config.staging.json`:

```json
"observerAddress": "<deployed Observer address on Sepolia>"
```

The workflow uses the same `CRE_TRANSACTION_PRIVATE_KEY` secret — no new secrets needed.

---

