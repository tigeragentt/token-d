import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI as ABI } from '../abi.js'
import { formatTokenAmount } from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'

const STATIC_FNS = ['name', 'symbol', 'decimals', 'totalSupply', 'paused', 'owner']

const LABELS = {
  name: 'Token Name', symbol: 'Symbol', decimals: 'Decimals',
  totalSupply: 'Total Supply', owner: 'Owner',
}

export default function TokenInfoPanel({ provider, contractAddress }) {
  const { account } = useWallet()
  const [info, setInfo]         = useState({})
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError]     = useState(null)

  const [queryAddr, setQueryAddr] = useState('')
  const [status, setStatus]       = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [statusError, setStatusError]     = useState(null)

  // pre-fill address from wallet
  useEffect(() => { if (account) setQueryAddr(account) }, [account])

  // load static info on mount
  useEffect(() => { loadInfo() }, [contractAddress])

  async function loadInfo() {
    setLoadingInfo(true); setInfoError(null)
    try {
      const c = new ethers.Contract(contractAddress, ABI, provider)
      const results = await Promise.all(STATIC_FNS.map(fn => c[fn]()))
      const data = {}
      STATIC_FNS.forEach((fn, i) => { data[fn] = results[i] })
      setInfo(data)
    } catch (e) { setInfoError(e.message || String(e)) }
    finally { setLoadingInfo(false) }
  }

  async function queryStatus(addrOverride) {
    const addr = addrOverride ?? queryAddr
    if (!addr || !ethers.isAddress(addr)) {
      setStatusError('Invalid address'); return
    }
    setLoadingStatus(true); setStatusError(null)
    try {
      const c = new ethers.Contract(contractAddress, ABI, provider)
      const [verified, frozen] = await Promise.all([c.isVerified(addr), c.isFrozen(addr)])
      setStatus({ addr, verified, frozen })
    } catch (e) { setStatusError(e.message || String(e)) }
    finally { setLoadingStatus(false) }
  }

  function fmtVal(key, val) {
    if (val === undefined || val === null) return '—'
    if (key === 'totalSupply') return formatTokenAmount(val) + ' ' + (info.symbol || '')
    if (key === 'decimals') return String(val)
    return String(val)
  }

  function Pill({ value, onLabel, offLabel, danger = false }) {
    if (value === null || value === undefined)
      return <span style={{ color: 'var(--text-dim)' }}>—</span>
    const color = danger
      ? (value ? 'var(--red)' : 'var(--green)')
      : (value ? 'var(--green)' : 'var(--red)')
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 10px', borderRadius: 20,
        fontSize: 12, fontWeight: 600,
        background: `${color}18`, color, border: `1px solid ${color}44`,
      }}>
        <span style={{ fontSize: 8 }}>●</span>
        {value ? onLabel : offLabel}
      </span>
    )
  }

  return (
    <div className="card token-info-panel" style={{ marginBottom: 16 }}>

      {/* ── Header ── */}
      <div className="token-info-header">
        <span className="card-title">Token Info</span>
        <button className="btn btn-secondary btn-sm" onClick={loadInfo} disabled={loadingInfo}>
          {loadingInfo ? '…' : '↻ Refresh'}
        </button>
      </div>

      {infoError && <div className="alert alert-warn" style={{ marginBottom: 12 }}>{infoError}</div>}

      {/* ── Static fields ── */}
      <div className="info-grid" style={{ marginBottom: 20 }}>
        {['name', 'symbol', 'decimals', 'totalSupply', 'owner'].map(key => (
          <div className="info-item" key={key}>
            <span className="info-label">{LABELS[key]}</span>
            <span className="info-value">
              {loadingInfo ? <span className="spinner" /> : fmtVal(key, info[key])}
            </span>
          </div>
        ))}
      </div>

      {/* ── Status row ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
        <div className="info-label" style={{ marginBottom: 10 }}>Status</div>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Contract</span>
            <span style={{ marginTop: 2 }}>
              {loadingInfo ? <span className="spinner" /> : (
                <Pill value={!info.paused} onLabel="Active" offLabel="Paused" />
              )}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Verified</span>
            <span style={{ marginTop: 2 }}>
              {status
                ? <Pill value={status.verified} onLabel="Verified" offLabel="Not verified" />
                : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>query an address ↓</span>
              }
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Frozen</span>
            <span style={{ marginTop: 2 }}>
              {status
                ? <Pill value={status.frozen} onLabel="Frozen" offLabel="Not frozen" danger />
                : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>query an address ↓</span>
              }
            </span>
          </div>
        </div>
      </div>

      {/* ── Address query ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="fn-input"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="0x… address to check isVerified / isFrozen"
          value={queryAddr}
          onChange={e => setQueryAddr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && queryStatus()}
        />
        <button className="btn btn-secondary btn-sm" onClick={() => queryStatus()} disabled={loadingStatus}>
          {loadingStatus ? '…' : 'Query'}
        </button>
      </div>

      {statusError && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--red)' }}>{statusError}</div>
      )}
      {status?.addr && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {status.addr}
        </div>
      )}
    </div>
  )
}
