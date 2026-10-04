import GameEngine from './GameEngine';
import Spaceship from './ships/Spaceship';
import HumanController from './controllers/HumanController';
import AIController from './controllers/AIController';
import useLogStore from '@/stores/logs';
import SpaceStation from './ships/stations/SpaceStation';
import {
  addToScene,
  createSphere,
  createStandardMaterial,
  type Vec3,
  type Vec3Tuple,
} from '@babylonjs/lite';
import MathBro from '@/utils/MathBro';

export interface SceneConfig {
  asteroidCount?: number;
  spaceRadius?: number;
  landmarkCount?: number;
  aiShipCount?: number;
}

export default class SceneBuilder {
  private gameEngine: GameEngine;
  log: ReturnType<typeof useLogStore>;

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
    this.log = useLogStore();
    this.log.log('finished making scene builder');
  }

  /**
   * Build the complete game scene with default or custom configuration
   */
  buildScene(config: SceneConfig = {}): void {
    const { asteroidCount = 80, spaceRadius = 150, aiShipCount = 15 } = config;

    this.createAsteroidField(asteroidCount, spaceRadius);
    this.createPlayerShip();
    this.createAIShips(aiShipCount);
    this.createSpaceStation();
  }

  /**
   * Create randomly distributed asteroids throughout 3D space
   */
  private createAsteroidField(count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const position = this.randomSpacePosition(radius, 20); // Avoid origin within 20 units
      const size = 3 + Math.random() * 8; // 3-11 units
      const color: [number,number,number] = [
        0.2 + Math.random() * 0.6,
        0.2 + Math.random() * 0.6,
        0.3 + Math.random() * 0.5,
      ];
      this.createReferenceObject(position, size, color);
    }
  }

  /**
   * Create the player-controlled spaceship
   */
  private createPlayerShip(): void {
    const playerShip = new Spaceship('/models/MilCap2.glb', [0.2, 0.6, 1]);
    playerShip.position = {x: 0, y: 0, z: 0};

    const humanController = new HumanController(this.gameEngine.getInputManager());
    playerShip.possess(humanController);
    this.gameEngine.setPlayerObject(playerShip);
  }

  /**
   * Create AI-controlled spaceships with different behaviors
   */
  private createAIShips(count: number): void {
    type Behavior = 'follow' | 'idle' | 'patrol';
    const configs: { id: string; pos: Vec3; color: Vec3Tuple; behavior: Behavior }[] = [
      {
        id: 'ai-1',
        pos: { x: 10, y: 0, z: 5 },
        color: [1, 0.2, 0.2],
        behavior: 'patrol' as const,
      },
      {
        id: 'ai-2',
        pos: { x: -8, y: 0, z: -10 },
        color: [0.2, 1, 0.2],
        behavior: 'follow' as const,
      },
      {
        id: 'ai-3',
        pos: { x: 5, y: 0, z: -15 },
        color: [1, 1, 0.2],
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
        const playerShip = this.gameEngine.getPlayer();
        if (playerShip) {
          aiController.setTarget(playerShip);
        }
      }

      aiShip.possess(aiController);
      this.gameEngine.addGameObject(aiShip);
    }
  }

  private createSpaceStation(): void {
    const randomPos = this.randomSpacePosition(150);

    const spaceStation = new SpaceStation('/models/SpaceStation1.glb');
    spaceStation.position = randomPos;
    this.gameEngine.addGameObject(spaceStation);
  }

  /**
   * Create a stationary reference object (asteroid/marker)
   */
  private createReferenceObject(
    position: Vec3,
    size: number,
    color: [number, number, number],
    debugFlash = false,
  ): void {
    const sphere = createSphere($engine, { diameter: size });
    sphere.position.copyFrom(position);

    // material must be assigned BEFORE addToScene: the scene groups meshes by material at add time
    const material = createStandardMaterial();
    material.diffuseColor = color;
    material.emissiveColor = color.map((c) => c * 0.3) as [number, number, number];
    sphere.material = material;
    addToScene($scene, sphere);
    if (debugFlash) {
      setInterval(() => {
        material.diffuseColor = [Math.random(), Math.random(), Math.random()];
      }, 1000); // new color every second
    }
  }

  /**
   * Generate a random position in 3D space, optionally avoiding origin
   */
  private randomSpacePosition(radius: number, minDistanceFromOrigin: number = 0): Vec3 {
    let position: Vec3;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      const x = (Math.random() - 0.5) * radius * 2;
      const y = (Math.random() - 0.5) * radius * 2;
      const z = (Math.random() - 0.5) * radius * 2;
      position = { x, y, z };
      attempts++;
    } while (
      MathBro.vec3Length(position) <
        minDistanceFromOrigin &&
      attempts < maxAttempts
    );

    return position;
  }
}
