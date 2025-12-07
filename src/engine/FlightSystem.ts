import { Vector3, Quaternion } from '@babylonjs/core';

export interface FlightInput {
  thrust?: number; // 0-1 (throttle)
  pitch?: number; // -1 to 1 (nose up/down)
  roll?: number; // -1 to 1 (barrel roll)
  yaw?: number; // -1 to 1 (turn left/right)
  brake?: boolean; // Air brake
}

export class FlightSystem {
  // Physics properties
  private velocity: Vector3 = Vector3.Zero();
  private angularVelocity: Vector3 = Vector3.Zero();
  private orientation: Quaternion = Quaternion.Identity();

  // Flight characteristics
  private maxThrust: number = 0.15;
  private maxSpeed: number = 2.0;
  private currentThrust: number = 0;
  private thrustAcceleration: number = 0.02; // How fast thrust changes
  private pitchSpeed: number = 0.02;
  private rollSpeed: number = 0.03;
  private yawSpeed: number = 0.015;

  // Inertia properties
  private mass: number = 1.0;
  private rotationalInertia: number = 5.0; // Resistance to rotation changes

  // Drag and stability
  private drag: number = 0.98;
  private angularDrag: number = 0.97; // Higher = more rotational momentum (was 0.85)
  private lateralDrag: number = 0.92; // Drag for sideways movement (creates drift feel)

  constructor(
    config?: Partial<{
      maxThrust: number;
      maxSpeed: number;
      pitchSpeed: number;
      rollSpeed: number;
      yawSpeed: number;
      drag: number;
      mass: number;
      rotationalInertia: number;
      lateralDrag: number;
    }>,
  ) {
    if (config) {
      this.maxThrust = config.maxThrust ?? this.maxThrust;
      this.maxSpeed = config.maxSpeed ?? this.maxSpeed;
      this.pitchSpeed = config.pitchSpeed ?? this.pitchSpeed;
      this.rollSpeed = config.rollSpeed ?? this.rollSpeed;
      this.yawSpeed = config.yawSpeed ?? this.yawSpeed;
      this.drag = config.drag ?? this.drag;
      this.mass = config.mass ?? this.mass;
      this.rotationalInertia = config.rotationalInertia ?? this.rotationalInertia;
      this.lateralDrag = config.lateralDrag ?? this.lateralDrag;
    }
  }

  update(deltaTime: number, input?: FlightInput): { position: Vector3; rotation: Vector3 } {
    // Normalize deltaTime (assuming 60fps as baseline)
    const dt = Math.min(deltaTime / 16.67, 2);

    if (input) {
      // Update thrust based on input
      if (input.thrust !== undefined) {
        const targetThrust = input.thrust * this.maxThrust;
        this.currentThrust += (targetThrust - this.currentThrust) * this.thrustAcceleration;
      }

      // Apply rotational inputs with inertia (mass/rotational inertia affects how quickly we spin)
      const rotationalForce = 1.0 / this.rotationalInertia;
      if (input.pitch) {
        this.angularVelocity.x += input.pitch * this.pitchSpeed * rotationalForce * dt;
      }
      if (input.roll) {
        this.angularVelocity.z += input.roll * this.rollSpeed * rotationalForce * dt;
      }
      if (input.yaw) {
        this.angularVelocity.y += input.yaw * this.yawSpeed * rotationalForce * dt;
      }

      // Air brake
      if (input.brake) {
        this.velocity.scaleInPlace(0.95);
        this.currentThrust *= 0.9;
      }
    }

    // Apply thrust ONLY in the direction the ship is facing (not velocity direction!)
    // This is key - thrust applies in ship's forward direction, not movement direction
    if (this.currentThrust > 0) {
      const forward = this.getForwardVector();
      const thrustForce = forward.scale(this.currentThrust / this.mass);
      this.velocity.addInPlace(thrustForce);
    }

    // Apply drag in world space (simple uniform drag for now)
    this.velocity.scaleInPlace(this.drag);
    this.angularVelocity.scaleInPlace(this.angularDrag);

    // Clamp velocity to max speed
    const currentSpeed = this.velocity.length();
    if (currentSpeed > this.maxSpeed) {
      this.velocity.normalize().scaleInPlace(this.maxSpeed);
    }

    // Update orientation based on angular velocity
    const rotationChange = Quaternion.RotationYawPitchRoll(
      this.angularVelocity.y * dt,
      this.angularVelocity.x * dt,
      this.angularVelocity.z * dt,
    );
    this.orientation.multiplyInPlace(rotationChange);
    this.orientation.normalize();

    // Convert quaternion to Euler angles for the GameObject
    const euler = this.orientation.toEulerAngles();

    return {
      position: this.velocity.clone(),
      rotation: euler,
    };
  }

  private getForwardVector(): Vector3 {
    // Get the forward direction based on current orientation
    const forward = new Vector3(0, 0, 1);
    return forward.applyRotationQuaternion(this.orientation);
  }

  private getLocalVelocity(): Vector3 {
    // Convert world velocity to local space (relative to ship orientation)
    const inverseOrientation = Quaternion.Inverse(this.orientation);
    return this.velocity.applyRotationQuaternion(inverseOrientation);
  }

  private localToWorldVelocity(localVel: Vector3): Vector3 {
    // Convert local velocity back to world space
    return localVel.applyRotationQuaternion(this.orientation);
  }

  // Getters for flight data
  getVelocity(): Vector3 {
    return this.velocity.clone();
  }

  getSpeed(): number {
    return this.velocity.length();
  }

  getCurrentThrust(): number {
    return this.currentThrust;
  }

  getThrustPercent(): number {
    return (this.currentThrust / this.maxThrust) * 100;
  }

  getOrientation(): Quaternion {
    return this.orientation.clone();
  }

  // Setters for direct manipulation
  setVelocity(velocity: Vector3): void {
    this.velocity = velocity.clone();
  }

  setOrientation(quaternion: Quaternion): void {
    this.orientation = quaternion.clone();
  }

  setThrust(thrust: number): void {
    this.currentThrust = Math.max(0, Math.min(thrust, this.maxThrust));
  }

  // Reset all flight state
  reset(): void {
    this.velocity = Vector3.Zero();
    this.angularVelocity = Vector3.Zero();
    this.orientation = Quaternion.Identity();
    this.currentThrust = 0;
  }
}
