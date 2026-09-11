import { useState } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import { formatTokenAmount, normaliseAddress } from '../config.js'

// Functions whose output is a token amount (needs /100 formatting)
const TOKEN_AMOUNT_FUNS = ['totalSupply', 'balanceOf', 'getFrozenTokens', 'allowance']

function formatResult(fnName, value) {
  if (value === undefined || value === null) return '—'
  if (TOKEN_AMOUNT_FUNS.includes(fnName)) {
    try {
      return formatTokenAmount(value) + ' Deb1'
    } catch { /* fall through */ }
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export default function ReadFunction({ fnName, provider, contractAddress, showRaw = false }) {
  const abiEntry = TOKEN_ABI.find(e => e.name === fnName && e.stateMutability === 'view' || e.stateMutability === 'pure')
    || TOKEN_ABI.find(e => e.name === fnName)
  const inputs = abiEntry?.inputs || []

  const [args, setArgs] = useState(inputs.map(() => ''))
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [rawReq, setRawReq] = useState(null)
  const [rawRes, setRawRes] = useState(null)
  const [showRawPanel, setShowRawPanel] = useState(false)

  async function call() {
    setStatus('loading')
    setResult(null)
    setRawReq(null)
    setRawRes(null)
    try {
      const iface = new ethers.Interface(TOKEN_ABI)
      const normArgs = args.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(a.trim())
        if (t === 'uint256') return BigInt(a.trim())
        if (t === 'bool') return a.trim().toLowerCase() === 'true'
        if (t === 'bytes32') return a.trim()
        return a.trim()
      })

      const calldata = iface.encodeFunctionData(fnName, normArgs)
      const addr = normaliseAddress(contractAddress)

      if (showRaw) {
        const reqPayload = {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: addr, data: calldata }, 'latest'],
          id: 1,
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
              <label className="fn-input-label">{inp.name} <span style={{color:'#4fa3ff'}}>({inp.type})</span></label>
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
        onClick={call}
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
              {rawReq && <><div style={{fontSize:11,color:'var(--text-dim)',marginTop:6}}>Request:</div><div className="raw-block">{rawReq}</div></>}
              {rawRes && <><div style={{fontSize:11,color:'var(--text-dim)',marginTop:6}}>Response:</div><div className="raw-block">{rawRes}</div></>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
