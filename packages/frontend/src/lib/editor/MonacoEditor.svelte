<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import * as monaco from 'monaco-editor';
import { bootcClient } from '../../api/client';

interface Props {
  value: string;
  language?: string;
  readonly?: boolean;
  height?: string;
  onchange?: (value: string) => void;
}

let { value = $bindable(), language = 'dockerfile', readonly = false, height = '300px', onchange }: Props = $props();

let editorContainer = $state<HTMLDivElement>();
let editor = $state<monaco.editor.IStandaloneCodeEditor>();

// Configure Monaco editor theme to match Podman Desktop dark theme
function setupMonacoTheme(): void {
  monaco.editor.defineTheme('podman-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorCursor.foreground': '#aeafad',
      'editor.selectionBackground': '#264f78',
      'editor.lineHighlightBackground': '#2a2d2e',
    },
  });
}

onMount(async () => {
  if (!editorContainer) return;

  // Fetch editor settings from Podman Desktop configuration
  const fontSize = ((await bootcClient.getConfigurationValue('editor', 'fontSize')) as number) || 13;
  const tabSize = ((await bootcClient.getConfigurationValue('editor', 'tabSize')) as number) || 2;
  const wordWrap = ((await bootcClient.getConfigurationValue('editor', 'wordWrap')) as string) || 'on';
  const lineNumbers = ((await bootcClient.getConfigurationValue('editor', 'lineNumbers')) as string) || 'on';

  setupMonacoTheme();

  editor = monaco.editor.create(editorContainer, {
    value: value,
    language: language,
    theme: 'podman-dark',
    readOnly: readonly,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: fontSize,
    lineNumbers: lineNumbers as monaco.editor.LineNumbersType,
    automaticLayout: true,
    wordWrap: wordWrap as 'on' | 'off' | 'wordWrapColumn' | 'bounded',
    tabSize: tabSize,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
    },
  });

  // Listen for content changes
  editor.onDidChangeModelContent(() => {
    const newValue = editor?.getValue() ?? '';
    if (newValue !== value) {
      value = newValue;
      onchange?.(newValue);
    }
  });
});

onDestroy(() => {
  editor?.dispose();
});

// Update editor value when prop changes from outside
$effect(() => {
  if (editor && editor.getValue() !== value) {
    editor.setValue(value);
  }
});
</script>

<div bind:this={editorContainer} class="w-full rounded-lg overflow-hidden border border-[var(--pd-input-field-stroke)]" style="height: {height}"></div>
