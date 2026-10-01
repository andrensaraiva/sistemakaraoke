import { venuePrefix, venuePath } from '../venueContext'

function atVenue(base: string) {
  return new URL(`${venuePrefix}/`, base).href
}

export const guestUrl = atVenue(import.meta.env.VITE_GUEST_SITE_URL || window.location.origin)
export const operatorUrl = import.meta.env.VITE_OPERATOR_SITE_URL
  ? atVenue(import.meta.env.VITE_OPERATOR_SITE_URL)
  : new URL(`${venuePrefix}/operador`, window.location.origin).href
export const tvUrl = import.meta.env.VITE_TV_SITE_URL
  ? atVenue(import.meta.env.VITE_TV_SITE_URL)
  : new URL(`${venuePrefix}/telao`, window.location.origin).href
export const reportsUrl = new URL(`${venuePrefix}/operador/relatorios`, window.location.origin).href
export const printUrl = new URL(`${venuePrefix}/imprimir`, window.location.origin).href

function isSiteHome(url: string) {
  const { hostname } = new URL(url)
  const siteId = hostname.split('.')[0]
  return venuePath === '/' &&
    (window.location.hostname === hostname || window.location.hostname === `${siteId}.firebaseapp.com`)
}

export const isOperatorHome = Boolean(import.meta.env.VITE_OPERATOR_SITE_URL) && isSiteHome(operatorUrl)
export const isTvHome = Boolean(import.meta.env.VITE_TV_SITE_URL) && isSiteHome(tvUrl)
