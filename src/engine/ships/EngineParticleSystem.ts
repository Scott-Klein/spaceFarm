import {
  ParticleSystem,
  Texture,
  Color4,
  Vector3,
  Scene,
  TransformNode,
  AbstractMesh,
} from '@babylonjs/core';

export type EngineType = 'ENGINE_SMALL' | 'ENGINE_MEDIUM' | 'ENGINE_LARGE' | 'ENGINE_MASSIVE';

interface EngineConfig {
  capacity: number;
  minSize: number;
  maxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  baseEmitRate: number;
  baseMinPower: number;
  baseMaxPower: number;
  color1: Color4;
  color2: Color4;
  colorDead: Color4;
}

export default class EngineParticleSystem {
  private particleSystems: ParticleSystem[] = [];
  private trackedNodes: Map<ParticleSystem, TransformNode> = new Map();
  private systemConfigs: Map<ParticleSystem, EngineConfig> = new Map();
  private scene: Scene;

  // Engine configurations for different types
  private static readonly ENGINE_CONFIGS: Record<EngineType, EngineConfig> = {
    ENGINE_SMALL: {
      capacity: 200,
      minSize: 0.03,
      maxSize: 0.05,
      minLifeTime: 0.2,
      maxLifeTime: 0.4,
      baseEmitRate: 50,
      baseMinPower: 1,
      baseMaxPower: 2,
      color1: new Color4(0.3, 0.7, 1.0, 1.0),
      color2: new Color4(0.8, 0.9, 1.0, 1.0),
      colorDead: new Color4(0.5, 0.7, 0.9, 0.0),
    },
    ENGINE_MEDIUM: {
      capacity: 500,
      minSize: 0.03,
      maxSize: 0.08,
      minLifeTime: 0.3,
      maxLifeTime: 0.6,
      baseEmitRate: 100,
      baseMinPower: 2,
      baseMaxPower: 4,
      color1: new Color4(0.2, 0.5, 1.0, 1.0),
      color2: new Color4(1.0, 0.6, 0.2, 1.0),
      colorDead: new Color4(0.8, 0.1, 0.1, 0.0),
    },
    ENGINE_LARGE: {
      capacity: 1000,
      minSize: 0.05,
      maxSize: 0.15,
      minLifeTime: 0.4,
      maxLifeTime: 0.8,
      baseEmitRate: 200,
      baseMinPower: 3,
      baseMaxPower: 6,
      color1: new Color4(1.0, 0.3, 0.1, 1.0),
      color2: new Color4(1.0, 0.8, 0.0, 1.0),
      colorDead: new Color4(1.0, 0.2, 0.0, 0.0),
    },
    ENGINE_MASSIVE: {
      capacity: 2000,
      minSize: 0.8,
      maxSize: 2.5,
      minLifeTime: 0.6,
      maxLifeTime: 1.2,
      baseEmitRate: 300,
      baseMinPower: 5,
      baseMaxPower: 10,
      color1: new Color4(1.0, 0.1, 0.5, 1.0),
      color2: new Color4(1.0, 0.5, 0.0, 1.0),
      colorDead: new Color4(1.0, 0.0, 0.2, 0.0),
    },
  };

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Detect engine type from node name
   */
  private detectEngineType(nodeName: string): EngineType {
    if (nodeName.includes('ENGINE_MASSIVE')) return 'ENGINE_MASSIVE';
    if (nodeName.includes('ENGINE_LARGE')) return 'ENGINE_LARGE';
    if (nodeName.includes('ENGINE_MEDIUM')) return 'ENGINE_MEDIUM';
    if (nodeName.includes('ENGINE_SMALL')) return 'ENGINE_SMALL';
    return 'ENGINE_MEDIUM'; // Default fallback
  }

