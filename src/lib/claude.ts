const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

export async function generateTitle(prompt: string): Promise<string> {
  const res = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ZHIPU_API}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content: `Give a short 2-4 word title for a web app described as: "${prompt}". Reply with only the title, no quotes or punctuation.`,
        },
      ],
    }),
  })
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content?.trim() ?? prompt.slice(0, 40)
}
