import { ethers } from 'ethers'
import { XDC_ADDRESS, XDC_RPC, XDC_NETWORK_PARAMS } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import TokenInfoPanel from '../components/TokenInfoPanel.jsx'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'
import { ROLES } from '../components/RoleSelector.jsx'
import AddTokenButton from '../components/AddTokenButton.jsx'

const ROLE_OPTIONS = { 0: ROLES.map(r => ({ label: r.name, value: r.bytes32 })) }

const readProvider = new ethers.JsonRpcProvider(XDC_RPC)

function FnPair({ a, b, signer, address, inputOptions = {} }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <WriteFunction fnName={a} signer={signer} contractAddress={address} inputOptions={inputOptions} />
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <WriteFunction fnName={b} signer={signer} contractAddress={address} inputOptions={inputOptions} />
      </div>
    </div>
  )
}

export default function XDCPage() {
  const { account, signer, error, connect } = useWallet()

  return (
    <div>
      <h1 className="page-title">XDC Apothem</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--green)', fontSize: 12 }}>{XDC_ADDRESS}</code>
        {' '}<AddTokenButton address={XDC_ADDRESS} />
        <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 11 }}>RPC: {XDC_RPC}</span>
      </p>

      <div className="alert alert-info">
        Read calls use raw JSON-RPC (eth_call) directly to the XDC node &mdash; no wallet needed.
        {!account && (
          <>
            {' '}Write functions require MetaMask on XDC Apothem.{' '}
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}
              onClick={() => connect(XDC_NETWORK_PARAMS)}>
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
        Any verified address — balance, allowance, status, transfer, approve
      </p>
      <div className="fn-list">
        <ReadFunction fnName="balanceOf" provider={readProvider} contractAddress={XDC_ADDRESS}
          showRaw={true} prefillArgs={[account]} autoCall={!!account} inline />
        <ReadFunction fnName="allowance" provider={readProvider} contractAddress={XDC_ADDRESS}
          showRaw={true} prefillArgs={[account, null]} inline />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <ReadFunction fnName="isVerified" provider={readProvider} contractAddress={XDC_ADDRESS}
              showRaw={true} prefillArgs={[account]} autoCall={!!account} inline />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <ReadFunction fnName="isFrozen" provider={readProvider} contractAddress={XDC_ADDRESS}
              showRaw={true} prefillArgs={[account]} autoCall={!!account} inline />
          </div>
        </div>
        <WriteFunction fnName="transfer"     signer={signer} contractAddress={XDC_ADDRESS} />
        <WriteFunction fnName="approve"      signer={signer} contractAddress={XDC_ADDRESS} />
        <WriteFunction fnName="transferFrom" signer={signer} contractAddress={XDC_ADDRESS} />
      </div>

      {/* ── Agent ── */}
      <div className="section-label">Agent</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="fn-list">
        <FnPair a="mint"             b="burn"                     signer={signer} address={XDC_ADDRESS} />
        <FnPair a="pause"            b="unpause"                  signer={signer} address={XDC_ADDRESS} />
        <FnPair a="registerIdentity" b="revokeIdentity"           signer={signer} address={XDC_ADDRESS} />
        <FnPair a="freezePartialTokens" b="unfreezePartialTokens" signer={signer} address={XDC_ADDRESS} />
        <WriteFunction fnName="setAddressFrozen" signer={signer} contractAddress={XDC_ADDRESS} />
        <WriteFunction fnName="forcedTransfer"  signer={signer} contractAddress={XDC_ADDRESS} />
        <WriteFunction fnName="recoveryAddress" signer={signer} contractAddress={XDC_ADDRESS} />
      </div>

      {/* ── Owner ── */}
      <div className="section-label">Owner</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>DEFAULT_ADMIN_ROLE</code> — role management
      </p>
      <div className="fn-list">
        <ReadFunction fnName="hasRole" provider={readProvider}
          contractAddress={XDC_ADDRESS} showRaw={true} inputOptions={ROLE_OPTIONS} />
        <FnPair a="grantRole" b="revokeRole" signer={signer} address={XDC_ADDRESS}
          inputOptions={ROLE_OPTIONS} />
      </div>
    </div>
  )
}
