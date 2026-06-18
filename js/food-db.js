// Real nutrition lookups for the AI chat — grounds calorie/macro estimates in
// USDA FoodData Central (generic/home-cooked foods) and Open Food Facts
// (branded/packaged products, strong European coverage), instead of letting
// Claude guess values from memory.

// In-memory + localStorage cache, so identical lookups survive page reloads
// and don't re-hit a rate-limited API. Keyed by normalized query text only —
// it can't help when Claude rephrases the same food differently each retry,
// which is why the retry-storm guard below matters more than the cache does.
const CACHE_KEY = 'tracker-fdc-cache'
const CACHE_MAX = 300
let _cache
try { _cache = new Map(Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY)) || {})) } catch (_) { _cache = new Map() }

function persistCache() {
  if (_cache.size > CACHE_MAX) {
    for (const k of [..._cache.keys()].slice(0, _cache.size - CACHE_MAX)) _cache.delete(k)
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(_cache))) } catch (_) { /* storage full/unavailable, cache stays in-memory only */ }
}

function round1(n) {
  return Math.round(n * 10) / 10
}

// USDA's 429 response includes a Retry-After header — DEMO_KEY's seen as long
// as ~3 hours once its (tiny, ~10 request) quota is spent. Once we know we're
// locked out, remember it and skip the network call entirely until it passes,
// instead of firing — and getting declined by — every single lookup attempt.
function cooldownStorageKey(apiKey) {
  return `tracker-fdc-cooldown:${apiKey}`
}

function getCooldownUntil(apiKey) {
  const until = Number(localStorage.getItem(cooldownStorageKey(apiKey)) || 0)
  return until > Date.now() ? until : 0
}

function setCooldown(apiKey, retryAfterHeader) {
  const seconds = Number(retryAfterHeader) > 0 ? Number(retryAfterHeader) : 300
  try { localStorage.setItem(cooldownStorageKey(apiKey), String(Date.now() + seconds * 1000)) } catch (_) { /* ignore */ }
}

function formatWait(ms) {
  if (ms <= 0) return 'a moment'
  const mins = Math.ceil(ms / 60000)
  return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hours`
}

// A multi-item meal fires several lookup_food calls in the same round, all
// concurrently. Without spacing them out, each API sees a burst and starts
// rate-limiting/anti-bot-blocking even well under its real hourly quota.
// One queue per API serializes its requests with a minimum gap between them.
function makeThrottledFetch(minGapMs) {
  let chain = Promise.resolve()
  return function throttledFetch(url) {
    const run = chain.then(async () => {
      try { return await fetch(url) }
      finally { await new Promise(res => setTimeout(res, minGapMs)) }
    })
    chain = run.catch(() => {})
    return run
  }
}

// USDA's queue re-checks the cooldown, and sets it on a 429, entirely inside
// the queued task itself — not in searchUSDA after awaiting the result. That
// makes it provably sequential: task N+1 cannot start until task N (and any
// cooldown it just recorded) has fully finished, so a burst of N calls for
// one meal only ever wastes one real request once the limit is hit, not N.
let _usdaChain = Promise.resolve()
function usdaFetch(url, apiKey, minGapMs) {
  const run = _usdaChain.then(async () => {
    const cooldownUntil = getCooldownUntil(apiKey)
    if (cooldownUntil) return { cooldownUntil }
    try {
      const r = await fetch(url)
      if (r.status === 429) {
        setCooldown(apiKey, r.headers.get('retry-after'))
        return { cooldownUntil: getCooldownUntil(apiKey) }
      }
      return r
    } finally {
      await new Promise(res => setTimeout(res, minGapMs))
    }
  })
  _usdaChain = run.catch(() => {})
  return run
}

const offFetch = makeThrottledFetch(400)

async function searchUSDA(query) {
  const key = localStorage.getItem('tracker-fdc-api-key') || 'DEMO_KEY'
  const earlyCooldown = getCooldownUntil(key)
  if (earlyCooldown) throw new Error(`rate_limited:${earlyCooldown}`)

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&dataType=Foundation,SR%20Legacy,Branded&api_key=${encodeURIComponent(key)}`
  const r = await usdaFetch(url, key, 350)
  if (r.cooldownUntil) throw new Error(`rate_limited:${r.cooldownUntil}`)
  if (!r.ok) return []
  const data = await r.json()
  return (data.foods || []).map(f => {
    const n = {}
    for (const fn of f.foodNutrients || []) {
      if (fn.nutrientNumber === '208') n.kcal = fn.value
      if (fn.nutrientNumber === '203') n.protein = fn.value
      if (fn.nutrientNumber === '204') n.fat = fn.value
      if (fn.nutrientNumber === '205') n.carbs = fn.value
    }
    if (n.kcal == null) return null
    return {
      source: 'usda',
      description: f.description,
      dataType: f.dataType,
      per100g: { kcal: round1(n.kcal), protein: round1(n.protein || 0), carbs: round1(n.carbs || 0), fat: round1(n.fat || 0) },
      servingSize: f.servingSize || undefined,
      servingSizeUnit: f.servingSizeUnit || undefined,
      householdServing: f.householdServingFullText || undefined,
    }
  }).filter(Boolean)
}

