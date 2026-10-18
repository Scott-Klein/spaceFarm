<template>
  <div
    v-if="uiStore.contextMenuOpen"
    class="fixed pointer-events-auto bg-gray-900/90 w-24 text-[9px]"
    :style="{ left: `${uiStore.contextMenuCords.x}px`, top: `${uiStore.contextMenuCords.y}px` }"
    @pointerdown.stop
  >
    <ul class="list-disc-none cursor-pointer">
      <li class="px-1 py-0.5 hover:bg-white/10 transition-colors" @click="uiStore.selectMenuItem('Align')">Align to</li>
      <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">Some other idea here</li>
      <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">Another idea later</li>
      <li class="px-1 py-0.5 hover:bg-white/10 transition-colors">And so on</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import useUiStore from '@/stores/ui';

const uiStore = useUiStore();

</script>
