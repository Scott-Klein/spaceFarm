import { createSphere, createStandardMaterial, type Mesh } from '@babylonjs/lite';
import RenderableObject from './RenderableObject';

export default class Planet extends RenderableObject {
  async create(): Promise<void> {
    await super.create();
  }

  protected createMeshes(): Mesh[] {
    const planetSphere = createSphere($engine, { diameter: 12 });
    return [planetSphere];
  }

  protected prepareMeshes(meshes: Mesh[]): void {
    for (const m of meshes) {
      if (!m.material) {
        const mat = createStandardMaterial();
        mat.diffuseColor = [0, 0.88, 0.2];
        m.material = mat;
      }
    }
  }
}
