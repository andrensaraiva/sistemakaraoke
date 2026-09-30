import { QRCodeSVG } from 'qrcode.react'
import { Brand } from './Brand'
import { guestUrl } from './siteUrls'

export function PrintPage() {
  const tableParam = new URLSearchParams(window.location.search).get('mesas')
  const count = tableParam === null ? null : Math.min(80, Math.max(1, Number(tableParam) || 12))
  const tables = count === null ? null : Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'))
  return <div className="print-page"><div className="print-toolbar"><Brand small /><button className="button button-primary" onClick={() => window.print()}>{tables ? 'Imprimir cartelas' : 'Imprimir QR único'}</button></div>
    {tables ? <div className="print-grid">{tables.map((table) => <section className="print-card" key={table}><Brand small /><p>O palco também é seu</p><div className="print-qr"><QRCodeSVG value={new URL(`mesa/${table}`, guestUrl).href} size={150} marginSize={1} /></div><strong>MESA {table}</strong><span>Escaneie, peça sua música e acompanhe a fila.</span><small>{new URL(guestUrl).host}/mesa/{table}</small></section>)}</div>
      : <section className="print-single"><Brand /><p>O palco também é seu.</p><h1>Peça sua música!</h1><div className="print-single-qr"><QRCodeSVG value={guestUrl} size={280} marginSize={1} /></div><strong>Escaneie e entre na fila.</strong><span>Acompanhe sua vez pelo celular. A mesa é opcional.</span><small>{new URL(guestUrl).host}</small></section>}
  </div>
}
