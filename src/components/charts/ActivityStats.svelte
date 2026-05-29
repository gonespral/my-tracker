<script>
  import { activityStatsHTML } from '../../lib/charts.js'
  export let data = null
  export let nDays = 30
</script>

{@html data ? activityStatsHTML(data, nDays) : ''}
