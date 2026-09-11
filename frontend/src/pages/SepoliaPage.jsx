import { ethers } from 'ethers'
import { SEPOLIA_ADDRESS, SEPOLIA_RPC, SEPOLIA_NETWORK_PARAMS } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import TokenInfoPanel from '../components/TokenInfoPanel.jsx'
import StatusBlock from '../components/StatusBlock.jsx'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'

const READ_FNS = [
  'balanceOf', 'isVerified', 'isFrozen', 'getFrozenTokens',
  'allowance', 'hasRole',
]

const WRITE_FNS = [
  'transfer', 'approve', 'transferFrom',
  'mint', 'burn',
  'pause', 'unpause',
  'registerIdentity', 'revokeIdentity',
  'setAddressFrozen', 'freezePartialTokens', 'unfreezePartialTokens',
  'forcedTransfer', 'recoveryAddress',
  'grantRole', 'revokeRole',
]

const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC)

export default function SepoliaPage() {
  const { account, signer, error, connect } = useWallet()

  return (
    <div>
      <h1 className="page-title">Sepolia</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--accent2)', fontSize: 12 }}>{SEPOLIA_ADDRESS}</code>
      </p>

      {error && <div className="alert alert-warn">{error}</div>}
      {!account && (
        <div className="alert alert-info">
          Read functions work without a wallet. Connect MetaMask (top right) on Sepolia to use write functions.
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 12 }}
            onClick={() => connect(SEPOLIA_NETWORK_PARAMS)}
          >
            Connect &amp; switch to Sepolia
          </button>
        </div>
      )}

      <TokenInfoPanel provider={readProvider} contractAddress={SEPOLIA_ADDRESS} />
      <StatusBlock provider={readProvider} contractAddress={SEPOLIA_ADDRESS} />

      <div className="section-label">Query Functions</div>
      <div className="fn-list">
        {READ_FNS.map(fn => (
          <ReadFunction
            key={fn}
            fnName={fn}
            provider={readProvider}
            contractAddress={SEPOLIA_ADDRESS}
            showRaw={false}
          />
        ))}
      </div>

      <div className="section-label">Write Functions</div>
      {!account && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          Connect MetaMask to enable write functions.
        </p>
      )}
      <div className="fn-list">
        {WRITE_FNS.map(fn => (
          <WriteFunction
            key={fn}
            fnName={fn}
            signer={signer}
            contractAddress={SEPOLIA_ADDRESS}
          />
        ))}
      </div>
    </div>
  )
}
