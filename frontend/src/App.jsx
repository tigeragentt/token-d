import { Routes, Route, NavLink } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext.jsx'
import WalletButton from './components/WalletButton.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SepoliaPage from './pages/SepoliaPage.jsx'
import XDCPage from './pages/XDCPage.jsx'
import CREPage from './pages/CREPage.jsx'

export default function App() {
  return (
    <WalletProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-logo">
            <span className="logo-icon">D</span>
            <span className="logo-text">TokenD</span>
            <span className="logo-sub">Debenture 1 &middot; ERC-3643</span>
          </div>
          <nav className="app-nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Dashboard
            </NavLink>
            <NavLink to="/sepolia" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Sepolia
            </NavLink>
            <NavLink to="/xdc" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              XDC
            </NavLink>
            <NavLink to="/cre" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              CRE / API
            </NavLink>
          </nav>
          <WalletButton />
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sepolia" element={<SepoliaPage />} />
            <Route path="/xdc" element={<XDCPage />} />
            <Route path="/cre" element={<CREPage />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>TokenD &mdash; Debenture 1 (Deb1) &mdash; ERC-3643 Security Token</span>
        </footer>
      </div>
    </WalletProvider>
  )
}
