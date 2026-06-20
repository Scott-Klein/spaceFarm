<template>
  <div class="fixed bottom-10 left-10 bg-slate-800 text-white">
    <p>crew:{{ shipData.crewList }}</p>
    <p>drones:{{ shipData.drones }}</p>
    <p>storage:{{ shipData.storage }}</p>
  </div>
</template>

<script setup lang="ts">
import { createDefaultShip, type Ship } from '@/engine/game/Ship';
import { ref } from 'vue';

const shipData = ref<Ship>(createDefaultShip());
</script>
