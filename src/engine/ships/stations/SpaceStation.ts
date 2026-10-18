import RenderableObject from '@/engine/game/RenderableObject';


export default class SpaceStation extends RenderableObject {

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
  }

    getLabel() {
    return 'SpaceStation'
  }

  async create(): Promise<string> {
    await super.create();

    return `${this.getLabel()}:${crypto.randomUUID()}`
  }
}
