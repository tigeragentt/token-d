import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import { formatTokenAmount, normaliseAddress } from '../config.js'

const TOKEN_AMOUNT_FUNS = ['totalSupply', 'balanceOf', 'getFrozenTokens', 'allowance']

function formatResult(fnName, value) {
  if (value === undefined || value === null) return '—'
  if (TOKEN_AMOUNT_FUNS.includes(fnName)) {
    try { return formatTokenAmount(value) + ' Deb1' } catch { /* fall through */ }
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export default function ReadFunction({
  fnName, provider, contractAddress,
  showRaw = false,
  prefillArgs = null,  // array matching inputs; null slots = empty
  autoCall = false,    // if true, call automatically when all prefills are set
}) {
  const abiEntry = TOKEN_ABI.find(e => e.name === fnName && (e.stateMutability === 'view' || e.stateMutability === 'pure'))
    || TOKEN_ABI.find(e => e.name === fnName)
  const inputs = abiEntry?.inputs || []

  const [args, setArgs] = useState(inputs.map((_, i) => prefillArgs?.[i] ?? ''))
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle')
  const [rawReq, setRawReq] = useState(null)
  const [rawRes, setRawRes] = useState(null)
  const [showRawPanel, setShowRawPanel] = useState(false)
  const calledRef = useRef(false)

  // sync prefillArgs into inputs when they change (e.g. wallet connects)
  useEffect(() => {
    if (!prefillArgs) return
    setArgs(prev => prev.map((v, i) => {
      const fill = prefillArgs[i]
      return fill !== null && fill !== undefined ? fill : v
    }))
    calledRef.current = false // allow re-call when prefill changes
  }, [JSON.stringify(prefillArgs)])

  // auto-call when all prefilled slots are non-empty
  useEffect(() => {
    if (!autoCall || calledRef.current) return
    const allFilled = inputs.every((_, i) => {
      const fill = prefillArgs?.[i]
      return fill !== null && fill !== undefined && fill !== ''
    })
    if (allFilled) {
      calledRef.current = true
      call(inputs.map((_, i) => prefillArgs[i]))
    }
  }, [JSON.stringify(prefillArgs)])

  async function call(overrideArgs) {
    const callArgs = overrideArgs ?? args
    setStatus('loading')
    setResult(null)
    setRawReq(null)
    setRawRes(null)
    try {
      const iface = new ethers.Interface(TOKEN_ABI)
      const normArgs = callArgs.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(String(a).trim())
        if (t === 'uint256') return BigInt(String(a).trim())
        if (t === 'bool') return String(a).trim().toLowerCase() === 'true'
        if (t === 'bytes32') return String(a).trim()
        return String(a).trim()
      })

      const calldata = iface.encodeFunctionData(fnName, normArgs)
      const addr = normaliseAddress(contractAddress)

      if (showRaw) {
        const reqPayload = {
          jsonrpc: '2.0', method: 'eth_call',
          params: [{ to: addr, data: calldata }, 'latest'], id: 1,
        }
        setRawReq(JSON.stringify(reqPayload, null, 2))
        const resp = await provider.call({ to: addr, data: calldata })
        setRawRes(JSON.stringify({ jsonrpc: '2.0', id: 1, result: resp }, null, 2))
        const decoded = iface.decodeFunctionResult(fnName, resp)
        setResult(formatResult(fnName, decoded.length === 1 ? decoded[0] : decoded))
      } else {
        const contract = new ethers.Contract(addr, TOKEN_ABI, provider)
        const res = await contract[fnName](...normArgs)
        setResult(formatResult(fnName, res))
      }
      setStatus('success')
    } catch (e) {
      setResult(e.message || String(e))
      setStatus('error')
    }
  }

  const prefilled = (i) => prefillArgs?.[i] !== null && prefillArgs?.[i] !== undefined && prefillArgs?.[i] !== ''

  return (
    <div className="fn-card">
      <div className="fn-header">
        <span className="fn-name">{fnName}()</span>
        <span className="fn-badge read">read</span>
      </div>
      {inputs.length > 0 && (
        <div className="fn-inputs">
          {inputs.map((inp, i) => (
            <div key={i} className="fn-input-group">
              <label className="fn-input-label">
                {inp.name} <span style={{ color: '#4fa3ff' }}>({inp.type})</span>
                {prefilled(i) && <span style={{ color: 'var(--green)', marginLeft: 6, fontSize: 10 }}>● auto</span>}
              </label>
              <input
                className="fn-input"
                placeholder={inp.type}
                value={args[i]}
                onChange={e => {
                  const next = [...args]
                  next[i] = e.target.value
                  setArgs(next)
                }}
              />
            </div>
          ))}
        </div>
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => call()}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? <><span className="spinner" />Calling…</> : 'Call'}
      </button>
      {result !== null && (
        <div className={`fn-result ${status}`}>{result}</div>
      )}
      {showRaw && (rawReq || rawRes) && (
        <>
          <span className="raw-toggle" onClick={() => setShowRawPanel(v => !v)}>
            {showRawPanel ? '▼' : '▶'} Raw JSON-RPC
          </span>
          {showRawPanel && (
            <div>
              {rawReq && <><div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Request:</div><div className="raw-block">{rawReq}</div></>}
              {rawRes && <><div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Response:</div><div className="raw-block">{rawRes}</div></>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
