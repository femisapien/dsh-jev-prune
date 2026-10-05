// Simulated DSH fixtures derived from smoke_apply.mjs; no live API calls.
function makeSession(plan) {
  const events = new Map()
  let nextSeq = 1
  const add = (type, data) => {
    const seq = nextSeq++
    events.set(seq, { seq, type, data })
    return seq
  }
  const addStep = (tool, args, text) => {
    const callId = `c${nextSeq + 1}`
    const head = add('assistant/message', {
      message: { content: [{ type: 'text', text: '看一下。' }, { type: 'tool-call', id: callId, name: tool, arguments: args }] },
    })
    const result = add('tool/result', {
      message: { source: { callId }, content: [{ type: 'tool-result', content: [{ type: 'text', text }] }] },
    })
    return { head, result, tool }
  }

  add('user/message', { content: [{ type: 'text', text: '排查河牌底池计算，先摸结构。' }], source: { kind: 'user' } })
  // 三步都必须在默认只读白名单内（read/grep/glob）——默认配置下 shell 工具进不了候选
  const effectivePlan = plan ?? [
    { tool: 'Read', args: { file_path: 'server/src/game/river.ts' }, chars: 6000 },
    { tool: 'Grep', args: { pattern: 'basePot', path: 'server/src' }, chars: 4000 },
    { tool: 'Glob', args: { pattern: '*.ts', path: 'server/src' }, chars: 6000 },
  ]
  const steps = []
  for (const item of effectivePlan) {
    if (item.interleave) {
      // 插一条不含 tool-call 的 assistant 文本，把前后两组只读步骤**切成两段**，
      // 这样 maxCompactionsPerPass > 1 才有第二个可压区间
      add('assistant/message', { message: { content: [{ type: 'text', text: item.interleave }] } })
    }
    const fill = item.fill ?? 'a'
    steps.push(addStep(item.tool, item.args, fill.repeat(item.chars)))
  }
  const step1 = steps[0]
  const step2 = steps[1]
  const step3 = steps[2]

  const tail = add('assistant/message', { message: { content: [{ type: 'text', text: '继续。' }] } })

  const appended = []
  const session = {
    seqs: { s1: step1.result, s2: step2.result, s3: step3.result },
    steps: [step1, step2, step3],
    tail,
    appended,
    // ⚠️ 刻意**不**提供 `.events`：实测活的 DSH 会话对象上 `session.events` 是 undefined，
    // 只有 `eventAt(seq)` 与 `surface.nodes` 可用。假对象要复刻这个现实，
    // 否则会掩盖"依赖 .events 的 bug"（那个 bug 让工具名索引在活宿主里建出 0 条）。
    surface: { nodes: [...events.keys()] },
    eventAt: (seq) => events.get(seq) ?? null,
    deriveEventMessage: (event) => event.data.message,
    append(type, data, options) {
      const seq = nextSeq++
      events.set(seq, { seq, type, data, ...options })
      appended.push({ seq, type, data, options })
      const op = options?.surfaceOp
      if (op === 'append') {
        session.surface.nodes.push(seq)
      } else if (op?.op === 'replace') {
        const start = session.surface.nodes.indexOf(op.startSeq)
        const end = session.surface.nodes.indexOf(op.endSeq)
        if (start < 0 || end < start) throw new Error(`fake surface replace: 非法区间 ${op.startSeq}-${op.endSeq}`)
        session.surface.nodes.splice(start, end - start + 1, seq)
      }
      return { seq }
    },
  }
  return session
}

