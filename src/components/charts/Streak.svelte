<script>
  import { streakHTML } from '../../lib/charts.js'
  export let data = null
</script>

{@html data ? streakHTML(data) : ''}
