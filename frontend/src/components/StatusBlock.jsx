import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import { useWallet } from '../context/WalletContext.jsx'

export default function StatusBlock({ provider, contractAddress }) {
  const { account } = useWallet()
  const [queryAddr, setQueryAddr] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (account) setQueryAddr(account)
  }, [account])

  useEffect(() => {
    load()
  }, [contractAddress])

  async function load(addrOverride) {
    const addr = addrOverride ?? queryAddr
    setLoading(true)
    setError(null)
    try {
      const contract = new ethers.Contract(contractAddress, TOKEN_ABI, provider)
      const [paused, verified, frozen] = await Promise.all([
        contract.paused(),
        addr && ethers.isAddress(addr) ? contract.isVerified(addr) : null,
        addr && ethers.isAddress(addr) ? contract.isFrozen(addr) : null,
      ])
      setData({ paused, verified, frozen, addr })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  function handleQuery() {
    load(queryAddr)
  }

  function StatusDot({ value, trueLabel = 'Yes', falseLabel = 'No', danger = false }) {
    if (value === null || value === undefined) return <span className="info-value" style={{ color: 'var(--text-dim)' }}>—</span>
    const isActive = value === true
    const color = danger ? (isActive ? 'var(--red)' : 'var(--green)') : (isActive ? 'var(--green)' : 'var(--red)')
    return (
      <span className="info-value" style={{ color, fontFamily: 'inherit' }}>
        <span style={{ marginRight: 5 }}>{isActive ? '●' : '○'}</span>
        {isActive ? trueLabel : falseLabel}
      </span>
    )
  }

  return (
    <div className="card token-info-panel" style={{ marginBottom: 16 }}>
      <div className="token-info-header">
        <span className="card-title">Status</span>
        <button className="btn btn-secondary btn-sm" onClick={() => load()} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-warn" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="info-grid" style={{ marginBottom: 16 }}>
        <div className="info-item">
          <span className="info-label">Contract</span>
          {data
            ? <span className={`info-value ${data.paused ? 'paused' : 'active'}`} style={{ fontFamily: 'inherit' }}>
                {data.paused ? '⏸ Paused' : '▶ Active'}
              </span>
            : <span className="info-value" style={{ color: 'var(--text-dim)' }}>—</span>
          }
        </div>
        <div className="info-item">
          <span className="info-label">Verified</span>
          <StatusDot value={data?.verified} trueLabel="Verified" falseLabel="Not verified" />
        </div>
        <div className="info-item">
          <span className="info-label">Frozen</span>
          <StatusDot value={data?.frozen} trueLabel="Frozen" falseLabel="Not frozen" danger />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="fn-input"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="0x… address to query"
          value={queryAddr}
          onChange={e => setQueryAddr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleQuery} disabled={loading}>
          Query
        </button>
      </div>
      {data?.addr && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {data.addr}
        </div>
      )}
    </div>
  )
}
