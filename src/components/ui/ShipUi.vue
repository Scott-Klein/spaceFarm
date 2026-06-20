<template>
  <div class="fixed bottom-8 left-1/2 -translate-x-1/2 select-none text-white leading-none">
    <div class="relative flex gap-12 bg-slate-800 p-2">
      <div class="flex flex-col gap-1 text-xs">
        <!--The speed / max speed-->
        <span class="text-xs">Speed</span>
        <span class="text-md">
          {{ formattedSpeed }} / {{ maxSpeed.toFixed(0) }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-xs">Throttle</span>
        <span class="text-m">{{ throttlePercentage.toFixed(0) }}%</span>
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

// I might need percentage of max speed some time in the future
const _speedPercentage = computed(() => {
  return Math.min((gameStore.player.speed / gameStore.player.maxSpeed) * 100, 100);
});

const throttlePercentage = computed(() => {
  return Math.max(0, Math.min(gameStore.player.throttle * 100, 100));
});
</script>
