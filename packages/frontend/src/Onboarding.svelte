<script lang="ts">
import './app.css';
import '@xterm/xterm/css/xterm.css';
import { Button, FormPage, Input, ErrorMessage } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import { onMount, onDestroy, tick } from 'svelte';
import { SvelteSet, SvelteMap } from 'svelte/reactivity';
import { bootcClient } from './api/client';
import type { BaseImage, ContainerfileExample } from '/@shared/src/models/baseImages';
import Stepper from './lib/stepper/Stepper.svelte';
import DiskImageIcon from './lib/DiskImageIcon.svelte';
import { goToImages } from './lib/navigation';
import MonacoEditor from './lib/editor/MonacoEditor.svelte';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getTerminalTheme } from './lib/upstream/terminal-theme';

// Logo imports
import fedoraLogo from './lib/dashboard/fedora.png';
import redhatLogo from './lib/dashboard/redhat.png';
import centosLogo from './lib/dashboard/centos.png';

// Map base image IDs to logos
function getLogoForImage(imageId: string): string | undefined {
  if (imageId.startsWith('fedora')) return fedoraLogo;
  if (imageId.startsWith('rhel')) return redhatLogo;
  if (imageId.startsWith('centos')) return centosLogo;
  return undefined;
}

// Step definitions
type StepId = 'select-base' | 'edit-containerfile' | 'build-container' | 'build-disk' | 'complete';

const STEPS = [
  { id: 'select-base', label: 'Select Base Image' },
  { id: 'edit-containerfile', label: 'Edit Containerfile' },
  { id: 'build-container', label: 'Build Container' },
  { id: 'build-disk', label: 'Test or Build' },
];

// State
let currentStep = $state<StepId>('select-base');
let baseImages = $state<BaseImage[]>([]);
let containerfileExamples = $state<ContainerfileExample[]>([]);
let selectedBaseImage = $state<BaseImage | undefined>(undefined);
let selectedExamples: SvelteSet<string> = new SvelteSet();
let containerfileContent = $state('');
let imageName = $state('my-bootc-image');
let imageTag = $state('latest');
let selectedArch = $state<string>('');
let buildInProgress = $state(false);
let buildError = $state('');
let containerBuildComplete = $state(false);
let buildLogs = $state('');
let builtImageEngineId = $state('');
let builtImageFullName = $state(''); // The actual full image name from RepoTags (may include localhost/)

// Terminal for build logs
let logsXtermDiv = $state<HTMLDivElement>();
let logsTerminal = $state<Terminal>();
let termFit = $state<FitAddon>();
let resizeObserver = $state<ResizeObserver>();
let logPollInterval: ReturnType<typeof setInterval> | undefined;
let lastLogLength = 0;

onMount(async () => {
  baseImages = await bootcClient.getBaseImages();
  containerfileExamples = await bootcClient.getContainerfileExamples();

  // Get the default architecture
  const hostArch = await bootcClient.getArch();
  if (hostArch === 'arm64') {
    selectedArch = 'arm64';
  } else if (hostArch === 'x64') {
    selectedArch = 'amd64';
  }
});

onDestroy(() => {
  if (logsXtermDiv) {
    resizeObserver?.unobserve(logsXtermDiv);
  }
  logsTerminal?.dispose();
  if (logPollInterval) {
    clearInterval(logPollInterval);
  }
});

// Poll for new logs and write them to the terminal
async function pollLogs(): Promise<void> {
  try {
    const logs = await bootcClient.getContainerBuildLogs();
    if (logs.length > lastLogLength) {
      const newLogs = logs.substring(lastLogLength);
      lastLogLength = logs.length;
      buildLogs = logs;

      if (logsTerminal) {
        // Convert newlines for terminal display
        const formattedLog = newLogs.replace(/\n/g, '\r\n');
        logsTerminal.write(formattedLog);
      }
    }
  } catch (e) {
    console.error('Error polling logs:', e);
  }
}

