import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]
const missing = required.filter((key) => !env[key]?.trim())
if (missing.length) {
  console.error(`Firebase incompleto em .env.local: ${missing.join(', ')}`)
  process.exitCode = 1
} else if (env.VITE_USE_FIREBASE_EMULATORS === 'true' || env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-')) {
  console.error('O deploy precisa usar um projeto Firebase real, sem emuladores.')
  process.exitCode = 1
} else {
  console.log(`Configuração Firebase pronta para ${env.VITE_FIREBASE_PROJECT_ID}.`)
}
