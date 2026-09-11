import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI as ABI } from '../abi.js'
import { formatTokenAmount } from '../config.js'

const STATIC_READS = ['name', 'symbol', 'decimals', 'totalSupply', 'paused', 'owner']

export default function TokenInfoPanel({ provider, contractAddress }) {
  const [info, setInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider)
      const results = await Promise.all(STATIC_READS.map(fn => contract[fn]()))
      const data = {}
      STATIC_READS.forEach((fn, i) => { data[fn] = results[i] })
      setInfo(data)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [contractAddress])

  function fmt(key, val) {
    if (val === undefined || val === null) return '—'
    if (key === 'totalSupply') return formatTokenAmount(val) + ' ' + (info.symbol || '')
    if (key === 'paused') return val ? '⏸ Paused' : '▶ Active'
    if (key === 'decimals') return String(val)
    return String(val)
  }

  const labels = {
    name: 'Token Name',
    symbol: 'Symbol',
    decimals: 'Decimals',
    totalSupply: 'Total Supply',
    paused: 'Status',
    owner: 'Owner',
  }

  return (
    <div className="card token-info-panel">
      <div className="token-info-header">
        <span className="card-title">Token Info</span>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-warn" style={{ marginBottom: 0 }}>{error}</div>}

      {!error && (
        <div className="info-grid">
          {STATIC_READS.map(key => (
            <div className="info-item" key={key}>
              <span className="info-label">{labels[key]}</span>
              <span className={`info-value${key === 'paused' ? (info[key] ? ' paused' : ' active') : ''}`}>
                {loading ? <span className="spinner" /> : fmt(key, info[key])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
