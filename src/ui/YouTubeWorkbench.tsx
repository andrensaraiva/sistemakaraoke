import { useEffect, useRef, useState, type FormEvent } from 'react'
import { demoMode } from '../backend'
import { youtubeVideoId, type SongRequest } from '../domain'
import { loadGoogleOAuth, type GoogleTokenClient } from '../googleOAuth'
import { addVideoToPlaylist, getPlaylistTitle, playlistIdFromInput, searchYouTube, type YouTubeVideo } from '../youtube'
import { venueId } from '../venueContext'

const scope = 'https://www.googleapis.com/auth/youtube.force-ssl'
const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || ''
const simulated = demoMode && !clientId
const demoVideo: YouTubeVideo = { id: 'M7lc1UVf-VE', title: 'Vídeo de teste do YouTube (não é karaokê)', channel: 'Demonstração', thumbnail: '' }
type WorkbenchView = 'integrated' | 'music'

function storedView(): WorkbenchView {
  try {
    const saved = window.localStorage.getItem(`karaoke-workbench-view-${venueId}`)
    if (saved === 'integrated' || saved === 'music') return saved
  } catch { /* armazenamento indisponível */ }
  return clientId || demoMode ? 'integrated' : 'music'
}

function playlistStorageKey(nightId: string) { return `karaoke-youtube-playlist-${venueId}-${nightId}` }

function storedPlaylistUrl(nightId: string): string {
  try { return window.localStorage.getItem(playlistStorageKey(nightId)) || '' }
  catch { return '' }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação no YouTube.'
}