async function initTerminal(): Promise<void> {
  if (!logsXtermDiv || logsTerminal) return;

  const fontSize = ((await bootcClient.getConfigurationValue('terminal', 'integrated.fontSize')) as number) || 13;
  const lineHeight = ((await bootcClient.getConfigurationValue('terminal', 'integrated.lineHeight')) as number) || 1.2;

  logsTerminal = new Terminal({
    fontSize: fontSize,
    lineHeight: lineHeight,
    disableStdin: true,
    theme: getTerminalTheme(),
    convertEol: true,
  });
  termFit = new FitAddon();
  logsTerminal.loadAddon(termFit);
  logsTerminal.open(logsXtermDiv);
  logsTerminal.write('\x1b[?25l'); // Hide cursor

  window.addEventListener('resize', () => {
    termFit?.fit();
  });
  termFit.fit();

  resizeObserver = new ResizeObserver(() => {
    termFit?.fit();
  });
  resizeObserver.observe(logsXtermDiv);
}

function writeToTerminal(message: string): void {
  if (logsTerminal) {
    logsTerminal.write(message);
    buildLogs += message;
  }
}

function selectBaseImage(image: BaseImage): void {
  selectedBaseImage = image;
  selectedExamples = new SvelteSet();
  updateContainerfileContent();
  imageName = `my-${image.id}-bootc`;
}

function toggleExample(exampleId: string): void {
  if (selectedExamples.has(exampleId)) {
    selectedExamples.delete(exampleId);
  } else {
    selectedExamples.add(exampleId);
  }
  updateContainerfileContent();
}

function updateContainerfileContent(): void {
  if (!selectedBaseImage) return;

  const fromLine = `FROM ${selectedBaseImage.image}:${selectedBaseImage.tag}\n`;

  if (selectedExamples.size === 0) {
    containerfileContent = `${fromLine}
# Add your customizations here
# Example: Install packages
# RUN dnf install -y vim htop

# Example: Enable services
# RUN systemctl enable my-service
`;
    return;
  }

  const examples = Array.from(selectedExamples)
    .map(id => containerfileExamples.find(e => e.id === id))
    .filter((e): e is ContainerfileExample => e !== undefined);

  const exampleContent = examples.map(e => `\n${e.containerfile}`).join('\n');

  containerfileContent = `${fromLine}${exampleContent}
`;
}

// Group examples by category for display
function getExamplesByCategory(): SvelteMap<string, ContainerfileExample[]> {
  const grouped = new SvelteMap<string, ContainerfileExample[]>();
  for (const example of containerfileExamples) {
    const existing = grouped.get(example.category) ?? [];
    existing.push(example);
    grouped.set(example.category, existing);
  }
  return grouped;
}

function goToNext(): void {
  if (currentStep === 'select-base' && selectedBaseImage) {
    currentStep = 'edit-containerfile';
  } else if (currentStep === 'edit-containerfile') {
    currentStep = 'build-container';
  } else if (currentStep === 'build-container' && containerBuildComplete) {
    currentStep = 'build-disk';
  }
}

function goBack(): void {
  if (currentStep === 'edit-containerfile') {
    currentStep = 'select-base';
  } else if (currentStep === 'build-container') {
    currentStep = 'edit-containerfile';
    containerBuildComplete = false;
    buildError = '';
    buildLogs = '';
    logsTerminal?.clear();
  } else if (currentStep === 'build-disk') {
    currentStep = 'build-container';
  }
}

function handleStepClick(stepId: string): void {
  const stepIndex = STEPS.findIndex(s => s.id === stepId);
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  if (stepIndex < currentIndex) {
    // Reset state when going back to select-base or edit-containerfile
    if (stepId === 'select-base' || stepId === 'edit-containerfile') {
      containerBuildComplete = false;
      buildError = '';
      buildLogs = '';
    }
    currentStep = stepId as StepId;
  }
}

