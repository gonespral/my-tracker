// Real nutrition lookups for the AI chat — grounds calorie/macro estimates in
// USDA FoodData Central (generic/home-cooked foods) and Open Food Facts
// (branded/packaged products, strong European coverage), instead of letting
// Claude guess values from memory.

interface FoodResult {
  source: 'usda' | 'openfoodfacts'
  description: string
  dataType?: string
  per100g: { kcal: number; protein: number; carbs: number; fat: number }
  servingSize?: number
  servingSizeUnit?: string
  householdServing?: string
}

type FoodSearchResult = FoodResult[] | { error: string }

const CACHE_KEY = 'tracker-fdc-cache'
const CACHE_MAX = 300
let _cache: Map<string, FoodSearchResult>
try { _cache = new Map(Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {})) } catch { _cache = new Map() }

function persistCache() {
  if (_cache.size > CACHE_MAX) {
    for (const k of [..._cache.keys()].slice(0, _cache.size - CACHE_MAX)) _cache.delete(k)
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(_cache))) } catch { /* storage full/unavailable, cache stays in-memory only */ }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function cooldownStorageKey(apiKey: string) {
  return `tracker-fdc-cooldown:${apiKey}`
}

function getCooldownUntil(apiKey: string) {
  const until = Number(localStorage.getItem(cooldownStorageKey(apiKey)) || 0)
  return until > Date.now() ? until : 0
}

function setCooldown(apiKey: string, retryAfterHeader: string | null) {
  const seconds = Number(retryAfterHeader) > 0 ? Number(retryAfterHeader) : 300
  try { localStorage.setItem(cooldownStorageKey(apiKey), String(Date.now() + seconds * 1000)) } catch { /* ignore */ }
}

function formatWait(ms: number) {
  if (ms <= 0) return 'a moment'
  const mins = Math.ceil(ms / 60000)
  return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hours`
}

function makeThrottledFetch(minGapMs: number) {
  let chain = Promise.resolve()
  return function throttledFetch(url: string) {
    const run = chain.then(async () => {
      try { return await fetch(url) }
      finally { await new Promise((res) => setTimeout(res, minGapMs)) }
    })
    chain = run.then(() => undefined).catch(() => undefined)
    return run
  }
}

let _usdaChain: Promise<unknown> = Promise.resolve()
function usdaFetch(url: string, apiKey: string, minGapMs: number): Promise<Response | { cooldownUntil: number }> {
  const run: Promise<Response | { cooldownUntil: number }> = _usdaChain.then(async () => {
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
      await new Promise((res) => setTimeout(res, minGapMs))
    }
  })
  _usdaChain = run.catch(() => undefined)
  return run
}

const offFetch = makeThrottledFetch(400)

interface USDANutrient { nutrientNumber: string; value: number }
interface USDAFood {
  description: string
  dataType?: string
  foodNutrients?: USDANutrient[]
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
}

async function searchUSDA(query: string): Promise<FoodResult[]> {
  const key = localStorage.getItem('tracker-fdc-api-key') || 'DEMO_KEY'
  const earlyCooldown = getCooldownUntil(key)
  if (earlyCooldown) throw new Error(`rate_limited:${earlyCooldown}`)

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&dataType=Foundation,SR%20Legacy,Branded&api_key=${encodeURIComponent(key)}`
  const r = await usdaFetch(url, key, 350)
  if ('cooldownUntil' in r) throw new Error(`rate_limited:${r.cooldownUntil}`)
  if (!r.ok) return []
  const data = await r.json()
  return ((data.foods || []) as USDAFood[]).map((f): FoodResult | null => {
    const n: { kcal?: number; protein?: number; fat?: number; carbs?: number } = {}
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
  }).filter((x): x is FoodResult => x !== null)
}

async function fetchOffWithRetry(url: string) {
  let r = await offFetch(url)
  if (!r.ok) r = await offFetch(url)
  return r
}

interface OFFProduct { product_name?: string; brands?: string; nutriments?: Record<string, number> }

async function searchOpenFoodFacts(query: string): Promise<FoodResult[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,nutriments`
  const r = await fetchOffWithRetry(url)
  if (!r.ok) return []
  const data = await r.json()
  return ((data.products || []) as OFFProduct[]).map((p): FoodResult | null => {
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
  }).filter((x): x is FoodResult => x !== null)
}

export async function searchFoodDatabase(query: string): Promise<FoodSearchResult> {
  const key = query.trim().toLowerCase()
  if (!key) return { error: 'empty query' }
  if (_cache.has(key)) return _cache.get(key)!

  let usdaResults: FoodResult[] = []
  let rateLimitedUntil = 0
  try {
    usdaResults = await searchUSDA(query)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('rate_limited')) rateLimitedUntil = Number(msg.split(':')[1]) || 0
  }

  if (rateLimitedUntil) {
    return { error: `food database is rate-limited for about ${formatWait(rateLimitedUntil - Date.now())} — do not retry, estimate this item from context instead` }
  }

  let results = usdaResults
  if (usdaResults.length < 3) {
    try { results = [...usdaResults, ...await searchOpenFoodFacts(query)] } catch { /* USDA results still usable */ }
  }
  results = results.slice(0, 8)

  const out: FoodSearchResult = results.length ? results : { error: 'no match found — do not retry with a reworded query, estimate this item from context instead' }
  _cache.set(key, out)
  persistCache()
  return out
}

// Safe arithmetic evaluator for +, -, *, /, parentheses, and decimals only.
// Avoids eval()/Function() on model-generated strings.
export function safeCalc(expression: string): number {
  const tokens = String(expression).match(/\d+\.?\d*|\.\d+|[()+\-*/]/g)
  if (!tokens || tokens.join('') !== String(expression).replace(/\s+/g, '')) {
    throw new Error('invalid expression')
  }
  let pos = 0

  function peek() { return tokens![pos] }
  function next() { return tokens![pos++] }

  function parseExpr(): number {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const rhs = parseTerm()
      v = op === '+' ? v + rhs : v - rhs
    }
    return v
  }
  function parseTerm(): number {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = next()
      const rhs = parseFactor()
      v = op === '*' ? v * rhs : v / rhs
    }
    return v
  }
  function parseFactor(): number {
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
