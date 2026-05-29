<script>
  import { mealMacroAvgHTML } from '../../lib/charts.js'
  export let data = null
  export let nDays = 30
</script>

{@html data ? mealMacroAvgHTML(data, nDays) : ''}
