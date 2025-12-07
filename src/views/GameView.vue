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
      const sphere = CreateSphere(
        `ref-${Math.random().toString(36).substr(2, 9)}`,
        { diameter: size },
        scene,
      );
      sphere.position = position;
      const material = new StandardMaterial(
        `refMat-${Math.random().toString(36).substr(2, 9)}`,
        scene,
      );
      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.3); // Slight glow
      sphere.material = material;
      return sphere;
    };

    // Create randomly placed asteroids in 3D space
    const numAsteroids = 80;
    const spaceRadius = 150; // Spread out in a 300x300x300 cube

    for (let i = 0; i < numAsteroids; i++) {
      // Random position in 3D space
      const x = (Math.random() - 0.5) * spaceRadius * 2;
      const y = (Math.random() - 0.5) * spaceRadius * 2;
      const z = (Math.random() - 0.5) * spaceRadius * 2;

      // Skip if too close to origin (where player starts)
      if (Math.sqrt(x * x + y * y + z * z) < 20) continue;

      const position = new Vector3(x, y, z);
      const size = 3 + Math.random() * 8; // Larger asteroids (3-11 units)

      // Random colors with variety
      const color = new Color3(
        0.2 + Math.random() * 0.6,
        0.2 + Math.random() * 0.6,
        0.3 + Math.random() * 0.5,
      );

      createReferenceObject(position, size, color);
    }

    // Add some very large landmark asteroids
    createReferenceObject(new Vector3(80, 30, 60), 20, new Color3(1, 0.5, 0));
    createReferenceObject(new Vector3(-90, -40, 70), 25, new Color3(0.5, 0, 1));
    createReferenceObject(new Vector3(100, 50, -80), 18, new Color3(0, 1, 0.5));
    createReferenceObject(new Vector3(-70, -30, -90), 22, new Color3(1, 0, 0.5));
    createReferenceObject(new Vector3(0, 100, 0), 30, new Color3(1, 1, 0.3)); // Big one above

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
