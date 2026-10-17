<template>
  <div class="absolute inset-0 w-full h-full pointer-events-none text-white">
    <div
      class="cursor-pointer absolute -translate-y-1/2 pointer-events-auto hover:outline outline-white/50"
      v-for="m in gameStore.markers"
      :key="`${m.label}`"
      :style="{ left: `${m.x}px`, top: `${m.y}px` }"
      @contextmenu.prevent.stop="openMenu($event, m)"
    >
      x <span class="text-[9px] text-white/50">{{ formatDistance(m.distance) }}</span>
    </div>
    <div
      v-if="menuOpen"
      class="fixed pointer-events-auto bg-gray-900/90 w-24 text-[9px] "
      :style="{ left: `${menuCords.x}px`, top: `${menuCords.y}px` }"
      @pointerdown.stop
    >
      <ul class="list-disc-none cursor-pointer">
        <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">Align to</li>
        <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">Some other idea here</li>
        <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">Another idea later</li>
        <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">And so on</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import useGameStore, { type Marker } from '@/stores/gameState';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const gameStore = useGameStore();

const formatDistance = (num: number) =>
  num > 1000 ? `${(num / 1000).toFixed(1)}k` : num.toFixed(0);

const menuOpen = ref<boolean>(false);
const menuCords = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const menuMarker = ref<Marker | null>(null);

const openMenu = (event: MouseEvent, marker: Marker) => {
  menuMarker.value = marker;
  menuCords.value = { x: event.clientX, y: event.clientY };
  menuOpen.value = true;
};

const closeMenu = () => {
  menuOpen.value = false;
  menuMarker.value = null;
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu();
};

onMounted(() => {
  window.addEventListener('pointerdown', closeMenu);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeMenu);
  window.removeEventListener('keydown', onKeydown);
});
</script>
