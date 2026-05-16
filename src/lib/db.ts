import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const DATA_DIR = process.env.DB_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'atoms.json')

export interface App {
  id: string
  title: string
  prompt: string
  html: string
  created_at: number
  updated_at: number
  remix_of: string | null
}

export interface Iteration {
  id: string
  app_id: string
  prompt: string
  html: string
  created_at: number
}

interface Store {
  apps: App[]
  iterations: Iteration[]
}

function loadStore(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_PATH)) {
    return { apps: [], iterations: [] }
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  } catch {
    return { apps: [], iterations: [] }
  }
}

function saveStore(store: Store): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(store), 'utf-8')
}

export function listApps(limit = 30): App[] {
  const store = loadStore()
  return store.apps
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit)
}

export function getApp(id: string): App | null {
  const store = loadStore()
  return store.apps.find(a => a.id === id) ?? null
}

export function createApp(app: Omit<App, 'created_at' | 'updated_at'>): App {
  const store = loadStore()
  const now = Math.floor(Date.now() / 1000)
  const newApp: App = { ...app, remix_of: app.remix_of ?? null, created_at: now, updated_at: now }
  store.apps.push(newApp)
  saveStore(store)
  return newApp
}

export function updateApp(id: string, html: string, title?: string): App | null {
  const store = loadStore()
  const idx = store.apps.findIndex(a => a.id === id)
  if (idx === -1) return null
  const now = Math.floor(Date.now() / 1000)
  store.apps[idx] = { ...store.apps[idx], html, updated_at: now, ...(title ? { title } : {}) }
  saveStore(store)
  return store.apps[idx]
}

export function addIteration(iter: Omit<Iteration, 'created_at'>): void {
  const store = loadStore()
  const now = Math.floor(Date.now() / 1000)
  store.iterations.push({ ...iter, created_at: now })
  saveStore(store)
}

export function getIterations(appId: string): Iteration[] {
  const store = loadStore()
  return store.iterations
    .filter(i => i.app_id === appId)
    .sort((a, b) => a.created_at - b.created_at)
}