/** 一个 assistant 消息并行发出 6 个 read，随后跟 6 个结果（issue #39 真实形态）。 */
function makeBatchSession() {
  const events = new Map()
  let nextSeq = 1
  const appended = []
  const add = (type, data, options = {}) => {
    const seq = nextSeq++
    events.set(seq, { seq, type, data, ...options })
    return seq
  }
  add('user/message', { content: [{ type: 'text', text: '批量读六个文件。' }], source: { kind: 'user' } })
  const calls = Array.from({ length: 6 }, (_, i) => ({
    type: 'tool-call', id: `batch-${i + 1}`, name: 'Read',
    arguments: { file_path: `src/file-${i + 1}.js` },
  }))
  const head = add('assistant/message', {
    message: { content: [{ type: 'text', text: '批量读取。' }, ...calls] },
  })
  const results = calls.map((call, i) => add('tool/result', {
    message: {
      source: { callId: call.id },
      content: [{ type: 'tool-result', content: [{ type: 'text', text: String(i + 1).repeat(3000) }] }],
    },
  }))
  add('assistant/message', { message: { content: [{ type: 'text', text: '继续。' }] } })
  const session = {
    seqs: Object.fromEntries(results.map((seq, i) => [`s${i + 1}`, seq])),
    steps: [{ head, results }],
    appended,
    surface: { nodes: [...events.keys()] },
    eventAt: (seq) => events.get(seq) ?? null,
    deriveEventMessage: (event) => event.data.message,
    append(type, data, options) {
      const seq = add(type, data, options)
      appended.push({ seq, type, data, options })
      const op = options?.surfaceOp
      if (op === 'append') session.surface.nodes.push(seq)
      else if (op?.op === 'replace') {
        const start = session.surface.nodes.indexOf(op.startSeq)
        const end = session.surface.nodes.indexOf(op.endSeq)
        if (start < 0 || end < start) throw new Error(`fake surface replace: 非法区间 ${op.startSeq}-${op.endSeq}`)
        session.surface.nodes.splice(start, end - start + 1, seq)
      }
      return { seq }
    },
  }
  return session
}

function makePruner() {
  let pruneContentCalls = 0
  return {
    get pruneContentCalls() { return pruneContentCalls },
    ctx: { tokenMeter: { estimateMessage: () => 123 } },
    measureContent: (blocks) => blocks.reduce((n, b) => n + (b?.text ? Array.from(b.text).length : 0), 0),
    // 与 DSH 同口径：超过阈值才裁；这里设成极高，模拟"体积启发式不动作"
    pruneContent(blocks) {
      pruneContentCalls += 1
      const chars = blocks.reduce((n, b) => n + (b?.text ? Array.from(b.text).length : 0), 0)
      if (chars <= 100000) return null
      return blocks
    },
    /**
     * 基线 pruneSession —— 忠实复刻 DSH 自带实现的循环与 append 协议。
     * 插件会**接管**这个方法；这里的实现用来验证"接管前它是可用的"
     * （插件的 guard 要求 pruner.pruneSession 是函数，否则拒绝接管）。
     */
    pruneSession(session) {
      const pruned = []
      let charsRemoved = 0
      for (const seq of [...session.surface.nodes]) {
        const event = session.eventAt(seq)
        if (event?.type !== 'tool/result') continue
        const original = session.deriveEventMessage(event)
        const result = original?.content?.[0]
        if (result == null) continue
        const content = this.pruneContent(result.content)
        if (content == null) continue
        const before = this.measureContent(result.content)
        const after = this.measureContent(content)
        session.append('compaction/prune', {
          shadowedRange: { start: seq, end: seq },
          shadowedSeqs: [seq],
          shadowedTokenCount: this.ctx.tokenMeter.estimateMessage(original),
        })
        session.append('tool/result',
          { ...event.data, message: { ...original, content: [{ ...result, content }] } },
          { surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq }, sourceEventSeqs: [seq] })
        pruned.push({ originalSeq: seq, charsBefore: before, charsAfter: after })
        charsRemoved += before - after
      }
      return { pruned, charsRemoved }
    },
  }
}

/**
 * 假 compaction 服务。行为对齐 DSH `BasicCompactionEngine` 的关键契约：
 *   · `compactRegion` 内部通过 `this.summarize(...)` **动态派发**（所以我们猴补丁实例方法才有效）
 *   · `summarize` 返回 `{ summary, provider, model }`，summary 是内容块数组
 *   · 回执必须比被压缩的区间更小，否则后端会抛错（这里也照做）
 */
function makeCompaction(session) {
  const calls = []
  const summaries = []
  return {
    calls,
    summaries,
    async summarize(input, agent, signal) {
      summaries.push({ input, injected: false })
      return { summary: [{ type: 'text', text: '（基线模型摘要）' }], provider: 'fake', model: 'fake-model' }
    },
    async compactRegion(start, end, agent, signal) {
      const nodes = session.surface.nodes
      const startIdx = nodes.indexOf(start)
      const endIdx = nodes.indexOf(end)
      if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) throw new Error(`compactRegion: 非法区间 ${start}-${end}`)
      // 关键：模拟后端内部这一次动态派发 —— 猴补丁必须在这里被调用到
      const summarized = await this.summarize({ messages: [] }, agent, signal)
      const text = summarized.summary.map((b) => b.text ?? '').join('')
      calls.push({ start, end, nodes: nodes.slice(startIdx, endIdx + 1), summary: text, provider: summarized.provider })
      return {
        compactionId: 'fake-compaction',
        shadowedRange: { start, end },
        shadowedSeqs: nodes.slice(startIdx, endIdx + 1),
        shadowedTokenCount: 1234,
        summary: summarized.summary,
      }
    },
  }
}

