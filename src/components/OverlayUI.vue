<template>
  <div class="absolute inset-0 w-full h-full pointer-events-none text-white">
    <div
      class="absolute"
      v-for="m in gameStore.markers"
      :key="`${m.x}${m.y}${m.label}`"
      :style="{ left: `${m.x}px`, top: `${m.y}px` }"
    >
      x
    </div>
  </div>
</template>

<script setup lang="ts">
import useGameStore from '@/stores/gameState';

const gameStore = useGameStore();
</script>
