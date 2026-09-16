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
const DECIMALS_FACTOR = BigInt(10 ** TOKEN_DECIMALS) // 100n

// Format a raw on-chain uint256 BigInt with decimals=2
export function formatTokenAmount(raw) {
  if (raw === undefined || raw === null) return '—'
  const n = BigInt(raw)
  const whole = n / DECIMALS_FACTOR
  const frac = n % DECIMALS_FACTOR
  return `${whole.toString()}.${frac.toString().padStart(TOKEN_DECIMALS, '0')}`
}

// Convert a human-readable amount string ("5" or "5.50") to raw on-chain uint256.
// "5" → 500n, "5.50" → 550n (for 2 decimals).
export function toRawAmount(str) {
  const trimmed = String(str).trim()
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = frac.padEnd(TOKEN_DECIMALS, '0').slice(0, TOKEN_DECIMALS)
  return BigInt(whole || '0') * DECIMALS_FACTOR + BigInt(fracPadded || '0')
}

// Returns true for uint256 param names that represent token amounts (should use toRawAmount).
export function isAmountParam(paramName) {
  const n = (paramName || '').toLowerCase()
  return n === 'amount' || n === 'value' || n === 'amounts'
}

// Normalise XDC-prefix addresses to 0x
export function normaliseAddress(addr) {
  if (!addr) return addr
  if (addr.startsWith('xdc') || addr.startsWith('XDC')) {
    return '0x' + addr.slice(3)
  }
  return addr
}
