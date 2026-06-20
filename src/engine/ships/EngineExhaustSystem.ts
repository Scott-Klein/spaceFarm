import { Color4, ParticleSystem, Texture, Vector3, type Scene, type TransformNode } from '@babylonjs/core';
import type { IEngineTrail } from './TrailMeshSystem';
import {
  type EngineExhaustConfig,
  getPresetForNode,
  cloneConfig,
  ENGINE_PRESETS,
} from './EngineExhaustConfigs';

/**
 * Tracked data for each engine's particle system
 */
interface EngineEntry {
  node: TransformNode;
  particleSystem: ParticleSystem;
  config: EngineExhaustConfig;
}

/**
 * Particle-based engine exhaust system.
 * Creates particle emitters for each engine node that respond to throttle.
 * Automatically selects presets based on engine node names (ENGINE_SMALL, etc.)
 * Supports runtime config updates for gameplay effects.
 */
export default class EngineExhaustSystem implements IEngineTrail {
  private engines: EngineEntry[] = [];
  private scene: Scene;
  private currentThrottle = 0;

  /**
   * Create exhaust system for engine nodes.
   * @param engineNodes - Transform nodes where particles emit from
   * @param scene - Babylon scene
   * @param configOverrides - Optional per-node config overrides (by index or node name)
   */
  constructor(
    engineNodes: TransformNode[],
    scene: Scene,
    configOverrides?: Map<string | number, Partial<EngineExhaustConfig>>,
  ) {
    this.scene = scene;

    // Create a particle system for each engine node
    engineNodes.forEach((node, index) => {
      // Get base config from preset based on node name
      const baseConfig = cloneConfig(getPresetForNode(node.name));

      // Apply any overrides
      const override = configOverrides?.get(index) ?? configOverrides?.get(node.name);
      const config = override ? { ...baseConfig, ...override } : baseConfig;

      const ps = this.createParticleSystem(node, config, index);
      this.engines.push({ node, particleSystem: ps, config });
      ps.start();
    });
  }

  private createParticleSystem(
    emitterNode: TransformNode,
    config: EngineExhaustConfig,
    index: number,
  ): ParticleSystem {
    const ps = new ParticleSystem(`exhaust_${emitterNode.name}_${index}`, config.capacity, this.scene);

    // Flare texture for glow
    ps.particleTexture = new Texture('https://assets.babylonjs.com/textures/flare.png', this.scene);

    // Emission from engine node
    ps.emitter = emitterNode;
    ps.minEmitBox = new Vector3(0, 0, 0);
    ps.maxEmitBox = new Vector3(0, 0, 0);

    // Direction - emits backward (-Z) with spread
    const spread = config.spread;
    ps.direction1 = new Vector3(-spread, -spread, -1);
    ps.direction2 = new Vector3(spread, spread, -1);

    // Particles respect emitter rotation
    ps.isLocal = true;

    // Apply config values
    this.applyConfigToParticleSystem(ps, config);

    // Additive blend for glow
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // No gravity in space
    ps.gravity = new Vector3(0, 0, 0);

    // No rotation
    ps.minAngularSpeed = 0;
    ps.maxAngularSpeed = 0;

    return ps;
  }

  private applyConfigToParticleSystem(ps: ParticleSystem, config: EngineExhaustConfig): void {
    ps.emitRate = config.emitRate;
    ps.minEmitPower = config.minSpeed;
    ps.maxEmitPower = config.maxSpeed;
    ps.minLifeTime = config.minLifeTime;
    ps.maxLifeTime = config.maxLifeTime;
    ps.minSize = config.minSize;
    ps.maxSize = config.maxSize;

    // Clear existing gradients
    ps.getSizeGradients()?.splice(0);
    ps.getColorGradients()?.splice(0);

    // Apply size gradients
    for (const sg of config.sizeGradients) {
      ps.addSizeGradient(sg.gradient, sg.size);
    }

    // Apply color gradients (will be updated by throttle)
    for (const cg of config.colorGradients) {
      ps.addColorGradient(cg.gradient, cg.color.clone());
    }
  }

  /**
   * Update exhaust based on throttle (0-1).
   * Scales emission rate, power, size, and interpolates colors.
   */
  update(_deltaTime: number, throttle: number): void {
    const t = Math.max(0, Math.min(1, throttle));
    this.currentThrottle = t;

    for (const engine of this.engines) {
      const { particleSystem: ps, config } = engine;

      // Scale emission and power by throttle
      ps.emitRate = config.emitRate * t;
      ps.minEmitPower = config.minSpeed * (0.5 + t * 0.5);
      ps.maxEmitPower = config.maxSpeed * (0.5 + t * 0.5);
      ps.minSize = config.minSize * (0.5 + t * 0.5);
      ps.maxSize = config.maxSize * (0.5 + t * 0.5);

      // Interpolate colors based on throttle
      this.updateColors(ps, config, t);
    }
  }

  private updateColors(ps: ParticleSystem, config: EngineExhaustConfig, throttle: number): void {
    const gradients = ps.getColorGradients();
    if (!gradients) return;

    // Lerp between low and high throttle colors
    for (let i = 0; i < gradients.length && i < config.colorGradients.length; i++) {
      const low = config.colorGradients[i].color;
      const high = config.highThrottleColorGradients[i]?.color ?? low;

      const lerped = Color4.Lerp(low, high, throttle);
      gradients[i].color1 = lerped;
      // color2 is for gradient ranges - set same as color1 for solid gradient points
      if (gradients[i].color2) {
        gradients[i].color2 = lerped;
      }
    }
  }

  /**
   * Update config for a specific engine at runtime.
   * Useful for damage effects, upgrades, etc.
   */
  setEngineConfig(engineIndex: number, configUpdate: Partial<EngineExhaustConfig>): void {
    const engine = this.engines[engineIndex];
    if (!engine) return;

    // Merge update into existing config
    Object.assign(engine.config, configUpdate);

    // Re-apply to particle system
    this.applyConfigToParticleSystem(engine.particleSystem, engine.config);

    // Re-apply current throttle
    this.update(0, this.currentThrottle);
  }

  /**
   * Update config for all engines at runtime.
   */
  setAllEngineConfigs(configUpdate: Partial<EngineExhaustConfig>): void {
    for (let i = 0; i < this.engines.length; i++) {
      this.setEngineConfig(i, configUpdate);
    }
  }

  /**
   * Get the current config for an engine (for inspection/modification).
   */
  getEngineConfig(engineIndex: number): EngineExhaustConfig | null {
    return this.engines[engineIndex]?.config ?? null;
  }

  /**
   * Get number of engines in this system.
   */
  getEngineCount(): number {
    return this.engines.length;
  }

  dispose(): void {
    for (const engine of this.engines) {
      engine.particleSystem.stop();
      engine.particleSystem.dispose();
    }
    this.engines = [];
  }
}

/**
 * Re-export config utilities for convenience
 */
export { ENGINE_PRESETS, getPresetForNode, cloneConfig, withColorScheme } from './EngineExhaustConfigs';
export type { EngineExhaustConfig } from './EngineExhaustConfigs';
