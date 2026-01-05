<script lang="ts">
import './app.css';
import { Button, FormPage } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import { bootcClient } from './api/client';
import DiskImageIcon from './lib/DiskImageIcon.svelte';
import { goToImages, gotoImageBuild } from './lib/navigation';
import { faTerminal, faCogs, faServer, faFlask } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { onMount } from 'svelte';
import type { BcvkBinaryInfo } from '/@shared/src/BootcAPI';

interface Props {
  imageName: string;
  imageTag: string;
  engineId: string;
}

let { imageName, imageTag, engineId }: Props = $props();

let launchInProgress = $state(false);
let launchMode = $state<'bash' | 'systemd' | 'ephemeral' | undefined>(undefined);

// bcvk state
let bcvkSupported = $state(false);
let bcvkInfo = $state<BcvkBinaryInfo | undefined>(undefined);

// Full image reference
const imageRef = $derived(imageTag ? `${imageName}:${imageTag}` : imageName);

// Check bcvk availability on mount
onMount(async () => {
  try {
    bcvkSupported = await bootcClient.isBcvkSupported();
    if (bcvkSupported) {
      bcvkInfo = await bootcClient.getBcvkBinaryInfo();
    }
  } catch (err) {
    console.error('Error checking bcvk availability:', err);
  }
});

async function launchBashTest(): Promise<void> {
  launchInProgress = true;
  launchMode = 'bash';
  try {
    await bootcClient.testBootcImage(imageRef, engineId, 'bash');
  } finally {
    launchInProgress = false;
    launchMode = undefined;
  }
}

async function launchSystemdTest(): Promise<void> {
  launchInProgress = true;
  launchMode = 'systemd';
  try {
    await bootcClient.testBootcImage(imageRef, engineId, 'systemd');
  } finally {
    launchInProgress = false;
    launchMode = undefined;
  }
}

async function launchEphemeralVM(): Promise<void> {
  launchInProgress = true;
  launchMode = 'ephemeral';
  try {
    // Install bcvk if not already installed
    if (!bcvkInfo) {
      await bootcClient.installBcvk();
      bcvkInfo = await bootcClient.getBcvkBinaryInfo();
    }
    // Launch the ephemeral VM
    // This will automatically navigate to the container terminal
    // which auto-SSHs into the VM via the modified .bashrc
    await bootcClient.launchBcvkEphemeralVM(imageRef);
  } catch (err) {
    console.error('Error launching ephemeral VM:', err);
  } finally {
    launchInProgress = false;
    launchMode = undefined;
  }
}

async function goToBuildDiskImage(): Promise<void> {
  await gotoImageBuild(imageName, imageTag);
}

function goBack(): void {
  router.goto('/images');
}
</script>

