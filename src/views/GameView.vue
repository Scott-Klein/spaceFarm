<template>
  <canvas ref="canvasRef" touch-action="none" class="h-full w-full"></canvas>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Color3, Vector3, CreateSphere, StandardMaterial } from '@babylonjs/core';
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

    // Create stationary reference objects (asteroids/markers) to gauge velocity
    const createReferenceObject = (position: Vector3, size: number, color: Color3) => {
      const sphere = CreateSphere(`ref-${position.x}-${position.z}`, { diameter: size }, scene);
      sphere.position = position;
      const material = new StandardMaterial(`refMat-${position.x}-${position.z}`, scene);
      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.3); // Slight glow
      sphere.material = material;
      return sphere;
    };

    // Create a grid of reference objects
    const gridSize = 50;
    const spacing = 20;
    for (let x = -gridSize; x <= gridSize; x += spacing) {
      for (let z = -gridSize; z <= gridSize; z += spacing) {
        if (x === 0 && z === 0) continue; // Skip origin where player starts
        const position = new Vector3(x, 0, z);
        const size = 2 + Math.random() * 2;
        const color = new Color3(0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.3, 0.5);
        createReferenceObject(position, size, color);
      }
    }

    // Add some larger landmark objects
    createReferenceObject(new Vector3(30, 0, 30), 8, new Color3(1, 0.5, 0));
    createReferenceObject(new Vector3(-40, 0, 40), 10, new Color3(0.5, 0, 1));
    createReferenceObject(new Vector3(50, 10, -30), 6, new Color3(0, 1, 0.5));
    createReferenceObject(new Vector3(-30, -10, -50), 7, new Color3(1, 0, 0.5));

    // Create player spaceship with human controller
    const playerShip = new Spaceship('player', new Color3(0.2, 0.6, 1));
    playerShip.position = new Vector3(0, 0, 0);
    const humanController = new HumanController(inputManager);
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
