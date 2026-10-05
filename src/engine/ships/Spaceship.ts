import FlightSystem from '../FlightSystem';
import type { ControlInput } from '../Controller';
import RenderableObject from '../game/RenderableObject';
import {
  addVec3InPlace,
  createBox,
  createCsgFromMesh,
  createMeshFromCsg,
  createSphere,
  createStandardMaterial,
  createTransformNode,
  csgUnion,
  quatToEulerXYZTuple,
  type Mesh,
  type TransformNode,
  type Vec3,
  type Vec3Tuple,
} from '@babylonjs/lite';
import { toDegrees } from '@/utils/extensions';

export default class Spaceship extends RenderableObject {
  private color: Vec3Tuple;
  // must be known before create() runs; prepareMeshes stamps it on every mesh
  private lightGroupId: string;
  private flightSystem: FlightSystem;
  protected engineNodes: TransformNode[] = [];

  constructor(modelPath: string, color: Vec3Tuple, lightGroupId: string = '') {
    super();
    this.lightGroupId = lightGroupId;
    this.modelPath = modelPath;
    this.color = color;
    this.flightSystem = new FlightSystem();
  }

  async create(): Promise<void> {
    await super.create();
    this.createDefaultEngineNodes();
  }

  // runs inside create() before the meshes are added to the scene
  protected prepareMeshes(meshes: Mesh[]): void {
    super.prepareMeshes(meshes);
    const material = createStandardMaterial();
    material.diffuseColor = this.color;
    material.specularColor = [0.2, 0.2, 0.2];
    for (const m of meshes) {
      m.material = material;
      m.receiveShadows = true;
      // light include/exclude filtering matches on mesh id
      if (this.lightGroupId) m.id = this.lightGroupId;
    }
  }

  protected createDefaultEngineNodes(): void {
    if (!this.root) return;
    const engineNode = createTransformNode(`engine`, 0, 0, -1);
    engineNode.parent = this.root;
    this.engineNodes.push(engineNode);
  }

  getEngineNodes(): TransformNode[] {
    return this.engineNodes;
  }

  protected createPlaceholderMesh(): Mesh[] {
    const body = createBox($engine, { width: 1, height: 0.5, depth: 2 });
    const cockpit = createBox($engine, { width: 0.8, height: 0.6, depth: 0.8 });

    cockpit.position.y = 0.5;
    cockpit.position.z = 0.3;

    const leftWing = createBox($engine, { width: 2, height: 0.1, depth: 1 });
    leftWing.position.x = -1.5;
    leftWing.position.z = -0.3;

    const rightWing = createBox($engine, { width: 2, height: 0.1, depth: 1 });
    rightWing.position.x = 1.5;
    rightWing.position.z = -0.3;

    const csg1 = createCsgFromMesh(body);
    const csg2 = createCsgFromMesh(cockpit);
    const csgwind = createCsgFromMesh(leftWing);
    const csgRight = createCsgFromMesh(rightWing);
    const res = csgUnion(csg1, csg2);
    const res2 = csgUnion(res, csgwind);
    const res3 = csgUnion(res2, csgRight);
    const csgMesh = createMeshFromCsg($engine, res3);
    const mergedMesh = csgMesh || createSphere($engine);
    return [mergedMesh];
  }

  protected handleControlInput(input: ControlInput): void {
    if (input.flight) {
      const result = this.flightSystem.update(input.flight);
      addVec3InPlace(this.position, result.velocity);

      this.orientation = result.orientation;
    }
  }

  updatePhysics(): void {
    super.updatePhysics();
  }

  updateRender(deltaTime: number): void {
    super.updateRender(deltaTime);
    // apply all render effects after gameobject.
  }

  getFlightSystem(): FlightSystem {
    return this.flightSystem;
  }

  getVelocity(): Vec3 {
    return this.flightSystem.getVelocity();
  }

  getSpeed(): number {
    return this.flightSystem.getSpeed();
  }

  getThrustPercent(): number {
    return this.flightSystem.getThrustPercent();
  }

  getOrientationAngles(): { pitch: number; roll: number; yaw: number } {
    const [pitch, yaw, roll]  =  quatToEulerXYZTuple(this.orientation.x, this.orientation.y, this.orientation.z, this.orientation.w)
    return {
      pitch: toDegrees(pitch),
      yaw: toDegrees(yaw),
      roll: toDegrees(roll),
    };
  }
}