  /**
   * Create particle systems for engine exhaust at specified emitter positions
   * @param emitters Array of transform nodes or Vector3 positions for engines
   */
  createEngineExhaust(emitters: (TransformNode | Vector3 | AbstractMesh)[]): void {
    // Clean up any existing systems
    this.dispose();

    // Create a flare texture
    const texture = new Texture('https://www.babylonjs.com/assets/Flare.png', this.scene);

    emitters.forEach((emitter, index) => {
      // Detect engine type from name
      let engineType: EngineType = 'ENGINE_MEDIUM';
      if (emitter instanceof TransformNode || emitter instanceof AbstractMesh) {
        engineType = this.detectEngineType(emitter.name);
      }

      // Get configuration for this engine type
      const config = EngineParticleSystem.ENGINE_CONFIGS[engineType];

      const particleSystem = new ParticleSystem(`engine-${index}`, config.capacity, this.scene);

      // Set the texture
      particleSystem.particleTexture = texture;

      // Set the emitter
      // Particle systems can use AbstractMesh or Vector3 as emitters
      // TransformNode needs to be converted, or we can update position each frame
      if (emitter instanceof AbstractMesh) {
        particleSystem.emitter = emitter;
      } else if (emitter instanceof TransformNode) {
        // For TransformNode, we'll store the node and update position in the update loop
        particleSystem.emitter = emitter.getAbsolutePosition();
        // Store reference to update later
        this.trackedNodes.set(particleSystem, emitter);
      } else {
        // Vector3
        particleSystem.emitter = emitter;
      }

      // Size of each particle (from config)
      particleSystem.minSize = config.minSize;
      particleSystem.maxSize = config.maxSize;

      // Life time of each particle (from config)
      particleSystem.minLifeTime = config.minLifeTime;
      particleSystem.maxLifeTime = config.maxLifeTime;

      // Emission rate (from config)
      particleSystem.emitRate = config.baseEmitRate;

      // Blend mode
      particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;

      // Colors (from config)
      particleSystem.color1 = config.color1.clone();
      particleSystem.color2 = config.color2.clone();
      particleSystem.colorDead = config.colorDead.clone();

      // Speed (from config)
      particleSystem.minEmitPower = config.baseMinPower;
      particleSystem.maxEmitPower = config.baseMaxPower;
      particleSystem.updateSpeed = 0.01;

      // Store config reference for throttle updates
      this.systemConfigs.set(particleSystem, config);

      // Direction of each particle after it has been emitted (local space if using TransformNode)
      particleSystem.direction1 = new Vector3(0, 0, -1); // Backward
      particleSystem.direction2 = new Vector3(0, 0, -1);

      // Angular speed
      particleSystem.minAngularSpeed = 0;
      particleSystem.maxAngularSpeed = Math.PI;

      // Use cone emitter
      const ce =particleSystem.createConeEmitter(0.5, 3.141);
      ce.emitFromSpawnPointOnly = true;
      // Start the particle system
      particleSystem.start();

      this.particleSystems.push(particleSystem);
    });
  }

  /**
   * Update particle emission based on throttle position (0.0 to 1.0)
   */
  updateThrottle(throttlePercent: number): void {
    const clampedThrottle = Math.max(0, Math.min(1, throttlePercent));

    this.particleSystems.forEach((system) => {
      // Update emitter position if tracking a TransformNode
      const trackNode = this.trackedNodes.get(system);
      if (trackNode) {
        system.emitter = trackNode.getAbsolutePosition();
      }

      // Get the engine config for this system
      const config = this.systemConfigs.get(system);
      if (!config) return;

      // Scale emission rate with throttle (10% base to 100% at full throttle)
      const throttleMultiplier = 0.1 + clampedThrottle * 0.9;
      system.emitRate = config.baseEmitRate * throttleMultiplier;

      // Scale particle speed with throttle
      system.minEmitPower = config.baseMinPower * throttleMultiplier;
      system.maxEmitPower = config.baseMaxPower * throttleMultiplier;

      // Adjust colors based on throttle (more intense at higher throttle)
      const intensity = 0.3 + clampedThrottle * 0.7;
      system.color1 = new Color4(
        config.color1.r * intensity,
        config.color1.g * intensity,
        config.color1.b * intensity,
        1.0,
      );
      system.color2 = new Color4(
        config.color2.r * intensity,
        config.color2.g * intensity,
        config.color2.b * intensity,
        1.0,
      );
    });
  }

  /**
   * Stop all particle systems
   */
  stop(): void {
    this.particleSystems.forEach((system) => system.stop());
  }

  /**
   * Start all particle systems
   */
  start(): void {
    this.particleSystems.forEach((system) => system.start());
  }

  /**
   * Clean up and dispose all particle systems
   */
  dispose(): void {
    this.particleSystems.forEach((system) => system.dispose());
    this.particleSystems = [];
    this.trackedNodes.clear();
    this.systemConfigs.clear();
  }
}
