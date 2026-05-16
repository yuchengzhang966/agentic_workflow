import { NextRequest, NextResponse } from 'next/server'
import { getApp, updateApp, addIteration, getIterations } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const app = getApp(params.id)
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const iterations = getIterations(params.id)
  return NextResponse.json({ ...app, iterations })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const existing = getApp(params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { html, title, prompt } = await req.json()
  if (!html) return NextResponse.json({ error: 'Missing html' }, { status: 400 })

  // Save current version as an iteration before updating
  addIteration({
    id: uuidv4(),
    app_id: params.id,
    prompt: prompt || 'Manual edit',
    html: existing.html,
  })

  const updated = updateApp(params.id, html, title)
  return NextResponse.json(updated)
}