async function buildContainerImage(): Promise<void> {
  buildInProgress = true;
  buildError = '';
  buildLogs = '';
  lastLogLength = 0;

  // Clear any previous build logs on the backend
  await bootcClient.clearContainerBuildLogs();

  // Wait for DOM to update so logsXtermDiv is available
  await tick();

  // Initialize terminal for logs
  await initTerminal();
  logsTerminal?.clear();
  writeToTerminal(`Building container image: ${imageName}:${imageTag}\r\n`);
  writeToTerminal(`Architecture: ${selectedArch}\r\n`);
  writeToTerminal('---\r\n');

  // Start polling for logs
  logPollInterval = setInterval(pollLogs, 500);

  try {
    const fullImageTag = `${imageName}:${imageTag}`;
    writeToTerminal(`Starting build for ${fullImageTag}...\r\n\r\n`);

    await bootcClient.buildContainerImage({
      imageTag: fullImageTag,
      containerfileContent,
      arch: selectedArch,
    });

    // Final poll to get any remaining logs
    await pollLogs();

    writeToTerminal('\r\n---\r\n');
    writeToTerminal('\x1b[32mBuild completed successfully!\x1b[0m\r\n');
    containerBuildComplete = true;

    // Get the engineId and full image name from the newly built image
    const images = await bootcClient.listBootcImages();
    const expectedTag = `${imageName}:${imageTag}`;
    const builtImage = images.find(img =>
      img.RepoTags?.some(
        tag => tag === expectedTag || tag === `localhost/${expectedTag}` || tag.endsWith(`/${expectedTag}`),
      ),
    );
    if (builtImage) {
      builtImageEngineId = builtImage.engineId;
      // Get the actual full image name from RepoTags
      const matchingTag = builtImage.RepoTags?.find(
        tag => tag === expectedTag || tag === `localhost/${expectedTag}` || tag.endsWith(`/${expectedTag}`),
      );
      if (matchingTag) {
        builtImageFullName = matchingTag;
      }
    }

    await bootcClient.telemetryLogUsage('onboarding-build-container', { baseImage: selectedBaseImage?.id });
  } catch (error) {
    // Final poll to get any error logs
    await pollLogs();

    const errorMsg = String(error);
    writeToTerminal('\r\n---\r\n');
    writeToTerminal(`\x1b[31mBuild failed: ${errorMsg}\x1b[0m\r\n`);
    buildError = errorMsg;
    await bootcClient.telemetryLogError('onboarding-build-container-error', { error: errorMsg });
  } finally {
    // Stop polling
    if (logPollInterval) {
      clearInterval(logPollInterval);
      logPollInterval = undefined;
    }
    buildInProgress = false;
  }
}

async function cancelContainerBuild(): Promise<void> {
  // Stop polling for logs
  if (logPollInterval) {
    clearInterval(logPollInterval);
    logPollInterval = undefined;
  }

  // Notify backend of cancellation
  await bootcClient.cancelContainerBuild();

  // Final poll to show cancellation message
  await pollLogs();

  writeToTerminal('\r\n\x1b[33mBuild cancelled by user.\x1b[0m\r\n');

  buildInProgress = false;
  buildError = 'Build cancelled by user';
}

function goToTestImage(): void {
  if (builtImageEngineId && builtImageFullName) {
    // Parse the full image name to get name and tag
    const lastColon = builtImageFullName.lastIndexOf(':');
    const fullName = lastColon > 0 ? builtImageFullName.substring(0, lastColon) : builtImageFullName;
    const tag = lastColon > 0 ? builtImageFullName.substring(lastColon + 1) : 'latest';
    const encodedName = encodeURIComponent(fullName);
    const encodedTag = encodeURIComponent(tag);
    const encodedEngineId = encodeURIComponent(builtImageEngineId);
    router.goto(`/images/test/${encodedName}/${encodedTag}/${encodedEngineId}`);
  } else {
    // Fallback to images list if engineId not available
    router.goto('/images');
  }
}

function goToBuildDiskImage(): void {
  // Use the full image name if available, otherwise fall back to user-entered name
  if (builtImageFullName) {
    const lastColon = builtImageFullName.lastIndexOf(':');
    const fullName = lastColon > 0 ? builtImageFullName.substring(0, lastColon) : builtImageFullName;
    const tag = lastColon > 0 ? builtImageFullName.substring(lastColon + 1) : 'latest';
    const encodedName = encodeURIComponent(fullName);
    const encodedTag = encodeURIComponent(tag);
    router.goto(`/disk-images/build/${encodedName}/${encodedTag}`);
  } else {
    const encodedName = encodeURIComponent(imageName);
    const encodedTag = encodeURIComponent(imageTag);
    router.goto(`/disk-images/build/${encodedName}/${encodedTag}`);
  }
}
</script>

