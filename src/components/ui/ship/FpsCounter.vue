<template>
  <div class="fixed top-15 left-0 text-white font-bold">
    FPS: {{ game.frameRate }}
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameState';

const game = useGameStore();
</script>