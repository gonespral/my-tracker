<script>
  import { calRingHTML } from '../../lib/charts.js'
  export let consumed = 0
  export let target = 0
  export let burned = 0
  export let mealFrac = 0
</script>

{@html calRingHTML(consumed, target, burned, mealFrac)}
