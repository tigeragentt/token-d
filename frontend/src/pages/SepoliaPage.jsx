import { ethers } from 'ethers'
import { SEPOLIA_ADDRESS, SEPOLIA_RPC, SEPOLIA_NETWORK_PARAMS } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import TokenInfoPanel from '../components/TokenInfoPanel.jsx'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'
import { ROLES } from '../components/RoleSelector.jsx'
import AddTokenButton from '../components/AddTokenButton.jsx'

const ROLE_OPTIONS = { 0: ROLES.map(r => ({ label: r.name, value: r.bytes32 })) }

const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC)

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

export default function SepoliaPage() {
  const { account, signer, error, connect } = useWallet()

  return (
    <div>
      <h1 className="page-title">Sepolia</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--accent2)', fontSize: 12 }}>{SEPOLIA_ADDRESS}</code>
        {' '}<AddTokenButton address={SEPOLIA_ADDRESS} />
      </p>

      {error &&<div className="alert alert-warn">{error}</div>}
      {!account && (
        <div className="alert alert-info">
          Read functions work without a wallet. Connect MetaMask (top right) on Sepolia to use write functions.
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 12 }}
            onClick={() => connect(SEPOLIA_NETWORK_PARAMS)}>
            Connect &amp; switch to Sepolia
          </button>
        </div>
      )}

      <TokenInfoPanel provider={readProvider} contractAddress={SEPOLIA_ADDRESS} />

      {/* ── User ── */}
      <div className="section-label">User</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Any verified address — balance, allowance, status, transfer, approve
      </p>
      <div className="fn-list">
        <ReadFunction fnName="balanceOf" provider={readProvider} contractAddress={SEPOLIA_ADDRESS}
          showRaw={false} prefillArgs={[account]} autoCall={!!account} inline />
        <ReadFunction fnName="allowance" provider={readProvider} contractAddress={SEPOLIA_ADDRESS}
          showRaw={false} prefillArgs={[account, null]} inline />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <ReadFunction fnName="isVerified" provider={readProvider} contractAddress={SEPOLIA_ADDRESS}
              showRaw={false} prefillArgs={[account]} autoCall={!!account} inline />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <ReadFunction fnName="isFrozen" provider={readProvider} contractAddress={SEPOLIA_ADDRESS}
              showRaw={false} prefillArgs={[account]} autoCall={!!account} inline />
          </div>
        </div>
        <WriteFunction fnName="transfer"     signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        <WriteFunction fnName="approve"      signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        <WriteFunction fnName="transferFrom" signer={signer} contractAddress={SEPOLIA_ADDRESS} />
      </div>

      {/* ── Agent ── */}
      <div className="section-label">Agent</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="fn-list">
        <FnPair a="mint"             b="burn"                   signer={signer} address={SEPOLIA_ADDRESS} />
        <FnPair a="pause"            b="unpause"                signer={signer} address={SEPOLIA_ADDRESS} />
        <FnPair a="registerIdentity" b="revokeIdentity"         signer={signer} address={SEPOLIA_ADDRESS} />
        <FnPair a="freezePartialTokens" b="unfreezePartialTokens" signer={signer} address={SEPOLIA_ADDRESS} />
        <WriteFunction fnName="setAddressFrozen" signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        <WriteFunction fnName="forcedTransfer"  signer={signer} contractAddress={SEPOLIA_ADDRESS} />
        <WriteFunction fnName="recoveryAddress" signer={signer} contractAddress={SEPOLIA_ADDRESS} />
      </div>

      {/* ── Owner ── */}
      <div className="section-label">Owner</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>DEFAULT_ADMIN_ROLE</code> — role management
      </p>
      <div className="fn-list">
        <ReadFunction fnName="hasRole" provider={readProvider}
          contractAddress={SEPOLIA_ADDRESS} showRaw={false} inputOptions={ROLE_OPTIONS} />
        <FnPair a="grantRole" b="revokeRole" signer={signer} address={SEPOLIA_ADDRESS}
          inputOptions={ROLE_OPTIONS} />
      </div>
    </div>
  )
}