function makeCtx({ pruner, session, compaction }) {
  const handlers = new Map()
  const registeredTools = []
  const registeredCommands = []
  const tokenMeter = {
    measure: (s) => {
      const nodes = (s?.surface?.nodes ?? []).map((seq) => {
        const event = s.eventAt(seq)
        const blocks = event?.data?.message?.content?.[0]?.content
        const text = Array.isArray(blocks) ? blocks.map((b) => b.text ?? '').join('') : ''
        return { seq, tokens: Math.ceil(text.length / 4), heuristicTokens: Math.ceil(text.length / 4) }
      })
      return { totalTokens: nodes.reduce((sum, n) => sum + n.tokens, 0), nodes }
    },
  }
  const services = new Map([
    ['toolResultPruner', pruner],
    ['tokenMeter', tokenMeter],
    ['compaction', compaction],
    ['commands', { register: (c) => { registeredCommands.push(c); return c } }],
  ])
  const toolsService = { register: (t) => { registeredTools.push(t); return t } }
  services.set('tools', toolsService)

  return {
    registeredTools,
    registeredCommands,
    handlers,
    // Cordis 两种取法都要支持：ctx.get('x') 与 ctx.x
    get: (n) => services.get(n) ?? null,
    tools: toolsService,
    commands: services.get('commands'),
    tokenMeter,
    compaction,
    // 与 cordis 同构：同一事件可以有**多个**监听器，第三个参数（或 options.prepend）
    // 决定插入队首还是队尾。此前这里只是 Map<event, fn> —— 第二个监听会**覆盖**第一个，
    // 而且 prepend 被完全忽略。于是"判定钩子 prepend 到 compaction-basic 之前"这条
    // 真实语义在测试里根本不存在（拆成两个监听后 30/72 项直接失败）。
    // 假对象必须复刻宿主这个形状，否则测的是一套不存在的语义。
    on: (evt, fn, options) => {
      const prepend = typeof options === 'object' && options !== null
        ? options.prepend === true
        : options === true
      const list = handlers.get(evt) ?? []
      if (prepend) list.unshift(fn)
      else list.push(fn)
      handlers.set(evt, list)
    },
    /**
     * 忠实复刻 cordis 的 waterfall（`agent/pre-step` 正是这类事件）：
     * 最外层先跑，最后一个参数是内层 next；监听器**不调用 next() 即否决**后续链路
     * （含宿主内建行为）。所以测试里不能"取一个 handler 直接调"——链上有几个监听、
     * 谁先谁后，恰恰是这次要验证的东西。
     */
    waterfall: (name, ...args) => {
      const cbs = [...(handlers.get(name) ?? [])]
      const inner = args.pop()
      const next = () => (cbs.shift() ?? inner)(...args)
      args.push(next)
      return next()
    },
    effect: (fn) => fn(),
    logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
  }
}

// ---------------------------------------------------------------- 假 Jev
/**
 * 只读概率、不看文本 —— 与真实现同语义。
 * @param {Record<number, number>} resultPreset 结果可丢性 P(保留)
 * @param {Record<number, number>} effectPreset 副作用 P(有副作用)
 */
function fakeJudge(resultPreset, effectPreset = {}) {
  return {
    ready: true,
    requests: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
    batch: (_state, questions) => [questions],
    async ask(_state, questions) {
      this.requests += 1
      const out = {}
      for (const id of Object.keys(questions)) {
        const match = /^(result|effect)_s(\d+)$/.exec(id)
        if (match == null) continue
        const seq = Number(match[2])
        const preset = match[1] === 'result' ? resultPreset : effectPreset
        if (preset[seq] != null) out[id] = preset[seq]
      }
      return out
    },
  }
}


export { makeSession, makePruner, makeCtx, fakeJudge };
