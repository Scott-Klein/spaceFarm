<template>
  <button
    @click="toggleCamera"
    class="fixed bottom-10 right-10 select-none rounded-lg border-2 border-purple-400/60 bg-slate-900/85 px-4 py-2 font-mono text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-sm transition-all hover:border-purple-400/80 hover:bg-slate-800/90 hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] active:scale-95"
  >
    <div class="flex items-center gap-2">
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
