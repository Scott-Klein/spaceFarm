import GameObject from '@/engine/GameObject';
import useLogStore from '@/stores/logs';
import {
  addToScene,
  createSphere,
  getContainerMeshes,
  loadGltf,
  removeFromScene,
  type AssetContainer,
  type Mesh,
  type TransformNode,
} from '@babylonjs/lite';

export default class RenderableObject extends GameObject {
  // the following two properties come from ISceneLoaderAsyncResult
  // we'll keep more properties in the future if we need them
  protected mesh: Mesh | null = null;
  protected transformNodes: TransformNode[] = [];

  protected modelPath: string = '';
  logger: ReturnType<typeof useLogStore>;
  constructor() {
    super();
    this.logger = useLogStore();
  }

  create(): void {
    this.mesh = this.createPlaceholderMesh();
  }

  updateRender(deltaTime: number): void {
    super.updateRender(deltaTime);
    if (!this.mesh) return;

    this.mesh.position.copyFrom(this.position);

    this.mesh.rotationQuaternion.copyFrom(this.orientation);
  }

  getMesh(): Mesh | null {
    return this.mesh;
  }

  protected createPlaceholderMesh(): Mesh {
    const body = createSphere($engine);
    addToScene($scene, body);
    return body;
  }

  // RenderableObject
  protected async loadModelAsync(pmodelPath?: string): Promise<void> {
    this.logger.log('Begin load model of renderable:');
    if (!this.modelPath && !pmodelPath) return;
    if (pmodelPath) this.modelPath = pmodelPath;

    const container = await loadGltf($engine, this.modelPath);

    if (this.mesh) removeFromScene($scene, this.mesh);

    if (this.disposed) { // just in case theres a race
      return;
    }
    addToScene($scene, container);

    this.mesh = getContainerMeshes(container)[0];
    this.onModelLoaded(container);
    this.logger.log('end load model of renderable:');
  }

  protected onModelLoaded(_result: AssetContainer): void {}
}
