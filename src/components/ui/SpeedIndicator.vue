<template>
  <div
    class="fixed bottom-10 left-10 min-w-[200px] select-none rounded-lg border-2 border-cyan-400/60 bg-slate-900/85 px-5 py-4 font-mono text-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.3)] backdrop-blur-sm"
  >
    <div class="mb-1 text-[11px] font-bold uppercase tracking-[2px] opacity-70">SPEED</div>
    <div class="mb-3 text-[32px] font-bold leading-none shadow-[0_0_10px_rgba(0,212,255,0.8)]">
      {{ formattedSpeed }}
    </div>
    <div class="mb-2 h-2 overflow-hidden rounded bg-slate-800/60">
      <div
        class="h-full rounded bg-linear-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(0,212,255,0.6)] transition-[width] duration-100 ease-out"
        :style="{ width: speedPercentage + '%' }"
      ></div>
    </div>
    <div class="text-right text-[10px] opacity-60">MAX: {{ maxSpeed.toFixed(2) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

const formattedSpeed = computed(() => {
  return gameStore.player.speed.toFixed(3);
});

const maxSpeed = computed(() => {
  return gameStore.player.maxSpeed;
});

const speedPercentage = computed(() => {
  return Math.min((gameStore.player.speed / gameStore.player.maxSpeed) * 100, 100);
});
</script>
