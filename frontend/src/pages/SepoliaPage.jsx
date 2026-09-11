import { ethers } from 'ethers'
import { SEPOLIA_ADDRESS, SEPOLIA_RPC, SEPOLIA_NETWORK_PARAMS } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import TokenInfoPanel from '../components/TokenInfoPanel.jsx'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'

const READ_FNS = ['balanceOf', 'getFrozenTokens', 'allowance', 'hasRole']

const USER_FNS  = ['transfer', 'approve', 'transferFrom']
const AGENT_FNS = ['mint', 'burn', 'pause', 'unpause', 'registerIdentity', 'revokeIdentity',
                   'setAddressFrozen', 'freezePartialTokens', 'unfreezePartialTokens',
                   'forcedTransfer', 'recoveryAddress']
const OWNER_FNS = ['grantRole', 'revokeRole']

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

      <div className="section-label">Query Functions</div>
      <div className="fn-list">
        {READ_FNS.map(fn => (
          <ReadFunction key={fn} fnName={fn} provider={readProvider}
            contractAddress={SEPOLIA_ADDRESS} showRaw={false} />
        ))}
      </div>

      <div className="section-label">User Functions</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Any verified address — transfer, approve
      </p>
      <div className="fn-list">
        {USER_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        ))}
      </div>

      <div className="section-label">Agent Functions</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="fn-list">
        {AGENT_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        ))}
      </div>

      <div className="section-label">Owner Functions</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>DEFAULT_ADMIN_ROLE</code> — role management
      </p>
      <div className="fn-list">
        {OWNER_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        ))}
      </div>
    </div>
  )
}
