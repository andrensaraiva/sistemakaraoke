import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  approveRequest, callNextSinger, cancelRequest, closeNight, completeSong,
  demoMode, markAbsent, moveQueueEntry, openNight, rejectRequest, reopenNight, saveSelectedUrl,
  signInAdmin, signOutAdmin, startSong, watchAdmin,
} from '../backend'
import { nextEligibleIndex, youtubeSearch, youtubeUrl, type QueueEntry, type SongRequest } from '../domain'
import { Brand, DemoBanner } from './Brand'
import { useCountdown, useRequests, useRoom } from './hooks'
import { venueName } from './venue'

type RunAction = (action: () => Promise<void>, success?: string) => Promise<void>

export function OperatorPage() {
  const room = useRoom()
  const [admin, setAdmin] = useState({ ready: demoMode, allowed: demoMode, email: demoMode ? 'Modo de demonstração' : '' })
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tableCount, setTableCount] = useState(12)
  useEffect(() => watchAdmin(setAdmin), [])
  const requests = useRequests(room.nightId, admin.allowed)
  const pending = requests.filter((request) => request.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)
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

  return <div className="operator-shell"><DemoBanner />
    <header className="operator-header"><Brand small /><nav aria-label="Acesso rápido"><a href="/" target="_blank" rel="noreferrer">Visão do cliente ↗</a><a href="/telao" target="_blank" rel="noreferrer">Abrir telão ↗</a>{!demoMode && <button onClick={() => doAction(signOutAdmin)}>Sair</button>}</nav></header>
    <main className="operator-main"><div className="operator-title"><div><span className="section-kicker">CENTRAL DO KARAOKÊ</span><h1>Painel da noite<span className="title-spark">✦</span></h1><p>Pedidos, palco e próxima música em um só lugar.</p></div><span className={`session-pill ${room.open ? 'session-open' : ''}`}>{room.open ? '● Noite aberta' : '○ Noite fechada'}</span></div>
      {!room.nightId ? <section className="card setup-card"><div><span className="section-kicker">COMEÇAR</span><h2>Abra a noite para receber pedidos</h2><p>Você decide durante cada chamada se a pessoa ganha outra chance.</p></div><div className="setup-actions"><button className="button button-primary" disabled={busy} onClick={() => doAction(openNight, 'Noite aberta. Os QR codes já podem ser usados.')}>Abrir nova noite ↗</button></div></section> : <>
        {!room.open && <div className="closed-notice" role="status">Pedidos encerrados. A fila atual continua em andamento. <button className="mini-button" disabled={busy} onClick={() => doAction(reopenNight, 'Pedidos reabertos.')}>Reabrir pedidos</button></div>}
        <section className="operator-stats" aria-label="Resumo da noite"><div><span>NA FILA</span><strong>{room.queue.length}</strong></div><div><span>PEDIDOS PENDENTES</span><strong>{pending.length}</strong></div><div><span>APRESENTAÇÕES</span><strong>{room.completedCount}</strong></div><div><span>CHAMADAS PERDIDAS</span><strong>{missedCalls}</strong></div></section>
        <section className="operator-grid"><div className="operator-primary">
          <section className="stage-card"><div className="stage-heading"><span className="section-kicker">CONTROLE DO PALCO</span><span className="stage-state">{room.stage === 'calling' ? 'CHAMANDO' : room.stage === 'singing' ? 'CANTANDO' : 'PRONTO'}</span></div>
            {current ? <><h2>{current.name} {current.table && <small>· Mesa {current.table}</small>}</h2><p>{current.song} — {current.artist}</p>{current.onMyWay && <span className="onway-badge">✓ Está a caminho</span>}
              {room.stage === 'calling' && <p className="countdown-label">Chamada no telão: {countdown > 0 ? `${countdown}s` : 'tempo encerrado; aguarde sua decisão'}</p>}
            </> : <><h2>{room.queue[nextIndex]?.name ?? 'Palco livre'}</h2><p>{room.queue[nextIndex] ? `${room.queue[nextIndex].song}${room.queue[nextIndex].table ? ` · Mesa ${room.queue[nextIndex].table}` : ''}` : 'Aguardando o próximo cantor.'}</p></>}
            <div className="stage-actions">{room.stage === 'idle' ? <button className="button button-light" disabled={busy || nextIndex < 0} onClick={() => doAction(callNextSinger)}>Chamar próximo <span aria-hidden="true">↗</span></button> : room.stage === 'calling' ? <><button className="button button-light" disabled={busy || countdown > 0} onClick={() => doAction(startSong, 'Apresentação iniciada. Dê play no vídeo escolhido.')}>Música iniciada</button><button className="button button-stage-outline" disabled={busy || countdown > 0} onClick={() => doAction(markAbsent, 'Pedido devolvido para depois do próximo cantor.')}>Dar outra chance</button><button className="button button-stage-outline" disabled={busy || countdown > 0} onClick={cancelCurrentRequest}>Cancelar pedido</button></> : <button className="button button-light" disabled={busy} onClick={() => doAction(completeSong)}>Concluir música</button>}
              {current && <a className="button button-stage-outline" target="_blank" rel="noreferrer" href={current.selectedUrl || current.suggestedUrl || youtubeSearch(current.song, current.artist)}>Abrir YouTube ↗</a>}</div>
          </section>

          <section className="card operator-section"><div className="section-heading-row"><div><span className="section-kicker">ROTAÇÃO JUSTA</span><h2>Fila aprovada</h2></div><span className="section-count">{room.queue.length} {room.queue.length === 1 ? 'pessoa' : 'pessoas'}</span></div>
            {room.queue.length ? <ol className="operator-queue">{room.queue.map((entry, index) => <QueueCard key={entry.id} entry={entry} index={index} length={room.queue.length} lockedFirst={room.stage !== 'idle'} request={byId.get(entry.id)} busy={busy} onAction={doAction} />)}</ol> : <p className="empty-copy">Ainda não há pedidos aprovados.</p>}
          </section>
        </div><aside className="operator-side">
          <section className="card operator-section"><div className="section-heading-row"><div><span className="section-kicker">CHEGANDO AGORA</span><h2>Novos pedidos</h2></div><span className="section-count">{pending.length}</span></div>
            {pending.length ? <div className="pending-list">{pending.map((request) => <PendingCard key={request.id} request={request} busy={busy} onAction={doAction} />)}</div> : <p className="empty-copy">Nenhum pedido aguardando aprovação.</p>}
          </section>
          <section className="card settings-card"><span className="section-kicker">AJUSTES DA NOITE</span><h2>Operação</h2><p className="helper">Em cada chamada, escolha se o cantor volta para a fila ou se o pedido é cancelado.</p>{room.open ? <button className="text-button" onClick={() => { if (window.confirm('Encerrar os pedidos desta noite? A fila atual continuará visível.')) doAction(closeNight) }}>Encerrar novos pedidos</button> : <button className="text-button" onClick={() => { if (window.confirm('Começar uma nova noite? A fila atual será arquivada e deixará de aparecer.')) doAction(openNight, 'Nova noite aberta.') }}>Começar nova noite</button>}</section>
          <section className="card qr-card"><span className="section-kicker">QR DAS MESAS</span><h2>Pronto para imprimir</h2><p>O QR abre o formulário com o número da mesa preenchido.</p><label>Número de mesas<input type="number" min={1} max={80} value={tableCount} onChange={(event) => setTableCount(Math.min(80, Math.max(1, Number(event.target.value) || 1)))} /></label><div className="qr-preview"><QRCodeSVG value={`${window.location.origin}/mesa/01`} size={112} marginSize={1} /><span>Mesa 01<br /><small>{venueName}</small></span></div><button className="button button-outline" onClick={() => window.open(`/imprimir?mesas=${tableCount}`, '_blank')}>Abrir cartelas para impressão ↗</button></section>
        </aside></section>
      </>}
      {notice && <p className="feedback operator-feedback" role="status">{notice}</p>}
    </main>
  </div>
}

