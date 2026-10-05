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
  protected mesh: Mesh | null = null;
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
    this.mesh = this.createPlaceholderMesh();
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

  getMesh(): Mesh | null {
    return this.mesh;
  }

  protected createPlaceholderMesh(): Mesh {
    const body = createSphere($engine);
    // material must be assigned BEFORE addToScene: the scene groups meshes by material at add time
    body.material = createStandardMaterial();
    addToScene($scene, body);
    this.attachToRoot([body]);
    return body;
  }

  // RenderableObject
  protected async loadModelAsync(pmodelPath?: string): Promise<void> {
    this.logger.log('Begin load model of renderable:');
    if (!this.modelPath && !pmodelPath) return;
    if (pmodelPath) this.modelPath = pmodelPath;

    let container;
    try {
      container = await loadGltf($engine, this.modelPath);
    } catch (e) {
      console.error('[dbg] gltf load FAILED', this.modelPath, e);
      return;
    }

    if (this.mesh) removeFromScene($scene, this.mesh);

    if (this.disposed) { // just in case theres a race
      return;
    }
    addToScene($scene, container);

    const meshes = getContainerMeshes(container);
    this.mesh = meshes[0];
    // glTF puts every mesh under its own root node(s) (container.entities), which is what
    // actually has to move. Parent those to our root, not the meshes themselves.
    this.attachToRoot(container.entities.filter((e): e is TransformNode => 'rotationQuaternion' in e));
    this.onModelLoaded(container);
    this.logger.log('end load model of renderable:');
  }

  protected onModelLoaded(_result: AssetContainer): void {}
}
