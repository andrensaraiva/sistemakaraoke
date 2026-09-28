import { QRCodeSVG } from 'qrcode.react'
import { Brand } from './Brand'

export function PrintPage() {
  const count = Math.min(80, Math.max(1, Number(new URLSearchParams(window.location.search).get('mesas')) || 12))
  const tables = Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'))
  return <div className="print-page"><div className="print-toolbar"><Brand small /><button className="button button-primary" onClick={() => window.print()}>Imprimir cartelas</button></div><div className="print-grid">{tables.map((table) => <section className="print-card" key={table}><Brand small /><p>O palco também é seu</p><div className="print-qr"><QRCodeSVG value={`${window.location.origin}/mesa/${table}`} size={150} marginSize={1} /></div><strong>MESA {table}</strong><span>Escaneie, peça sua música e acompanhe a fila.</span><small>{window.location.host}/mesa/{table}</small></section>)}</div></div>
}