function QueueCard({ entry, index, length, lockedFirst, request, busy, onAction }: {
  entry: QueueEntry; index: number; length: number; lockedFirst: boolean; request?: SongRequest;
  busy: boolean; onAction: RunAction,
}) {
  const [linkEdit, setLinkEdit] = useState<string | null>(null)
  const link = linkEdit ?? (request?.selectedUrl || request?.suggestedUrl || '')
  const search = youtubeSearch(entry.song, entry.artist)
  const firstMovable = lockedFirst ? 1 : 0
  return <li className="queue-card"><span className="queue-number">{String(index + 1).padStart(2, '0')}</span><div className="operator-queue-body"><strong>{entry.name} {entry.table && <span>· Mesa {entry.table}</span>}</strong><p>{entry.song} — {entry.artist}</p>
    <div className="operator-meta">{entry.misses > 0 && <span>{entry.misses} {entry.misses === 1 ? 'chamada perdida' : 'chamadas perdidas'}</span>}{request?.onMyWay && <span>✓ A caminho</span>}<a href={request?.selectedUrl || request?.suggestedUrl || search} target="_blank" rel="noreferrer">Abrir vídeo ↗</a></div>
    <div className="video-edit"><input type="url" aria-label={`Link escolhido para ${entry.song}`} value={link} onChange={(event) => setLinkEdit(event.target.value)} placeholder="Link da versão escolhida" /><button className="mini-button" disabled={busy || link === (request?.selectedUrl || request?.suggestedUrl || '')} onClick={() => { const clean = youtubeUrl(link); if (clean === null) { window.alert('Use um link válido do YouTube.'); return }; onAction(() => saveSelectedUrl(entry.id, clean), 'Vídeo escolhido salvo.') }}>Salvar</button></div>
  </div><div className="queue-actions"><button className="icon-button" aria-label={`Subir ${entry.name} na fila`} title="Subir" disabled={busy || index <= firstMovable} onClick={() => onAction(() => moveQueueEntry(entry.id, -1))}>↑</button><button className="icon-button" aria-label={`Descer ${entry.name} na fila`} title="Descer" disabled={busy || index === length - 1 || (lockedFirst && index === 0)} onClick={() => onAction(() => moveQueueEntry(entry.id, 1))}>↓</button><button className="icon-button" aria-label={`Cancelar pedido de ${entry.name}`} title="Cancelar pedido" disabled={busy} onClick={() => { if (window.confirm(`Cancelar o pedido de ${entry.name}?`)) onAction(() => cancelRequest(entry.id)) }}>×</button></div></li>
}

