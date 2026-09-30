export const guestUrl = import.meta.env.VITE_GUEST_SITE_URL || `${window.location.origin}/`
export const operatorUrl = import.meta.env.VITE_OPERATOR_SITE_URL || `${window.location.origin}/operador`
export const tvUrl = import.meta.env.VITE_TV_SITE_URL || `${window.location.origin}/telao`

function isSiteHome(url: string) {
  const { hostname } = new URL(url)
  const siteId = hostname.split('.')[0]
  return window.location.pathname === '/' &&
    (window.location.hostname === hostname || window.location.hostname === `${siteId}.firebaseapp.com`)
}

export const isOperatorHome = Boolean(import.meta.env.VITE_OPERATOR_SITE_URL) && isSiteHome(operatorUrl)
export const isTvHome = Boolean(import.meta.env.VITE_TV_SITE_URL) && isSiteHome(tvUrl)
