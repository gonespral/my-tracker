import { renderIfChanged } from './utils.js'

export { renderIfChanged as renderPanel }

/**
 * Wraps each item's HTML in an animated container with a staggered delay.
 * @param {any[]} items
 * @param {(item: any, index: number) => string} renderFn
 * @param {number} step - delay increment in seconds (default 0.05)
 */
export function stagger(items, renderFn, step = 0.05) {
  return items.map((item, i) =>
    `<div class="anim-item" style="--anim-delay:${(i * step).toFixed(2)}s">${renderFn(item, i)}</div>`
  ).join('')
}

/**
 * Wraps a single block of HTML with a fade-up entrance.
 */
export function fadeIn(html) {
  return `<div class="anim-item">${html}</div>`
}
