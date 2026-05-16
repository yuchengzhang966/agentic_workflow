'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface AppWithIterations {
  id: string
  title: string
  prompt: string
  html: string
  created_at: number
  updated_at: number
  remix_of: string | null
  iterations: { id: string; prompt: string; html: string; created_at: number }[]
}

export default function AppPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [app, setApp] = useState<AppWithIterations | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCode, setShowCode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editedHtml, setEditedHtml] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const htmlRef = useRef('')

  useEffect(() => {
    loadApp()
  }, [id]) // eslint-disable-line

  async function loadApp() {
    setLoading(true)
    const res = await fetch(`/api/apps/${id}`)
    if (!res.ok) {
      router.push('/')
      return
    }
    const data: AppWithIterations = await res.json()
    setApp(data)
    setEditedHtml(data.html)
    setPreviewHtml(data.html)
    htmlRef.current = data.html
    setLoading(false)
  }

  async function handleSaveEdit() {
    if (!app || saving) return
    setSaving(true)
    await fetch(`/api/apps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: editedHtml, prompt: 'Manual edit' }),
    })
    setPreviewHtml(editedHtml)
    htmlRef.current = editedHtml
    setSaving(false)
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    if (!refinePrompt.trim() || refining) return
    setRefining(true)

    const params = new URLSearchParams({
      prompt: refinePrompt.trim(),
    })
    // Save current as remix source
    const src = id
    router.push(`/create?${params}&remixOf=${src}`)
  }

  async function loadIteration(html: string) {
    setPreviewHtml(html)
    setEditedHtml(html)
    htmlRef.current = html
    setShowHistory(false)
  }

  async function handleRemix() {
    if (!app) return
    const params = new URLSearchParams({ prompt: app.prompt })
    router.push(`/create?${params}`)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-[#555] text-sm">Loading…</div>
      </div>
    )
  }

  if (!app) return null

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#555] hover:text-white transition-colors text-sm">
            ← Atoms
          </Link>
          <span className="text-sm font-medium">{app.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {app.iterations.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#222] text-[#666] hover:text-white hover:border-[#444] transition-colors"
            >
              History ({app.iterations.length})
            </button>
          )}
          <button
            onClick={() => setShowCode(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showCode
                ? 'border-purple-500/60 text-purple-300 bg-purple-500/10'
                : 'border-[#222] text-[#666] hover:text-white hover:border-[#444]'
            }`}
          >
            {showCode ? 'Preview' : 'Code'}
          </button>
          <button
            onClick={handleRemix}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#333] text-white transition-colors"
          >
            Remix
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <p className="text-xs text-[#555]">{app.prompt}</p>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border-b border-[#1a1a1a] bg-[#0d0d0d] p-3 shrink-0 overflow-x-auto">
          <p className="text-xs text-[#555] mb-2">Version history</p>
          <div className="flex gap-2">
            {app.iterations.map((iter, i) => (
              <button
                key={iter.id}
                onClick={() => loadIteration(iter.html)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#222] text-[#888] hover:text-white hover:border-[#444] whitespace-nowrap transition-colors"
              >
                v{i + 1}: {iter.prompt.slice(0, 30)}
              </button>
            ))}
            <button
              onClick={() => { setPreviewHtml(app.html); setEditedHtml(app.html); setShowHistory(false) }}
              className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 whitespace-nowrap"
            >
              Current
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-hidden relative">
        {showCode ? (
          <div className="h-full flex flex-col">
            <textarea
              value={editedHtml}
              onChange={e => setEditedHtml(e.target.value)}
              className="flex-1 w-full p-4 text-xs text-[#ccc] font-mono bg-[#0d0d0d] resize-none focus:outline-none border-0"
              spellCheck={false}
            />
            <div className="px-4 py-2 border-t border-[#1a1a1a] flex gap-2 justify-end bg-[#0d0d0d]">
              <button
                onClick={() => { setPreviewHtml(editedHtml); setShowCode(false) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#222] text-[#666] hover:text-white transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-scripts allow-forms allow-modals"
            className="w-full h-full border-0"
            title="App preview"
          />
        )}
      </div>

      {/* Refine bar */}
      <div className="px-4 py-3 border-t border-[#1a1a1a] shrink-0">
        <form onSubmit={handleRefine} className="flex gap-2">
          <input
            type="text"
            value={refinePrompt}
            onChange={e => setRefinePrompt(e.target.value)}
            placeholder="Describe changes to make…"
            className="flex-1 bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-purple-500/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!refinePrompt.trim() || refining}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-sm text-white transition-colors"
          >
            {refining ? '…' : 'Refine'}
          </button>
        </form>
      </div>
    </div>
  )
}