export function YouTubeWorkbench({ nightId, requests, onUseVideo }: {
  nightId: string
  requests: SongRequest[]
  onUseVideo: (request: SongRequest, url: string) => Promise<void>
}) {
  const clientRef = useRef<GoogleTokenClient | null>(null)
  const expiryTimerRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<WorkbenchView>(storedView)
  const [token, setToken] = useState<string | null>(null)
  const [playlistInput, setPlaylistInput] = useState(() => storedPlaylistUrl(nightId))
  const [playlistId, setPlaylistId] = useState(simulated ? 'demo-playlist' : '')
  const [playlistTitle, setPlaylistTitle] = useState(simulated ? 'Playlist simulada' : '')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeVideo[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedRequest = requests.find((request) => request.id === selectedRequestId)
  const selectedVideoId = youtubeVideoId(selectedRequest?.selectedUrl || selectedRequest?.suggestedUrl || '')
  const connected = simulated || Boolean(token)
  const nativePlaylistId = playlistIdFromInput(playlistInput)
  const playlistField = <label className="workbench-playlist-link">Link da playlist da noite<input type="url" value={playlistInput} onChange={(event) => {
    const value = event.target.value
    setPlaylistInput(value)
    if (!simulated) { setPlaylistId(''); setPlaylistTitle('') }
    try { window.localStorage.setItem(playlistStorageKey(nightId), value.trim()) } catch { /* armazenamento indisponível */ }
  }} placeholder="https://music.youtube.com/playlist?list=..." /></label>

  function chooseView(next: WorkbenchView) {
    setView(next)
    try { window.localStorage.setItem(`karaoke-workbench-view-${venueId}`, next) } catch { /* armazenamento indisponível */ }
  }

  useEffect(() => {
    if (!clientId) return
    let mounted = true
    void loadGoogleOAuth().then((googleOAuth) => {
      if (!mounted) return
      clientRef.current = googleOAuth.initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => {
          if (!mounted) return
          if (!response.access_token || !googleOAuth.hasGrantedAllScopes(response, scope)) {
            setMessage('A conta Google não autorizou o acesso às playlists do YouTube.')
            return
          }
          if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current)
          setToken(response.access_token)
          expiryTimerRef.current = window.setTimeout(() => setToken(null), Math.max(1000, Number(response.expires_in || 3600) * 1000 - 60_000))
          setPlaylistId('')
          setPlaylistTitle('')
          setAddedIds(new Set())
          setMessage('Conta Google conectada. Escolha a playlist da noite.')
        },
        error_callback: () => { if (mounted) setMessage('A janela de conexão do Google não abriu ou foi fechada.') },
      })
      setReady(true)
    }).catch((error: unknown) => { if (mounted) setMessage(errorMessage(error)) })
    return () => {
      mounted = false; clientRef.current = null
      if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current)
    }
  }, [])

  function activeToken(): string {
    if (!token) throw new Error('A conexão com Google expirou. Clique em Conectar conta novamente.')
    return token
  }

  async function verifyPlaylist() {
    setBusy(true); setMessage('')
    try {
      const id = playlistIdFromInput(playlistInput)
      if (!id) throw new Error('Cole o link da playlist criada no YouTube Music.')
      const title = await getPlaylistTitle(id, activeToken())
      setPlaylistId(id)
      setPlaylistTitle(title)
      setAddedIds(new Set())
      setMessage(`Playlist selecionada: ${title}`)
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      if (!query.trim()) throw new Error('Digite o nome da música para buscar.')
      const videos = simulated ? [demoVideo] : await searchYouTube(query.trim(), activeToken())
      setResults(videos)
      setMessage(simulated ? 'Busca simulada: use o vídeo de teste abaixo para conhecer o fluxo.' : videos.length ? `${videos.length} versões encontradas no YouTube.` : 'Nenhum vídeo encontrado. Tente outros termos.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function addToPlaylist(videoId: string) {
    setBusy(true); setMessage('')
    try {
      if (!playlistId) throw new Error('Selecione primeiro a playlist da noite.')
      if (simulated) {
        setAddedIds((previous) => new Set(previous).add(videoId))
        setMessage('Adicionado somente à playlist simulada. Nenhuma conta Google foi alterada.')
        return
      }
      const result = await addVideoToPlaylist(playlistId, videoId, activeToken())
      setAddedIds((previous) => new Set(previous).add(videoId))
      setMessage(result === 'added' ? `Vídeo adicionado à playlist ${playlistTitle}.` : `Este vídeo já estava na playlist ${playlistTitle}.`)
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  return <section className="card youtube-workbench" aria-label="Escolha de música do operador">
    <span className="section-kicker">MÚSICA DA NOITE</span><h2>Como buscar a música?</h2>
    <div className="workbench-view-options" role="group" aria-label="Forma de buscar música">
      <button type="button" aria-pressed={view === 'integrated'} className={view === 'integrated' ? 'is-selected' : ''} onClick={() => chooseView('integrated')}>No painel</button>
      <button type="button" aria-pressed={view === 'music'} className={view === 'music' ? 'is-selected' : ''} onClick={() => chooseView('music')}>YouTube Music</button>
    </div>
    {view === 'music' ? <div className="workbench-native">
      <span>Abra o YouTube Music, escolha a versão e cole o link do vídeo na fila.</span>
      <a className="button button-outline" href="https://music.youtube.com/" target="_blank" rel="noopener noreferrer">Abrir YouTube Music ↗</a>
      <details><summary>Minha playlist da noite</summary>{playlistField}
        {nativePlaylistId && <a className="button button-outline" href={`https://music.youtube.com/playlist?list=${nativePlaylistId}`} target="_blank" rel="noopener noreferrer">Abrir minha playlist ↗</a>}
      </details>
    </div> : <>
    {!clientId && !simulated ? <p className="workbench-note">Esta opção ainda precisa ser conectada à conta Google. Por enquanto, use YouTube Music.</p> : <>
      {simulated ? <p className="workbench-note">Demonstração local: a busca retorna um vídeo de teste e a playlist é simulada. Nenhum item será salvo na sua conta Google.</p> : <><div className="workbench-connect">
        <span>{connected ? 'Conta Google conectada nesta sessão' : ready ? 'Conecte a conta que criou a playlist' : 'Carregando conexão com Google...'}</span>
        <button className="button button-outline" type="button" disabled={!ready || busy} onClick={() => clientRef.current?.requestAccessToken()}>{connected ? 'Trocar ou renovar conta' : 'Conectar conta Google'}</button>
      </div>
      <div className="workbench-playlist">
        {playlistField}
        <button className="button button-outline" type="button" disabled={!connected || busy} onClick={() => void verifyPlaylist()}>Selecionar playlist</button>
      </div></>}
      {playlistTitle && <p className="workbench-selected">✓ {playlistTitle}</p>}
      <label>Pedido da fila
        <select value={selectedRequestId} onChange={(event) => {
          const id = event.target.value
          setSelectedRequestId(id)
          const request = requests.find((item) => item.id === id)
          if (request) setQuery(`${request.song} ${request.artist} karaoke com letra`)
        }}>
          <option value="">Escolha uma pessoa</option>
          {requests.map((request) => <option key={request.id} value={request.id}>{request.name} · {request.song}</option>)}
        </select>
      </label>
      {selectedVideoId && <button className="button button-outline workbench-saved-button" type="button" disabled={!connected || !playlistId || busy || addedIds.has(selectedVideoId)} onClick={() => void addToPlaylist(selectedVideoId)}>{addedIds.has(selectedVideoId) ? 'Já está na playlist' : 'Adicionar vídeo escolhido à playlist'}</button>}
      <form className="workbench-search" onSubmit={(event) => void search(event)}>
        <label>Pesquisar vídeos no YouTube<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Música, artista e karaokê" /></label>
        <button className="button button-primary" type="submit" disabled={!connected || busy}>Buscar</button>
      </form>
      {message && <p className="workbench-message" role="status">{message}</p>}
      {results.length > 0 && <ol className="workbench-results">{results.map((video) => <li key={video.id}>
        {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" />}
        <div><strong>{video.title}</strong><small>{video.channel} · YouTube</small>
          <div className="workbench-result-actions">
            <button className="mini-button" type="button" disabled={!selectedRequest || busy} onClick={() => { if (selectedRequest) void onUseVideo(selectedRequest, `https://www.youtube.com/watch?v=${video.id}`) }}>Usar na fila</button>
            <button className="mini-button" type="button" disabled={!playlistId || busy || addedIds.has(video.id)} onClick={() => void addToPlaylist(video.id)}>{addedIds.has(video.id) ? 'Na playlist' : 'Adicionar à playlist'}</button>
          </div>
        </div>
      </li>)}</ol>}
      <p className="helper">{simulated ? 'Para pesquisar vídeos reais e alterar sua playlist, configure a conexão Google no projeto.' : 'O YouTube Music mostra apenas vídeos que ele classifica como música. A playlist e a fila do sistema continuam independentes.'}</p>
    </>}
    </>}
  </section>
}
