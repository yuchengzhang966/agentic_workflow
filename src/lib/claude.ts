import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert web developer. Generate a complete, self-contained HTML page based on the user's request.

Rules:
- Return ONLY raw HTML — no markdown, no code fences, no explanation
- The HTML must be complete and self-contained: all CSS in <style> tags, all JS in <script> tags, no external dependencies except CDN links if truly necessary
- Make it visually polished: use a tasteful color scheme, clean typography, smooth interactions
- Include interactivity wherever it makes sense (animations, click handlers, form inputs, etc.)
- The app should be impressive but NOT overcomplicated — nail the core experience
- If the user asks to modify an existing app, return the full modified HTML`

export interface GenerateOptions {
  prompt: string
  existingHtml?: string
  onChunk?: (chunk: string) => void
}

export async function generateApp({ prompt, existingHtml, onChunk }: GenerateOptions): Promise<string> {
  const userMessage = existingHtml
    ? `Existing app HTML:\n${existingHtml}\n\nModification request: ${prompt}`
    : prompt

  let html = ''

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      html += event.delta.text
      onChunk?.(event.delta.text)
    }
  }

  return html.trim()
}

export async function generateTitle(prompt: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 32,
    messages: [
      {
        role: 'user',
        content: `Give a short 2-4 word title for a web app described as: "${prompt}". Reply with only the title, no quotes or punctuation.`,
      },
    ],
  })
  const block = msg.content[0]
  return block.type === 'text' ? block.text.trim() : prompt.slice(0, 40)
}
