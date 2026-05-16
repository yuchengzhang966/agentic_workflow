'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type AgentNode = 'planner' | 'generator' | 'critic' | 'refiner' | 'done'

interface AgentStatus {
  node: AgentNode
  message: string
}

const STATUS_PREFIX = 'data: STATUS:'

const NODE_LABEL: Record<AgentNode, string> = {
  planner: '🤔 Planning your app...',
  generator: '⚡ Generating code...',
  critic: '🔍 Reviewing quality...',
  refiner: '✨ Refining...',
  done: '✅ Done',
}

function CreatePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prompt = searchParams.get('prompt') || ''

  const [html, setHtml] = useState('')
  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating')
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [refineCount, setRefineCount] = useState(0)
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const htmlRef = useRef('')
  const refineCountRef = useRef(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!prompt) {
      router.push('/')
      return
    }
    generate(prompt, null)
  }, []) // eslint-disable-line

  async function generate(p: string, existing: string | null) {
    setStatus('generating')
    setHtml('')
    setAgentStatus(null)
    setRefineCount(0)
    htmlRef.current = ''
    refineCountRef.current = 0

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, existingHtml: existing }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })

        const lines = pending.split('\n')
        pending = lines.pop() ?? ''

        let htmlAppend = ''
        for (const line of lines) {
          if (line.startsWith(STATUS_PREFIX)) {
            const body = line.slice(STATUS_PREFIX.length)
            const colonIdx = body.indexOf(':')
            if (colonIdx === -1) continue
            const node = body.slice(0, colonIdx) as AgentNode
            const message = body.slice(colonIdx + 1)
            setAgentStatus({ node, message })

            if (node === 'generator' || node === 'refiner') {
              htmlRef.current = ''
              htmlAppend = ''
              setHtml('')
              if (node === 'refiner') {
                refineCountRef.current += 1
                setRefineCount(refineCountRef.current)
              }
            }
          } else {
            htmlAppend += line + '\n'
          }
        }

        if (htmlAppend) {
          htmlRef.current += htmlAppend
          setHtml(htmlRef.current)
        }
      }

      if (pending && !pending.startsWith(STATUS_PREFIX)) {
        htmlRef.current += pending
        setHtml(htmlRef.current)
      }

      setStatus('done')
      setAgentStatus({ node: 'done', message: 'complete' })
      await saveApp(p, htmlRef.current)
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  async function saveApp(p: string, generatedHtml: string) {
    const res = await fetch('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: p, html: generatedHtml }),
    })
    if (res.ok) {
      const app = await res.json()
      setSaved({ id: app.id, title: app.title })
    }
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    if (!refinePrompt.trim() || refining || status !== 'done') return
    setRefining(true)
    setSaved(null)

    await generate(refinePrompt.trim(), htmlRef.current)
    setRefinePrompt('')
    setRefining(false)
  }

  const iframeDoc = html || '<html><body style="background:#0a0a0a"></body></html>'

  const statusLabel = (() => {
    if (status === 'error') return null
    if (status === 'done') {
      const suffix = refineCount > 0 ? ` — ${refineCount} refinement${refineCount > 1 ? 's' : ''}` : ''
      return `✅ Done${suffix}`
    }
    if (agentStatus) return NODE_LABEL[agentStatus.node]
    return '🤔 Starting...'
  })()

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#555] hover:text-white transition-colors text-sm">
            ← Atoms
          </Link>
          {status === 'generating' && statusLabel && (
            <span className="text-xs text-purple-400 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              {statusLabel}
            </span>
          )}
          {status === 'done' && (
            <span className="text-xs text-[#888]">
              {statusLabel}{saved && ` · ${saved.title}`}
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-400">Generation failed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          {saved && (
            <Link
              href={`/app/${saved.id}`}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Share ↗
            </Link>
          )}
        </div>
      </div>

      {/* Prompt bar */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <p className="text-xs text-[#555] truncate">{prompt}</p>
      </div>

      {/* Main: preview + code */}
      <div className="flex-1 overflow-hidden">
        {showCode ? (
          <pre className="h-full overflow-auto p-4 text-xs text-[#ccc] font-mono leading-relaxed bg-[#0d0d0d]">
            {html || '// generating...'}
          </pre>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={iframeDoc}
            sandbox="allow-scripts allow-forms allow-modals"
            className={`w-full h-full border-0 ${status === 'generating' ? 'generating border border-transparent' : ''}`}
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
            placeholder="Refine or modify the app…"
            disabled={status !== 'done'}
            className="flex-1 bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-purple-500/60 disabled:opacity-40 transition-colors"
          />
          <button
            type="submit"
            disabled={!refinePrompt.trim() || status !== 'done' || refining}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-sm text-white transition-colors"
          >
            {refining ? '…' : 'Refine'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  )
}
