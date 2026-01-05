<script lang="ts">
interface Props {
  size?: string;
}
let { size = '16px' }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="7" height="9"></rect>
  <rect x="14" y="3" width="7" height="5"></rect>
  <rect x="14" y="12" width="7" height="9"></rect>
  <rect x="3" y="16" width="7" height="5"></rect>
</svg>
