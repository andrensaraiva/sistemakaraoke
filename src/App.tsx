import { useEffect } from 'react'
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
    if (path === '/telao') document.title = `Telão · ${venueName}`
  }, [path])
  if (path === '/operador') return <OperatorPage />
  if (path === '/telao') return <TvPage />
  if (path === '/imprimir') return <PrintPage />
  return <GuestPage />
}
