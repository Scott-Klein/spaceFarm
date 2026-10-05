<template>
  <div class="flex flex-1 min-h-0 w-full select-none">
    <canvas
      ref="canvasRef"
      touch-action="none"
      class="h-full flex-5 min-h-0 min-w-0 outline-none"
    ></canvas>
    <div class="flex-1">
      <LogWindow />
    </div>

    <ShipStatus />
    <ShipUi />
    <CameraToggle />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import setupBabylonScene from '@/composables/useBabylonScene';
import { GameEngine, SceneBuilder } from '@/engine';
import { useGameStore } from '@/stores/gameState';
import LogWindow from '@/components/LogWindow.vue';
import ShipUi from '@/components/ui/ship/ShipUi.vue';
import CameraToggle from '@/components/ui/CameraToggle.vue';
import ShipStatus from '@/components/ui/ship/ShipStatus.vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const gameStore = useGameStore();
let babylonSetupResult: Awaited<ReturnType<typeof setupBabylonScene>>;
let gameEngine: GameEngine;
let unmounted = false;
onMounted(async () => {
  if (!canvasRef.value) {
    return;
  }
  try {
  babylonSetupResult = await setupBabylonScene({
    canvas: canvasRef.value,
    onSceneReady: async () => {
      gameEngine = new GameEngine();

      gameEngine.setStateUpdateCallback((state) => {
        gameStore.updatePlayerState(state);
      });

      const inputManager = gameEngine.getInputManager();
      inputManager.onCommand('toggleCamera', () => {
        if (inputManager.wasCommandJustPressed('toggleCamera')) {
          gameStore.toggleCameraMode();
        }
      });

      const sceneBuilder = new SceneBuilder(gameEngine);
      await sceneBuilder.buildScene();
    },
  });
  // unmounted (or hot-reloaded) while we were still setting up: tear this engine down
  if (unmounted) babylonSetupResult.dispose();
  } catch (e) {
    console.error('[dbg] setup FAILED', e);
  }
});

onUnmounted(() => {
  unmounted = true;
  if (babylonSetupResult) {
    babylonSetupResult.dispose();
  }
});
</script>
