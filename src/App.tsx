import { useEffect } from 'react'
import { firebaseConfigError } from './backend'
import { Brand } from './ui/Brand'
import { GuestPage } from './ui/GuestPage'
import { OperatorPage } from './ui/OperatorPage'
import { PrintPage } from './ui/PrintPage'
import { TvPage } from './ui/TvPage'
import { venueName } from './ui/venue'
import './App.css'

export default function App() {
  const path = window.location.pathname
  useEffect(() => {
    if (path === '/operador') document.title = `Painel · ${venueName}`
    if (path === '/operador/relatorios') document.title = `Relatórios · ${venueName}`
    if (path === '/telao') document.title = `Telão · ${venueName}`
  }, [path])
  if (firebaseConfigError) return <div className="operator-shell login-shell"><div className="login-card"><Brand /><span className="section-kicker">CONFIGURAÇÃO NECESSÁRIA</span><h1>Firebase indisponível.</h1><p role="alert">{firebaseConfigError}</p></div></div>
  if (path === '/operador' || path === '/operador/relatorios') return <OperatorPage />
  if (path === '/telao') return <TvPage />
  if (path === '/imprimir') return <PrintPage />
  return <GuestPage />
}
