<script lang="ts">
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import type { ImageInfoUI } from './ImageInfoUI';
import { faBuilding, faPlay, faTrash } from '@fortawesome/free-solid-svg-icons';
import { gotoImageBuild } from '../navigation';
import { bootcClient } from '/@/api/client';

interface Props {
  object: ImageInfoUI;
}

let { object }: Props = $props();

async function goToImageBuild(): Promise<void> {
  await gotoImageBuild(object.name, object.tag);
}

async function deleteImage(): Promise<void> {
  object.status = 'deleting';
  await bootcClient.deleteImage(object.engineId, object.id);
}

async function testBootcImage(): Promise<void> {
  // Build the full image reference (name:tag)
  const imageRef = object.tag ? `${object.name}:${object.tag}` : object.name;
  await bootcClient.testBootcImage(imageRef, object.engineId);
}
</script>

<ListItemButtonIcon title="Test Image" onClick={testBootcImage} icon={faPlay} />

<ListItemButtonIcon title="Build Disk Image" onClick={goToImageBuild} icon={faBuilding} />

<ListItemButtonIcon title="Delete Image" enabled={object.status === 'unused'} onClick={deleteImage} icon={faTrash} />
