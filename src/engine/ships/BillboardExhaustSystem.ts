import {
  Color3,
  CreateCylinder,
  CreatePlane,
  Mesh,
  StandardMaterial,
  Vector3,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { IEngineTrail } from './TrailMeshSystem';

export type EngineSize = 'small' | 'medium' | 'large' | 'massive' | 'default';

export interface ExhaustConfig {
  coneBaseDiameter: number;
  coneHeight: number;
  innerGlowSize: number;
  outerGlowSize: number;
  coreColor: Color3;
  innerColor: Color3;
  outerColor: Color3;
}

const ENGINE_CONFIGS: Record<EngineSize, ExhaustConfig> = {
  small: {
    coneBaseDiameter: 0.1,
    coneHeight: 2,
    innerGlowSize: 0.2,
    outerGlowSize: 0.3,
    coreColor: new Color3(1, 0.9, 0.7),
    innerColor: new Color3(1, 0.6, 0.1),
    outerColor: new Color3(1, 0.3, 0),
  },
  medium: {
    coneBaseDiameter: 0.2,
    coneHeight: 4,
    innerGlowSize: 0.4,
    outerGlowSize: 0.6,
    coreColor: new Color3(1, 0.9, 0.7),
    innerColor: new Color3(1, 0.6, 0.1),
    outerColor: new Color3(1, 0.3, 0),
  },
  large: {
    coneBaseDiameter: 0.4,
    coneHeight: 6,
    innerGlowSize: 0.7,
    outerGlowSize: 1.0,
    coreColor: new Color3(1, 0.95, 0.8),
    innerColor: new Color3(1, 0.5, 0.1),
    outerColor: new Color3(1, 0.2, 0),
  },
  massive: {
    coneBaseDiameter: 0.8,
    coneHeight: 10,
    innerGlowSize: 1.2,
    outerGlowSize: 1.8,
    coreColor: new Color3(1, 1, 0.9),
    innerColor: new Color3(1, 0.4, 0.1),
    outerColor: new Color3(1, 0.15, 0),
  },
  default: {
    coneBaseDiameter: 0.2,
    coneHeight: 5,
    innerGlowSize: 0.4,
    outerGlowSize: 0.6,
    coreColor: new Color3(1, 0.9, 0.7),
    innerColor: new Color3(1, 0.6, 0.1),
    outerColor: new Color3(1, 0.3, 0),
  },
};

interface ExhaustNode {
  core: Mesh;
  innerGlow: Mesh;
  outerGlow: Mesh;
}

export default class BillboardExhaustSystem implements IEngineTrail {
  private exhaustNodes: ExhaustNode[] = [];
  private scene: Scene;
  private time: number = 0;

  constructor(engineNodes: TransformNode[], scene: Scene) {
    this.scene = scene;

    for (const node of engineNodes) {
      const exhaust = this.createExhaustForNode(node);
      this.exhaustNodes.push(exhaust);
    }
  }

  private getEngineSizeFromName(name: string): EngineSize {
    const upperName = name.toUpperCase();
    if (upperName.includes('ENGINE_MASSIVE')) return 'massive';
    if (upperName.includes('ENGINE_LARGE')) return 'large';
    if (upperName.includes('ENGINE_MEDIUM')) return 'medium';
    if (upperName.includes('ENGINE_SMALL')) return 'small';
    return 'default';
  }

  private createExhaustForNode(engineNode: TransformNode): ExhaustNode {
    const engineSize = this.getEngineSizeFromName(engineNode.name);
    const config = ENGINE_CONFIGS[engineSize];

    // Core: cone with base at engine, tip trailing behind
    const core = CreateCylinder(
      `${engineNode.name}-exhaust-core`,
      {
        diameterTop: config.coneBaseDiameter,
        diameterBottom: 0,
        height: config.coneHeight,
        tessellation: 12,
      },
      this.scene,
    );
    core.parent = engineNode;
    core.rotation.x = -Math.PI / 2;

    const coreMat = new StandardMaterial(`${engineNode.name}-core-mat`, this.scene);
    coreMat.emissiveColor = config.coreColor;
    coreMat.disableLighting = true;
    core.material = coreMat;

    // Inner glow billboard
    const innerGlow = CreatePlane(
      `${engineNode.name}-exhaust-inner`,
      { size: config.innerGlowSize },
      this.scene,
    );
    innerGlow.parent = engineNode;
    innerGlow.position.z = -config.coneHeight * 0.1;
    innerGlow.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const innerMat = new StandardMaterial(`${engineNode.name}-inner-mat`, this.scene);
    innerMat.emissiveColor = config.innerColor;
    innerMat.disableLighting = true;
    innerMat.alpha = 0.6;
    innerGlow.material = innerMat;

    // Outer glow billboard
    const outerGlow = CreatePlane(
      `${engineNode.name}-exhaust-outer`,
      { size: config.outerGlowSize },
      this.scene,
    );
    outerGlow.parent = engineNode;
    outerGlow.position.z = -config.coneHeight * 0.15;
    outerGlow.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const outerMat = new StandardMaterial(`${engineNode.name}-outer-mat`, this.scene);
    outerMat.emissiveColor = config.outerColor;
    outerMat.disableLighting = true;
    outerMat.alpha = 0.3;
    outerGlow.material = outerMat;

    return { core, innerGlow, outerGlow };
  }

  update(deltaTime: number, throttle: number): void {
    this.time += deltaTime;

    // Clamp throttle to minimum so engines never look completely off
    const minThrottle = 0.15;
    const effectiveThrottle = minThrottle + throttle * (1 - minThrottle);

    // Slower flicker for billboards only
    const flicker = 0.95 + Math.sin(this.time * 0.005) * 0.05 + Math.random() * 0.02;

    for (const exhaust of this.exhaustNodes) {
      // Cone scales with throttle - no flickering
      exhaust.core.scaling = new Vector3(effectiveThrottle, effectiveThrottle, effectiveThrottle);

      // Scale billboards based on throttle with subtle flicker
      const billboardScale = effectiveThrottle * flicker;
      exhaust.innerGlow.scaling = new Vector3(billboardScale, billboardScale, 1);
      exhaust.outerGlow.scaling = new Vector3(billboardScale * 1.1, billboardScale * 1.1, 1);

      // Vary alpha based on throttle with subtle flicker
      const innerMat = exhaust.innerGlow.material as StandardMaterial;
      const outerMat = exhaust.outerGlow.material as StandardMaterial;
      innerMat.alpha = (0.4 + Math.random() * 0.1) * effectiveThrottle;
      outerMat.alpha = (0.2 + Math.random() * 0.05) * effectiveThrottle;

      // Core color: yellow at idle → white at full throttle
      const coreMat = exhaust.core.material as StandardMaterial;
      // At min throttle: yellow (1, 0.8, 0.3), at max: white (1, 1, 1)
      const g = 0.8 + effectiveThrottle * 0.2;
      const b = 0.3 + effectiveThrottle * 0.7;
      coreMat.emissiveColor = new Color3(1, g, b);
    }
  }

  dispose(): void {
    for (const exhaust of this.exhaustNodes) {
      exhaust.core.dispose();
      exhaust.innerGlow.dispose();
      exhaust.outerGlow.dispose();
    }
    this.exhaustNodes = [];
  }
}
