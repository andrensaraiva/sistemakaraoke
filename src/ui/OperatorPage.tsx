import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  approveRequest, callNextSinger, cancelRequest, changeTvMode, closeNight, completeSong, confirmSingerPresence,
  demoMode, markAbsent, moveQueueEntry, openNight, rejectRequest, reopenNight, saveSelectedUrl,
  signInAdmin, signOutAdmin, startSong, watchAdmin,
} from '../backend'
import { karaokeSearch, nextEligibleIndex, youtubeUrl, youtubeVideoId, type QueueEntry, type SearchProvider, type SongRequest } from '../domain'
import { Brand, DemoBanner } from './Brand'
import { useCountdown, useRequests, useRoom } from './hooks'
import { ReportsPage } from './ReportsPage'
import { guestUrl, tvUrl } from './siteUrls'
import { YouTubeWorkbench } from './YouTubeWorkbench'

type RunAction = (action: () => Promise<void>, success?: string) => Promise<void>
const searchProviderLabels: Record<SearchProvider, string> = { youtube: 'YouTube', youtube_music: 'YouTube Music', spotify: 'Spotify' }

function storedSearchProvider(): SearchProvider {
  try {
    const value = window.localStorage.getItem('karaoke-search-provider')
    if (value === 'youtube' || value === 'youtube_music' || value === 'spotify') return value
  } catch { /* armazenamento indisponível */ }
  return 'youtube'
}

