import GameObject from "./GameObject";

export default class EmptyObject extends GameObject {

  async create(): Promise<string> {
    // I could also hide it in the interface from the constructor, but uncreated objects never get sent to the UI anyway,
    // so here is fine 
    this.hideFromInterface = true; 
    // nothing?
    return `Empty:${crypto.randomUUID()}`
  }

}