import RenderableObject from '@/engine/game/RenderableObject';
import { createSphere, createStandardMaterial, type Mesh } from '@babylonjs/lite';

class Asteroid extends RenderableObject {

  constructor() {
    super();

  }

  protected createMeshes(): Mesh[] {
    return [createSphere($engine, { diameter: 1 })];
  }

  protected prepareMeshes(meshes: Mesh[]): void {
    for (const m of meshes) {
      const material = createStandardMaterial();
      material.diffuseColor = [0.8, 0.1, 0.21];
      material.backFaceCulling = false;
      m.material = material;
    }
  }

  getLabel(): string {
    return 'Asteroid';
  }
}

export default Asteroid;
