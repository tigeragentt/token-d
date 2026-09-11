# Deployment Guide — TokenDV2 + SupplyController ACE System

## Overview

```
Regulator wallet
  └─ owns PausePolicy (shared)
        ├─ attached to SupplyController's engine (controlledMint selector)
        └─ attached to TokenDV2's engine (transfer + transferFrom selectors)

Compliance Officer wallet
  ├─ owns RejectPolicy
  │     └─ attached to TokenDV2's engine (transfer + transferFrom selectors)
  └─ is authorized in OnlyAuthorizedSenderPolicy_freeze
        └─ attached to TokenDV2's engine (freeze/unfreeze/forceTransfer selectors)

Issuer wallet(s)
  └─ authorized in OnlyAuthorizedSenderPolicy_mint_sc
        └─ attached to SupplyController's engine (controlledMint selector)

SupplyController (this contract)
  └─ authorized in OnlyAuthorizedSenderPolicy_mint_token
        └─ attached to TokenDV2's engine (mint selector)
```

## Prerequisites

Install ACE packages (requires access to `@chainlink/ace`):
```bash
npm install @chainlink/ace @openzeppelin/contracts @openzeppelin/contracts-upgradeable
```

## Step 1 — Deploy ACE PolicyEngine proxies

Deploy two PolicyEngine proxies (one per protected contract).  
Use Foundry scripts from `smartcontractkit/chainlink-ace/packages/policy-management`.

```bash
# Deploy PolicyEngine for TokenDV2
forge script script/DeployPolicyEngine.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $ADMIN_ADDRESS
# → note TOKEN_POLICY_ENGINE address

# Deploy PolicyEngine for SupplyController
forge script script/DeployPolicyEngine.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $ADMIN_ADDRESS
# → note SC_POLICY_ENGINE address
```

## Step 2 — Deploy TokenDV2

Deploy the UUPS proxy:
```bash
forge script script/DeployUUPS.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --impl TokenDV2 \
  --init "initialize(address,address)" \
  --init-args "$TOKEN_POLICY_ENGINE $ADMIN_ADDRESS"
# → note TOKEN_PROXY address
```

## Step 3 — Deploy SupplyController

```bash
forge create src/SupplyController.sol:SupplyController \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args \
    $TOKEN_PROXY \
    $SC_POLICY_ENGINE \
    $ADMIN_ADDRESS \
    1000000                  # mintCap in token units (decimals=2, so 1 000 000 = 10 000.00 Deb1)
# → note SUPPLY_CONTROLLER address
```

## Step 4 — Deploy policies

### 4a. PausePolicy (shared — one instance only)
```bash
forge script script/DeployPausePolicy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $REGULATOR_ADDRESS
# → note PAUSE_POLICY address
```

### 4b. RejectPolicy (denylist for token transfers)
```bash
forge script script/DeployRejectPolicy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $COMPLIANCE_OFFICER_ADDRESS
# → note REJECT_POLICY address
```

### 4c. OnlyAuthorizedSenderPolicy — for SupplyController.controlledMint (issuers)
```bash
forge script script/DeployOnlyAuthorizedSenderPolicy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $ADMIN_ADDRESS
# → note OAS_ISSUERS address
# Authorize issuer(s):
cast send $OAS_ISSUERS "authorizeAddress(address)" $ISSUER_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

### 4d. OnlyAuthorizedSenderPolicy — for TokenDV2.mint (SupplyController only)
```bash
forge script script/DeployOnlyAuthorizedSenderPolicy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $ADMIN_ADDRESS
# → note OAS_MINT_TOKEN address
# Authorize SupplyController:
cast send $OAS_MINT_TOKEN "authorizeAddress(address)" $SUPPLY_CONTROLLER \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

### 4e. OnlyAuthorizedSenderPolicy — for TokenDV2 freeze/unfreeze/forceTransfer (CO only)
```bash
forge script script/DeployOnlyAuthorizedSenderPolicy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --verify \
  --constructor-args $ADMIN_ADDRESS
# → note OAS_FREEZE address
# Authorize compliance officer:
cast send $OAS_FREEZE "authorizeAddress(address)" $COMPLIANCE_OFFICER_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

## Step 5 — Register TokenDV2 with its PolicyEngine

```bash
cast send $TOKEN_POLICY_ENGINE "registerTarget(address)" $TOKEN_PROXY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

