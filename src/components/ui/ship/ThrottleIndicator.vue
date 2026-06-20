<template>
  <div
    class="fixed bottom-10 left-[280px] flex select-none flex-col items-center gap-3 rounded-lg border-2 border-orange-400/60 bg-slate-900/85 p-4 font-mono text-orange-400 shadow-[0_0_20px_rgba(255,150,0,0.3)] backdrop-blur-sm"
  >
    <div class="text-[11px] font-bold uppercase tracking-[2px] opacity-70">THROTTLE</div>
    <div
      class="relative flex h-[150px] w-10 flex-col justify-end overflow-hidden rounded bg-orange-950/60"
    >
      <div
        class="w-full rounded bg-linear-to-b from-orange-400 to-orange-600 shadow-[0_0_15px_rgba(255,170,0,0.7)] transition-[height] duration-150 ease-out"
        :style="{ height: throttlePercentage + '%' }"
      ></div>
      <div class="pointer-events-none absolute inset-0 flex flex-col justify-between py-2">
        <div v-for="i in 5" :key="i" class="h-px w-full bg-white/20"></div>
      </div>
    </div>
    <div class="text-lg font-bold shadow-[0_0_10px_rgba(255,170,0,0.8)]">
      {{ throttlePercentage.toFixed(0) }}%
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

const throttlePercentage = computed(() => {
  return Math.max(0, Math.min(gameStore.player.throttle * 100, 100));
});
</script>
