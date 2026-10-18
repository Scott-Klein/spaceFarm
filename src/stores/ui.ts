import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Vec2 } from '@babylonjs/lite';
import type { CommandType, Marker } from '@/types/game';
import useGameStore from './gameState';

const useUiStore = defineStore('ui', () => {
  const gameState = useGameStore();
  const contextMenuOpen = ref<boolean>(false);
  const contextMenuCords = ref<Vec2>({ x: 0, y: 0 });
  const menuMarker = ref<Marker | null>(null);

  const openMenu = (event: MouseEvent, marker: Marker) => {
    menuMarker.value = marker;
    contextMenuCords.value = { x: event.clientX, y: event.clientY };
    contextMenuOpen.value = true;
  };

  const closeMenu = () => {
    contextMenuOpen.value = false;
    menuMarker.value = null;
  };

  const selectMenuItem = (command: CommandType) => {
    if (menuMarker.value) {
      gameState.pushCommand(menuMarker.value?.key, command)
    }

    contextMenuOpen.value = false;
  }

  return {
    contextMenuOpen,
    contextMenuCords,
    openMenu,
    closeMenu,
    menuMarker,
    selectMenuItem
  };
});

export default useUiStore;
