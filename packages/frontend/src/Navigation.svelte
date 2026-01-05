<script lang="ts">
import type { TinroRouteMeta } from 'tinro';
import { SettingsNavItem } from '@podman-desktop/ui-svelte';
import DashboardIcon from './lib/icons/DashboardIcon.svelte';
import ImagesIcon from './lib/icons/ImagesIcon.svelte';
import DiskImageIcon from './lib/DiskImageIcon.svelte';
import ExamplesIcon from './lib/icons/ExamplesIcon.svelte';
import bootcIcon from './lib/icons/icon.png';

interface Props {
  meta: TinroRouteMeta;
}
let { meta }: Props = $props();
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar shadow-sm flex-col justify-between flex bg-[var(--pd-secondary-nav-bg)] border-[var(--pd-global-nav-bg-border)] border-r-[1px]"
  aria-label="Navigation">
  <div class="flex items-center">
    <a href="/" title="Navigate to dashboard" class="pt-4 px-4 mb-10 flex items-center gap-3">
      <img src={bootcIcon} alt="Bootable Containers" class="w-7 h-7" />
      <p class="text-xl font-semibold text-[color:var(--pd-secondary-nav-header-text)]">Bootable Containers</p>
    </a>
  </div>
  <div class="h-full overflow-hidden hover:overflow-y-auto" style="margin-bottom:auto">
    <SettingsNavItem title="Dashboard" selected={meta.url === '/'} href="/">
      {#snippet icon()}
        <DashboardIcon size="16px" />
      {/snippet}
    </SettingsNavItem>
    <SettingsNavItem title="Images" selected={meta.url.startsWith('/images') || meta.url.startsWith('/onboarding')} href="/images">
      {#snippet icon()}
        <ImagesIcon size="16px" />
      {/snippet}
    </SettingsNavItem>
    <SettingsNavItem title="Disk Images" selected={meta.url.startsWith('/disk-image')} href="/disk-images">
      {#snippet icon()}
        <DiskImageIcon size="16px" />
      {/snippet}
    </SettingsNavItem>
    <SettingsNavItem title="Examples" selected={meta.url.startsWith('/examples')} href="/examples">
      {#snippet icon()}
        <ExamplesIcon size="16px" />
      {/snippet}
    </SettingsNavItem>
  </div>
</nav>
