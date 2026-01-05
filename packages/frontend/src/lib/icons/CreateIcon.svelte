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
  <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"></path>
  <path d="M5 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2"></path>
  <path d="M9 7v10"></path>
  <path d="M4 12h10"></path>
</svg>
