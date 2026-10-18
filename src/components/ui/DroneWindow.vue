<template>
  <div class="fixed top-18 right-8 bg-slate-800 text-white">
    <p>drones: {{ game.drones.length }}</p>
    <p v-for="d in game.drones" :key="d.key">{{ d.type }} hp:{{ d.health }} cargo:{{ d.cargo }}</p>
  </div>
</template>

<script setup lang="ts">
import useGameStore from '@/stores/gameState';

const game = useGameStore();
</script>
