import { NextRequest, NextResponse } from 'next/server'
import { listApps, createApp, getApp } from '@/lib/db'
import { generateTitle } from '@/lib/claude'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const apps = listApps(30)
  return NextResponse.json(apps)
}

export async function POST(req: NextRequest) {
  const { prompt, html, remixOf } = await req.json()

  if (!prompt || !html) {
    return NextResponse.json({ error: 'Missing prompt or html' }, { status: 400 })
  }

  // Validate remix source exists
  if (remixOf) {
    const source = getApp(remixOf)
    if (!source) {
      return NextResponse.json({ error: 'Remix source not found' }, { status: 404 })
    }
  }

  const title = await generateTitle(prompt)
  const app = createApp({ id: uuidv4(), title, prompt, html, remix_of: remixOf ?? null })

  return NextResponse.json(app, { status: 201 })
}
