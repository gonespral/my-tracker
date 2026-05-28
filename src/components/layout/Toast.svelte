<script>
  import { toastMsg } from '../../stores.js'
</script>

<div class="toast" id="toast" class:show={!!$toastMsg}>
  {$toastMsg || ''}
</div>

<style>
  .toast.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
</style>
