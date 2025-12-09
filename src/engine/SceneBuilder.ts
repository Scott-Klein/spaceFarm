import { Scene, Vector3, Color3, CreateSphere, StandardMaterial } from '@babylonjs/core';
import { GameEngine } from './GameEngine';
import { Spaceship } from './Spaceship';
import { HumanController } from './controllers/HumanController';
import { AIController } from './controllers/AIController';
import { CapitalShip } from './CapitalShip';

export interface SceneConfig {
  asteroidCount?: number;
  spaceRadius?: number;
  landmarkCount?: number;
  aiShipCount?: number;
}

export class SceneBuilder {
  private gameEngine: GameEngine;
  private scene: Scene;

  constructor(gameEngine: GameEngine, scene: Scene) {
    this.gameEngine = gameEngine;
    this.scene = scene;
  }

  /**
   * Build the complete game scene with default or custom configuration
   */
  buildScene(config: SceneConfig = {}): void {
    const { asteroidCount = 80, spaceRadius = 150, landmarkCount = 5, aiShipCount = 3 } = config;

    this.createAsteroidField(asteroidCount, spaceRadius);
    this.createLandmarks(landmarkCount, spaceRadius);
    this.createPlayerShip();
    this.createAIShips(aiShipCount);

    // Select player ship to start
    this.gameEngine.selectGameObject('player-capital');
  }

  /**
   * Create randomly distributed asteroids throughout 3D space
   */
  private createAsteroidField(count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const position = this.randomSpacePosition(radius, 20); // Avoid origin within 20 units
      const size = 3 + Math.random() * 8; // 3-11 units
      const color = new Color3(
        0.2 + Math.random() * 0.6,
        0.2 + Math.random() * 0.6,
        0.3 + Math.random() * 0.5,
      );
      this.createReferenceObject(position, size, color);
    }
  }

  /**
   * Create large landmark asteroids at specific locations
   */
  private createLandmarks(count: number, _radius: number): void {
    const landmarks = [
      { pos: new Vector3(80, 30, 60), size: 20, color: new Color3(1, 0.5, 0) },
      { pos: new Vector3(-90, -40, 70), size: 25, color: new Color3(0.5, 0, 1) },
      { pos: new Vector3(100, 50, -80), size: 18, color: new Color3(0, 1, 0.5) },
      { pos: new Vector3(-70, -30, -90), size: 22, color: new Color3(1, 0, 0.5) },
      { pos: new Vector3(0, 100, 0), size: 30, color: new Color3(1, 1, 0.3) },
    ];

    for (let i = 0; i < Math.min(count, landmarks.length); i++) {
      const landmark = landmarks[i];
      if (landmark) {
        this.createReferenceObject(landmark.pos, landmark.size, landmark.color);
      }
    }
  }

  /**
   * Create the player-controlled spaceship
   */
  private createPlayerShip(): void {
    const playerShip = new CapitalShip('player-capital', new Color3(0.2, 0.6, 1), '/models/MilCap.glb');
    playerShip.position = new Vector3(0, 0, 0);

    const humanController = new HumanController(this.gameEngine.getInputManager());
    playerShip.possess(humanController);

    this.gameEngine.addGameObject(playerShip);
  }

  /**
   * Create AI-controlled spaceships with different behaviors
   */
  private createAIShips(count: number): void {
    const configs = [
      {
        id: 'ai-1',
        pos: new Vector3(10, 0, 5),
        color: new Color3(1, 0.2, 0.2),
        behavior: 'patrol' as const,
      },
      {
        id: 'ai-2',
        pos: new Vector3(-8, 0, -10),
        color: new Color3(0.2, 1, 0.2),
        behavior: 'follow' as const,
      },
      {
        id: 'ai-3',
        pos: new Vector3(5, 0, -15),
        color: new Color3(1, 1, 0.2),
        behavior: 'idle' as const,
      },
    ];

    for (let i = 0; i < Math.min(count, configs.length); i++) {
      const config = configs[i];
      if (!config) continue;

      const aiShip = new Spaceship(config.id, config.color);
      aiShip.position = config.pos;

      const aiController = new AIController(config.behavior);

      // If follow behavior, set target to player
      if (config.behavior === 'follow') {
        const playerShip = this.gameEngine.getGameObject('player');
        if (playerShip) {
          aiController.setTarget(playerShip);
        }
      }

      aiShip.possess(aiController);
      this.gameEngine.addGameObject(aiShip);
    }
  }

  /**
   * Create a stationary reference object (asteroid/marker)
   */
  private createReferenceObject(position: Vector3, size: number, color: Color3): void {
    const sphere = CreateSphere(
      `ref-${Math.random().toString(36).substr(2, 9)}`,
      { diameter: size },
      this.scene,
    );
    sphere.position = position;

    const material = new StandardMaterial(
      `refMat-${Math.random().toString(36).substr(2, 9)}`,
      this.scene,
    );
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.3); // Slight glow
    sphere.material = material;
  }

  /**
   * Generate a random position in 3D space, optionally avoiding origin
   */
  private randomSpacePosition(radius: number, minDistanceFromOrigin: number = 0): Vector3 {
    let position: Vector3;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      const x = (Math.random() - 0.5) * radius * 2;
      const y = (Math.random() - 0.5) * radius * 2;
      const z = (Math.random() - 0.5) * radius * 2;
      position = new Vector3(x, y, z);
      attempts++;
    } while (position.length() < minDistanceFromOrigin && attempts < maxAttempts);

    return position;
  }
}
