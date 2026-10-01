import { useEffect, useState, type FormEvent } from 'react'
import { guestUid, submitRequest, watchOwnRequest } from '../backend'
import { publicPosition, terminalStatuses, youtubeUrl, type SongRequest } from '../domain'
import { Brand, DemoBanner } from './Brand'
import { useRoom } from './hooks'
import { venueName } from './venue'

export function GuestPage() {
  const room = useRoom()
  const routeTable = decodeURIComponent(window.location.pathname.match(/^\/mesa\/([^/]+)/)?.[1] ?? '')
  const [uid, setUid] = useState('')
  const [own, setOwn] = useState<SongRequest | null>(null)
  const [form, setForm] = useState({ name: '', table: routeTable, song: '', artist: '', suggestedUrl: '' })
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { guestUid().then(setUid).catch(() => setMessage('Não foi possível conectar. Atualize a página.')) }, [])
  useEffect(() => watchOwnRequest(room.nightId, uid, setOwn), [room.nightId, uid])
  useEffect(() => {
    document.title = own?.status === 'calling' ? `Sua vez de cantar! · ${venueName}` : venueName
  }, [own?.status])

  const position = own ? publicPosition(room, own.id) : 0
  const active = Boolean(own && !terminalStatuses.includes(own.status))
  const canRequest = room.open && uid && (!own || showForm)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const clean = {
      name: form.name.trim(), table: form.table.trim(), song: form.song.trim(),
      artist: form.artist.trim(), suggestedUrl: form.suggestedUrl.trim(),
    }
    if (!clean.name || !clean.song || !clean.artist) { setMessage('Preencha os campos obrigatórios.'); return }
    const link = youtubeUrl(clean.suggestedUrl)
    if (link === null) { setMessage('Cole um link válido do YouTube ou deixe o campo vazio.'); return }
    setBusy(true)
    try {
      await submitRequest(room, uid, { ...clean, suggestedUrl: link })
      setForm({ ...form, song: '', artist: '', suggestedUrl: '' })
      setShowForm(false)
      setMessage('Pedido enviado! O operador vai conferir a música.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.') }
    finally { setBusy(false) }
  }

  return <div className="site-shell guest-shell">
    <DemoBanner />
    <header className="site-header"><Brand /><span className="header-chip">A noite é sua</span></header>
    <main className="guest-main">
      <section className="guest-hero">
        <div className="eyebrow"><span className="star">✦</span> FAÇA PARTE DO SHOW</div>
        <h1>Sua voz.<br /><em>Seu momento.</em></h1>
        <p>Peça sua música de onde estiver e acompanhe sua vez por aqui.</p>
        <div className="hero-disc" aria-hidden="true"><div className="disc-center">♫</div></div>
      </section>

      {!room.open && <section className="card prominent-card" role="status">
        <span className="section-kicker">Por enquanto</span><h2>Novos pedidos estão fechados</h2>
        <p>Acompanhe a fila por aqui. O operador avisará quando os pedidos forem reabertos.</p>
      </section>}

      {active && own && !showForm && <section className={`card request-status status-${own.status}`} aria-live="polite">
        <div className="status-top"><span className="section-kicker">Seu pedido</span><span className="pill">{own.status === 'pending' ? 'Em análise' : own.status === 'calling' ? 'Sua vez!' : own.status === 'singing' ? 'No palco' : 'Na fila'}</span></div>
        <h2>{own.song}</h2><p className="muted">{own.artist} · {own.name}{own.table && ` · Mesa ${own.table}`}</p>
        {own.status === 'pending' && <p>O operador está conferindo a versão da música.</p>}
        {own.status === 'queued' && <div className={`position-callout ${position > 0 && position <= 3 ? 'position-near' : ''}`}><strong>{position > 0 ? `${position}º` : '…'}</strong><span>{position === 0 ? 'Atualizando sua posição na fila.' : position === 1 ? 'Você é o próximo. Fique perto do palco!' : position === 2 ? 'Prepare-se: falta uma apresentação.' : `Faltam ${position - 1} apresentações antes da sua.`}</span></div>}
        {own.status === 'calling' && <div className="turn-callout"><span className="pulse-dot" aria-hidden="true" />Sua vez! Dirija-se ao palco. O operador pode iniciar a música.</div>}
        {own.status === 'singing' && <p>É seu momento. Divirta-se!</p>}
        {own.misses > 0 && <p className="absence-note">Chamadas perdidas: {own.misses}</p>}
      </section>}

      {own && terminalStatuses.includes(own.status) && !showForm && <section className="card request-status" aria-live="polite">
        <span className="section-kicker">Pedido encerrado</span>
        <h2>{own.status === 'completed' ? 'Valeu pelo show!' : own.status === 'removed' ? 'Você perdeu sua vez' : own.status === 'rejected' ? 'Música indisponível' : 'Pedido cancelado'}</h2>
        <p>{own.status === 'removed' ? 'Você pode fazer um novo pedido para entrar na fila novamente.' : 'Quer cantar outra? Envie uma nova música.'}</p>
        {room.open && <button className="button button-primary" onClick={() => setShowForm(true)}>Pedir outra música <span aria-hidden="true">↗</span></button>}
      </section>}

      {canRequest && <section className="card form-card" id="pedido">
        <div className="card-heading"><span className="section-kicker">Inscrição aberta</span><h2>Escolha sua música</h2><p>O operador escolhe a versão antes de colocar na fila.</p></div>
        <form onSubmit={handleSubmit}>
          <div className="form-row"><label>Seu nome <span aria-hidden="true">*</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={40} autoComplete="name" required placeholder="Como quer ser chamado?" /></label>
            <label>Mesa <span className="optional">opcional</span><input value={form.table} onChange={(event) => setForm({ ...form, table: event.target.value })} maxLength={10} placeholder="Ex.: 04" /></label></div>
          <label>Música <span aria-hidden="true">*</span><input value={form.song} onChange={(event) => setForm({ ...form, song: event.target.value })} maxLength={100} required placeholder="Nome da música" /></label>
          <label>Artista <span aria-hidden="true">*</span><input value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} maxLength={100} required placeholder="Quem canta?" /></label>
          <label>Link do YouTube ou YouTube Music <span className="optional">opcional</span><input type="url" value={form.suggestedUrl} onChange={(event) => setForm({ ...form, suggestedUrl: event.target.value })} placeholder="https://youtu.be/..." /></label>
          <button className="button button-primary submit-button" disabled={busy || !uid} type="submit">{busy ? 'Enviando...' : 'Entrar na fila'} <span aria-hidden="true">↗</span></button>
        </form>
      </section>}
      {message && <p className="feedback" role="status">{message}</p>}

      <section className="queue-preview"><div className="section-heading"><span className="section-kicker">AO VIVO</span><h2>Fila da noite</h2></div>
        {room.queue.length ? <ol className="guest-queue">{room.queue.slice(0, 6).map((entry, index) => <li key={entry.id}><span className="queue-number">{String(index + 1).padStart(2, '0')}</span><span className="queue-person"><strong>{entry.name}</strong><small>{entry.song} · {entry.artist}</small></span>{entry.table && <span className="table-chip">MESA {entry.table}</span>}</li>)}</ol> : <p className="empty-copy">A fila ainda está vazia. Que tal abrir o show?</p>}
      </section>
    </main>
    <footer className="site-footer"><span>Feito para deixar a noite fluir.</span></footer>
  </div>
}
