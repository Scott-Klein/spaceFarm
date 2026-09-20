import GameObject from '@/engine/GameObject';
import {
  CreateSphere,
  ImportMeshAsync,
  Mesh,
  Quaternion,
  Scene,
  TransformNode,
  type ISceneLoaderAsyncResult,
} from '@babylonjs/core';
import useLogStore from '@/stores/logs';

export default class RenderableObject extends GameObject {
  protected scene: Scene | null = null;

  // the following two properties come from ISceneLoaderAsyncResult
  // we'll keep more properties in the future if we need them
  protected mesh: Mesh | null = null;
  protected transformNodes: TransformNode[] = [];

  protected modelPath: string = '';
  logger: ReturnType<typeof useLogStore>;
  constructor(id: string) {
    super(id);
    this.logger = useLogStore();
  }

  create(scene: Scene): void {
    this.scene = scene;
    this.mesh = this.createPlaceholderMesh();
  }

  updateRender(deltaTime: number): void {
    super.updateRender(deltaTime);
    if (!this.mesh) return;

    this.mesh.position.copyFrom(this.position);

    this.mesh.rotationQuaternion ??= Quaternion.Identity();
    this.mesh.rotationQuaternion.copyFrom(this.orientation);
  }

  getMesh(): Mesh | null {
    return this.mesh;
  }

  protected createPlaceholderMesh(): Mesh {
    const body = CreateSphere(`${this.id}-placeHolderMesh`);
    return body;
  }

  // RenderableObject
  protected async loadModelAsync(): Promise<void> {
    this.logger.log('Begin load model of renderable:' + this.id)
    if (!this.scene || !this.modelPath) return;
    const result = await ImportMeshAsync(this.modelPath, this.scene);
    if (this.disposed) {
      result.meshes[0]?.dispose();
      return;
    }

    this.mesh?.dispose();
    this.mesh = result.meshes[0] as Mesh;
    this.mesh.name = this.id;
    this.onModelLoaded(result);
        this.logger.log('end load model of renderable:' + this.id)
  }

  protected onModelLoaded(_result: ISceneLoaderAsyncResult): void {}
}
