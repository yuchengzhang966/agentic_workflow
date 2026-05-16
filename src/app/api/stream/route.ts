import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert web developer. Generate a complete, self-contained HTML page based on the user's request.

Rules:
- Return ONLY raw HTML — no markdown, no code fences, no explanation, no commentary
- The HTML must be complete and self-contained: all CSS in <style> tags, all JS in <script> tags
- External CDN links are allowed only for established libraries (Chart.js, Three.js, etc.) when genuinely needed
- Make it visually polished: tasteful color scheme, clean typography, smooth interactions
- Include meaningful interactivity wherever it makes sense
- If given existing HTML to modify, return the full modified HTML`

export async function POST(req: NextRequest) {
  const { prompt, existingHtml } = await req.json()

  if (!prompt?.trim()) {
    return new Response('Missing prompt', { status: 400 })
  }

  const userMessage = existingHtml
    ? `Existing app HTML:\n${existingHtml}\n\nModification request: ${prompt}`
    : prompt

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
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
