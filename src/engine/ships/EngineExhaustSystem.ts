import {
  Color4,
  ParticleSystem,
  Texture,
  Vector3,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { IEngineTrail } from './TrailMeshSystem';

export interface EngineExhaustOptions {
  capacity?: number;
  emitRate?: number;
  minLifeTime?: number;
  maxLifeTime?: number;
  minSize?: number;
  maxSize?: number;
  minSpeed?: number;
  maxSpeed?: number;
}

/**
 * Particle-based engine exhaust system.
 * Creates particle emitters for each engine node that respond to throttle.
 */
export default class EngineExhaustSystem implements IEngineTrail {
  private particleSystems: ParticleSystem[] = [];
  private baseEmitRate: number;
  private baseMinPower: number;
  private baseMaxPower: number;
  private baseMinSize: number;
  private baseMaxSize: number;

  constructor(engineNodes: TransformNode[], scene: Scene, options: EngineExhaustOptions = {}) {
    const opts = {
      capacity: 500,
      emitRate: 150,
      minLifeTime: 0.2,
      maxLifeTime: 0.5,
      minSize: 0.1,
      maxSize: 0.3,
      minSpeed: 2,
      maxSpeed: 5,
      ...options,
    };

    this.baseEmitRate = opts.emitRate;
    this.baseMinPower = opts.minSpeed;
    this.baseMaxPower = opts.maxSpeed;
    this.baseMinSize = opts.minSize;
    this.baseMaxSize = opts.maxSize;

    // Create a particle system for each engine node
    engineNodes.forEach((node, index) => {
      const ps = this.createExhaustParticles(node, scene, opts, index);
      this.particleSystems.push(ps);
      ps.start();
    });
  }

  private createExhaustParticles(
    emitterNode: TransformNode,
    scene: Scene,
    opts: Required<EngineExhaustOptions>,
    index: number,
  ): ParticleSystem {
    const ps = new ParticleSystem(`exhaust_${index}`, opts.capacity, scene);

    // Use flare texture for glow effect
    ps.particleTexture = new Texture('https://assets.babylonjs.com/textures/flare.png', scene);

    // Emission from the engine node
    ps.emitter = emitterNode;
    ps.minEmitBox = new Vector3(0, 0, 0);
    ps.maxEmitBox = new Vector3(0, 0, 0);

    // Direction - emits backward (-Z in local space)
    ps.direction1 = new Vector3(-0.1, -0.1, -1);
    ps.direction2 = new Vector3(0.1, 0.1, -1);

    // Particles respect emitter rotation
    ps.isLocal = true;

    // Speeds
    ps.minEmitPower = opts.minSpeed;
    ps.maxEmitPower = opts.maxSpeed;

    // Lifetime
    ps.minLifeTime = opts.minLifeTime;
    ps.maxLifeTime = opts.maxLifeTime;

    // Size
    ps.minSize = opts.minSize;
    ps.maxSize = opts.maxSize;

    // Size over lifetime - start small, grow slightly, shrink at end
    ps.addSizeGradient(0.0, 0.5);
    ps.addSizeGradient(0.3, 1.0);
    ps.addSizeGradient(1.0, 0.2);

    // Color gradient: white core → blue → orange → fade out
    ps.addColorGradient(0.0, new Color4(1, 1, 1, 1));
    ps.addColorGradient(0.2, new Color4(0.5, 0.7, 1, 0.9));
    ps.addColorGradient(0.5, new Color4(1, 0.5, 0.2, 0.6));
    ps.addColorGradient(1.0, new Color4(1, 0.3, 0.1, 0));

    // Additive blend mode for glow
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Emission rate
    ps.emitRate = opts.emitRate;

    // No gravity in space
    ps.gravity = new Vector3(0, 0, 0);

    // No rotation
    ps.minAngularSpeed = 0;
    ps.maxAngularSpeed = 0;

    return ps;
  }

  update(_deltaTime: number, throttle: number): void {
    const t = Math.max(0, Math.min(1, throttle));

    for (const ps of this.particleSystems) {
      ps.emitRate = this.baseEmitRate * t;
      ps.minEmitPower = this.baseMinPower * (0.5 + t * 0.5);
      ps.maxEmitPower = this.baseMaxPower * (0.5 + t * 0.5);
      ps.minSize = this.baseMinSize * (0.5 + t * 0.5);
      ps.maxSize = this.baseMaxSize * (0.5 + t * 0.5);
    }
  }

  dispose(): void {
    for (const ps of this.particleSystems) {
      ps.stop();
      ps.dispose();
    }
    this.particleSystems = [];
  }
}