function PendingCard({ request, busy, onAction }: { request: SongRequest; busy: boolean; onAction: RunAction }) {
  const [link, setLink] = useState(request.suggestedUrl)
  return <article className="pending-card"><div className="pending-top"><strong>{request.name}</strong>{request.table && <span>Mesa {request.table}</span>}</div><h3>{request.song}</h3><p>{request.artist}</p>
    <div className="pending-links"><a href={youtubeSearch(request.song, request.artist)} target="_blank" rel="noreferrer">Buscar no YouTube ↗</a>{request.suggestedUrl && <a href={request.suggestedUrl} target="_blank" rel="noreferrer">Link sugerido ↗</a>}</div>
    <label className="compact-label">Vídeo escolhido <span className="optional">opcional</span><input type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Cole aqui a versão escolhida" /></label>
    <div className="pending-actions"><button className="button button-primary" disabled={busy} onClick={() => {
      const clean = youtubeUrl(link)
      if (clean === null) { window.alert('Use um link válido do YouTube ou deixe vazio.'); return }
      onAction(() => approveRequest(request.id, clean), 'Pedido aprovado e incluído na fila.')
    }}>Aprovar</button><button className="button button-outline" disabled={busy} onClick={() => onAction(() => rejectRequest(request.id))}>Recusar</button></div>
  </article>
}
