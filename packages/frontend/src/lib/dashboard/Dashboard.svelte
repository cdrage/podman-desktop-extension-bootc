<script lang="ts">
import BootcSelkie from '../BootcSelkie.svelte';
import Link from '../Link.svelte';
import { Button } from '@podman-desktop/ui-svelte';
import DashboardPage from '../upstream/DashboardPage.svelte';
import DiskImageIcon from '../DiskImageIcon.svelte';
import { imageInfo } from '../../stores/imageInfo';
import { historyInfo } from '../../stores/historyInfo';
import osbuildImage from './osbuild.png';
import redhatImage from './redhat.png';
import fedoraImage from './fedora.png';
import BootcImageIcon from '../BootcImageIcon.svelte';
import { REPOSITORY_URL } from '/@shared/src/repository-infos';
import { router } from 'tinro';
import { faRocket, faArrowCircleDown, faCube } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';
import { bootcClient } from '/@/api/client';
import { gotoImageBuild } from '../navigation';
import { tick } from 'svelte';

let bootcImageCount = $derived($imageInfo.length);
let diskImageCount = $derived($historyInfo.length);

const bootcImageBuilderSite = 'https://github.com/osbuild/bootc-image-builder';
const bootcSite = 'https://bootc-dev.github.io/bootc/';
const fedoraBaseImages = 'https://docs.fedoraproject.org/en-US/bootc/base-images/';

// Example image handling
const exampleImage = 'registry.gitlab.com/fedora/bootc/examples/httpd:latest';
const exampleImageReadmeUrl = 'https://gitlab.com/fedora/bootc/examples/-/tree/main/httpd';
let pullInProgress = $state(false);
let displayDisclaimer = $state(false);
let imageExists = $derived($imageInfo?.some(image => image.RepoTags?.includes(exampleImage)));

async function gotoBuild(): Promise<void> {
  const [image, tag] = exampleImage.split(':');
  await gotoImageBuild(image, tag);
}

async function pullExampleImage(): Promise<void> {
  pullInProgress = true;
  displayDisclaimer = false;
  setTimeout(() => {
    if (pullInProgress) {
      displayDisclaimer = true;
      tick().catch((e: unknown) => console.error('error updating disclaimer', e));
    }
  }, 5_000);
  await bootcClient.pullImage(exampleImage).finally(() => {
    pullInProgress = false;
    displayDisclaimer = false;
  });
}
</script>

<DashboardPage>
  {#snippet pageTitle()}
    Welcome to Bootable Containers
  {/snippet}

  {#snippet header()}
    <div class="flex flex-row items-start gap-6">
      <div class="flex-1">
        <p class="text-[var(--pd-content-card-text)] leading-relaxed">
          Build entire bootable operating systems from your container images. Using
          <Link externalRef={fedoraBaseImages}>compatible base images</Link>,
          <Link externalRef={bootcImageBuilderSite}>bootc-image-builder</Link>, and
          <Link externalRef={bootcSite}>bootc</Link>, transform containers into bootable disk images.
        </p>
        <p class="text-[var(--pd-content-card-text)] mt-2 opacity-80">
          <Link externalRef={REPOSITORY_URL}>View documentation</Link> to learn more.
        </p>
      </div>
      <div class="flex-shrink-0">
        <BootcSelkie size="80" />
      </div>
    </div>
  {/snippet}

  <!-- Get Started Section -->
  <div class="space-y-3">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Build disk image card -->
      <div class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)]">
            <Fa icon={faRocket} size="1.1x" />
          </div>
          <div>
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Build a Disk Image</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">Create bootable disk images</p>
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)] grow">
          Convert your bootable container image into a disk image (QCOW2, RAW, ISO, AMI, VMDK) ready for deployment.
        </p>
        <Button on:click={(): void => router.goto('/disk-images/build')} icon={faRocket} class="self-start mt-3">Build Disk Image</Button>
      </div>

      <!-- Pull example card -->
      <div class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)]">
            <Fa icon={faCube} size="1.1x" />
          </div>
          <div>
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Try an Example Image</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">Apache httpd web server</p>
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)] grow">
          {imageExists ? 'Build a disk image from the' : 'Pull and build the'}
          <Link externalRef={exampleImageReadmeUrl}>example httpd image</Link>.
        </p>
        <div class="mt-3">
          {#if imageExists}
            <Button on:click={gotoBuild} icon={faCube}>Build Disk Image</Button>
          {:else}
            <Button on:click={pullExampleImage} icon={faArrowCircleDown} inProgress={pullInProgress}>
              Pull Example Image
            </Button>
          {/if}
          {#if displayDisclaimer}
            <p class="text-[var(--pd-status-waiting)] text-xs mt-2">
              The image is over 1.5GB and may take a while to download.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Metrics Section -->
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">Images</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Bootc Images card -->
      <button
        type="button"
        class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)] text-left cursor-pointer"
        onclick={(): void => router.goto('/images/')}>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)]">
            <BootcImageIcon size="20" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">BootC Container Images</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">Container images containing the bootc label</p>
          </div>
          <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)] text-sm font-semibold">
            {bootcImageCount}
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)]">
          View and manage your bootable container images ready for disk image creation.
        </p>
      </button>

      <!-- Disk Images card -->
      <button
        type="button"
        class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)] text-left cursor-pointer"
        onclick={(): void => router.goto('/disk-images/')}>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)]">
            <DiskImageIcon size="20" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Disk Images</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">Built bootable disk images</p>
          </div>
          <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--pd-button-primary-bg)] text-sm font-semibold">
            {diskImageCount}
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)]">
          View your built disk images in formats like QCOW2, RAW, ISO, AMI, and VMDK.
        </p>
      </button>
    </div>
  </div>

  <!-- Learn More Section -->
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">Learn More</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- OSBuild card -->
      <div class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white">
            <img src={osbuildImage} class="w-8 h-8 object-contain" alt="OSBuild" />
          </div>
          <div>
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Image Builder</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">osbuild.org</p>
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)] grow">
          Learn how to use bootc-image-builder to create disk images from containers.
        </p>
        <Button on:click={(): Promise<void> => bootcClient.openLink('https://osbuild.org/docs/user-guide/introduction/')} class="self-start mt-3">Read Guide</Button>
      </div>

      <!-- Red Hat card -->
      <div class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white">
            <img src={redhatImage} class="w-8 h-8 object-contain" alt="Red Hat" />
          </div>
          <div>
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Image Mode for RHEL</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">developers.redhat.com</p>
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)] grow">
          Introduction to image mode and bootable containers for Red Hat Enterprise Linux.
        </p>
        <Button on:click={(): Promise<void> => bootcClient.openLink('https://developers.redhat.com/articles/2024/05/07/image-mode-rhel-bootable-containers')} class="self-start mt-3">Read Article</Button>
      </div>

      <!-- Fedora card -->
      <div class="flex flex-col p-4 rounded-md bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)]">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white">
            <img src={fedoraImage} class="w-8 h-8 object-contain" alt="Fedora" />
          </div>
          <div>
            <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">Getting Started</h3>
            <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-70">docs.fedoraproject.org</p>
          </div>
        </div>
        <p class="text-sm text-[var(--pd-invert-content-card-text)] grow">
          Step-by-step guide to getting started with bootc on Fedora.
        </p>
        <Button on:click={(): Promise<void> => bootcClient.openLink('https://docs.fedoraproject.org/en-US/bootc/getting-started/')} class="self-start mt-3">Read Docs</Button>
      </div>
    </div>
  </div>
</DashboardPage>
