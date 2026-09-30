import { useEffect, useMemo, useState } from 'react'
import { demoMode, loadReports, signOutAdmin } from '../backend'
import { buildSummaryCsv, requestsForNights, summarizeRequests, type NightRecord, type RankedItem, type ReportData } from '../reports'
import type { Room } from '../domain'
import { Brand, DemoBanner } from './Brand'
import { operatorUrl, tvUrl } from './siteUrls'

function dateLabel(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(timestamp)
}

function percent(numerator: number, denominator: number): string {
  return denominator ? `${Math.round(numerator / denominator * 100)}%` : '0%'
}

function downloadCsv(data: ReportData, nights: NightRecord[]) {
  const csv = buildSummaryCsv(data, nights)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'karaoke-resumo-das-noites.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Ranking({ title, items, empty, note }: { title: string; items: RankedItem[]; empty: string; note?: string }) {
  const max = items[0]?.count ?? 1
  return <section className="card report-panel"><div className="report-panel-head"><div><span className="section-kicker">PREFERÊNCIAS</span><h2>{title}</h2></div><span className="section-count">{items.length} no total</span></div>
    {note && <p className="report-note">{note}</p>}
    {items.length ? <ol className="report-ranking">{items.slice(0, 7).map((item, index) => <li key={item.label}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><div className="rank-content"><div><strong>{item.label}</strong><small>{item.count} {item.count === 1 ? 'pedido' : 'pedidos'} · {item.performed} {item.performed === 1 ? 'apresentação' : 'apresentações'}</small></div><span className="rank-track" aria-hidden="true"><span style={{ width: `${item.count / max * 100}%` }} /></span></div></li>)}</ol> : <p className="empty-copy">{empty}</p>}
  </section>
}

