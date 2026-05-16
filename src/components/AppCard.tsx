'use client'

import Link from 'next/link'
import type { App } from '@/lib/db'

interface Props {
  app: App
}

function timeAgo(ts: number): string {
  const secs = Math.floor(Date.now() / 1000) - ts
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function AppCard({ app }: Props) {
  return (
    <Link
      href={`/app/${app.id}`}
      className="group block bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden hover:border-[#333] hover:shadow-lg transition-all"
    >
      {/* Mini preview iframe */}
      <div className="relative h-36 overflow-hidden bg-[#0d0d0d]">
        <iframe
          srcDoc={app.html}
          sandbox="allow-scripts"
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
          title={app.title}
        />
        <div className="absolute inset-0 group-hover:bg-purple-500/5 transition-colors" />
      </div>

      {/* Meta */}
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{app.title}</p>
        <p className="text-xs text-[#555] truncate mt-0.5">{app.prompt}</p>
        <p className="text-xs text-[#444] mt-1.5">{timeAgo(app.created_at)}</p>
      </div>
    </Link>
  )
}
