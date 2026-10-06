/** Version evidence and runtime shape are independent checks. No network at boot. */
export function classifyHostVersion(version, policy) {
  const testedVersions = policy.testedVersions ?? []
  if (!version || version === 'unknown') return { status: 'unknown', version: 'unknown', testedVersions }
  if (testedVersions.includes(version)) return { status: 'tested', version, testedVersions }
  const family = /^([0-9]+\.[0-9]+)\./.exec(version)?.[1]
  const supported = (policy.supportedSeries ?? []).includes(family)
  return { status: supported ? 'untested' : 'unsupported', version, testedVersions }
}

export function inspectHostCapabilities(ctx) {
  const service = name => {
    try { return ctx.get?.(name) ?? ctx[name] ?? null } catch { return null }
  }
  const pruner = service('toolResultPruner')
  const compaction = service('compaction')
  return {
    tools: typeof service('tools')?.register === 'function',
    layer1: typeof pruner?.pruneSession === 'function' && typeof pruner?.pruneContent === 'function',
    layer2: typeof compaction?.compactRegion === 'function' && typeof compaction?.summarize === 'function',
    pressure: typeof service('tokenMeter')?.measure === 'function',
    modelInfo: typeof service('llm')?.resolveModelInfo === 'function',
  }
}
