import {
  Scene,
  Mesh,
  Vector3,
  StandardMaterial,
  Color3,
  CreateBox,
  TransformNode,
} from '@babylonjs/core';
import GameObject from '../GameObject';
import FlightSystem from '../FlightSystem';
import { type IEngineTrail } from './TrailMeshSystem';
import EngineExhaustSystem from './EngineExhaustSystem';
import type { ControlInput } from '../Controller';

export default class Spaceship extends GameObject {
  private color: Color3;
  private flightSystem: FlightSystem;
  protected scene: Scene | null = null;
  protected engineTrail: IEngineTrail | null = null;
  protected engineNodes: TransformNode[] = [];

  constructor(id: string, color: Color3) {
    super(id);
    this.color = color;
    this.flightSystem = new FlightSystem();
  }

  create(scene: Scene): void {
    this.scene = scene;
    this.mesh = this.createPlaceholderMesh();

    if (this.mesh) {
      this.initializeMesh(this.mesh);
      this.createDefaultEngineNodes();
      this.engineTrail = new EngineExhaustSystem(this.engineNodes, scene);
    }
  }

  protected initializeMesh(mesh: Mesh): void {
    mesh.name = this.id;

    // Apply material
    const material = new StandardMaterial(`${this.id}-material`, this.scene!);
    material.diffuseColor = this.color;
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    mesh.material = material;

    // Sync transform
    mesh.position = this.position;
    mesh.rotation = this.rotation;
  }

  protected createDefaultEngineNodes(): void {
    if (!this.mesh || !this.scene) return;

    // Create a single engine node behind the ship
    const engineNode = new TransformNode(`${this.id}-engine`, this.scene);
    engineNode.parent = this.mesh;
    engineNode.position = new Vector3(0, 0, -1); // Behind the ship
    this.engineNodes.push(engineNode);
  }

  getEngineNodes(): TransformNode[] {
    return this.engineNodes;
  }

  private createPlaceholderMesh(): Mesh | null {
    const body = CreateBox(`${this.id}-body`, { width: 1, height: 0.5, depth: 2 });
    const cockpit = CreateBox(`${this.id}-cockpit`, { width: 0.8, height: 0.6, depth: 0.8 });
    cockpit.position.y = 0.5;
    cockpit.position.z = 0.3;

    const leftWing = CreateBox(`${this.id}-leftWing`, { width: 2, height: 0.1, depth: 1 });
    leftWing.position.x = -1.5;
    leftWing.position.z = -0.3;

    const rightWing = CreateBox(`${this.id}-rightWing`, { width: 2, height: 0.1, depth: 1 });
    rightWing.position.x = 1.5;
    rightWing.position.z = -0.3;

    return Mesh.MergeMeshes(
      [body, cockpit, leftWing, rightWing],
      true,
      false,
      undefined,
      false,
      true,
    );
  }

  protected handleControlInput(input: ControlInput): void {
  if (input.flight) {
    const result = this.flightSystem.update(input.flight);
    this.position.addInPlace(result.position);// delta
    this.rotation = result.rotation;// absolute
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

  getVelocity(): Vector3 {
    return this.flightSystem.getVelocity();
  }

  getSpeed(): number {
    return this.flightSystem.getSpeed();
  }

  getThrustPercent(): number {
    return this.flightSystem.getThrustPercent();
  }

  /**
   * Get orientation angles in degrees
   * @returns { pitch, roll, yaw } in degrees
   */
  getOrientationAngles(): { pitch: number; roll: number; yaw: number } {
    // Convert Babylon rotation vector (in radians) to degrees
    const toDegrees = (rad: number) => (rad * 180) / Math.PI;
    return {
      pitch: toDegrees(this.rotation.x),
      roll: toDegrees(this.rotation.z),
      yaw: toDegrees(this.rotation.y),
    };
  }
}