<FormPage
  title="Run Bootable Container"
  inProgress={launchInProgress}
  breadcrumbLeftPart="Images"
  breadcrumbRightPart="Run Image"
  onclose={goToImages}
  onbreadcrumbClick={goToImages}>
  {#snippet icon()}
    <DiskImageIcon size="30px" />
  {/snippet}

  {#snippet content()}
    <div class="p-5 min-w-full h-fit">
      <div class="bg-[var(--pd-content-card-bg)] pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg">
        <!-- Header -->
        <div class="space-y-2">
          <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
            Run Image: {imageRef}
          </h2>
          <p class="text-sm text-[var(--pd-content-card-text)]">
            Choose how you want to run your bootable container image. For quick testing, use Shell or Systemd modes.
            For a complete experience with full functionality, build a disk image and run it as a Virtual Machine.
          </p>
        </div>

        <!-- Options Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
          <!-- Option 1: Shell -->
          <div class="flex flex-col p-6 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)] hover:border-[var(--pd-button-primary-bg)] transition-all">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-lg bg-[var(--pd-button-primary-bg)]/20 flex items-center justify-center">
                <Fa class="text-[var(--pd-button-primary-bg)]" size="1.5x" icon={faTerminal} />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)]">Shell</h3>
                <span class="text-xs text-[var(--pd-content-card-text)] opacity-70">Quick Testing</span>
              </div>
            </div>

            <p class="text-sm text-[var(--pd-content-card-text)] mb-4 grow">
              Launch an interactive bash shell to inspect the container. Useful for examining packages, configurations, and files without running systemd.
            </p>

            <div class="p-3 rounded-md bg-[var(--pd-content-card-inset-bg)] mb-4">
              <code class="text-xs text-[var(--pd-content-card-text)]">
                podman run --rm -ti {imageRef} bash
              </code>
            </div>

            <div class="text-xs text-[var(--pd-content-card-text)] mb-4 space-y-1">
              <p><strong>Pros:</strong> Fast startup, low resource usage</p>
              <p><strong>Cons:</strong> No systemd services running</p>
            </div>

            <Button
              class="w-full"
              on:click={launchBashTest}
              disabled={launchInProgress}
              inProgress={launchMode === 'bash'}>
              Launch Shell
            </Button>
          </div>

          <!-- Option 2: Systemd -->
          <div class="flex flex-col p-6 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)] hover:border-[var(--pd-button-primary-bg)] transition-all">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-lg bg-[var(--pd-state-warning)]/20 flex items-center justify-center">
                <Fa class="text-[var(--pd-state-warning)]" size="1.5x" icon={faCogs} />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)]">Systemd</h3>
                <span class="text-xs text-[var(--pd-content-card-text)] opacity-70">Limited Testing</span>
              </div>
            </div>

            <p class="text-sm text-[var(--pd-content-card-text)] mb-4 grow">
              Launch a privileged container with <code>/sbin/init</code> to test systemd services. Note that not all services will work correctly in a container environment.
            </p>

            <div class="p-3 rounded-md bg-[var(--pd-content-card-inset-bg)] mb-4">
              <code class="text-xs text-[var(--pd-content-card-text)]">
                podman run --privileged -v /sys:/sys:ro {imageRef}
              </code>
            </div>

            <div class="text-xs text-[var(--pd-content-card-text)] mb-4 space-y-1">
              <p><strong>Pros:</strong> Systemd runs, can test services</p>
              <p><strong>Cons:</strong> Requires privileges, some services fail</p>
            </div>

            <Button
              class="w-full"
              on:click={launchSystemdTest}
              disabled={launchInProgress}
              inProgress={launchMode === 'systemd'}>
              Launch Systemd
            </Button>
          </div>

          <!-- Option 3: Ephemeral VM (bcvk) - Experimental -->
          {#if bcvkSupported}
          <div class="flex flex-col p-6 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)] hover:border-[var(--pd-button-primary-bg)] transition-all relative">
            <!-- Experimental badge -->
            <div class="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--pd-state-warning)]/20 text-[var(--pd-state-warning)]">
              Experimental
            </div>

            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-lg bg-[var(--pd-state-info)]/20 flex items-center justify-center">
                <Fa class="text-[var(--pd-state-info)]" size="1.5x" icon={faFlask} />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)]">Ephemeral VM</h3>
                <span class="text-xs text-[var(--pd-state-info)]">bcvk</span>
              </div>
            </div>

            <p class="text-sm text-[var(--pd-content-card-text)] mb-4 grow">
              Launch a real VM directly from your container image without building a disk image first. Uses bcvk for fast ephemeral VM testing with full systemd support.
            </p>

            <div class="p-3 rounded-md bg-[var(--pd-content-card-inset-bg)] mb-4">
              <code class="text-xs text-[var(--pd-content-card-text)]">
                bcvk ephemeral run-ssh {imageRef}
              </code>
            </div>

            <div class="text-xs text-[var(--pd-content-card-text)] mb-4 space-y-1">
              <p><strong>Pros:</strong> Real VM, fast, no disk build needed</p>
              <p><strong>Cons:</strong> Ephemeral only, Linux x86_64 only</p>
            </div>

            <Button
              class="w-full"
              on:click={launchEphemeralVM}
              disabled={launchInProgress}
              inProgress={launchMode === 'ephemeral'}>
              Launch Ephemeral VM
            </Button>
          </div>
          {/if}

          <!-- Option 4: Virtual Machine -->
          <div class="flex flex-col p-6 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)] hover:border-[var(--pd-button-primary-bg)] transition-all">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-lg bg-[var(--pd-state-success)]/20 flex items-center justify-center">
                <Fa class="text-[var(--pd-state-success)]" size="1.5x" icon={faServer} />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)]">Virtual Machine</h3>
                <span class="text-xs text-[var(--pd-state-success)]">Recommended</span>
              </div>
            </div>

            <p class="text-sm text-[var(--pd-content-card-text)] mb-4 grow">
              Build a disk image and launch a full virtual machine. This is the intended way to run bootable containers with complete functionality and all services working correctly.
            </p>

            <div class="p-3 rounded-md bg-[var(--pd-content-card-inset-bg)] mb-4 text-xs text-[var(--pd-content-card-text)]">
              <p class="mb-1"><strong>Process:</strong></p>
              <ol class="list-decimal list-inside space-y-0.5">
                <li>Build disk image (QCOW2/RAW)</li>
                <li>Configure VM settings</li>
                <li>Launch virtual machine</li>
              </ol>
            </div>

            <div class="text-xs text-[var(--pd-content-card-text)] mb-4 space-y-1">
              <p><strong>Pros:</strong> Full system, all services work</p>
              <p><strong>Cons:</strong> Slower, requires disk space</p>
            </div>

            <Button
              class="w-full"
              on:click={(): void => {
                goToBuildDiskImage().catch((e: unknown) => console.error('Error navigating to build disk image', e));
              }}
              disabled={launchInProgress}>
              Build Disk Image
            </Button>
          </div>
        </div>

        <!-- Info box -->
        <div class="p-4 rounded-lg bg-[var(--pd-content-card-inset-bg)] border border-[var(--pd-content-card-border)] mt-6">
          <h4 class="font-semibold text-[var(--pd-content-card-header-text)] mb-2">About Running Bootable Containers</h4>
          <p class="text-sm text-[var(--pd-content-card-text)]">
            Running bootable containers as regular containers is useful for quick inspection and testing, but has limitations.
            According to the <a href="https://docs.fedoraproject.org/en-US/bootc/provisioning-container/" target="_blank" class="text-[var(--pd-button-primary-bg)] underline">Fedora bootc documentation</a>,
            not all services are expected to run without additional privileges. For complete functionality with all hardware and system services,
            building a disk image and running it in a VM is recommended.
          </p>
        </div>

        <!-- Back button -->
        <div class="flex justify-start mt-6">
          <Button type="secondary" on:click={goBack}>Back to Images</Button>
        </div>
      </div>
    </div>
  {/snippet}
</FormPage>
