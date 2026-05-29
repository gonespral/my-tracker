<script>
  import { macroRingHTML } from '../../lib/charts.js'
  export let label = ''
  export let value = 0
  export let target = 0
  export let unit = 'g'
  export let color = 'var(--accent)'
</script>

{@html macroRingHTML(label, value, target, unit, color)}
