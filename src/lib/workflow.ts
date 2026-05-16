import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

export type WorkflowNode = 'planner' | 'generator' | 'critic' | 'refiner'

export type WorkflowEvent =
  | { type: 'status'; node: WorkflowNode; message: string }
  | { type: 'chunk'; text: string }
  | { type: 'done'; html: string }
  | { type: 'error'; message: string }

interface Critique {
  score: number
  issues: string[]
}

const StateAnnotation = Annotation.Root({
  prompt: Annotation<string>(),
  existingHtml: Annotation<string | undefined>(),
  plan: Annotation<string>(),
  html: Annotation<string>(),
  critique: Annotation<Critique | undefined>(),
  attempts: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
})

type State = typeof StateAnnotation.State

const MAX_REFINEMENTS = 2
const QUALITY_THRESHOLD = 8

const PLANNER_PROMPT = `You are a product planner for self-contained HTML web apps.

Given a user's app request, produce a concise plan (under 200 words) covering:
- Core purpose and target user experience
- 3-5 key UI sections or components
- Primary interactions and data flows
- Visual style direction (color, typography, mood)

Be specific and concrete. No preamble — just the plan.`

const GENERATOR_PROMPT = `You are an expert web developer. Generate a complete, self-contained HTML page based on the user's request and the provided plan.

Rules:
- Return ONLY raw HTML — no markdown, no code fences, no explanation, no commentary
- The HTML must be complete and self-contained: all CSS in <style> tags, all JS in <script> tags
- External CDN links are allowed only for established libraries (Chart.js, Three.js, etc.) when genuinely needed
- Make it visually polished: tasteful color scheme, clean typography, smooth interactions
- Include meaningful interactivity wherever it makes sense
- Follow the plan but exercise good craft judgment`

const CRITIC_PROMPT = `You are a senior web app reviewer. Critique the HTML app on:
- Functional correctness (does the JS work, no syntax errors)
- Visual polish (typography, spacing, color)
- Interaction quality (smooth, responsive, intuitive)
- Completeness (matches the original prompt)

Respond with ONLY a JSON object — no markdown, no code fences:
{"score": <integer 1-10>, "issues": [<short issue strings>]}

Score 8+ means production-ready. List concrete fixable issues only; if score is 9+, issues may be empty.`

const REFINER_PROMPT = `You are an expert web developer fixing specific issues in an HTML app.

You will receive the current HTML and a list of issues. Return the FULL revised HTML with the issues addressed.

Rules:
- Return ONLY raw HTML — no markdown, no code fences, no explanation
- The HTML must remain complete and self-contained
- Address every listed issue while preserving what already works
- Do not regress on visual polish or functionality`

const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

function makeModel(model: string, opts: { maxTokens?: number } = {}) {
  return new ChatOpenAI({
    model,
    maxTokens: opts.maxTokens ?? 4096,
    apiKey: process.env.ZHIPU_API,
    configuration: { baseURL: ZHIPU_BASE_URL },
  })
}

class EventBus {
  private queue: WorkflowEvent[] = []
  private waiters: Array<(e: WorkflowEvent | null) => void> = []
  private closed = false

  emit(e: WorkflowEvent) {
    if (this.waiters.length > 0) {
      this.waiters.shift()!(e)
    } else {
      this.queue.push(e)
    }
  }

  close() {
    this.closed = true
    while (this.waiters.length > 0) {
      this.waiters.shift()!(null)
    }
  }

  async next(): Promise<WorkflowEvent | null> {
    if (this.queue.length > 0) return this.queue.shift()!
    if (this.closed) return null
    return new Promise(resolve => this.waiters.push(resolve))
  }
}

function parseCritique(raw: string): Critique {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const match = trimmed.match(/\{[\s\S]*\}/)
  const json = match ? match[0] : trimmed
  try {
    const parsed = JSON.parse(json)
    const score = typeof parsed.score === 'number' ? Math.max(1, Math.min(10, Math.round(parsed.score))) : 5
    const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((x: unknown) => typeof x === 'string') : []
    return { score, issues }
  } catch {
    return { score: 5, issues: ['critic output was not valid JSON'] }
  }
}

