import { NextRequest } from 'next/server'
import { runWorkflow } from '../../../lib/workflow'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { prompt, existingHtml } = await req.json()

  if (!prompt?.trim()) {
    return new Response('Missing prompt', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runWorkflow(prompt, existingHtml ?? undefined)) {
          if (event.type === 'status') {
            const line = `\ndata: STATUS:${event.node}:${event.message}\n`
            controller.enqueue(encoder.encode(line))
          } else if (event.type === 'chunk') {
            controller.enqueue(encoder.encode(event.text))
          } else if (event.type === 'done') {
            controller.enqueue(encoder.encode(`\ndata: STATUS:done:complete\n`))
          } else if (event.type === 'error') {
            controller.enqueue(encoder.encode(`\n<!-- ERROR: ${event.message} -->`))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed'
        controller.enqueue(encoder.encode(`\n<!-- ERROR: ${msg} -->`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}
