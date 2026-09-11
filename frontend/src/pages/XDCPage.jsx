import { useState } from 'react'
import { ethers } from 'ethers'
import {
  XDC_ADDRESS, XDC_CHAIN_ID, XDC_RPC, XDC_NETWORK_PARAMS,
  normaliseAddress,
} from '../config.js'
import ReadFunction from '../components/ReadFunction.jsx'
import WriteFunction from '../components/WriteFunction.jsx'

const READ_FNS = [
  'totalSupply', 'name', 'symbol', 'decimals', 'paused', 'owner',
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

export default function XDCPage() {
  const [account, setAccount] = useState(null)
  const [signer, setSigner] = useState(null)
  const [connError, setConnError] = useState(null)

  // XDC read provider — raw JSON-RPC via fetch
  const readProvider = new ethers.JsonRpcProvider(XDC_RPC)

  async function connect() {
    setConnError(null)
    if (!window.ethereum) {
      setConnError('MetaMask not found.')
      return
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== XDC_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: XDC_NETWORK_PARAMS.chainId }],
          })
        } catch (err) {
          if (err.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [XDC_NETWORK_PARAMS],
            })
          } else throw err
        }
      }
      const s = await provider.getSigner()
      setAccount(await s.getAddress())
      setSigner(s)
    } catch (e) {
      setConnError(e.message || String(e))
    }
  }

  function disconnect() {
    setAccount(null)
    setSigner(null)
  }

  return (
    <div>
      <h1 className="page-title">XDC Apothem</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--green)', fontSize: 12 }}>{XDC_ADDRESS}</code>
        <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 11 }}>RPC: {XDC_RPC}</span>
      </p>

      <div className="alert alert-info">
        Read calls use raw JSON-RPC (eth_call) directly to the XDC node &mdash; no wallet needed.
        Each card shows a collapsible Raw JSON-RPC section.
      </div>

      <div className="connect-bar">
        {!account ? (
          <button className="btn btn-primary" onClick={connect}>Connect MetaMask (XDC Apothem)</button>
        ) : (
          <>
            <span className="connected-addr">{account}</span>
            <span className="network-badge" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>XDC Apothem</span>
            <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>
          </>
        )}
      </div>
      {connError && <div className="alert alert-warn">{connError}</div>}

      <div className="section-label">Read Functions — Raw JSON-RPC</div>
      <div className="fn-list">
        {READ_FNS.map(fn => (
          <ReadFunction
            key={fn}
            fnName={fn}
            provider={readProvider}
            contractAddress={XDC_ADDRESS}
            showRaw={true}
          />
        ))}
      </div>

      <div className="section-label">Write Functions</div>
      {!account && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          Connect MetaMask to XDC Apothem to enable write functions.
        </p>
      )}
      <div className="fn-list">
        {WRITE_FNS.map(fn => (
          <WriteFunction
            key={fn}
            fnName={fn}
            signer={signer}
            contractAddress={XDC_ADDRESS}
          />
        ))}
      </div>
    </div>
  )
}
