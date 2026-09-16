import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import {
  XDC_ADDRESS, XDC_RPC, XDC_NETWORK_PARAMS,
  formatTokenAmount, normaliseAddress, toRawAmount, isAmountParam,
} from '../config.js'
import { useWallet } from '../context/WalletContext.jsx'
import { ROLES } from '../components/RoleSelector.jsx'

const ROLE_OPTIONS = ROLES.map(r => ({ label: r.name, value: r.bytes32 }))

function downloadJson(filename, data) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Build eth_call JSON-RPC payload for a given function + args
function buildEthCallPayload(fnName, args, contractAddress) {
  const iface = new ethers.Interface(TOKEN_ABI)
  const calldata = iface.encodeFunctionData(fnName, args)
  const addr = normaliseAddress(contractAddress)
  return {
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [{ to: addr, data: calldata }, 'latest'],
    id: 1,
  }
}

// Decode an eth_call result
function decodeResult(fnName, hexResult) {
  const iface = new ethers.Interface(TOKEN_ABI)
  const decoded = iface.decodeFunctionResult(fnName, hexResult)
  return decoded.length === 1 ? decoded[0] : decoded
}

function CREWritePair({ a, b, signer, creUrl }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}><CREWriteRow fnName={a} signer={signer} creUrl={creUrl} /></div>
      <div style={{ flex: '1 1 0', minWidth: 0 }}><CREWriteRow fnName={b} signer={signer} creUrl={creUrl} /></div>
    </div>
  )
}

const TOKEN_AMOUNT_FNS = ['totalSupply', 'balanceOf', 'getFrozenTokens', 'allowance']

function formatVal(fnName, v) {
  if (v === undefined || v === null) return '—'
  if (TOKEN_AMOUNT_FNS.includes(fnName)) {
    try { return formatTokenAmount(v) + ' Deb1' } catch { /* fall through */ }
  }
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v.toString()
  return String(v)
}

