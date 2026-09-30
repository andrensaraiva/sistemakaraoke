import { useEffect, useRef, useState } from 'react'

type Player = { playVideo: () => void; destroy: () => void }
type PlayerEvent = { target: Player }
type PlayerStateEvent = PlayerEvent & { data: number }
type YoutubeApi = {
  Player: new (element: HTMLElement, options: {
    videoId: string
    width: string
    height: string
    playerVars: { origin: string; playsinline: number }
    events: {
      onReady: (event: PlayerEvent) => void
      onStateChange: (event: PlayerStateEvent) => void
      onAutoplayBlocked: () => void
      onError: () => void
    }
  }) => Player
}

declare global {
  interface Window {
    YT?: YoutubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YoutubeApi> | null = null

function loadYoutubeApi(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise<YoutubeApi>((resolve, reject) => {
      const script = document.createElement('script')
      const previousReady = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        if (window.YT?.Player) resolve(window.YT)
        else reject(new Error('O player do YouTube não carregou.'))
      }
      script.src = 'https://www.youtube.com/iframe_api'
      script.onerror = () => reject(new Error('O player do YouTube não carregou.'))
      document.head.append(script)
    }).catch((error: unknown) => {
      apiPromise = null
      throw error
    })
  }
  return apiPromise!
}

export function TvPlayer({ videoId, url }: { videoId: string; url: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [status, setStatus] = useState<'loading' | 'playing' | 'blocked' | 'ended' | 'error'>('loading')
  const ended = status === 'ended'

  useEffect(() => {
    if (ended) return
    let cancelled = false
    let ready = false
    let attempted = false
    let observer: IntersectionObserver | null = null

    const tryPlay = () => {
      const frame = frameRef.current
      if (!ready || attempted || !frame || document.visibilityState !== 'visible') return
      const rect = frame.getBoundingClientRect()
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
      if (visibleHeight * visibleWidth < rect.height * rect.width * 0.5) return
      attempted = true
      observer?.disconnect()
      playerRef.current?.playVideo()
    }

    void loadYoutubeApi().then((api) => {
      if (cancelled || !mountRef.current) return
      playerRef.current = new api.Player(mountRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { origin: window.location.origin, playsinline: 1 },
        events: {
          onReady: () => {
            ready = true
            if (frameRef.current) {
              observer = new IntersectionObserver(tryPlay, { threshold: 0.5 })
              observer.observe(frameRef.current)
            }
            tryPlay()
          },
          onStateChange: (event) => {
            if (event.data === 0) setStatus('ended')
            if (event.data === 1) setStatus('playing')
          },
          onAutoplayBlocked: () => setStatus('blocked'),
          onError: () => setStatus('error'),
        },
      })
    }).catch(() => { if (!cancelled) setStatus('error') })

    document.addEventListener('visibilitychange', tryPlay)
    return () => {
      cancelled = true
      observer?.disconnect()
      document.removeEventListener('visibilitychange', tryPlay)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId, ended])

  if (status === 'ended') return <div className="tv-video-wait"><span className="tv-kicker">FIM DA MÚSICA</span><h2>Valeu pelo show!</h2><p>Aguardando o operador concluir a apresentação.</p></div>

  return <div className="tv-player-shell">
    <div className="tv-player-frame" ref={frameRef}><div ref={mountRef} /></div>
    {status === 'blocked' && <p className="tv-player-help" role="status">O navegador bloqueou a reprodução automática. <button onClick={() => playerRef.current?.playVideo()}>Tocar vídeo</button></p>}
    {status === 'error' && <p className="tv-player-help" role="alert">Este vídeo não pôde ser reproduzido aqui. <a href={url} target="_blank" rel="noreferrer">Abrir no YouTube ↗</a></p>}
  </div>
}
