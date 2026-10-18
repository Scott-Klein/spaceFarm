import {
  addToScene,
  createCsmDirectionalShadowGenerator,
  createDirectionalLight,
  createSphere,
  createStandardMaterial,
  setShadowTaskCasterMeshes,
  subtractVec3,
  type CsmDirectionalShadowGeneratorConfig,
  type DirectionalLight,
  type Mesh,
} from '@babylonjs/lite';
import GameObject from './GameObject';
import type RenderableObject from './game/RenderableObject';

export interface LightGroup {
  light: DirectionalLight;
  members: Set<GameObject>;
  target: GameObject;
}

export default class LightSystem {
  private lightGroups: Map<string, LightGroup>;
  private sun: Mesh;

  constructor() {
    this.lightGroups = new Map<string, LightGroup>();
    const sun = createSphere($engine, { diameter: 5000 });
    const sunMat = createStandardMaterial();
    sunMat.emissiveColor = [1.0, 0.85, 0.5];
    sun.material = sunMat;
    addToScene($scene, sun);
    this.sun = sun;
  }

  public RegisterGroup(gameObject: RenderableObject, groupId: string) {
    // lets set all meshes to ahve the right id;
    for (const m of gameObject.getMesh()) {
      m.id = groupId;
    }

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
      newGroup.light.includedOnlyMeshIds = new Set([groupId]);

      const confCsm: CsmDirectionalShadowGeneratorConfig = {
        shadowMaxZ: 100,
        mapSize: 4096,
        stabilizeCascades: true,
        numCascades: 4,
        lambda: 0.9,
        worldSpaceBias: 0.35,
        frustumEdgeFalloff: 0.15,
        darkness: 0,
      };
      newGroup.light.shadowGenerator = createCsmDirectionalShadowGenerator(
        $engine,
        newGroup.light,
        confCsm,
      );

      setShadowTaskCasterMeshes(newGroup.light.shadowGenerator, gameObject.getMesh());
      addToScene($scene, newGroup.light);
      this.lightGroups.set(groupId, newGroup);
    }
  }

  public update(): void {
    for (const [_key, value] of this.lightGroups) {
      this.targetSun(value.target, value.light);
    }
  }

  private createSunLight(target: GameObject): DirectionalLight {
    const dir = subtractVec3(target.position, this.sun.position);
    const sl = createDirectionalLight([dir.x, dir.y, dir.z], 1.5);
    return sl;
  }

  private targetSun(target: GameObject, sunLight: DirectionalLight): void {
    const dir = subtractVec3(target.position, this.sun.position);
    sunLight.direction.copyFrom(dir);
  }
}
