<template>
  <div class="fixed left-3 top-24 text-white">
    <p v-for="m in gameStore.markers" :key="m.label + m.x + m.y">{{ m.label }}</p>
  </div>
</template>

<script setup lang="ts">
import useGameStore from '@/stores/gameState';
const gameStore = useGameStore();
</script>
