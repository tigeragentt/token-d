import { useState } from 'react'
import { ethers } from 'ethers'
import { TOKEN_ABI } from '../abi.js'
import { normaliseAddress } from '../config.js'

export default function WriteFunction({ fnName, signer, contractAddress, inputOptions = {} }) {
  const abiEntry = TOKEN_ABI.find(e => e.name === fnName && e.stateMutability === 'nonpayable')
    || TOKEN_ABI.find(e => e.name === fnName)
  const inputs = abiEntry?.inputs || []

  const [args, setArgs] = useState(inputs.map(() => ''))
  const [picks, setPicks] = useState(inputs.map(() => ''))
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle')

  async function send() {
    if (!signer) {
      setResult('Connect your wallet first.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setResult(null)
    try {
      const addr = normaliseAddress(contractAddress)
      const contract = new ethers.Contract(addr, TOKEN_ABI, signer)
      const normArgs = args.map((a, i) => {
        const t = inputs[i]?.type || ''
        if (t === 'address') return normaliseAddress(a.trim())
        if (t === 'address[]') return a.trim().split(',').map(x => normaliseAddress(x.trim()))
        if (t === 'uint256') return BigInt(a.trim())
        if (t === 'uint256[]') return a.trim().split(',').map(x => BigInt(x.trim()))
        if (t === 'bool') return a.trim().toLowerCase() === 'true'
        if (t === 'bool[]') return a.trim().split(',').map(x => x.trim().toLowerCase() === 'true')
        if (t === 'bytes32') return a.trim()
        return a.trim()
      })
      const tx = await contract[fnName](...normArgs)
      setResult(`Tx sent: ${tx.hash}`)
      setStatus('pending')
      const receipt = await tx.wait()
      setResult(`Confirmed in block ${receipt.blockNumber} — ${tx.hash}`)
      setStatus('success')
    } catch (e) {
      setResult(e.reason || e.message || String(e))
      setStatus('error')
    }
  }

  return (
    <div className="fn-card">
      <div className="fn-header">
        <span className="fn-name">{fnName}()</span>
        <span className="fn-badge write">write</span>
      </div>
      {inputs.length > 0 && (
        <div className="fn-inputs">
          {inputs.map((inp, i) => (
            <div key={i} className="fn-input-group">
              <label className="fn-input-label">
                {inp.name} <span style={{color:'var(--accent)'}}>({inp.type})</span>
                {inp.type.includes('[]') && <span style={{color:'var(--text-dim)',marginLeft:4}}>(comma-separated)</span>}
              </label>
              {inputOptions[i] ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="fn-input"
                    style={{ flex: '0 0 150px', width: 150, minWidth: 0, cursor: 'pointer' }}
                    value={picks[i]}
                    onChange={e => {
                      const opt = inputOptions[i].find(o => o.label === e.target.value)
                      const nextPicks = [...picks]; nextPicks[i] = e.target.value; setPicks(nextPicks)
                      if (opt) { const next = [...args]; next[i] = opt.value; setArgs(next) }
                    }}
                  >
                    <option value="">— role name —</option>
                    {inputOptions[i].map(opt => (
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
                  onChange={e => {
                    const next = [...args]
                    next[i] = e.target.value
                    setArgs(next)
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <button
        className="btn btn-primary btn-sm"
        onClick={send}
        disabled={status === 'loading' || status === 'pending' || !signer}
        title={!signer ? 'Connect wallet first' : ''}
      >
        {(status === 'loading' || status === 'pending')
          ? <><span className="spinner" />{status === 'pending' ? 'Waiting…' : 'Sending…'}</>
          : 'Send'}
      </button>
      {result !== null && (
        <div className={`fn-result ${status === 'pending' ? 'pending' : status}`}>
          {result}
        </div>
      )}
    </div>
  )
}
