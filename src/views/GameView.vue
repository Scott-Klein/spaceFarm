<template>
  <canvas ref="canvasRef" touch-action="none" class="h-full w-full"></canvas>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Color3, Vector3 } from '@babylonjs/core';
import { useBabylonScene } from '@/composables/useBabylonScene';
import { GameEngine, Spaceship, HumanController, AIController } from '@/engine';

const canvasRef = ref<HTMLCanvasElement | null>(null);

useBabylonScene({
  canvasRef,
  onSceneReady: (scene) => {
    const canvas = canvasRef.value!;

    // Initialize the game engine
    const gameEngine = new GameEngine(scene, canvas);
    const inputManager = gameEngine.getInputManager();

    // Create player spaceship with human controller
    const playerShip = new Spaceship('player', new Color3(0.2, 0.6, 1));
    playerShip.position = new Vector3(0, 0, 0);
    const humanController = new HumanController(inputManager, 0.05);
    playerShip.possess(humanController);
    gameEngine.addGameObject(playerShip);

    // Create AI spaceships with different behaviors
    const aiShip1 = new Spaceship('ai-1', new Color3(1, 0.2, 0.2));
    aiShip1.position = new Vector3(10, 0, 5);
    const aiController1 = new AIController('patrol');
    aiShip1.possess(aiController1);
    gameEngine.addGameObject(aiShip1);

    const aiShip2 = new Spaceship('ai-2', new Color3(0.2, 1, 0.2));
    aiShip2.position = new Vector3(-8, 0, -10);
    const aiController2 = new AIController('follow');
    aiController2.setTarget(playerShip); // Follow the player
    aiShip2.possess(aiController2);
    gameEngine.addGameObject(aiShip2);

    const aiShip3 = new Spaceship('ai-3', new Color3(1, 1, 0.2));
    aiShip3.position = new Vector3(5, 0, -15);
    const aiController3 = new AIController('idle');
    aiShip3.possess(aiController3);
    gameEngine.addGameObject(aiShip3);

    // Select the player ship (camera will follow it)
    gameEngine.selectGameObject('player');
  },
});
</script>
