import {
  Scene,
  Color3,
  type ISceneLoaderAsyncResult,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import Spaceship from './Spaceship';
import EngineExhaustSystem from './EngineExhaustSystem';

export default class CapitalShip extends Spaceship {
  protected modelPath: string;

  constructor(id: string, color: Color3, modelPath: string) {
    super(id, color);
    this.modelPath = modelPath;
  }

  create(scene: Scene): void {
    super.create(scene); // sets this.scene, builds the placeholder

    this.createDefaultEngineNodes();
    this.engineTrail = new EngineExhaustSystem(this.engineNodes, scene);

    void this.loadModelAsync();
  }

  // CapitalShip
  dispose(): void {
    if (this.disposed) return;
    this.engineTrail?.dispose();
    this.engineTrail = null;
    for (const node of this.engineNodes) node.dispose();
    this.engineNodes = [];
    super.dispose();
  }

  // CapitalShip
  protected onModelLoaded(result: ISceneLoaderAsyncResult): void {
    this.engineTrail?.dispose();
    for (const node of this.engineNodes) node.dispose();

    const found = result.transformNodes.filter((n) =>
      /ENGINE_(SMALL|MEDIUM|LARGE|MASSIVE)/.test(n.name),
    );
    if (found.length) {
      this.engineNodes = found;
    } else {
      console.warn('No ENGINE_* nodes found in model, using default');
      this.engineNodes = [];
      this.createDefaultEngineNodes();
    }
    this.engineTrail = new EngineExhaustSystem(this.engineNodes, this.scene!);
  }
}
