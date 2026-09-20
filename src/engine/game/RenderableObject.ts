import GameObject from '@/engine/GameObject';
import { CreateSphere, ImportMeshAsync, Mesh, Scene } from '@babylonjs/core';

export default class RenderableObject extends GameObject {
  protected scene: Scene | null = null;

  protected modelPath: string = '';

  create(scene: Scene): void {
    this.scene = scene;
    this.mesh = this.createPlaceholderMesh();
  }

  protected createPlaceholderMesh(): Mesh {
    const body = CreateSphere(`${this.id}-placeHolderMesh`);
    return body;
  }

  protected async loadModelAsync(): Promise<void> {
    if (!this.scene || this.modelPath.length === 0) {
      return;
    }

    const result = await ImportMeshAsync(this.modelPath, this.scene);

    // If multiple meshes, use the first as parent
    this.mesh = result.meshes[0] as Mesh;
    // Parent any and all other meshes to the first one
    for (let i = 1; i < result.meshes.length; i++) {
      const childMesh = result.meshes[i];
      if (childMesh && this.mesh) {
        childMesh.parent = this.mesh;
      }
    }
  }
}
