export const SEPOLIA_ADDRESS = '0xCdb840cc3cfc53dc94BC427D657A4E9D47B44cE4'
export const XDC_ADDRESS = '0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9'

export const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
export const XDC_RPC = 'https://rpc.apothem.network'

export const SEPOLIA_CHAIN_ID = 11155111
export const XDC_CHAIN_ID = 51

export const XDC_NETWORK_PARAMS = {
  chainId: '0x33',
  chainName: 'XDC Apothem Testnet',
  rpcUrls: ['https://rpc.apothem.network'],
  nativeCurrency: { name: 'XDC', symbol: 'TXDC', decimals: 18 },
  blockExplorerUrls: ['https://testnet.xdcscan.com'],
}

export const SEPOLIA_NETWORK_PARAMS = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia Testnet',
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
}

export const TOKEN_DECIMALS = 2

// Format a raw on-chain uint256 BigInt with decimals=2
export function formatTokenAmount(raw) {
  if (raw === undefined || raw === null) return '—'
  const n = BigInt(raw)
  const whole = n / 100n
  const frac = n % 100n
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`
}

// Normalise XDC-prefix addresses to 0x
export function normaliseAddress(addr) {
  if (!addr) return addr
  if (addr.startsWith('xdc') || addr.startsWith('XDC')) {
    return '0x' + addr.slice(3)
  }
  return addr
}
