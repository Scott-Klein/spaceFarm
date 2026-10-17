<template>
  <div class="fixed bottom-8 left-1/3 -translate-x-1/2 bg-blue-900/80 w-80 h-10 p-1 flex items-stretched grid grid-cols-10 gap-1" ><div v-for="seg in segments" :key="seg" class="bg-blue-500/30"></div></div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import useGameStore from '@/stores/gameState';
const gameState = useGameStore();

const segments = computed(()=> {
  return Math.ceil(gameState.player.throttle / 10);
})
</script>