<FormPage
  title="Interactive Build"
  inProgress={buildInProgress}
  breadcrumbLeftPart="Images"
  breadcrumbRightPart="Interactive Build"
  onclose={goToImages}
  onbreadcrumbClick={goToImages}>
  {#snippet icon()}
    <DiskImageIcon size="30px" />
  {/snippet}

  {#snippet content()}
    <div class="p-5 min-w-full h-fit">
      <div class="bg-[var(--pd-content-card-bg)] pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg">
        <!-- Stepper -->
        <div class="mb-6">
          <Stepper value={currentStep} steps={STEPS} onStepClick={handleStepClick} />
        </div>

        <!-- Step 1: Select Base Image -->
        {#if currentStep === 'select-base'}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
              Select a Base Image
            </h2>
            <p class="text-sm text-[var(--pd-content-card-text)]">
              Choose a base bootable container image to start with. You can customize the Containerfile in the next
              step.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {#each baseImages as image (image.id)}
                <button
                  type="button"
                  class="flex flex-col p-4 rounded-md text-left transition-all bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)] {selectedBaseImage?.id === image.id
                    ? 'ring-2 ring-[var(--pd-button-primary-bg)]'
                    : ''}"
                  onclick={(): void => selectBaseImage(image)}>
                  <div class="flex items-center gap-3 mb-2">
                    <div class="w-8 h-8 rounded-md flex items-center justify-center bg-white overflow-hidden">
                      {#if getLogoForImage(image.id)}
                        <img src={getLogoForImage(image.id)} alt={image.name} class="w-6 h-6 object-contain" />
                      {:else}
                        <svg class="w-4 h-4 text-[var(--pd-button-primary-bg)]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"></path>
                        </svg>
                      {/if}
                    </div>
                    <div class="flex-1">
                      <h3 class="font-semibold text-[var(--pd-invert-content-card-text)]">{image.name}</h3>
                    </div>
                    {#if selectedBaseImage?.id === image.id}
                      <div class="w-6 h-6 rounded-full bg-[var(--pd-button-primary-bg)] flex items-center justify-center">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                        </svg>
                      </div>
                    {/if}
                  </div>
                  <p class="text-sm text-[var(--pd-invert-content-card-text)] opacity-80 grow">{image.description}</p>
                  <p class="text-xs text-[var(--pd-invert-content-card-text)] opacity-60 mt-2">
                    {image.image}:{image.tag}
                  </p>
                </button>
              {/each}
            </div>

            <div class="flex justify-end mt-6">
              <Button disabled={!selectedBaseImage} on:click={goToNext}>Next</Button>
            </div>
          </div>
        {/if}

        <!-- Step 2: Edit Containerfile -->
        {#if currentStep === 'edit-containerfile'}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">Edit Containerfile</h2>
            <div class="space-y-2">
              <span class="text-sm font-medium text-[var(--pd-content-card-header-text)]">Snippets</span>
              <p class="text-xs text-[var(--pd-content-card-text)] opacity-70">Select one or more Containerfile snippets to add</p>
              <div class="flex flex-wrap gap-2 p-3 rounded-lg bg-[var(--pd-content-card-inset-bg)] border border-[var(--pd-content-card-border)]">
                {#each containerfileExamples as example (example.id)}
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all {selectedExamples.has(example.id)
                      ? 'bg-[var(--pd-button-primary-bg)] text-white'
                      : 'bg-[var(--pd-content-card-bg)] text-[var(--pd-content-card-text)] hover:bg-[var(--pd-content-card-hover-bg)] border border-[var(--pd-content-card-border)]'}"
                    onclick={(): void => toggleExample(example.id)}
                    title={example.description}>
                    {example.name}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Containerfile Editor -->
            <div class="space-y-3">
              <span class="text-sm font-medium text-[var(--pd-content-card-header-text)]">Containerfile</span>
              <MonacoEditor bind:value={containerfileContent} language="dockerfile" height="300px" />
            </div>

            <div class="flex justify-between mt-6">
              <Button type="secondary" on:click={goBack}>Back</Button>
              <Button disabled={!containerfileContent.trim()} on:click={goToNext}>Next</Button>
            </div>
          </div>
        {/if}

        <!-- Step 3: Build Container Image -->
        {#if currentStep === 'build-container'}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">Build Container Image</h2>
            <p class="text-sm text-[var(--pd-content-card-text)]">
              Configure and build your bootable container image.
            </p>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  for="image-name"
                  class="block mb-2 text-sm font-medium text-[var(--pd-content-card-header-text)]">
                  Image Name
                </label>
                <Input
                  id="image-name"
                  bind:value={imageName}
                  placeholder="my-bootc-image"
                  disabled={containerBuildComplete || buildInProgress}
                  class="w-full" />
              </div>
              <div>
                <label for="image-tag" class="block mb-2 text-sm font-medium text-[var(--pd-content-card-header-text)]">
                  Tag
                </label>
                <Input
                  id="image-tag"
                  bind:value={imageTag}
                  placeholder="latest"
                  disabled={containerBuildComplete || buildInProgress}
                  class="w-full" />
              </div>
            </div>

            <div>
              <span class="block mb-2 text-sm font-medium text-[var(--pd-content-card-header-text)]">Architecture</span>
              <div class="flex items-center space-x-4">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    bind:group={selectedArch}
                    value="arm64"
                    disabled={containerBuildComplete || buildInProgress}
                    class="sr-only peer" />
                  <div
                    class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]"></div>
                  <span class={containerBuildComplete || buildInProgress ? 'text-[var(--pd-input-field-disabled-text)]' : ''}
                    >ARM64</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    bind:group={selectedArch}
                    value="amd64"
                    disabled={containerBuildComplete || buildInProgress}
                    class="sr-only peer" />
                  <div
                    class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]"></div>
                  <span class={containerBuildComplete || buildInProgress ? 'text-[var(--pd-input-field-disabled-text)]' : ''}
                    >AMD64</span>
                </label>
              </div>
            </div>

            <!-- Build Logs Terminal -->
            {#if buildInProgress || buildLogs}
              <div class="space-y-2">
                <span class="text-sm font-medium text-[var(--pd-content-card-header-text)]">Build Output</span>
                <div
                  class="min-w-full flex flex-col p-[5px] rounded-lg bg-[var(--pd-terminal-background)]"
                  style="height: 200px;"
                  bind:this={logsXtermDiv}></div>
              </div>
            {/if}

            {#if buildError}
              <ErrorMessage error={buildError} />
            {/if}

            <div class="flex justify-between mt-6">
              <Button type="secondary" on:click={goBack} disabled={buildInProgress}>Back</Button>
              <div class="flex space-x-2">
                {#if !containerBuildComplete}
                  {#if buildInProgress}
                    <Button type="secondary" on:click={cancelContainerBuild}>
                      Cancel
                    </Button>
                  {/if}
                  <Button
                    on:click={buildContainerImage}
                    disabled={!imageName.trim() || !imageTag.trim() || buildInProgress}
                    inProgress={buildInProgress}>
                    Build Container Image
                  </Button>
                {:else}
                  <Button on:click={goToNext}>Next</Button>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Step 4: Test or Build -->
        {#if currentStep === 'build-disk'}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">Test or Build Disk Image</h2>
            <p class="text-sm text-[var(--pd-content-card-text)]">
              Your container image <strong>{imageName}:{imageTag}</strong> has been built successfully. You can now test it or create a bootable disk image.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <!-- Run Image Option -->
              <div class="p-4 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)]">
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)] mb-2">Run Image</h3>
                <p class="text-sm text-[var(--pd-content-card-text)] mb-4">
                  Quickly run your bootable container with a shell or systemd for testing.
                </p>
                <Button class="w-full" on:click={goToTestImage}>Run Image</Button>
              </div>

              <!-- Build Disk Image Option -->
              <div class="p-4 rounded-lg bg-[var(--pd-content-card-carousel-card-bg)] border border-[var(--pd-content-card-border)]">
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)] mb-2">Build Disk Image</h3>
                <p class="text-sm text-[var(--pd-content-card-text)] mb-4">
                  Create a bootable disk image (QCOW2, RAW, ISO) that can be used to launch a virtual machine.
                </p>
                <Button class="w-full" on:click={goToBuildDiskImage}>Build Disk Image</Button>
              </div>
            </div>

            <div class="flex justify-start mt-6">
              <Button type="secondary" on:click={goBack}>Back</Button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/snippet}
</FormPage>
