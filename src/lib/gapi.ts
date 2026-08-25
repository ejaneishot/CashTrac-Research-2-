/**
 * Google Identity Services (GIS) — client-side OAuth.
 * Loads gsi/client + gapi.client from CDN, holds an access token in memory.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void
        }
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => {
            callback: (resp: { access_token?: string; error?: string }) => void
            requestAccessToken: (opts?: { prompt?: string }) => void
          }
        }
      }
    }
    gapi?: {
      load: (api: string, config: { callback: () => void; onerror: (err: unknown) => void }) => void
      client: {
        init: (config: { apiKey?: string; discoveryDocs?: string[] }) => Promise<void>
        setToken: (token: { access_token: string }) => void
        getToken: () => { access_token?: string } | null
        sheets?: {
          spreadsheets: {
            get: (req: Record<string, unknown>) => Promise<{ result: Record<string, unknown> }>
            values: {
              get: (req: Record<string, unknown>) => Promise<{ result: { values?: string[][] } }>
              append: (req: Record<string, unknown>) => Promise<{ result: unknown }>
              update: (req: Record<string, unknown>) => Promise<{ result: unknown }>
            }
            batchUpdate: (req: Record<string, unknown>) => Promise<{ result: unknown }>
          }
        }
        drive?: {
          files: {
            list: (req: Record<string, unknown>) => Promise<{ result: { files?: { id: string; name: string }[] } }>
            create: (req: Record<string, unknown>) => Promise<{ result: { id: string } }>
            get: (req: Record<string, unknown>) => Promise<{ result: { id: string; name: string } }>
            update: (req: Record<string, unknown>) => Promise<{ result: { id: string } }>
          }
        }
      }
    }
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

const SHEETS_DISCOVERY = 'https://sheets.googleapis.com/$discovery/rest?version=v4'
const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

let loaded = false
let tokenClient: ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null = null

/** Load the GIS + gapi scripts once. Resolves when ready, or false if no client id. */
export async function loadGoogleScripts(): Promise<boolean> {
  if (!CLIENT_ID) return false

  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve()
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(s)
    })

  try {
    if (!window.google?.accounts) await loadScript('https://accounts.google.com/gsi/client')
    if (!window.gapi?.client) await loadScript('https://apis.google.com/js/api.js')

    if (!window.gapi) throw new Error('gapi failed to load')

    await new Promise<void>((resolve, reject) => {
      window.gapi!.load('client', { callback: resolve, onerror: reject })
    })

    if (!window.gapi.client.sheets || !window.gapi.client.drive) {
      await window.gapi.client.init({
        discoveryDocs: [SHEETS_DISCOVERY, DRIVE_DISCOVERY],
      })
    }

    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPES,
      callback: () => {}, // token is read from getToken below
    })
    loaded = true
    return true
  } catch (err) {
    console.error('[cashtrac] Google init failed', err)
    return false
  }
}

export function isGoogleAvailable(): boolean {
  return loaded
}

export function hasClientId(): boolean {
  return Boolean(CLIENT_ID)
}

/** Trigger the consent popup. Resolves with an access token. */
export function requestAccessToken(opts?: { prompt?: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Google not initialized'))
    tokenClient!.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      if (!resp.access_token) return reject(new Error('No access token'))
      window.gapi!.client.setToken({ access_token: resp.access_token })
      resolve(resp.access_token)
    }
    tokenClient!.requestAccessToken(opts?.prompt ? { prompt: 'consent' } : undefined)
  })
}
