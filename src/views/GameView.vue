<template>
  <canvas ref="canvasRef" touch-action="none" class="h-full w-full"></canvas>
</template>

<script setup lang="ts">
/**
 * Main game view component - handles Babylon.js canvas setup and scene initialization.
 * Scene configuration can be customized through SceneBuilder options.
 */
import { ref } from 'vue';
import { useBabylonScene } from '@/composables/useBabylonScene';
import { GameEngine, SceneBuilder } from '@/engine';

const canvasRef = ref<HTMLCanvasElement | null>(null);

useBabylonScene({
  canvasRef,
  onSceneReady: (scene) => {
    const canvas = canvasRef.value!;

    // Initialize the game engine
    const gameEngine = new GameEngine(scene, canvas);

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
