import { Vector3 } from '@babylonjs/core';
import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';
import type { FlightInput } from '../FlightSystem';
import { GameObject } from '../GameObject';

export type AIBehavior = 'idle' | 'patrol' | 'follow' | 'flee';

export class AIController extends Controller {
  private behavior: AIBehavior;
  private target: GameObject | null = null;
  private patrolPoints: Vector3[] = [];
  private currentPatrolIndex = 0;
  private patrolRadius = 15;
  private baseThrottle = 0.5;
  private idleTime = 0;
  private idleMaxTime = 3000; // 3 seconds

  constructor(behavior: AIBehavior = 'idle') {
    super();
    this.behavior = behavior;
  }

  setBehavior(behavior: AIBehavior): void {
    this.behavior = behavior;
  }

  setTarget(target: GameObject | null): void {
    this.target = target;
  }

  setPatrolPoints(points: Vector3[]): void {
    this.patrolPoints = points;
    this.currentPatrolIndex = 0;
  }

  update(deltaTime: number): ControlInput | null {
    if (!this.controlledObject) return null;

    switch (this.behavior) {
      case 'idle':
        return this.updateIdle(deltaTime);
      case 'patrol':
        return this.updatePatrol();
      case 'follow':
        return this.updateFollow();
      case 'flee':
        return this.updateFlee();
      default:
        return null;
    }
  }

  private updateIdle(_deltaTime: number): ControlInput | null {
    // Idle AI just maintains a steady slow cruise
    const flightInput: FlightInput = {
      thrust: 0.3,
      pitch: 0,
      roll: 0,
      yaw: 0,
    };

    return { flight: flightInput };
  }

  private updatePatrol(): ControlInput | null {
    if (!this.controlledObject) return null;

    // Generate patrol points if none exist
    if (this.patrolPoints.length === 0) {
      this.generatePatrolPoints();
    }

    const targetPoint = this.patrolPoints[this.currentPatrolIndex];
    if (!targetPoint) return null;

    const direction = targetPoint.subtract(this.controlledObject.position);
    const distance = direction.length();

    // If close enough to patrol point, move to next one
    if (distance < 5) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    }

    // Calculate desired direction and convert to flight controls
    const desiredDirection = direction.normalize();

    // Simple yaw control based on horizontal angle difference
    const yaw = Math.atan2(desiredDirection.x, desiredDirection.z);
    const pitch = Math.asin(desiredDirection.y);

    const flightInput: FlightInput = {
      thrust: this.baseThrottle,
      pitch: Math.max(-1, Math.min(1, pitch * 2)),
      roll: 0,
      yaw: Math.max(-1, Math.min(1, yaw * 0.5)),
    };

    return { flight: flightInput };
  }

  private updateFollow(): ControlInput | null {
    if (!this.controlledObject || !this.target) return null;

    const direction = this.target.position.subtract(this.controlledObject.position);
    const distance = direction.length();

    const desiredDirection = direction.normalize();

    // Calculate flight controls to point towards target
    const yaw = Math.atan2(desiredDirection.x, desiredDirection.z);
    const pitch = Math.asin(desiredDirection.y);

    // Increase throttle if far, decrease if close
    const throttle = distance < 5 ? 0.3 : distance > 15 ? 0.8 : 0.5;

    const flightInput: FlightInput = {
      thrust: throttle,
      pitch: Math.max(-1, Math.min(1, pitch * 2)),
      roll: 0,
      yaw: Math.max(-1, Math.min(1, yaw * 0.5)),
    };

    return { flight: flightInput };
  }

  private updateFlee(): ControlInput | null {
    if (!this.controlledObject || !this.target) return null;

    const direction = this.controlledObject.position.subtract(this.target.position);
    const distance = direction.length();

    // Only flee if target is close
    if (distance > 20) {
      return { flight: { thrust: 0.3, pitch: 0, roll: 0, yaw: 0 } };
    }

    const desiredDirection = direction.normalize();

    // Calculate flight controls to flee
    const yaw = Math.atan2(desiredDirection.x, desiredDirection.z);
    const pitch = Math.asin(desiredDirection.y);

    const flightInput: FlightInput = {
      thrust: 0.9, // Max throttle when fleeing
      pitch: Math.max(-1, Math.min(1, pitch * 2)),
      roll: 0,
      yaw: Math.max(-1, Math.min(1, yaw * 0.5)),
    };

    return { flight: flightInput };
  }

  private generatePatrolPoints(): void {
    const center = this.controlledObject?.position || Vector3.Zero();
    const numPoints = 4;

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * this.patrolRadius;
      const z = center.z + Math.sin(angle) * this.patrolRadius;
      this.patrolPoints.push(new Vector3(x, center.y, z));
    }
  }
}