function CREReadRow({ fnName }) {
  const abiEntry = TOKEN_ABI.find(e => e.name === fnName)
  const inputs = abiEntry?.inputs || []
  const [args, setArgs] = useState(inputs.map(() => ''))
  const [picks, setPicks] = useState(inputs.map(() => ''))
  const [payload, setPayload] = useState(null)
  const [rawRes, setRawRes] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle')
  const [showRaw, setShowRaw] = useState(false)

  function buildPayload() {
    try {
      const normArgs = args.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(a.trim())
        if (t === 'uint256') return BigInt(a.trim())
        if (t === 'bool') return a.trim().toLowerCase() === 'true'
        if (t === 'bytes32') return a.trim()
        return a.trim()
      })
      const p = buildEthCallPayload(fnName, normArgs, XDC_ADDRESS)
      setPayload(JSON.stringify(p, null, 2))
      setRawRes(null)
      setResult(null)
      setStatus('idle')
      return p
    } catch (e) {
      setPayload(null)
      setResult('Error building payload: ' + e.message)
      setStatus('error')
      return null
    }
  }

  function downloadPayload() {
    const p = buildPayload()
    if (p) downloadJson(`${fnName}-payload.json`, p)
  }

  async function send() {
    if (!payload) { buildPayload(); return }
    setStatus('loading')
    setRawRes(null)
    setResult(null)
    try {
      const resp = await fetch(XDC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
      const json = await resp.json()
      setRawRes(JSON.stringify(json, null, 2))
      if (json.error) throw new Error(json.error.message)
      const decoded = decodeResult(fnName, json.result)
      setResult(formatVal(fnName, decoded))
      setStatus('success')
    } catch (e) {
      setResult(e.message || String(e))
      setStatus('error')
    }
  }

  return (
    <div className="fn-card">
      <div className="fn-header">
        <span className="fn-name">{fnName}()</span>
        <span className="fn-badge read">read / eth_call</span>
      </div>
      {inputs.length > 0 && (
        <div className="fn-inputs">
          {inputs.map((inp, i) => (
            <div key={i} className="fn-input-group">
              <label className="fn-input-label">{inp.name} ({inp.type})</label>
              {inp.type === 'bytes32' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="fn-input"
                    style={{ flex: '0 0 150px', width: 150, minWidth: 0, cursor: 'pointer' }}
                    value={picks[i]}
                    onChange={e => {
                      const opt = ROLE_OPTIONS.find(o => o.label === e.target.value)
                      const nextPicks = [...picks]; nextPicks[i] = e.target.value; setPicks(nextPicks)
                      if (opt) { const next = [...args]; next[i] = opt.value; setArgs(next) }
                    }}
                  >
                    <option value="">— role name —</option>
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    className="fn-input"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="role (bytes32)"
                    value={args[i]}
                    onChange={e => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
                  />
                </div>
              ) : (
                <input
                  className="fn-input"
                  placeholder={inp.type}
                  value={args[i]}
                  onChange={e => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={buildPayload}>Build Payload</button>
        <button className="btn btn-secondary btn-sm" onClick={downloadPayload}>Download Payload</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={send}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? <><span className="spinner" />Sending…</> : 'Send to XDC RPC'}
        </button>
      </div>
      {payload && (
        <>
          <span className="raw-toggle" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? '▼' : '▶'} CRE JSON-RPC Payload (request)
          </span>
          {showRaw && <div className="raw-block">{payload}</div>}
        </>
      )}
      {rawRes && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>Raw XDC Response:</div>
          <div className="raw-block">{rawRes}</div>
        </>
      )}
      {result !== null && (
        <div className={`fn-result ${status}`}>
          Decoded: {result}
        </div>
      )}
    </div>
  )
}

function CREWriteRow({ fnName, signer, creUrl }) {
  const abiEntry = TOKEN_ABI.find(e => e.name === fnName)
  const inputs = abiEntry?.inputs || []
  const [args, setArgs] = useState(inputs.map(() => ''))
  const [picks, setPicks] = useState(inputs.map(() => ''))
  const [calldata, setCalldata] = useState(null)
  const [txResult, setTxResult] = useState(null)
  const [status, setStatus] = useState('idle')
  const [showRaw, setShowRaw] = useState(false)
  const [creStatus, setCreStatus] = useState('idle')
  const [creResult, setCreResult] = useState(null)

  function buildCalldata() {
    try {
      const iface = new ethers.Interface(TOKEN_ABI)
      const normArgs = args.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(a.trim())
        if (t === 'address[]') return a.trim().split(',').map(x => normaliseAddress(x.trim()))
        if (t === 'uint256') return isAmountParam(inputs[i]?.name) ? toRawAmount(a) : BigInt(a.trim())
        if (t === 'uint256[]') return a.trim().split(',').map(x => isAmountParam(inputs[i]?.name) ? toRawAmount(x) : BigInt(x.trim()))
        if (t === 'bool') return a.trim().toLowerCase() === 'true'
        if (t === 'bool[]') return a.trim().split(',').map(x => x.trim().toLowerCase() === 'true')
        if (t === 'bytes32') return a.trim()
        return a.trim()
      })
      const data = iface.encodeFunctionData(fnName, normArgs)
      const obj = {
        to: normaliseAddress(XDC_ADDRESS),
        data,
        fnName,
        args: normArgs.map(a => typeof a === 'bigint' ? a.toString() : a),
      }
      setCalldata(JSON.stringify(obj, null, 2))
      return obj
    } catch (e) {
      setCalldata('Error: ' + e.message)
      return null
    }
  }

  function downloadPayload() {
    const obj = buildCalldata()
    if (obj) downloadJson(`${fnName}-payload.json`, obj)
  }

  async function sendViaCre() {
    if (!creUrl) { setCreResult('Paste the CRE trigger URL above first.'); setCreStatus('error'); return }
    const obj = buildCalldata()
    if (!obj) return
    setCreStatus('loading')
    setCreResult(null)
    try {
      const body = JSON.stringify({ input: { to: obj.to, data: obj.data, gasLimit: 100000 } })
      // Route localhost URLs through Vite dev proxy (/cre-proxy) to avoid CORS.
      const isLocal = creUrl.includes('localhost') || creUrl.includes('127.0.0.1')
      const fetchUrl = isLocal ? '/cre-proxy' : creUrl
      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const text = await resp.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = text }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
      const txHash = parsed?.txHash || parsed?.result || text
      setCreResult(`Submitted via CRE — txHash: ${txHash}`)
      setCreStatus('success')
    } catch (e) {
      setCreResult(e.message || String(e))
      setCreStatus('error')
    }
  }

  async function sendTx() {
    if (!signer) { setTxResult('Connect MetaMask (XDC) first.'); return }
    setStatus('loading')
    setTxResult(null)
    try {
      const iface = new ethers.Interface(TOKEN_ABI)
      const normArgs = args.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(a.trim())
        if (t === 'address[]') return a.trim().split(',').map(x => normaliseAddress(x.trim()))
        if (t === 'uint256') return isAmountParam(inputs[i]?.name) ? toRawAmount(a) : BigInt(a.trim())
        if (t === 'uint256[]') return a.trim().split(',').map(x => isAmountParam(inputs[i]?.name) ? toRawAmount(x) : BigInt(x.trim()))
        if (t === 'bool') return a.trim().toLowerCase() === 'true'
        if (t === 'bool[]') return a.trim().split(',').map(x => x.trim().toLowerCase() === 'true')
        if (t === 'bytes32') return a.trim()
        return a.trim()
      })
      const contract = new ethers.Contract(normaliseAddress(XDC_ADDRESS), TOKEN_ABI, signer)
      const tx = await contract[fnName](...normArgs)
      setTxResult(`Tx sent: ${tx.hash}`)
      setStatus('pending')
      const receipt = await tx.wait()
      setTxResult(`Confirmed in block ${receipt.blockNumber} — ${tx.hash}`)
      setStatus('success')
    } catch (e) {
      setTxResult(e.reason || e.message || String(e))
      setStatus('error')
    }
  }

  return (
    <div className="fn-card">
      <div className="fn-header">
        <span className="fn-name">{fnName}()</span>
        <span className="fn-badge write">write / wallet</span>
      </div>
      {inputs.length > 0 && (
        <div className="fn-inputs">
          {inputs.map((inp, i) => (
            <div key={i} className="fn-input-group">
              <label className="fn-input-label">
                {inp.name} ({inp.type})
                {inp.type.includes('[]') && <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>(comma-separated)</span>}
                {(inp.type === 'uint256' || inp.type === 'uint256[]') && isAmountParam(inp.name) && (
                  <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>Deb1 (e.g. 5 = 5.00)</span>
                )}
              </label>
              {inp.type === 'bytes32' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="fn-input"
                    style={{ flex: '0 0 150px', width: 150, minWidth: 0, cursor: 'pointer' }}
                    value={picks[i]}
                    onChange={e => {
                      const opt = ROLE_OPTIONS.find(o => o.label === e.target.value)
                      const nextPicks = [...picks]; nextPicks[i] = e.target.value; setPicks(nextPicks)
                      if (opt) { const next = [...args]; next[i] = opt.value; setArgs(next) }
                    }}
                  >
                    <option value="">— role name —</option>
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    className="fn-input"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="role (bytes32)"
                    value={args[i]}
                    onChange={e => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
                  />
                </div>
              ) : (
                <input
                  className="fn-input"
                  placeholder={inp.type}
                  value={args[i]}
                  onChange={e => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={buildCalldata}>Show Calldata</button>
        <button className="btn btn-secondary btn-sm" onClick={downloadPayload}>Download Payload</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={sendViaCre}
          disabled={creStatus === 'loading' || !creUrl}
          title={!creUrl ? 'Paste CRE trigger URL above first' : 'POST to the workflow-xdc HTTP trigger'}
          style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
        >
          {creStatus === 'loading'
            ? <><span className="spinner" />Sending to CRE…</>
            : 'Send via CRE'}
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={sendTx}
          disabled={status === 'loading' || status === 'pending' || !signer}
          title={!signer ? 'Connect MetaMask (XDC) first' : ''}
        >
          {(status === 'loading' || status === 'pending')
            ? <><span className="spinner" />{status === 'pending' ? 'Waiting…' : 'Sending…'}</>
            : 'Send via Wallet'}
        </button>
      </div>
      {calldata && (
        <>
          <span className="raw-toggle" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? '▼' : '▶'} Encoded Calldata
          </span>
          {showRaw && <div className="raw-block">{calldata}</div>}
        </>
      )}
      {creResult !== null && (
        <div className={`fn-result ${creStatus}`}>{creResult}</div>
      )}
      {txResult !== null && (
        <div className={`fn-result ${status === 'pending' ? 'pending' : status}`}>{txResult}</div>
      )}
    </div>
  )
}

// Simulate CRE totalSupply workflow
function CRESimulate() {
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle')
  const [log, setLog] = useState([])

  const payload = {
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [{ to: normaliseAddress(XDC_ADDRESS), data: '0x18160ddd' }, 'latest'],
    id: 1,
  }

  async function simulate() {
    setStatus('loading')
    setResult(null)
    setLog([])

    const addLog = msg => setLog(prev => [...prev, msg])

    addLog('Step 1: CRE HTTP capability prepares eth_call payload')
    addLog('  → method: eth_call')
    addLog('  → data: 0x18160ddd (totalSupply selector)')
    addLog(`  → to: ${normaliseAddress(XDC_ADDRESS)}`)
    addLog(`  → RPC: ${XDC_RPC}`)

    try {
      addLog('Step 2: Sending POST request to XDC RPC node…')
      const resp = await fetch(XDC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await resp.json()
      addLog('Step 3: Received response from XDC node')
      addLog('  → result (hex): ' + json.result)
      if (json.error) throw new Error(json.error.message)
      const raw = BigInt(json.result)
      addLog('Step 4: CRE decodes ABI result — uint256: ' + raw.toString())
      const formatted = formatTokenAmount(raw)
      addLog('Step 5: CRE applies decimals (÷100) → ' + formatted + ' Deb1')
      setResult(formatted + ' Deb1')
      setStatus('success')
    } catch (e) {
      addLog('Error: ' + e.message)
      setResult(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="card">
      <div className="card-title">Simulate CRE totalSupply() Call</div>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
        This simulates exactly what a CRE workflow would do: use the HTTP capability to call
        the XDC RPC with a raw eth_call, then decode the ABI response.
      </p>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>JSON-RPC Payload CRE would send:</div>
        <div className="raw-block">{JSON.stringify(payload, null, 2)}</div>
      </div>

      <button
        className="btn btn-primary"
        onClick={simulate}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? <><span className="spinner" />Running…</> : 'Run CRE Simulation'}
      </button>

      {log.length > 0 && (
        <div className="raw-block" style={{ marginTop: 12 }}>
          {log.join('\n')}
        </div>
      )}

      {result !== null && (
        <div className={`fn-result ${status}`} style={{ marginTop: 10 }}>
          Result: {result}
        </div>
      )}
    </div>
  )
}

const CRE_URL_KEY = 'cre_trigger_url'

export default function CREPage() {
  const { account, signer, error: connError, connect, disconnect } = useWallet()
  const [creUrl, setCreUrl] = useState(
    () => localStorage.getItem(CRE_URL_KEY) || import.meta.env.VITE_CRE_TRIGGER_URL || ''
  )
  const updateCreUrl = useCallback((val) => {
    setCreUrl(val)
    if (val) localStorage.setItem(CRE_URL_KEY, val)
    else localStorage.removeItem(CRE_URL_KEY)
  }, [])

  return (
    <div>
      <h1 className="page-title">CRE</h1>
      <p className="page-subtitle">
        Shows how a Chainlink Runtime Environment workflow reads from XDC via the HTTP capability (raw JSON-RPC).
        Write functions show encoded calldata and require MetaMask.
      </p>

      <div className="alert alert-info">
        CRE uses the <strong>HTTP capability</strong> to call the XDC JSON-RPC endpoint directly &mdash;
        no wallet or SDK needed for reads. Each read below shows the exact payload CRE would send,
        lets you fire it live, and shows the raw response.
      </div>

      <CRESimulate />

      {/* ── CRE Trigger URL ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">CRE Write Trigger (workflow-xdc)</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
          Paste the HTTP trigger URL from <code>cre workflow deploy</code> for <strong>workflow-xdc</strong>.
          Write functions will get a <strong>Send via CRE</strong> button that POSTs calldata to this URL.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="fn-input"
            style={{ flex: 1 }}
            placeholder="https://cre.chain.link/trigger/..."
            value={creUrl}
            onChange={e => updateCreUrl(e.target.value.trim())}
          />
          {creUrl && (
            <button className="btn btn-secondary btn-sm" onClick={() => updateCreUrl('')}>Clear</button>
          )}
        </div>
        {creUrl && (
          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>
            ✓ CRE trigger URL set — write cards now show "Send via CRE"
          </div>
        )}
      </div>

      {!account ? (
        <div className="connect-bar" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => connect(XDC_NETWORK_PARAMS)}>
            Connect MetaMask (XDC) for Writes
          </button>
          {connError && <span style={{ color: 'var(--warn)', fontSize: 12, marginLeft: 8 }}>{connError}</span>}
        </div>
      ) : (
        <div className="connect-bar" style={{ marginTop: 8 }}>
          <span className="connected-addr">{account}</span>
          <span className="network-badge" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>XDC Apothem</span>
          <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>
        </div>
      )}

      {/* ── Token Info ── */}
      <div className="section-label">Token Info</div>
      <div className="fn-list">
        <CREReadRow fnName="totalSupply" />
        <CREReadRow fnName="name" />
        <CREReadRow fnName="symbol" />
        <CREReadRow fnName="decimals" />
        <CREReadRow fnName="paused" />
        <CREReadRow fnName="owner" />
      </div>

      {/* ── User ── */}
      <div className="section-label">User</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Any verified address — balance, allowance, status, transfer, approve
      </p>
      <div className="fn-list">
        <CREReadRow fnName="balanceOf" />
        <CREReadRow fnName="allowance" />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}><CREReadRow fnName="isVerified" /></div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}><CREReadRow fnName="isFrozen" /></div>
        </div>
        <CREWriteRow fnName="transfer"     signer={signer} creUrl={creUrl} />
        <CREWriteRow fnName="approve"      signer={signer} creUrl={creUrl} />
        <CREWriteRow fnName="transferFrom" signer={signer} creUrl={creUrl} />
      </div>

      {/* ── Agent ── */}
      <div className="section-label">Agent</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>AGENT_ROLE</code> — mint, burn, identity, freeze, pause
      </p>
      <div className="alert alert-warn" style={{ marginBottom: 12 }}>
        CRE cannot submit transactions directly &mdash; it would need a signer/agent wallet.
        These show the encoded calldata CRE would prepare, and let you execute via MetaMask.
      </div>
      <div className="fn-list">
        <CREWritePair a="mint"                b="burn"                     signer={signer} creUrl={creUrl} />
        <CREWritePair a="pause"               b="unpause"                  signer={signer} creUrl={creUrl} />
        <CREWritePair a="registerIdentity"    b="revokeIdentity"           signer={signer} creUrl={creUrl} />
        <CREWritePair a="freezePartialTokens" b="unfreezePartialTokens"    signer={signer} creUrl={creUrl} />
        <CREWriteRow fnName="setAddressFrozen" signer={signer} creUrl={creUrl} />
        <CREWriteRow fnName="forcedTransfer"   signer={signer} creUrl={creUrl} />
        <CREWriteRow fnName="recoveryAddress"  signer={signer} creUrl={creUrl} />
      </div>

      {/* ── Owner ── */}
      <div className="section-label">Owner</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
        Requires <code>DEFAULT_ADMIN_ROLE</code> — role management
      </p>
      <div className="fn-list">
        <CREReadRow fnName="hasRole" />
        <CREWritePair a="grantRole" b="revokeRole" signer={signer} creUrl={creUrl} />
      </div>
    </div>
  )
}
