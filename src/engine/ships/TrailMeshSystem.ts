import {
  Color3,
  DynamicTexture,
  StandardMaterial,
  TrailMesh,
  type AbstractMesh,
  type ITrailMeshOptions,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';

export interface IEngineTrail {
  update(deltaTime: number): void;
  dispose(): void;
}

export default class TrailMeshSystem implements IEngineTrail {
  private trailMeshes: TrailMesh[] = [];

  constructor(engineNodes: TransformNode[], scene: Scene) {
    // Create procedural exhaust texture (shared by all trails)
    const texture = this.createExhaustTexture('engine-trail-tex', scene);

    const opts: ITrailMeshOptions = {
      diameter: 0.5,
      length: 50 * 6,
      segments: 10 * 6,
      sections: 2,
      doNotTaper: true,
    };

    for (const node of engineNodes) {
      const trail = new TrailMesh(`${node.name}-trail`, node as AbstractMesh, scene, opts);

      const mat = new StandardMaterial(`${node.name}-trail-mat`, scene);
      mat.emissiveColor = new Color3(1, 0.5, 0);
      mat.disableLighting = true;
      mat.diffuseTexture = texture;
      mat.opacityTexture = texture;
      mat.useAlphaFromDiffuseTexture = true;
      trail.material = mat;

      this.trailMeshes.push(trail);
    }
  }

  private createExhaustTexture(name: string, scene: Scene): DynamicTexture {
    const size = 256;
    const texture = new DynamicTexture(name, size, scene, false);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    const imageData = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Normalized coordinates (0-1)
        const nx = x / size;
        const ny = y / size;

        // Distance from center (0 at center, 1 at edge)
        const centerDist = Math.abs(nx - 0.5) * 2;

        // Core intensity - sharp falloff from center
        const core = Math.pow(1 - centerDist, 3);

        // Outer glow - softer falloff
        const glow = Math.pow(1 - centerDist, 1.5);

        // Length fade (ny = 0 is hot end, 1 is tail)
        const lengthFade = Math.pow(1 - ny, 0.8);

        // Color: white core → orange → red along length
        const r = Math.min(255, (core * 255 + glow * 200) * lengthFade);
        const g = Math.min(255, (core * 200 + glow * 100) * lengthFade * (1 - ny * 0.5));
        const b = Math.min(255, core * 180 * lengthFade * (1 - ny));
        const a = glow * lengthFade * 255;

        const idx = (y * size + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    texture.update();
    texture.hasAlpha = true;

    return texture;
  }

  update(_deltaTime: number): void {
    // TrailMesh updates automatically with the mesh it's attached to
  }

  dispose(): void {
    for (const trail of this.trailMeshes) {
      trail.dispose();
    }
    this.trailMeshes = [];
  }
}
