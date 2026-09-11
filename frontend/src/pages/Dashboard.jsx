import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import {
  SEPOLIA_ADDRESS, XDC_ADDRESS,
  SEPOLIA_RPC, XDC_RPC,
  formatTokenAmount,
} from '../config.js'
import SupplyPieChart from '../components/SupplyPieChart.jsx'

async function fetchSupply(rpc, address) {
  // Use raw eth_call for reliability (no CORS issues with JsonRpcProvider on some nodes)
  const resp = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: address, data: '0x18160ddd' }, 'latest'],
      id: 1,
    }),
  })
  const json = await resp.json()
  if (json.error) throw new Error(json.error.message)
  return BigInt(json.result)
}

export default function Dashboard() {
  const [sepoliaSupply, setSepoliaSupply] = useState(null)
  const [xdcSupply, setXdcSupply] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [s, x] = await Promise.all([
        fetchSupply(SEPOLIA_RPC, SEPOLIA_ADDRESS),
        fetchSupply(XDC_RPC, XDC_ADDRESS),
      ])
      setSepoliaSupply(s)
      setXdcSupply(x)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = (sepoliaSupply !== null && xdcSupply !== null)
    ? sepoliaSupply + xdcSupply
    : null

  const sepoliaPct = (sepoliaSupply !== null && total !== null && total > 0n)
    ? ((Number(sepoliaSupply) / Number(total)) * 100).toFixed(1)
    : '—'
  const xdcPct = (xdcSupply !== null && total !== null && total > 0n)
    ? ((Number(xdcSupply) / Number(total)) * 100).toFixed(1)
    : '—'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title">Dashboard</h1>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? <><span className="spinner" />Refreshing…</> : 'Refresh'}
        </button>
      </div>
      <p className="page-subtitle">
        Debenture 1 (Deb1) — ERC-3643 Security Token &mdash; live supply across chains
        {lastUpdated && <span style={{ marginLeft: 8, color: 'var(--text-dim)' }}>Updated {lastUpdated}</span>}
      </p>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Sepolia Supply</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {loading ? <span className="spinner" /> : (sepoliaSupply !== null ? formatTokenAmount(sepoliaSupply) : '—')}
          </div>
          <div className="stat-sub">Deb1 &mdash; {sepoliaPct}% of total</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">XDC Apothem Supply</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {loading ? <span className="spinner" /> : (xdcSupply !== null ? formatTokenAmount(xdcSupply) : '—')}
          </div>
          <div className="stat-sub">Deb1 &mdash; {xdcPct}% of total</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Combined Total Supply</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {loading ? <span className="spinner" /> : (total !== null ? formatTokenAmount(total) : '—')}
          </div>
          <div className="stat-sub">Deb1 across both chains</div>
        </div>
      </div>

      <div className="dash-bottom">
        <div className="card">
          <div className="card-title">Supply Distribution</div>
          <div className="chart-wrap">
            {!loading && sepoliaSupply !== null && xdcSupply !== null && (
              <SupplyPieChart sepoliaRaw={sepoliaSupply} xdcRaw={xdcSupply} />
            )}
            {loading && <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}><span className="spinner" />Loading…</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Contract Info</div>
          <table className="info-table">
            <tbody>
              <tr><td>Token Name</td><td>Debenture 1</td></tr>
              <tr><td>Symbol</td><td>Deb1</td></tr>
              <tr><td>Decimals</td><td>2</td></tr>
              <tr><td>Standard</td><td>ERC-3643 (T-REX)</td></tr>
              <tr><td>Sepolia Address</td><td style={{ fontSize: 11 }}>{SEPOLIA_ADDRESS}</td></tr>
              <tr><td>XDC Apothem Address</td><td style={{ fontSize: 11 }}>{XDC_ADDRESS}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
