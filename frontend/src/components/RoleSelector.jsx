import { useState } from 'react'

export const ROLES = [
  {
    name: 'DEFAULT_ADMIN_ROLE',
    bytes32: '0x0000000000000000000000000000000000000000000000000000000000000000',
    description: 'Full admin — can grant/revoke any role',
  },
  {
    name: 'AGENT_ROLE',
    bytes32: '0xcab5a0bfe0b79d2c4b1c2e02599fa044d115b7511f9659307cb4276950967709',
    description: 'Mint, burn, freeze, pause, identity ops',
  },
]

export default function RoleSelector() {
  const [selected, setSelected] = useState(ROLES[0])
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(selected.bytes32)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card" style={{ marginBottom: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="fn-badge read" style={{ fontSize: 11 }}>roles</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Available Roles</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <select
          className="fn-input"
          style={{ minWidth: 0, flex: '0 0 auto', width: 220, cursor: 'pointer' }}
          value={selected.name}
          onChange={e => setSelected(ROLES.find(r => r.name === e.target.value))}
        >
          {ROLES.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selected.description}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{
          flex: 1, fontSize: 11, fontFamily: 'monospace',
          color: 'var(--accent2)', wordBreak: 'break-all',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px',
        }}>
          {selected.bytes32}
        </code>
        <button className="btn btn-secondary btn-sm" onClick={copy} style={{ whiteSpace: 'nowrap' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
