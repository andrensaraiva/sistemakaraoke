export type YouTubeVideo = {
  id: string
  title: string
  channel: string
  thumbnail: string
}

type ApiError = { error?: { message?: string } }

async function api<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  const body = await response.json() as T & ApiError
  if (!response.ok) {
    if (response.status === 401) throw new Error('A conexão com Google expirou. Conecte a conta novamente.')
    throw new Error(body.error?.message || `YouTube retornou erro ${response.status}.`)
  }
  return body
}

export function playlistIdFromInput(input: string): string | null {
  const value = input.trim()
  try {
    const url = new URL(value)
    if (!['music.youtube.com', 'www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) return null
    const id = url.searchParams.get('list') || ''
    return /^[A-Za-z0-9_-]{10,100}$/.test(id) ? id : null
  } catch {
    return /^[A-Za-z0-9_-]{10,100}$/.test(value) ? value : null
  }
}

export async function searchYouTube(query: string, token: string): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '8',
    regionCode: 'BR', relevanceLanguage: 'pt', q: query,
  })
  const result = await api<{ items?: Array<{
    id?: { videoId?: string }
    snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }
  }> }>(`search?${params}`, token)
  return (result.items || []).flatMap((item) => item.id?.videoId ? [{
    id: item.id.videoId,
    title: item.snippet?.title || 'Vídeo sem título',
    channel: item.snippet?.channelTitle || 'YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
  }] : [])
}

export async function getPlaylistTitle(id: string, token: string): Promise<string> {
  const params = new URLSearchParams({ part: 'snippet', id })
  const result = await api<{ items?: Array<{ snippet?: { title?: string } }> }>(`playlists?${params}`, token)
  const title = result.items?.[0]?.snippet?.title
  if (!title) throw new Error('Playlist não encontrada nesta conta.')
  return title
}

export async function addVideoToPlaylist(playlistId: string, videoId: string, token: string): Promise<'added' | 'exists'> {
  const params = new URLSearchParams({ part: 'id', playlistId, videoId, maxResults: '1' })
  const existing = await api<{ items?: Array<{ id: string }> }>(`playlistItems?${params}`, token)
  if (existing.items?.length) return 'exists'
  await api<unknown>('playlistItems?part=snippet', token, {
    method: 'POST',
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
  })
  return 'added'
}
