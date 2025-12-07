import { Vector3, Quaternion } from '@babylonjs/core';

/**
 * FlightSystem handles the physics and control of spacecraft flight
 * Uses quaternions to avoid gimbal lock and provides proper 6DOF (degrees of freedom) flight
 */
export class FlightSystem {
  // Physics constants
  private static readonly TARGET_FPS = 60;
  private static readonly FRAME_TIME_MS = 1000 / FlightSystem.TARGET_FPS;
  private static readonly MIN_ROTATION_THRESHOLD = 0.0001;

  // Position and orientation
  public position: Vector3;
  public orientation: Quaternion;

  // Linear motion
  private velocity: Vector3;
  private maxSpeed: number;
  private thrustPower: number;
  private linearDrag: number;

  // Angular motion
  private angularVelocity: Vector3; // Rotation rates around local X, Y, Z axes
  private maxAngularSpeed: number;
  private rotationPower: number;
  private angularDrag: number;

  constructor(initialPosition: Vector3 = Vector3.Zero()) {
    this.position = initialPosition.clone();
    this.orientation = Quaternion.Identity();
    this.velocity = Vector3.Zero();
    this.angularVelocity = Vector3.Zero();

    // Flight parameters
    this.maxSpeed = 0.5;
    this.thrustPower = 0.002;
    this.linearDrag = 0.98;

    // Rotation parameters tuned for weighty, gradual feel
    this.maxAngularSpeed = 0.015; // Reduced from 0.04 for slower rotation
    this.rotationPower = 0.0003; // Reduced from 0.001 for gradual acceleration
    this.angularDrag = 0.96; // Increased from 0.92 for more momentum persistence
  }

  /**
   * Apply thrust in the direction relative to the ship's current orientation
   * @param localDirection Direction in ship's local space (e.g., Vector3(0, 0, 1) for forward)
   * @param amount Thrust amount (0-1)
   */
  applyThrust(localDirection: Vector3, amount: number): void {
    // Transform local direction to world space using the ship's orientation
    const worldDirection = localDirection.applyRotationQuaternion(this.orientation);
    const thrust = worldDirection.scale(this.thrustPower * amount);
    this.velocity.addInPlace(thrust);

    // Clamp to max speed
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.normalize().scaleInPlace(this.maxSpeed);
    }
  }

  /**
   * Apply rotation torque around local axes
   * @param pitch Rotation around local X axis (nose up/down)
   * @param yaw Rotation around local Y axis (nose left/right)
   * @param roll Rotation around local Z axis (barrel roll)
   */
  applyRotation(pitch: number, yaw: number, roll: number): void {
    // Add to angular velocity
    this.angularVelocity.x += pitch * this.rotationPower;
    this.angularVelocity.y += yaw * this.rotationPower;
    this.angularVelocity.z += roll * this.rotationPower;

    // Clamp angular velocity
    const angularSpeed = this.angularVelocity.length();
    if (angularSpeed > this.maxAngularSpeed) {
      this.angularVelocity.normalize().scaleInPlace(this.maxAngularSpeed);
    }
  }

  /**
   * Update the flight system physics
   * @param deltaTime Time since last update in milliseconds
   */
  update(deltaTime: number): void {
    // Apply linear drag
    this.velocity.scaleInPlace(this.linearDrag);

    // Update position - normalize delta time to target frame rate for consistent physics
    const timeScale = deltaTime / FlightSystem.FRAME_TIME_MS;
    const scaledVelocity = this.velocity.scale(timeScale);
    this.position.addInPlace(scaledVelocity);

    // Apply angular drag
    this.angularVelocity.scaleInPlace(this.angularDrag);

    // Update orientation using quaternion integration
    if (!this.angularVelocity.equals(Vector3.Zero())) {
      // Create a quaternion from angular velocity
      // Scale angular velocity by deltaTime
      const scaledAngularVel = this.angularVelocity.scale(timeScale);
      
      // Convert to quaternion (axis-angle representation)
      const angle = scaledAngularVel.length();
      if (angle > FlightSystem.MIN_ROTATION_THRESHOLD) {
        const axis = scaledAngularVel.normalize();
        const deltaRotation = Quaternion.RotationAxis(axis, angle);
        
        // Apply the rotation: new orientation = deltaRotation * old orientation
        this.orientation = deltaRotation.multiply(this.orientation);
        this.orientation.normalize();
      }
    }
  }

  /**
   * Get the forward direction in world space
   */
  getForwardDirection(): Vector3 {
    return Vector3.Forward().applyRotationQuaternion(this.orientation);
  }

  /**
   * Get the right direction in world space
   */
  getRightDirection(): Vector3 {
    return Vector3.Right().applyRotationQuaternion(this.orientation);
  }

  /**
   * Get the up direction in world space
   */
  getUpDirection(): Vector3 {
    return Vector3.Up().applyRotationQuaternion(this.orientation);
  }

  /**
   * Convert orientation to Euler angles for visualization
   */
  getEulerAngles(): Vector3 {
    return this.orientation.toEulerAngles();
  }

  /**
   * Get current velocity
   */
  getVelocity(): Vector3 {
    return this.velocity.clone();
  }

  /**
   * Set flight parameters
   */
  setFlightParameters(params: {
    maxSpeed?: number;
    thrustPower?: number;
    linearDrag?: number;
    maxAngularSpeed?: number;
    rotationPower?: number;
    angularDrag?: number;
  }): void {
    if (params.maxSpeed !== undefined) this.maxSpeed = params.maxSpeed;
    if (params.thrustPower !== undefined) this.thrustPower = params.thrustPower;
    if (params.linearDrag !== undefined) this.linearDrag = params.linearDrag;
    if (params.maxAngularSpeed !== undefined) this.maxAngularSpeed = params.maxAngularSpeed;
    if (params.rotationPower !== undefined) this.rotationPower = params.rotationPower;
    if (params.angularDrag !== undefined) this.angularDrag = params.angularDrag;
  }
}
