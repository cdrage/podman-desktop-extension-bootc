<script lang="ts">
export interface Step {
  id: string;
  label: string;
}

interface Props {
  value: string;
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

let { value, steps, onStepClick }: Props = $props();

function handleStepClick(stepId: string, stepIndex: number): void {
  const currentIndex = steps.findIndex(s => s.id === value);
  // Only allow clicking on previous steps (not future steps)
  if (stepIndex < currentIndex && onStepClick) {
    onStepClick(stepId);
  }
}

function isClickable(stepIndex: number): boolean {
  const currentIndex = steps.findIndex(s => s.id === value);
  return stepIndex < currentIndex;
}
</script>

<div class="flex items-center" aria-label="stepper">
  {#each steps as step, index (step.id)}
    <div class="flex items-center">
      <button
        type="button"
        class="flex items-center justify-center w-6 h-6 rounded-full border-2 mr-2 text-xs font-bold transition-all {value ===
        step.id
          ? 'border-[var(--pd-button-primary-bg)] bg-[var(--pd-button-primary-bg)] text-white'
          : steps.findIndex(s => s.id === value) > index
            ? 'border-[var(--pd-state-success)] bg-[var(--pd-state-success)] text-white hover:opacity-80 cursor-pointer'
            : 'border-[var(--pd-content-card-border)] text-[var(--pd-content-card-text)] cursor-default'}"
        disabled={!isClickable(index)}
        onclick={(): void => handleStepClick(step.id, index)}
        title={isClickable(index) ? `Go back to ${step.label}` : ''}>
        {index + 1}
      </button>
      <button
        type="button"
        class="text-sm transition-all {value === step.id
          ? 'text-[var(--pd-button-primary-bg)] font-semibold'
          : isClickable(index)
            ? 'text-[var(--pd-content-card-text)] hover:text-[var(--pd-button-primary-bg)] cursor-pointer'
            : 'text-[var(--pd-content-card-text)] cursor-default'}"
        disabled={!isClickable(index)}
        onclick={(): void => handleStepClick(step.id, index)}
        title={isClickable(index) ? `Go back to ${step.label}` : ''}>
        {step.label}
      </button>
    </div>
    {#if index < steps.length - 1}
      <div class="grow mx-4 h-0.5 bg-[var(--pd-content-card-border)]"></div>
    {/if}
  {/each}
</div>
