<template>
  <div class="absolute inset-0 w-full h-full pointer-events-none text-white">
    <div
      class="absolute -translate-y-1/2"
      v-for="m in gameStore.markers"
      :key="`${m.x}${m.y}${m.label}`"
      :style="{ left: `${m.x}px`, top: `${m.y}px` }"
    >
      x <span class="text-[9px] text-white/50">{{ formatDistance(m.distance) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import useGameStore from '@/stores/gameState';

const gameStore = useGameStore();

const formatDistance = (num: number) =>
  num > 1000 ? `${(num / 1000).toFixed(1)}k` : num.toFixed(0);
</script>
