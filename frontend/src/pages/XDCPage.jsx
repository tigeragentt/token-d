import { ethers } from 'ethers'
import { XDC_ADDRESS, XDC_RPC, XDC_NETWORK_PARAMS } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import TokenInfoPanel from '../components/TokenInfoPanel.jsx'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'

const USER_READ_FNS  = ['balanceOf', 'allowance', 'isVerified', 'isFrozen']
const USER_WRITE_FNS = ['transfer', 'approve', 'transferFrom']

const AGENT_FNS = [
  'mint', 'burn', 'pause', 'unpause',
  'registerIdentity', 'revokeIdentity',
  'setAddressFrozen', 'freezePartialTokens', 'unfreezePartialTokens',
  'forcedTransfer', 'recoveryAddress',
]

const OWNER_FNS = ['grantRole', 'revokeRole']

const readProvider = new ethers.JsonRpcProvider(XDC_RPC)

export default function XDCPage() {
  const { account, signer, error, connect } = useWallet()

  return (
    <div>
      <h1 className="page-title">XDC Apothem</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--green)', fontSize: 12 }}>{XDC_ADDRESS}</code>
        <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 11 }}>RPC: {XDC_RPC}</span>
      </p>

      <div className="alert alert-info">
        Read calls use raw JSON-RPC (eth_call) directly to the XDC node &mdash; no wallet needed.
        {!account && (
          <>
            {' '}Write functions require MetaMask on XDC Apothem.{' '}
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => connect(XDC_NETWORK_PARAMS)}
            >
              Connect &amp; switch to XDC
            </button>
          </>
        )}
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <TokenInfoPanel provider={readProvider} contractAddress={XDC_ADDRESS} />

      {/* ── User ── */}
      <div className="section-label">User</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Any verified address — read balance/allowance/status, transfer, approve
      </p>
      <div className="fn-list">
        {USER_READ_FNS.map(fn => (
          <ReadFunction key={fn} fnName={fn} provider={readProvider}
            contractAddress={XDC_ADDRESS} showRaw={true} />
        ))}
        {USER_WRITE_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={XDC_ADDRESS} />
        ))}
      </div>

      {/* ── Agent ── */}
      <div className="section-label">Agent</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="fn-list">
        {AGENT_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={XDC_ADDRESS} />
        ))}
      </div>

      {/* ── Owner ── */}
      <div className="section-label">Owner</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>DEFAULT_ADMIN_ROLE</code> — role management
      </p>
      <div className="fn-list">
        {OWNER_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={XDC_ADDRESS} />
        ))}
      </div>
    </div>
  )
}
