import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { FUNCTIONS_REGION } from '../../shared/ticketing'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

export const firebaseConfigured = Object.values(config).every((value) => value.length > 0)

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true'
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY ?? ''

function openFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    return getFirestore(app)
  }
}

/** Deployed ticket functions refuse calls without an App Check token. Localhost registers a debug token instead. */
function startAppCheck(app: FirebaseApp): void {
  if (useEmulators || !appCheckSiteKey) return
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    // A string token is used as-is. `true` would make Firebase print a new token in the console.
    ;(globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true })
}

const app: FirebaseApp | null = firebaseConfigured ? initializeApp(config) : null
if (app) startAppCheck(app)

export const db: Firestore | null = app ? openFirestore(app) : null
export const auth: Auth | null = app ? getAuth(app) : null
export const functions: Functions | null = app ? getFunctions(app, FUNCTIONS_REGION) : null

if (useEmulators && db && auth && functions) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