export function OperatorPage() {
  const reportRoute = window.location.pathname === '/operador/relatorios'
  const room = useRoom()
  const tvMode = room.tvMode ?? 'video'
  const [admin, setAdmin] = useState({ ready: demoMode, allowed: demoMode, email: demoMode ? 'Modo de demonstração' : '' })
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tableCount, setTableCount] = useState(12)
  const [searchProvider, setSearchProvider] = useState<SearchProvider>(storedSearchProvider)
  const closeDialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => watchAdmin(setAdmin), [])
  useEffect(() => { try { window.localStorage.setItem('karaoke-search-provider', searchProvider) } catch { /* armazenamento indisponível */ } }, [searchProvider])
  const requests = useRequests(room.nightId, admin.allowed && !reportRoute)
  const pending = requests.filter((request) => request.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)
  const activeRequests = requests.filter((request) => ['pending', 'queued', 'calling', 'singing'].includes(request.status))
  const byId = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])
  const current = room.stage !== 'idle' ? byId.get(room.queue[0]?.id) : null
  const nextIndex = nextEligibleIndex(room)
  const countdown = useCountdown(room.stage === 'calling' ? room.calledAt : null)
  const missedCalls = requests.reduce((total, request) => total + request.misses, 0)

  const doAction: RunAction = async (action, success) => {
    setBusy(true); setNotice('')
    try { await action(); if (success) setNotice(success) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível concluir a ação.') }
    finally { setBusy(false) }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await doAction(() => signInAdmin(credentials.email, credentials.password))
  }

  function cancelCurrentRequest() {
    const id = room.queue[0]?.id
    if (id && window.confirm('Cancelar o pedido deste cantor? Ele poderá enviar um novo pedido depois.')) {
      void doAction(() => cancelRequest(id), 'Pedido cancelado.')
    }
  }

  if (!admin.ready) return <div className="operator-shell loading-screen"><Brand /><p>Carregando painel...</p></div>
  if (!admin.allowed) return <div className="operator-shell login-shell"><DemoBanner /><div className="login-card"><Brand /><span className="section-kicker">ÁREA RESTRITA</span><h1>Bem-vindo de volta.</h1><p>Entre para organizar a noite de karaokê.</p>
    {admin.email ? <><p className="feedback">Este usuário ainda não foi autorizado como operador.</p><button className="button button-outline" onClick={() => doAction(signOutAdmin)}>Sair desta conta</button></> : <form onSubmit={handleLogin}><label>E-mail<input type="email" required value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} /></label><label>Senha<input type="password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label><button className="button button-primary" type="submit" disabled={busy}>Entrar no painel</button></form>}
    {notice && <p className="feedback" role="alert">{notice}</p>}</div></div>

  if (reportRoute) return <ReportsPage room={room} />

  return <div className="operator-shell"><DemoBanner />
    <header className="operator-header"><Brand small /><nav aria-label="Acesso rápido"><a href="/operador/relatorios">Relatórios ↗</a><a href={guestUrl} target="_blank" rel="noreferrer">Visão do cliente ↗</a><a href={tvUrl} target="_blank" rel="noreferrer">Abrir telão ↗</a>{!demoMode && <button onClick={() => doAction(signOutAdmin)}>Sair</button>}</nav></header>
    <main className="operator-main"><div className="operator-title"><div><span className="section-kicker">CENTRAL DO KARAOKÊ</span><h1>Painel da noite<span className="title-spark">✦</span></h1><p>Pedidos, palco e próxima música em um só lugar.</p></div><span className={`session-pill ${room.open ? 'session-open' : ''}`}>{room.open ? '● Noite aberta' : '○ Noite fechada'}</span></div>
      {!room.nightId ? <section className="card setup-card"><div><span className="section-kicker">COMEÇAR</span><h2>Abra a noite para receber pedidos</h2><p>Você decide durante cada chamada se a pessoa ganha outra chance.</p></div><div className="setup-actions"><button className="button button-primary" disabled={busy} onClick={() => doAction(openNight, 'Noite aberta. Os QR codes já podem ser usados.')}>Abrir nova noite ↗</button></div></section> : <>
        {!room.open && <div className="closed-notice" role="status">Pedidos encerrados. A fila atual continua em andamento. <button className="mini-button" disabled={busy} onClick={() => doAction(reopenNight, 'Pedidos reabertos.')}>Reabrir pedidos</button></div>}
        <section className="operator-stats" aria-label="Resumo da noite"><div><span>NA FILA</span><strong>{room.queue.length}</strong></div><div><span>PEDIDOS PENDENTES</span><strong>{pending.length}</strong></div><div><span>APRESENTAÇÕES</span><strong>{room.completedCount}</strong></div><div><span>CHAMADAS PERDIDAS</span><strong>{missedCalls}</strong></div></section>
        <section className="operator-grid"><div className="operator-primary">
          <section className="stage-card"><div className="stage-heading"><span className="section-kicker">CONTROLE DO PALCO</span><span className="stage-state">{room.stage === 'calling' ? 'CHAMANDO' : room.stage === 'singing' ? 'CANTANDO' : 'PRONTO'}</span></div>
            {current ? <><h2>{current.name} {current.table && <small>· Mesa {current.table}</small>}</h2><p>{current.song} — {current.artist}</p>{current.onMyWay && <span className="presence-badge">✓ Presença confirmada</span>}
              {room.stage === 'calling' && <p className="countdown-label">{current.onMyWay ? 'Você já pode iniciar a música.' : `Chamada no telão: ${countdown > 0 ? `${countdown}s` : 'tempo encerrado; aguarde sua decisão'}`}</p>}
              {room.stage === 'calling' && tvMode === 'video' && !youtubeVideoId(current.selectedUrl || current.suggestedUrl) && <p className="stage-video-note">Cole o link da versão escolhida do YouTube ou YouTube Music na fila aprovada para tocar no telão.</p>}
            </> : <><h2>{room.queue[nextIndex]?.name ?? 'Palco livre'}</h2><p>{room.queue[nextIndex] ? `${room.queue[nextIndex].song}${room.queue[nextIndex].table ? ` · Mesa ${room.queue[nextIndex].table}` : ''}` : 'Aguardando o próximo cantor.'}</p></>}
            <div className="stage-actions">{room.stage === 'idle' ? <button className="button button-light" disabled={busy || nextIndex < 0} onClick={() => doAction(callNextSinger)}>Chamar próximo <span aria-hidden="true">↗</span></button> : room.stage === 'calling' ? <>{!current?.onMyWay && <button className="button button-stage-outline" disabled={busy || !current} onClick={() => { const id = room.queue[0]?.id; if (id) void doAction(() => confirmSingerPresence(id)) }}>Confirmar presença</button>}<button className="button button-light" disabled={busy || (countdown > 0 && !current?.onMyWay) || (tvMode === 'video' && !youtubeVideoId(current?.selectedUrl || current?.suggestedUrl || ''))} onClick={() => doAction(startSong, tvMode === 'video' ? 'Vídeo enviado ao telão.' : 'Apresentação iniciada no modo clássico.')}>{tvMode === 'video' ? 'Tocar no telão' : 'Música iniciada'}</button><button className="button button-stage-outline" disabled={busy || countdown > 0} onClick={() => doAction(markAbsent, 'Pedido devolvido para depois do próximo cantor.')}>Dar outra chance</button><button className="button button-stage-outline" disabled={busy || countdown > 0} onClick={cancelCurrentRequest}>Cancelar pedido</button></> : <button className="button button-light" disabled={busy} onClick={() => doAction(completeSong)}>Concluir música</button>}
              {current && <a className="button button-stage-outline" target="_blank" rel="noreferrer" href={current.selectedUrl || current.suggestedUrl || karaokeSearch(searchProvider, current.song, current.artist)}>Abrir versão ↗</a>}</div>
          </section>

          <section className="card operator-section"><div className="section-heading-row"><div><span className="section-kicker">ROTAÇÃO JUSTA</span><h2>Fila aprovada</h2></div><span className="section-count">{room.queue.length} {room.queue.length === 1 ? 'pessoa' : 'pessoas'}</span></div>
            {room.queue.length ? <ol className="operator-queue">{room.queue.map((entry, index) => <QueueCard key={entry.id} entry={entry} index={index} length={room.queue.length} lockedFirst={room.stage !== 'idle'} request={byId.get(entry.id)} searchProvider={searchProvider} busy={busy} onAction={doAction} />)}</ol> : <p className="empty-copy">Ainda não há pedidos aprovados.</p>}
          </section>
        </div><aside className="operator-side">
          <section className="card operator-section"><div className="section-heading-row"><div><span className="section-kicker">CHEGANDO AGORA</span><h2>Novos pedidos</h2></div><span className="section-count">{pending.length}</span></div>
            {pending.length ? <div className="pending-list">{pending.map((request) => <PendingCard key={request.id} request={request} searchProvider={searchProvider} busy={busy} onAction={doAction} />)}</div> : <p className="empty-copy">Nenhum pedido aguardando aprovação.</p>}
          </section>
          <YouTubeWorkbench requests={activeRequests} onUseVideo={(request, url) => doAction(
            () => request.status === 'pending' ? approveRequest(request.id, url) : saveSelectedUrl(request.id, url),
            request.status === 'pending' ? 'Vídeo aprovado e adicionado à fila do sistema.' : 'Vídeo escolhido para a fila do sistema.',
          )} />
          <section className="card settings-card">
            <span className="section-kicker">AJUSTES DA NOITE</span><h2>Operação</h2>
            <p className="helper">Em cada chamada, escolha se o cantor volta para a fila ou se o pedido é cancelado.</p>
            <label className="search-provider-label">Buscar karaokê em
              <select value={searchProvider} onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}>
                <option value="youtube">YouTube</option>
                <option value="youtube_music">YouTube Music</option>
                <option value="spotify">Spotify</option>
              </select>
            </label>
            <p className="helper">A busca abre na sua conta em outra aba. Para tocar vídeo no telão, salve o link direto do YouTube ou YouTube Music. O Spotify serve para busca e uso com o painel clássico.</p>
            {room.open ? <button className="text-button" disabled={busy} onClick={() => closeDialogRef.current?.showModal()}>Encerrar novos pedidos</button> : <button className="text-button" onClick={() => { if (window.confirm('Começar uma nova noite? A fila atual será arquivada e deixará de aparecer.')) doAction(openNight, 'Nova noite aberta.') }}>Começar nova noite</button>}
            <div className="tv-mode-settings"><span className="section-kicker">TELÃO</span><h3>Como mostrar a apresentação</h3>
              <div className="tv-mode-options" role="group" aria-label="Modo do telão">
                <button type="button" className={`tv-mode-option ${tvMode === 'video' ? 'is-selected' : ''}`} aria-pressed={tvMode === 'video'} disabled={busy || tvMode === 'video'} onClick={() => doAction(() => changeTvMode('video'), 'Telão em modo vídeo e fila.')}>Vídeo + fila</button>
                <button type="button" className={`tv-mode-option ${tvMode === 'classic' ? 'is-selected' : ''}`} aria-pressed={tvMode === 'classic'} disabled={busy || tvMode === 'classic'} onClick={() => doAction(() => changeTvMode('classic'), 'Telão em modo clássico.')}>Painel clássico</button>
              </div>
              <p className="helper">A mudança aparece no telão aberto. No modo clássico, você pode abrir o YouTube separadamente. Trocar durante uma música interrompe o vídeo; ao voltar, ele recomeça.</p>
            </div>
          </section>
          <section className="card qr-card"><span className="section-kicker">QR ÚNICO</span><h2>Um código para todos</h2><p>Todos acessam o mesmo formulário. A mesa continua opcional para quem fizer o pedido.</p><div className="qr-preview"><QRCodeSVG value={guestUrl} size={152} marginSize={1} /><span>Peça sua música<br /><small>{new URL(guestUrl).host}</small></span></div><button className="button button-outline" onClick={() => window.open('/imprimir', '_blank')}>Imprimir QR único ↗</button><details className="table-qr-details"><summary>QR por mesa (para usar depois)</summary><p>Cartelas com o número da mesa preenchido automaticamente.</p><label>Número de mesas<input type="number" min={1} max={80} value={tableCount} onChange={(event) => setTableCount(Math.min(80, Math.max(1, Number(event.target.value) || 1)))} /></label><button className="button button-outline" onClick={() => window.open(`/imprimir?mesas=${tableCount}`, '_blank')}>Abrir cartelas por mesa ↗</button></details></section>
        </aside></section>
      </>}
      {notice && <p className="feedback operator-feedback" role="status">{notice}</p>}
    </main>
    <dialog ref={closeDialogRef} className="confirm-dialog" aria-labelledby="close-dialog-title" aria-describedby="close-dialog-description"><span className="section-kicker">CONFIRMAR ALTERAÇÃO</span><h2 id="close-dialog-title">Encerrar novos pedidos?</h2><p id="close-dialog-description">Ninguém poderá enviar pedidos novos. Você ainda poderá aprovar os pedidos pendentes, concluir a fila atual e reabrir os pedidos depois.</p><div className="dialog-actions"><button className="button button-outline" autoFocus onClick={() => closeDialogRef.current?.close()}>Continuar recebendo</button><button className="button button-primary" disabled={busy} onClick={() => { closeDialogRef.current?.close(); void doAction(closeNight, 'Pedidos encerrados. A fila atual continua visível.') }}>Encerrar pedidos</button></div></dialog>
  </div>
}

