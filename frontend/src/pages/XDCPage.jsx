import { ethers } from 'ethers'
import { XDC_ADDRESS, XDC_RPC, XDC_NETWORK_PARAMS } from '../config.js'
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

      <div className="section-label">Query Functions — Raw JSON-RPC</div>
      <div className="fn-list">
        {READ_FNS.map(fn => (
          <ReadFunction key={fn} fnName={fn} provider={readProvider}
            contractAddress={XDC_ADDRESS} showRaw={true} />
        ))}
      </div>

      <div className="section-label">User Functions</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Any verified address — transfer, approve
      </p>
      <div className="fn-list">
        {USER_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={XDC_ADDRESS} />
        ))}
      </div>

      <div className="section-label">Agent Functions</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="fn-list">
        {AGENT_FNS.map(fn => (
          <WriteFunction key={fn} fnName={fn} signer={signer} contractAddress={XDC_ADDRESS} />
        ))}
      </div>

      <div className="section-label">Owner Functions</div>
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
