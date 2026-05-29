<script>
  import { weekChartHTML } from '../../lib/charts.js'
  export let data = null
</script>

{@html data ? weekChartHTML(data) : ''}
