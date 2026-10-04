import RenderableObject from '@/engine/game/RenderableObject';


export default class SpaceStation extends RenderableObject {

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
  }

  create(): void {
    this.loadModelAsync();
  }
}
