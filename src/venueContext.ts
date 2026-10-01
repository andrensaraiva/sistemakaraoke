export const defaultVenueId = 'andre'

export function parseVenuePath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'b') return { venueId: defaultVenueId, prefix: '', path: pathname || '/', valid: true }
  const id = segments[1] ?? ''
  const valid = /^[a-z0-9][a-z0-9-]{1,39}$/.test(id)
  return {
    venueId: valid ? id : '',
    prefix: valid ? `/b/${id}` : '',
    path: valid ? pathname.slice(`/b/${id}`.length) || '/' : '/',
    valid,
  }
}

const route = parseVenuePath(window.location.pathname)
export const venueId = route.venueId
export const venuePrefix = route.prefix
export const venuePath = route.path
export const validVenuePath = route.valid
export const legacyVenue = venueId === defaultVenueId

export function operatorEmail(identity: string): string {
  const value = identity.trim().toLowerCase()
  if (value.includes('@')) return value
  if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(value)) throw new Error('Digite um usuário ou e-mail válido.')
  return `${value}.${venueId}@operators.example.com`
}
