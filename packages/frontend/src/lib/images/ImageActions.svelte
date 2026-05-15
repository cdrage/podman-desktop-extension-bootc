<script lang="ts">
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import type { ImageInfoUI } from './ImageInfoUI';
import { faPlay, faTrash } from '@fortawesome/free-solid-svg-icons';
import { gotoImageBuild, gotoTestImage } from '../navigation';
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
  await gotoTestImage(object.name, object.tag, object.engineId);
}
</script>

<ListItemButtonIcon title="Run Image" onClick={testBootcImage} icon={faPlay} />

<!--<ListItemButtonIcon title="Build Disk Image" onClick={goToImageBuild} icon={faBuilding} />-->

<ListItemButtonIcon title="Delete Image" enabled={object.status === 'unused'} onClick={deleteImage} icon={faTrash} />
