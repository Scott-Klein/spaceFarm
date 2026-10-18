<template>
  <div class="absolute inset-0 w-full h-full pointer-events-none text-white">
    <div
      class="cursor-pointer absolute -translate-y-1/2 pointer-events-auto hover:outline outline-white/50"
      v-for="m in gameStore.markers"
      :key="`${m.key}`"
      :style="{ left: `${m.x}px`, top: `${m.y}px` }"
      @contextmenu.prevent.stop="uiStore.openMenu($event, m)"
    >
      x <span class="text-[9px] text-white/50">{{ formatDistance(m.distance) }}</span>
    </div>
    <ContextMenu />
  </div>
</template>

<script setup lang="ts">
import ContextMenu from '@/components/ui/menu/ContextMenu.vue';
import useGameStore from '@/stores/gameState';
import { onBeforeUnmount, onMounted } from 'vue';
import useUiStore from '@/stores/ui';
const gameStore = useGameStore();
const uiStore = useUiStore();

const formatDistance = (num: number) =>
  num > 1000 ? `${(num / 1000).toFixed(1)}k` : num.toFixed(0);



const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') uiStore.closeMenu();
};

onMounted(() => {
  window.addEventListener('pointerdown',uiStore.closeMenu);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', uiStore.closeMenu);
  window.removeEventListener('keydown', onKeydown);
});
</script>
