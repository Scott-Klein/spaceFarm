import { multiplyQuat, normalizeQuat, quatFromEuler, quatIdentity, rotateVec3ByQuat, vec3Length } from '@/utils/extensions';
import { addVec3InPlace, scaleVec3, scaleVec3InPlace, vec3, type Quat, type Vec3 } from '@babylonjs/lite';

export interface FlightInput {
  thrust?: number; // 0-1 (throttle)
  pitch?: number; // -1 to 1 (nose up/down)
  roll?: number; // -1 to 1 (barrel roll)
  yaw?: number; // -1 to 1 (turn left/right)
  brake?: boolean; // Air brake
}

const TUNE_MASS = 1;
const TUNE_ROTATION_DRAG = 0.99;
const TUNE_ROTATIONAL_INTERTIA = 1;
const TUNE_THRUST = 0.1;

export default class FlightSystem {
  // Physics properties
  private velocity: Vec3 = vec3(0,0,0);
  private angularVelocity: Vec3 = vec3(0,0,0);
  private orientation: Quat = quatIdentity();

  // Flight characteristics
  private maxThrust: number = 1;
  private currentThrust: number = 0;

  // Inertia properties
  private _mass: number = 100.0;
  private rotationalInertia: number = 145.0; // Resistance to rotation changes

  // Drag and stability
  private drag: number = 0.997;

  constructor(
    config?: Partial<{
      maxThrust: number;
      drag: number;
      mass: number;
      rotationalInertia: number;
    }>,
  ) {
    if (config) {
      this.maxThrust = config.maxThrust ?? this.maxThrust;
      this.drag = config.drag ?? this.drag;
      this._mass = config.mass ?? this._mass;
      this.rotationalInertia = config.rotationalInertia ?? this.rotationalInertia;
    }
  }

  update(input?: FlightInput): { velocity: Vec3; orientation: Quat } {
    if (input) {
      // Update thrust based on input
      if (input.thrust !== undefined) {
        const targetThrust = input.thrust * this.maxThrust;
        this.currentThrust += targetThrust - this.currentThrust;
      }

      // Apply rotational inputs with inertia (mass/rotational inertia affects how quickly we spin)
      const rotationalForce = 1.0 / (this.mass * this.rotationalInertia * TUNE_ROTATIONAL_INTERTIA);
      if (input.pitch) {
        this.angularVelocity.x += input.pitch * rotationalForce;
      }
      if (input.roll) {
        this.angularVelocity.z += input.roll * rotationalForce;
      }
      if (input.yaw) {
        this.angularVelocity.y += input.yaw * rotationalForce;
      }

      // Air brake - dont think i'll use it
      if (input.brake) {
        scaleVec3InPlace(this.velocity, 0.95)
        this.currentThrust *= 0.9;
      }
    }

    // Apply thrust ONLY in the direction the ship is facing (not velocity direction!)
    // This is key - thrust applies in ship's forward direction, not movement direction
    if (this.currentThrust > 0) {
      const forward = this.getForwardVector();
      const thrustForce = scaleVec3(forward, (this.currentThrust / this.mass) * TUNE_THRUST)
      addVec3InPlace(this.velocity, thrustForce);
    }

    // Apply drag in world space (simple uniform drag for now)
    scaleVec3InPlace(this.velocity, this.drag);
    scaleVec3InPlace(this.angularVelocity, this.drag * TUNE_ROTATION_DRAG);

    // Update orientation based on angular velocity
    const rotationCHange = quatFromEuler(this.angularVelocity);
    this.orientation = multiplyQuat(this.orientation, rotationCHange);
    this.orientation = normalizeQuat(this.orientation);

    return {
      velocity: this.velocity, // no clone — caller reads it same tick
      orientation: this.orientation,
    };
  }

  private getForwardVector(): Vec3 {
    // Get the forward direction based on current orientation
    const forward = vec3(0, 0, 1);
    
    return rotateVec3ByQuat(this.orientation, forward);
  }

  public get mass(): number {
    return this._mass * TUNE_MASS;
  }

  // Getters for flight data
  getVelocity(): Vec3 {
    return { ...this.velocity };
  }

  getSpeed(): number {
    return vec3Length(this.velocity);
  }

  getCurrentThrust(): number {
    return this.currentThrust;
  }

  getThrustPercent(): number {
    return (this.currentThrust / this.maxThrust) * 100;
  }

  getOrientation(): Quat {
    return { ...this.orientation };
  }

  // Setters for direct manipulation
  setVelocity(velocity: Vec3): void {
    this.velocity = { ...velocity };
  }

  setOrientation(quaternion: Quat): void {
    this.orientation = { ...quaternion };
  }

  setThrust(thrust: number): void {
    this.currentThrust = Math.max(0, Math.min(thrust, this.maxThrust));
  }

  // Reset all flight state
  reset(): void {
    this.velocity = vec3(0, 0, 0);
    this.angularVelocity = vec3(0, 0, 0);
    this.orientation = quatIdentity();
    this.currentThrust = 0;
  }
}
