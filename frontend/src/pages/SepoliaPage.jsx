import { useState } from 'react'
import { ethers } from 'ethers'
import {
  SEPOLIA_ADDRESS, SEPOLIA_CHAIN_ID, SEPOLIA_RPC, SEPOLIA_NETWORK_PARAMS,
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

export default function SepoliaPage() {
  const [account, setAccount] = useState(null)
  const [signer, setSigner] = useState(null)
  const [networkOk, setNetworkOk] = useState(false)
  const [connError, setConnError] = useState(null)

  // Read provider — public RPC, no wallet needed
  const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC)

  async function connect() {
    setConnError(null)
    if (!window.ethereum) {
      setConnError('MetaMask not found. Install it and try again.')
      return
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        // Try to switch
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_NETWORK_PARAMS.chainId }],
          })
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [SEPOLIA_NETWORK_PARAMS],
            })
          } else throw switchErr
        }
      }
      const s = await provider.getSigner()
      setAccount(await s.getAddress())
      setSigner(s)
      setNetworkOk(true)
    } catch (e) {
      setConnError(e.message || String(e))
    }
  }

  function disconnect() {
    setAccount(null)
    setSigner(null)
    setNetworkOk(false)
  }

  return (
    <div>
      <h1 className="page-title">Sepolia</h1>
      <p className="page-subtitle">
        Contract: <code style={{ color: 'var(--accent2)', fontSize: 12 }}>{SEPOLIA_ADDRESS}</code>
      </p>

      <div className="connect-bar">
        {!account ? (
          <button className="btn btn-primary" onClick={connect}>Connect MetaMask</button>
        ) : (
          <>
            <span className="connected-addr">{account}</span>
            <span className="network-badge">Sepolia</span>
            <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>
          </>
        )}
      </div>
      {connError && <div className="alert alert-warn">{connError}</div>}
      {!account && (
        <div className="alert alert-info">
          Read functions work without a wallet. Write functions require MetaMask connected to Sepolia.
        </div>
      )}

      <div className="section-label">Read Functions</div>
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
