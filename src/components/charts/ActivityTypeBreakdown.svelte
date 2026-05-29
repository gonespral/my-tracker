<script>
  import { activityTypeBreakdownHTML } from '../../lib/charts.js'
  export let data = null
  export let year = new Date().getFullYear()
  export let month = new Date().getMonth()
</script>

{@html data ? activityTypeBreakdownHTML(data, year, month) : ''}
