import { QRCodeSVG } from 'qrcode.react'
import { youtubeVideoId } from '../domain'
import { Brand, DemoBanner } from './Brand'
import { useCountdown, useRoom } from './hooks'
import { TvPlayer } from './TvPlayer'
import { venueName } from './venue'

export function TvPage() {
  const room = useRoom()
  const current = room.stage !== 'idle' ? room.queue[0] : null
  const countdown = useCountdown(room.stage === 'calling' ? room.calledAt : null)
  const upcoming = room.stage === 'idle' ? room.queue : room.queue.slice(1)
  const videoId = room.stage === 'singing' ? youtubeVideoId(room.playbackUrl ?? '') : null
  const showVideo = (room.tvMode ?? 'video') === 'video' && Boolean(videoId)
  const featureKicker = room.stage === 'singing'
    ? (room.tvMode ?? 'video') === 'classic' ? 'NO PALCO AGORA' : 'AGUARDANDO VÍDEO'
    : 'A NOITE É NOSSA'
  const guestUrl = `${window.location.origin}/`

  return <div className="tv-shell">
    <div className="tv-top"><Brand /><span className="live-indicator"><span /> AO VIVO</span></div>
    {room.stage === 'calling' && current ? <main className="tv-call" aria-live="assertive">
      <span className="tv-kicker">ATENÇÃO, PALCO!</span>
      <h1>{current.name}</h1>{current.table && <div className="tv-table">MESA {current.table}</div>}
      <p>Chegou a sua vez de brilhar.</p><div className="tv-countdown">{countdown > 0 ? countdown : 'Aguardando operador'}</div>
    </main> : <main className="tv-grid">
      <section className={`tv-feature ${showVideo ? 'tv-feature-video' : ''}`}>
        {showVideo ? <><TvPlayer key={`${current?.id}:${room.playbackUrl}`} videoId={videoId!} url={room.playbackUrl!} />
          <div className="tv-video-caption"><span>NO PALCO AGORA</span><strong>{current?.name}</strong><small>{current?.song} · {current?.artist}</small></div></>
          : <div className="tv-feature-inner"><span className="tv-kicker">{featureKicker}</span>
            <h1>{current ? current.name : 'Quem será o próximo?'}</h1>
            {current ? <><p className="tv-song">{current.song}</p><p className="tv-artist">{current.artist}{current.table && ` · Mesa ${current.table}`}</p></> : <p className="tv-song">O palco espera por você.</p>}
            <span className="tv-decor" aria-hidden="true">✦</span></div>}
      </section>
      <section className="tv-list-panel"><span className="tv-kicker">PRÓXIMAS VOZES</span>
        {upcoming.length ? <ol>{upcoming.slice(0, 5).map((entry, index) => <li key={entry.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{entry.name}</strong><small>{entry.song}</small></div>{entry.table && <b>M{entry.table}</b>}</li>)}</ol> : <p className="tv-empty">{room.stage === 'singing' ? 'Última apresentação da fila.' : room.open ? 'A fila está aberta para novos pedidos.' : 'Aguardando nova noite.'}</p>}
        <div className="tv-qr"><div className="qr-paper"><QRCodeSVG value={guestUrl} size={112} marginSize={1} /></div><div><strong>Quer cantar também?</strong><span>Escaneie e peça sua música.</span></div></div>
      </section>
    </main>}
    <div className="tv-bottom"><span>{room.open ? 'INSCRIÇÕES ABERTAS' : 'INSCRIÇÕES ENCERRADAS'}</span><span>{venueName} · A sua vez de brilhar</span></div>
    <DemoBanner />
  </div>
}
