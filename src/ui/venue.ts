export let venueName = import.meta.env.VITE_VENUE_NAME || 'Karaokê da Casa'

export function setVenueName(name: string) {
  venueName = name
}
