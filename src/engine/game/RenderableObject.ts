import GameObject from '@/engine/GameObject';
import useLogStore from '@/stores/logs';
import {
  addToScene,
  createSphere,
  createTransformNode,
  createStandardMaterial,
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
  protected mesh: Mesh[]  = [];
  protected transformNodes: TransformNode[] = [];
  // root that parents every mesh of this object; position/orientation are applied here
  protected root: TransformNode | null = null;

  protected modelPath: string = '';
  logger: ReturnType<typeof useLogStore>;
  constructor() {
    super();
    this.logger = useLogStore();
  }

  async create(): Promise<void> {
    let container: AssetContainer | null = null;
    let meshes: Mesh[];
    if (this.modelPath) {
      container = await this.loadModelAsync();
      if (!container) return;
      meshes = getContainerMeshes(container);
    } else {
      meshes = this.createPlaceholderMesh();
    }

    if (this.disposed) return; // just in case theres a race

    if (this.mesh.length) {
      for (const m of this.mesh) removeFromScene($scene, m);
    }
    this.mesh = meshes;

    // materials must be assigned BEFORE addToScene: the scene groups meshes by material at add time
    this.prepareMeshes(meshes);

    if (container) {
      addToScene($scene, container);
      // glTF puts every mesh under its own root node(s) (container.entities), which is what
      // actually has to move. Parent those to our root, not the meshes themselves.
      this.attachToRoot(container.entities.filter((e): e is TransformNode => 'rotationQuaternion' in e));
    } else {
      for (const m of meshes) addToScene($scene, m);
      this.attachToRoot(meshes);
    }

    // sync once so the object doesn't sit at the origin for a frame
    this.root!.position.copyFrom(this.position);
    this.root!.rotationQuaternion.copyFrom(this.orientation);

    if (container) this.onModelLoaded(container);
  }

  // hook for subclasses; runs before the meshes are added to the scene.
  // Default: only give a material to meshes that have none, so loaded models keep their own.
  protected prepareMeshes(meshes: Mesh[]): void {
    for (const m of meshes) {
      if (!m.material) m.material = createStandardMaterial();
    }
  }

  updateRender(deltaTime: number): void {
    super.updateRender(deltaTime);
    if (!this.root) return;

    this.root.position.copyFrom(this.position);
    this.root.rotationQuaternion.copyFrom(this.orientation);
  }

  getRoot(): TransformNode | null {
    return this.root;
  }

  // create the root node (once) and parent the given top-level nodes to it
  protected attachToRoot(nodes: TransformNode[]): void {
    if (!this.root) {
      this.root = createTransformNode(`${this.constructor.name}Root`);
      addToScene($scene, this.root);
    }
    for (const n of nodes) {
      if (!n.parent) n.parent = this.root;
    }
  }

  getMesh(): Mesh[] {
    return this.mesh;
  }

  protected createPlaceholderMesh(): Mesh[] {
    return [createSphere($engine)];
  }

  protected async loadModelAsync(pmodelPath?: string): Promise<AssetContainer | null> {
    this.logger.log('Begin load model of renderable:');
    if (pmodelPath) this.modelPath = pmodelPath;
    if (!this.modelPath) return null;

    try {
      const container = await loadGltf($engine, this.modelPath);
      this.logger.log('end load model of renderable:');
      return container;
    } catch (e) {
      console.error('[dbg] gltf load FAILED', this.modelPath, e);
      return null;
    }
  }

  protected onModelLoaded(_result: AssetContainer): void {}
}
