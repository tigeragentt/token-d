import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI as ABI } from '../abi.js'
import { formatTokenAmount } from '../config.js'

const STATIC_FNS = ['name', 'symbol', 'decimals', 'totalSupply', 'paused', 'owner']

const LABELS = {
  name: 'Token Name', symbol: 'Symbol', decimals: 'Decimals',
  totalSupply: 'Total Supply', owner: 'Owner',
}

export function Pill({ value, onLabel, offLabel, danger = false }) {
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

export default function TokenInfoPanel({ provider, contractAddress }) {
  const [info, setInfo]           = useState({})
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => { loadInfo() }, [contractAddress])

  async function loadInfo() {
    setLoading(true); setError(null)
    try {
      const c = new ethers.Contract(contractAddress, ABI, provider)
      const results = await Promise.all(STATIC_FNS.map(fn => c[fn]()))
      const data = {}
      STATIC_FNS.forEach((fn, i) => { data[fn] = results[i] })
      setInfo(data)
    } catch (e) { setError(e.message || String(e)) }
    finally { setLoading(false) }
  }

  function fmtVal(key, val) {
    if (val === undefined || val === null) return '—'
    if (key === 'totalSupply') return formatTokenAmount(val) + ' ' + (info.symbol || '')
    if (key === 'decimals') return String(val)
    return String(val)
  }

  return (
    <div className="card token-info-panel" style={{ marginBottom: 16 }}>
      <div className="token-info-header">
        <span className="card-title">Token Info</span>
        <button className="btn btn-secondary btn-sm" onClick={loadInfo} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-warn" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="info-grid" style={{ marginBottom: 20 }}>
        {['name', 'symbol', 'decimals', 'totalSupply', 'owner'].map(key => (
          <div className="info-item" key={key}>
            <span className="info-label">{LABELS[key]}</span>
            <span className="info-value">
              {loading ? <span className="spinner" /> : fmtVal(key, info[key])}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div className="info-label" style={{ marginBottom: 10 }}>Contract Status</div>
        <div>
          {loading
            ? <span className="spinner" />
            : <Pill value={!info.paused} onLabel="Active" offLabel="Paused" />
          }
        </div>
      </div>
    </div>
  )
}