// Open Food Facts 503s when hit with concurrent bursts (its anti-bot layer,
// and the error page it returns has no CORS header, which browsers surface
// as a misleading "CORS Missing Allow Origin" instead of the real 503).
// The throttled queue above spaces requests out; retry once on top of that.
async function fetchOffWithRetry(url) {
  let r = await offFetch(url)
  if (!r.ok) r = await offFetch(url)
  return r
}

async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,nutriments`
  const r = await fetchOffWithRetry(url)
  if (!r.ok) return []
  const data = await r.json()
  return (data.products || []).map(p => {
    const n = p.nutriments || {}
    const kcal = n['energy-kcal_100g']
    if (kcal == null || !p.product_name) return null
    return {
      source: 'openfoodfacts',
      description: p.brands ? `${p.product_name} (${p.brands})` : p.product_name,
      per100g: {
        kcal: round1(kcal),
        protein: round1(n.proteins_100g || 0),
        carbs: round1(n.carbohydrates_100g || 0),
        fat: round1(n.fat_100g || 0),
      },
    }
  }).filter(Boolean)
}

export async function searchFoodDatabase(query) {
  const key = query.trim().toLowerCase()
  if (!key) return { error: 'empty query' }
  if (_cache.has(key)) return _cache.get(key)

  // USDA first (fast, never rate-limited so far). Most home-cooked/generic
  // queries are already well covered by it, so only fall back to Open Food
  // Facts — which is fragile under concurrent load — when USDA comes up thin.
  // This keeps a 4-item meal from firing 4 simultaneous OFF requests at once.
  let usdaResults = []
  let rateLimitedUntil = 0
  try {
    usdaResults = await searchUSDA(query)
  } catch (e) {
    if (e.message.startsWith('rate_limited')) rateLimitedUntil = Number(e.message.split(':')[1]) || 0
  }

  // Rate-limited means every other lookup this turn will fail the same way —
  // don't also burn an Open Food Facts request, and tell Claude plainly so it
  // stops retrying with reworded queries instead of treating this as "no match".
  if (rateLimitedUntil) {
    return { error: `food database is rate-limited for about ${formatWait(rateLimitedUntil - Date.now())} — do not retry, estimate this item from context instead` }
  }

  let results = usdaResults
  if (usdaResults.length < 3) {
    try { results = [...usdaResults, ...await searchOpenFoodFacts(query)] } catch (_) { /* USDA results still usable */ }
  }
  results = results.slice(0, 8)

  const out = results.length ? results : { error: 'no match found — do not retry with a reworded query, estimate this item from context instead' }
  _cache.set(key, out)
  persistCache()
  return out
}

// Safe arithmetic evaluator for +, -, *, /, parentheses, and decimals only.
// Avoids eval()/Function() on model-generated strings.
export function safeCalc(expression) {
  const tokens = String(expression).match(/\d+\.?\d*|\.\d+|[()+\-*/]/g)
  if (!tokens || tokens.join('') !== String(expression).replace(/\s+/g, '')) {
    throw new Error('invalid expression')
  }
  let pos = 0

  function peek() { return tokens[pos] }
  function next() { return tokens[pos++] }

  function parseExpr() {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const rhs = parseTerm()
      v = op === '+' ? v + rhs : v - rhs
    }
    return v
  }
  function parseTerm() {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = next()
      const rhs = parseFactor()
      v = op === '*' ? v * rhs : v / rhs
    }
    return v
  }
  function parseFactor() {
    if (peek() === '-') { next(); return -parseFactor() }
    if (peek() === '(') {
      next()
      const v = parseExpr()
      if (next() !== ')') throw new Error('mismatched parentheses')
      return v
    }
    const tok = next()
    const v = Number(tok)
    if (tok === undefined || Number.isNaN(v)) throw new Error('invalid expression')
    return v
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('invalid expression')
  if (!Number.isFinite(result)) throw new Error('invalid expression')
  return result
}
