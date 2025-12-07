<template>
  <div class="game-container select-none">
    <!-- 3D Canvas Background -->
    <canvas ref="canvasRef" touch-action="none" class="game-canvas"></canvas>

    <!-- UI Overlay Components - All read from Pinia store -->
    <ControlsDisplay />
    <SpeedIndicator />
    <ThrottleIndicator />
    <OrientationIndicator />
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
import ControlsDisplay from '@/components/ui/ControlsDisplay.vue';
import SpeedIndicator from '@/components/ui/SpeedIndicator.vue';
import ThrottleIndicator from '@/components/ui/ThrottleIndicator.vue';
import OrientationIndicator from '@/components/ui/OrientationIndicator.vue';
import CameraToggle from '@/components/ui/CameraToggle.vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const gameStore = useGameStore();

useBabylonScene({
  canvasRef,
  onSceneReady: (scene) => {
    const canvas = canvasRef.value!;

    // Initialize the game engine
    const gameEngine = new GameEngine(scene, canvas);

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

<style scoped>
.game-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
