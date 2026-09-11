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

