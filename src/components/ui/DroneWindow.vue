<template>
  <div class="fixed top-18 right-8 bg-slate-800 text-white">
    <p>drones: {{ game.drones.length }}</p>
    <p @contextmenu.prevent.stop="openMenu($event, d)" v-for="d in game.drones" :key="d.key">{{ d.type }} hp:{{ d.health }} cargo:{{ d.cargo }}</p>
  </div>
</template>

<script setup lang="ts">
import type Drone from '@/engine/objects/ships/Drone';
import useGameStore from '@/stores/gameState';
import useUiStore from '@/stores/ui';
import type { DroneState, Marker } from '@/types/game';

const ui = useUiStore();
const game = useGameStore();

const openMenu = (event: MouseEvent, drone: DroneState) => {
  const m: Marker = {
    x: event.clientX,
    y: event.clientY,
    label: 'Drone',
    distance: 0,
    key: drone.key
  }

  ui.openMenu(event, m);
}
</script>
