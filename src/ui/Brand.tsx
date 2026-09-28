import { demoMode } from '../backend'
import { venueName } from './venue'

export function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}>
    <span className="brand-mark" aria-hidden="true">✦</span>
    <span>{venueName}</span>
  </div>
}

export function DemoBanner() {
  if (!demoMode) return null
  return <div className="demo-banner">Modo demonstração · os dados ficam neste navegador até conectar o Firebase</div>
}
