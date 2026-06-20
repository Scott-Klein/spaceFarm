<template>
  <button
    @click="toggleCamera"
    class="fixed bottom-10 right-10 select-none bg-slate-800 px-4 py-2"
  >
    <div class="flex items-center gap-2 text-white">
      <PhEye v-if="gameStore.cameraMode === 'free'" :size="20" weight="bold" />
      <PhLock v-else :size="20" weight="bold" />
    </div>
  </button>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameState';
import { PhEye, PhLock } from '@phosphor-icons/vue';

const gameStore = useGameStore();

function toggleCamera() {
  gameStore.toggleCameraMode();
}
</script>
