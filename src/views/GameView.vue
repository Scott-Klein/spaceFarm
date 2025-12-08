<template>
  <div class="relative h-full w-full select-none overflow-hidden">
    <!-- 3D Canvas Background -->
    <canvas
      ref="canvasRef"
      touch-action="none"
      class="absolute left-0 top-0 h-full w-full"
    ></canvas>

    <!-- UI Overlay Components - All read from Pinia store -->
    <ShipUi />
    <CameraToggle />
  </div>
</template>

<script setup lang="ts">
/**
 * Main game view component - handles Babylon.js canvas setup and scene initialization.
 * Scene configuration can be customized through SceneBuilder options.
 *
 * Game state is pushed from the game engine to Pinia store automatically every frame.
 * UI components read directly from the store - no props needed.
 */
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

    // Connect game engine to Pinia store (bidirectional)

    // Game → UI: Push state updates every frame (~60fps)
    gameEngine.setStateUpdateCallback((state) => {
      gameStore.updatePlayerState(state);
    });

    // Handle keyboard shortcut for camera toggle
    const inputManager = gameEngine.getInputManager();
    inputManager.onCommand('toggleCamera', () => {
      if (inputManager.wasCommandJustPressed('toggleCamera')) {
        gameStore.toggleCameraMode();
      }
    });

    // Build the scene with custom configuration
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
