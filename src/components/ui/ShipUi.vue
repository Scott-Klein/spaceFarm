<template>
  <div class="fixed bottom-8 left-1/2 -translate-x-1/2 select-none">
    <div class="relative flex-col items-center gap-1 bg-slate-800">
      <span
        class="text-3xl font-bold tabular-nums leading-none drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]"
      >
        {{ formattedSpeed }} / {{ maxSpeed.toFixed(0) }}
      </span>

      <div class="text-3xl font-bold">
        {{ throttlePercentage.toFixed(0) }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

const formattedSpeed = computed(() => {
  return gameStore.player.speed.toFixed(1);
});

const maxSpeed = computed(() => {
  return gameStore.player.maxSpeed;
});

const speedPercentage = computed(() => {
  return Math.min((gameStore.player.speed / gameStore.player.maxSpeed) * 100, 100);
});

const throttlePercentage = computed(() => {
  return Math.max(0, Math.min(gameStore.player.throttle * 100, 100));
});
</script>
