<script>
  import { sparklineHTML } from '../../lib/charts.js'
  export let weights = []
  export let compact = false
</script>

{@html sparklineHTML(weights, { compact })}
