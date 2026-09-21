import RenderableObject from '@/engine/game/RenderableObject';
import type { Scene } from '@babylonjs/core';

export default class SpaceStation extends RenderableObject {

  constructor(id: string, modelPath: string) {
    super(id, modelPath);
  }

  create(scene: Scene): void {
    this.scene = scene;
    this.loadModelAsync();
  }
}
