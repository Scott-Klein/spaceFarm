<template>
  <div class="flex h-full w-full select-none">
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
import { ref } from 'vue';
import { useBabylonScene } from '@/composables/useBabylonScene';
import { GameEngine, SceneBuilder } from '@/engine';
import { useGameStore } from '@/stores/gameState';
import LogWindow from '@/components/LogWindow.vue';
import ShipUi from '@/components/ui/ship/ShipUi.vue';
import CameraToggle from '@/components/ui/CameraToggle.vue';
import ShipStatus from '@/components/ui/ship/ShipStatus.vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const gameStore = useGameStore();

useBabylonScene({
  canvasRef,
  onSceneReady: (scene) => {
    const canvas = canvasRef.value!;

    // Initialize the game engine with store access
    const gameEngine = new GameEngine(scene, canvas, gameStore);

    gameEngine.setStateUpdateCallback((state) => {
      gameStore.updatePlayerState(state);
    });

    const inputManager = gameEngine.getInputManager();
    inputManager.onCommand('toggleCamera', () => {
      if (inputManager.wasCommandJustPressed('toggleCamera')) {
        gameStore.toggleCameraMode();
      }
    });

    const sceneBuilder = new SceneBuilder(gameEngine, scene);
    sceneBuilder.buildScene();
  },
});
</script>
