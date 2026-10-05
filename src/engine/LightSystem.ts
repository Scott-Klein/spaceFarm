import {
  addToScene,
  createPcfSpotlightShadowGenerator,
  createSphere,
  createSpotLight,
  createStandardMaterial,
  setShadowTaskCasterMeshes,
  subtractVec3,
  type Mesh,
  type SpotLight,
} from '@babylonjs/lite';
import GameObject from './GameObject';
import type RenderableObject from './game/RenderableObject';

export interface LightGroup {
  light: SpotLight;
  members: Set<GameObject>;
  target: GameObject;
}

export default class LightSystem {
  private lightGroups: Map<string, LightGroup>;
  private sun: Mesh;

  constructor() {
    this.lightGroups = new Map<string, LightGroup>();
    const sun = createSphere($engine, { diameter: 50 });
    const sunMat = createStandardMaterial();
    sunMat.emissiveColor = [1.0, 0.85, 0.5];
    sun.material = sunMat;
    addToScene($scene, sun);
    this.sun = sun;
  }

  public RegisterGroup(gameObject: RenderableObject, groupId: string) {
    if (this.lightGroups.has(groupId)) {
      // add this object as a member
      const lg = this.lightGroups.get(groupId);
      lg?.members.add(gameObject);
    } else {
      // create the group
      const newGroup: LightGroup = {
        light: this.createSunLight(gameObject),
        members: new Set<GameObject>([gameObject]),
        target: gameObject,
      };
      newGroup.light.shadowGenerator = createPcfSpotlightShadowGenerator($engine, newGroup.light, { mapSize: 2048, near: 0.5, far: 6000 });
      setShadowTaskCasterMeshes(newGroup.light.shadowGenerator, gameObject.getMesh())
      addToScene($scene, newGroup.light);
      this.lightGroups.set(groupId, newGroup);
    }
  }

  public update(): void {
    for (const [_key, value] of this.lightGroups) {
      this.targetSun(value.target, value.light);
    }
  }

  private createSunLight(target: GameObject): SpotLight {
    const dir = subtractVec3(target.position, this.sun.position);
    const sl = createSpotLight(
      [this.sun.position.x, this.sun.position.y, this.sun.position.z],
      [dir.x, dir.y, dir.z],
      1.2,
      0,
      1.0,
    );
    return sl;
  }

  private targetSun(target: GameObject, sunLight: SpotLight): void {
    const dir = subtractVec3(target.position, this.sun.position);
    sunLight.direction.copyFrom(dir);
  }
}