function QueueCard({ entry, index, length, lockedFirst, request, searchProvider, busy, onAction }: {
  entry: QueueEntry; index: number; length: number; lockedFirst: boolean; request?: SongRequest;
  searchProvider: SearchProvider; busy: boolean; onAction: RunAction,
}) {
  const [linkEdit, setLinkEdit] = useState<string | null>(null)
  const link = linkEdit ?? (request?.selectedUrl || request?.suggestedUrl || '')
  const search = karaokeSearch(searchProvider, entry.song, entry.artist)
  const firstMovable = lockedFirst ? 1 : 0
  return <li className="queue-card"><span className="queue-number">{String(index + 1).padStart(2, '0')}</span><div className="operator-queue-body"><strong>{entry.name} {entry.table && <span>· Mesa {entry.table}</span>}</strong><p>{entry.song} — {entry.artist}</p>
    <div className="operator-meta">{entry.misses > 0 && <span>{entry.misses} {entry.misses === 1 ? 'chamada perdida' : 'chamadas perdidas'}</span>}{request?.onMyWay && <span>✓ Presença confirmada</span>}<a href={request?.selectedUrl || request?.suggestedUrl || search} target="_blank" rel="noreferrer">{request?.selectedUrl || request?.suggestedUrl ? 'Abrir versão' : `Buscar no ${searchProviderLabels[searchProvider]}`} ↗</a></div>
    <div className="video-edit"><input type="url" aria-label={`Link escolhido para ${entry.song}`} value={link} onChange={(event) => setLinkEdit(event.target.value)} placeholder="Link da versão escolhida" /><button className="mini-button" disabled={busy || link === (request?.selectedUrl || request?.suggestedUrl || '')} onClick={() => { const clean = youtubeUrl(link); if (clean === null || (clean && !youtubeVideoId(clean))) { window.alert('Cole um link direto de vídeo do YouTube ou YouTube Music.'); return }; onAction(() => saveSelectedUrl(entry.id, clean), 'Vídeo escolhido salvo.') }}>Salvar</button></div>
  </div><div className="queue-actions"><button className="icon-button" aria-label={`Subir ${entry.name} na fila`} title="Subir" disabled={busy || index <= firstMovable} onClick={() => onAction(() => moveQueueEntry(entry.id, -1))}>↑</button><button className="icon-button" aria-label={`Descer ${entry.name} na fila`} title="Descer" disabled={busy || index === length - 1 || (lockedFirst && index === 0)} onClick={() => onAction(() => moveQueueEntry(entry.id, 1))}>↓</button><button className="icon-button" aria-label={`Cancelar pedido de ${entry.name}`} title="Cancelar pedido" disabled={busy} onClick={() => { if (window.confirm(`Cancelar o pedido de ${entry.name}?`)) onAction(() => cancelRequest(entry.id)) }}>×</button></div></li>
}