export function ReportsPage({ room }: { room: Room }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [openedAt] = useState(() => Date.now())

  async function refresh() {
    setLoading(true)
    setError('')
    try { setData(await loadReports()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os relatórios.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    loadReports().then((result) => { if (active) setData(result) })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os relatórios.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const allNights = useMemo(() => [...(data?.nights ?? [])].sort((a, b) => b.startedAt - a.startedAt), [data])
  const selectedNights = useMemo(() => {
    if (filter.startsWith('night:')) return allNights.filter((night) => night.id === filter.slice(6))
    if (filter === '30' || filter === '90') return allNights.filter((night) => night.startedAt >= openedAt - Number(filter) * 86_400_000)
    return allNights
  }, [allNights, filter, openedAt])
  const requests = useMemo(() => data ? requestsForNights(data, selectedNights.map((night) => night.id)) : [], [data, selectedNights])
  const summary = useMemo(() => summarizeRequests(requests), [requests])
  const nightRows = useMemo(() => data ? selectedNights.map((night) => ({
    night, summary: summarizeRequests(requestsForNights(data, [night.id])),
  })) : [], [data, selectedNights])
  const peak = summary.hours[0]

  return <div className="operator-shell report-shell"><DemoBanner />
    <header className="operator-header"><Brand small /><nav aria-label="Acesso rápido"><a href={operatorUrl}>Painel da noite ↗</a><a href={tvUrl} target="_blank" rel="noreferrer">Abrir telão ↗</a>{!demoMode && <button onClick={() => void signOutAdmin()}>Sair</button>}</nav></header>
    <main className="operator-main report-main">
      <div className="operator-title report-title"><div><span className="section-kicker">INTELIGÊNCIA DA CASA</span><h1>Relatórios da casa<span className="title-spark">✦</span></h1><p>Descubra o que o público pede e acompanhe cada noite de karaokê.</p></div><span className="session-pill">Acesso do operador</span></div>
      <div className="report-toolbar"><label>Período ou noite<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas as noites</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><optgroup label="Uma noite">{allNights.map((night) => <option key={night.id} value={`night:${night.id}`}>{dateLabel(night.startedAt)}{night.id === room.nightId ? ' · atual' : ''}</option>)}</optgroup></select></label><div className="report-toolbar-actions"><button className="button button-outline" disabled={loading} onClick={() => void refresh()}>{loading ? 'Atualizando...' : 'Atualizar dados'}</button><button className="button button-primary" disabled={!data || selectedNights.length === 0} onClick={() => data && downloadCsv(data, selectedNights)}>Baixar resumo CSV ↗</button></div></div>
      {error && <p className="feedback" role="alert">{error}</p>}
      {loading && !data ? <section className="card report-panel"><p>Carregando dados das noites...</p></section> : !selectedNights.length ? <section className="card report-panel"><h2>Sem noites neste período</h2><p>Abra uma noite no painel do operador para começar a formar o histórico.</p></section> : <>
        <section className="report-metrics" aria-label="Resumo dos pedidos"><div><span>NOITES</span><strong>{selectedNights.length}</strong><small>registradas</small></div><div><span>PEDIDOS</span><strong>{summary.total}</strong><small>{selectedNights.length ? (summary.total / selectedNights.length).toFixed(1).replace('.', ',') : 0} por noite</small></div><div><span>APRESENTAÇÕES</span><strong>{summary.completed}</strong><small>{percent(summary.completed, summary.total)} dos pedidos</small></div><div><span>MÚSICAS DIFERENTES</span><strong>{summary.uniqueSongs}</strong><small>por título e artista</small></div></section>
        <div className="report-grid"><Ranking title="Músicas mais pedidas" items={summary.topSongs} empty="Ainda não há músicas neste período." note="Pedidos enviados, incluindo os que não chegaram ao palco." /><Ranking title="Artistas mais pedidos" items={summary.topArtists} empty="Ainda não há artistas neste período." /></div>
        <div className="report-grid report-secondary"><section className="card report-panel"><span className="section-kicker">FLUXO DA NOITE</span><h2>Destino dos pedidos</h2><div className="report-breakdown"><div><span>Apresentados</span><strong>{summary.completed}</strong></div><div><span>Cancelados</span><strong>{summary.cancelled}</strong></div><div><span>Recusados</span><strong>{summary.rejected}</strong></div><div><span>Em aberto ou sem apresentação</span><strong>{summary.open}</strong></div><div><span>Chamadas perdidas</span><strong>{summary.missedCalls}</strong></div></div><p className="report-note">Pedidos de noites anteriores que ficaram na fila aparecem como “sem apresentação”.</p></section>
          <section className="card report-panel"><span className="section-kicker">OPORTUNIDADES</span><h2>Para planejar a divulgação</h2><div className="report-insights"><div><small>ARTISTA MAIS PEDIDO</small><strong>{summary.topArtists[0]?.label ?? 'Sem dados'}</strong></div><div><small>HORÁRIO COM MAIS PEDIDOS</small><strong>{peak ? `${String(peak.hour).padStart(2, '0')}h–${String((peak.hour + 1) % 24).padStart(2, '0')}h` : 'Sem dados'}</strong></div><div><small>MESA COM MAIS PEDIDOS INFORMADOS</small><strong>{summary.topTables[0]?.label ?? 'Sem dados'}</strong></div></div><p className="report-note">O horário considera o envio do pedido, não o início da música. A mesa é opcional.</p></section></div>
        <section className="card report-panel report-history"><div className="report-panel-head"><div><span className="section-kicker">HISTÓRICO</span><h2>Noite por noite</h2></div><span className="section-count">{nightRows.length} {nightRows.length === 1 ? 'noite' : 'noites'}</span></div><div className="report-table-wrap"><table><thead><tr><th scope="col">Data</th><th scope="col">Pedidos</th><th scope="col">Apresentações</th><th scope="col">Conclusão</th><th scope="col">Mais pedida</th></tr></thead><tbody>{nightRows.map(({ night, summary: item }) => <tr key={night.id}><th scope="row"><span>{dateLabel(night.startedAt)}</span>{night.id === room.nightId && <small>{room.open ? 'Noite em andamento' : 'Pedidos encerrados'}</small>}</th><td>{item.total}</td><td>{item.completed}</td><td>{percent(item.completed, item.total)}</td><td>{item.topSongs[0]?.label ?? '—'}</td></tr>)}</tbody></table></div></section>
        <p className="report-footnote">Relatórios agrupam variações de acento e maiúsculas. Os números são de pedidos registrados no sistema; não representam vendas, público total ou reproduções no YouTube.</p>
      </>}
    </main>
  </div>
}
