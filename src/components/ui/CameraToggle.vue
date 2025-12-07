<template>
  <button
    @click="toggleCamera"
    class="fixed bottom-10 right-10 select-none rounded-lg border-2 border-purple-400/60 bg-slate-900/85 px-4 py-2 font-mono text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-sm transition-all hover:border-purple-400/80 hover:bg-slate-800/90 hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] active:scale-95"
  >
    <div class="flex items-center gap-2">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path
          v-if="gameStore.cameraMode === 'free'"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          v-if="gameStore.cameraMode === 'free'"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
        <path
          v-if="gameStore.cameraMode === 'follow'"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <div class="flex flex-col items-start">
        <span class="text-[9px] font-bold uppercase tracking-[1.5px] opacity-50">CAMERA</span>
        <span class="text-[11px] font-bold uppercase leading-none">{{
          gameStore.cameraMode === 'free' ? 'FREE ORBIT' : 'LOCKED REAR'
        }}</span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

function toggleCamera() {
  gameStore.toggleCameraMode();
}
</script>
