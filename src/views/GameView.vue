<template>
  <div class="relative h-full w-full select-none overflow-hidden">
    <canvas
      ref="canvasRef"
      touch-action="none"
      class="absolute left-0 top-0 h-full w-full"
    ></canvas>

    <ShipUi />
    <CameraToggle />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useBabylonScene } from '@/composables/useBabylonScene';
import { GameEngine, SceneBuilder } from '@/engine';
import { useGameStore } from '@/stores/gameState';
import ShipUi from '@/components/ui/ShipUi.vue';
import CameraToggle from '@/components/ui/CameraToggle.vue';

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
    sceneBuilder.buildScene({
      asteroidCount: 80,
      spaceRadius: 150,
      landmarkCount: 5,
      aiShipCount: 3,
    });
  },
});
</script>