function PendingCard({ request, searchProvider, busy, onAction }: { request: SongRequest; searchProvider: SearchProvider; busy: boolean; onAction: RunAction }) {
  const [link, setLink] = useState(request.suggestedUrl)
  return <article className="pending-card"><div className="pending-top"><strong>{request.name}</strong>{request.table && <span>Mesa {request.table}</span>}</div><h3>{request.song}</h3><p>{request.artist}</p>
    <div className="pending-links"><a href={karaokeSearch(searchProvider, request.song, request.artist)} target="_blank" rel="noreferrer">Buscar no {searchProviderLabels[searchProvider]} ↗</a>{request.suggestedUrl && <a href={request.suggestedUrl} target="_blank" rel="noreferrer">Link sugerido ↗</a>}</div>
    <label className="compact-label">Vídeo escolhido <span className="optional">opcional</span><input type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Cole aqui a versão escolhida" /></label>
    <div className="pending-actions"><button className="button button-primary" disabled={busy} onClick={() => {
      const clean = youtubeUrl(link)
      if (clean === null || (clean && !youtubeVideoId(clean))) { window.alert('Cole um link direto de vídeo do YouTube ou YouTube Music, ou deixe vazio.'); return }
      onAction(() => approveRequest(request.id, clean), 'Pedido aprovado e incluído na fila.')
    }}>Aprovar</button><button className="button button-outline" disabled={busy} onClick={() => onAction(() => rejectRequest(request.id))}>Recusar</button></div>
  </article>
}
