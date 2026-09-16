import { TOKEN_DECIMALS } from '../config.js'

const TOKEN_SYMBOL = 'Deb1'

export default function AddTokenButton({ address }) {
  async function addToken() {
    const { ethereum } = window
    if (!ethereum) return
    try {
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address, symbol: TOKEN_SYMBOL, decimals: TOKEN_DECIMALS } },
      })
    } catch {
      // user rejected or MetaMask unavailable
    }
  }

  return (
    <button
      className="btn-copy"
      onClick={addToken}
      title={`Add ${TOKEN_SYMBOL} to MetaMask`}
      style={{ padding: '0.2rem 0.45rem' }}
    >
      add to 🦊
    </button>
  )
}
