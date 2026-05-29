<script>
  import { calTrendHTML } from '../../lib/charts.js'
  export let data = null
  export let nDays = 30
  export let options = {}
</script>

{@html data ? calTrendHTML(data, nDays, options) : ''}
