import { useEffect, useState } from 'react'
import { firebaseConfigError, loadVenue } from './backend'
import { Brand } from './ui/Brand'
import { GuestPage } from './ui/GuestPage'
import { OperatorPage } from './ui/OperatorPage'
import { PrintPage } from './ui/PrintPage'
import { TvPage } from './ui/TvPage'
import { isOperatorHome, isTvHome } from './ui/siteUrls'
import { setVenueName, venueName } from './ui/venue'
import { validVenuePath, venuePath } from './venueContext'
import './App.css'

export default function App() {
  const path = venuePath
  const [venueReady, setVenueReady] = useState(false)
  const [venueFound, setVenueFound] = useState(false)
  useEffect(() => {
    if (firebaseConfigError || !validVenuePath) return
    let active = true
    loadVenue().then((venue) => {
      if (!active) return
      if (venue) setVenueName(venue.name)
      setVenueFound(Boolean(venue))
      setVenueReady(true)
    }).catch(() => { if (active) setVenueReady(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!venueReady || !venueFound) return
    if (path === '/operador' || isOperatorHome) document.title = `Painel · ${venueName}`
    if (path === '/operador/relatorios') document.title = `Relatórios · ${venueName}`
    if (path === '/telao' || isTvHome) document.title = `Telão · ${venueName}`
  }, [path, venueReady, venueFound])
  if (firebaseConfigError) return <div className="operator-shell login-shell"><div className="login-card"><Brand /><span className="section-kicker">CONFIGURAÇÃO NECESSÁRIA</span><h1>Firebase indisponível.</h1><p role="alert">{firebaseConfigError}</p></div></div>
  if (!validVenuePath || (venueReady && !venueFound)) return <div className="operator-shell login-shell"><div className="login-card"><h1>Bar não encontrado</h1><p>Confira o endereço deste bar com o operador.</p></div></div>
  if (!venueReady) return <div className="operator-shell loading-screen"><p>Carregando bar...</p></div>
  if (path === '/operador' || path === '/operador/relatorios' || isOperatorHome) return <OperatorPage />
  if (path === '/telao' || isTvHome) return <TvPage />
  if (path === '/imprimir') return <PrintPage />
  return <GuestPage />
}
