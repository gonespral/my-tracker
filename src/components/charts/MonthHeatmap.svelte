<script>
  import { monthHeatmapHTML } from '../../lib/charts.js'
  export let data = null
  export let monthOffset = 0
  export let type = 'workouts'
</script>

{@html data ? monthHeatmapHTML(data, monthOffset, type) : ''}