## Step 6 — Attach policies to TokenDV2's PolicyEngine

Function selectors:
```
transfer(address,uint256)         = 0xa9059cbb
transferFrom(address,address,uint256) = 0x23b872dd
freeze(address,uint256,bytes)     = bytes4(keccak256("freeze(address,uint256,bytes)"))
unfreeze(address,uint256,bytes)   = bytes4(keccak256("unfreeze(address,uint256,bytes)"))
forceTransfer(address,address,uint256,bytes) = bytes4(keccak256("forceTransfer(address,address,uint256,bytes)"))
mint(address,uint256)             = 0x40c10f19
```

```bash
# transfer — [PausePolicy, RejectPolicy]
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY 0xa9059cbb $PAUSE_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY 0xa9059cbb $REJECT_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

# transferFrom — [PausePolicy, RejectPolicy]
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY 0x23b872dd $PAUSE_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY 0x23b872dd $REJECT_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

# freeze / unfreeze / forceTransfer — [OAS_FREEZE]
# (compute selectors with `cast sig "freeze(address,uint256,bytes)"` etc.)
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY $FREEZE_SELECTOR $OAS_FREEZE \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY $UNFREEZE_SELECTOR $OAS_FREEZE \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY $FORCE_TRANSFER_SELECTOR $OAS_FREEZE \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

# mint — [OAS_MINT_TOKEN]
cast send $TOKEN_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $TOKEN_PROXY 0x40c10f19 $OAS_MINT_TOKEN \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

## Step 7 — Register SupplyController and attach its policies

```bash
cast send $SC_POLICY_ENGINE "registerTarget(address)" $SUPPLY_CONTROLLER \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

# controlledMint(address,uint256)
CONTROLLED_MINT_SELECTOR=$(cast sig "controlledMint(address,uint256)")

# [PausePolicy, OAS_ISSUERS]
cast send $SC_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $SUPPLY_CONTROLLER $CONTROLLED_MINT_SELECTOR $PAUSE_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
cast send $SC_POLICY_ENGINE \
  "attachPolicy(address,bytes4,address)" \
  $SUPPLY_CONTROLLER $CONTROLLED_MINT_SELECTOR $OAS_ISSUERS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

## Step 8 — Wire SupplyController roles and policy contract references

```bash
cast send $SUPPLY_CONTROLLER \
  "setRegulator(address)" $REGULATOR_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

cast send $SUPPLY_CONTROLLER \
  "setComplianceOfficer(address)" $COMPLIANCE_OFFICER_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK

cast send $SUPPLY_CONTROLLER \
  "setPolicyContracts(address,address)" $PAUSE_POLICY $REJECT_POLICY \
  --rpc-url $SEPOLIA_RPC_URL --private-key $ADMIN_PK
```

## Post-deploy checklist

- [ ] Regulator: `emergencyPause()` and `emergencyUnpause()` both revert for non-regulator
- [ ] Issuer: `controlledMint()` succeeds; exceeding cap reverts with `MintCapExceeded`
- [ ] Compliance Officer: `addToDenylist()` / `removeFromDenylist()` updates RejectPolicy
- [ ] Compliance Officer: `freeze()` / `unfreeze()` / `forceTransfer()` work
- [ ] Non-authorized address calling `controlledMint()` reverts via `PolicyRejected`
- [ ] Denied address attempting `transfer()` reverts via `PolicyRejected`
- [ ] When paused, both `transfer()` and `controlledMint()` revert

## Token addresses (Sepolia, existing TokenD — original non-ACE version)

| Contract | Address |
|---|---|
| TokenD (original) | `0x326baD54071c50830B1EF2C00d160f511fd2E39e` |
| TokenDV2 proxy | _(deploy above)_ |
| SupplyController | _(deploy above)_ |
