'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppCard from '@/components/AppCard'
import type { App } from '@/lib/db'

const EXAMPLE_PROMPTS = [
  'A todo app with local storage and smooth animations',
  'A color palette generator with hex codes',
  'An interactive sine wave visualizer',
  'A Pomodoro timer with sound effects',
  'A BMI calculator with a visual gauge',
  'A CSS gradient generator with live preview',
  'A minimal Markdown previewer',
  'A dice roller for tabletop games',
]

export default function Home() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(false)
  const [placeholder, setPlaceholder] = useState(EXAMPLE_PROMPTS[0])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchApps()
    const interval = setInterval(() => {
      setPlaceholder(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)])
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  async function fetchApps() {
    const res = await fetch('/api/apps')
    if (res.ok) setApps(await res.json())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)

    // Navigate to a new app page in "generating" mode
    const params = new URLSearchParams({ prompt: prompt.trim() })
    router.push(`/create?${params}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">⚛ Atoms</span>
        </div>
        <span className="text-xs text-[#555] hidden sm:block">
          Build any web app with a sentence
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-12">
        <div className="w-full max-w-2xl space-y-3">
          <h1 className="text-4xl font-bold text-center tracking-tight mb-2">
            What do you want to build?
          </h1>
          <p className="text-center text-[#666] text-sm mb-8">
            Describe any web app. Watch it come to life.
          </p>

          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={3}
              className="w-full resize-none bg-[#111] border border-[#222] rounded-2xl px-5 py-4 pr-16 text-sm text-white placeholder-[#444] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_20px_#a855f720] transition-all"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || loading}
              className="absolute right-3 bottom-3 w-9 h-9 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#444]">
            Press Enter to generate · Shift+Enter for new line
          </p>
        </div>

        {/* Gallery */}
        {apps.length > 0 && (
          <div className="w-full max-w-5xl mt-20">
            <h2 className="text-sm font-medium text-[#555] mb-4 px-1">Recent creations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.map(app => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
