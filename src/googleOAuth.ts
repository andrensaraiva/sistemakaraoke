export type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
}

export type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void }

export type GoogleOAuth = {
  initTokenClient: (options: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback: (error: { type?: string }) => void
  }) => GoogleTokenClient
  hasGrantedAllScopes: (response: GoogleTokenResponse, scope: string) => boolean
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } }
  }
}

let scriptPromise: Promise<GoogleOAuth> | null = null

export function loadGoogleOAuth(): Promise<GoogleOAuth> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  if (!scriptPromise) {
    scriptPromise = new Promise<GoogleOAuth>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => window.google?.accounts?.oauth2
        ? resolve(window.google.accounts.oauth2)
        : reject(new Error('Não foi possível carregar a conexão com Google.'))
      script.onerror = () => reject(new Error('Não foi possível carregar a conexão com Google.'))
      document.head.append(script)
    }).catch((error: unknown) => {
      scriptPromise = null
      throw error
    })
  }
  return scriptPromise
}