function buildGraph(bus: EventBus) {
  const planner = makeModel('glm-4-flash', { maxTokens: 1024 })
  const generator = makeModel('glm-4-plus', { maxTokens: 8192 })
  const critic = makeModel('glm-4-flash', { maxTokens: 512 })
  const refiner = makeModel('glm-4-plus', { maxTokens: 8192 })

  async function plannerNode(state: State): Promise<Partial<State>> {
    bus.emit({ type: 'status', node: 'planner', message: 'Planning your app...' })
    const userMsg = state.existingHtml
      ? `Existing app HTML:\n${state.existingHtml}\n\nModification request: ${state.prompt}`
      : state.prompt
    const res = await planner.invoke([
      new SystemMessage(PLANNER_PROMPT),
      new HumanMessage(userMsg),
    ])
    const plan = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
    return { plan }
  }

  async function generatorNode(state: State): Promise<Partial<State>> {
    bus.emit({ type: 'status', node: 'generator', message: 'Generating code...' })
    const userMsg = state.existingHtml
      ? `User request: ${state.prompt}\n\nExisting HTML:\n${state.existingHtml}\n\nPlan:\n${state.plan}\n\nReturn the full modified HTML.`
      : `User request: ${state.prompt}\n\nPlan:\n${state.plan}\n\nReturn the full HTML now.`

    const stream = await generator.stream([
      new SystemMessage(GENERATOR_PROMPT),
      new HumanMessage(userMsg),
    ])

    let html = ''
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string'
        ? chunk.content
        : Array.isArray(chunk.content)
          ? chunk.content.map(c => ('text' in c && typeof c.text === 'string' ? c.text : '')).join('')
          : ''
      if (text) {
        html += text
        bus.emit({ type: 'chunk', text })
      }
    }
    return { html: html.trim() }
  }

  async function criticNode(state: State): Promise<Partial<State>> {
    bus.emit({ type: 'status', node: 'critic', message: 'Reviewing quality...' })
    const res = await critic.invoke([
      new SystemMessage(CRITIC_PROMPT),
      new HumanMessage(`Original prompt: ${state.prompt}\n\nApp HTML:\n${state.html}`),
    ])
    const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
    return { critique: parseCritique(raw) }
  }

  async function refinerNode(state: State): Promise<Partial<State>> {
    bus.emit({ type: 'status', node: 'refiner', message: 'Refining...' })
    const issues = state.critique?.issues ?? []
    const userMsg = `Original prompt: ${state.prompt}\n\nCurrent HTML:\n${state.html}\n\nIssues to fix:\n${issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}\n\nReturn the full revised HTML.`

    const stream = await refiner.stream([
      new SystemMessage(REFINER_PROMPT),
      new HumanMessage(userMsg),
    ])

    let html = ''
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string'
        ? chunk.content
        : Array.isArray(chunk.content)
          ? chunk.content.map(c => ('text' in c && typeof c.text === 'string' ? c.text : '')).join('')
          : ''
      if (text) {
        html += text
        bus.emit({ type: 'chunk', text })
      }
    }
    return { html: html.trim(), attempts: state.attempts + 1 }
  }

  function shouldRefine(state: State): 'refiner' | typeof END {
    const score = state.critique?.score ?? 0
    if (score >= QUALITY_THRESHOLD) return END
    if (state.attempts >= MAX_REFINEMENTS) return END
    return 'refiner'
  }

  const graph = new StateGraph(StateAnnotation)
    .addNode('planner', plannerNode)
    .addNode('generator', generatorNode)
    .addNode('critic', criticNode)
    .addNode('refiner', refinerNode)
    .addEdge(START, 'planner')
    .addEdge('planner', 'generator')
    .addEdge('generator', 'critic')
    .addConditionalEdges('critic', shouldRefine, {
      refiner: 'refiner',
      [END]: END,
    })
    .addEdge('refiner', 'critic')

  return graph.compile()
}

export async function* runWorkflow(
  prompt: string,
  existingHtml?: string
): AsyncGenerator<WorkflowEvent> {
  const bus = new EventBus()
  const graph = buildGraph(bus)

  const runPromise = graph
    .invoke({ prompt, existingHtml, attempts: 0 })
    .then(finalState => {
      bus.emit({ type: 'done', html: finalState.html ?? '' })
    })
    .catch(err => {
      const msg = err instanceof Error ? err.message : 'Workflow failed'
      bus.emit({ type: 'error', message: msg })
    })
    .finally(() => bus.close())

  while (true) {
    const event = await bus.next()
    if (!event) break
    yield event
  }

  await runPromise
}
