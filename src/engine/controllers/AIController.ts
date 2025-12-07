import { Vector3 } from '@babylonjs/core';
import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';
import { GameObject } from '../GameObject';

export type AIBehavior = 'idle' | 'patrol' | 'follow' | 'flee';

export class AIController extends Controller {
  private behavior: AIBehavior;
  private target: GameObject | null = null;
  private patrolPoints: Vector3[] = [];
  private currentPatrolIndex = 0;
  private patrolRadius = 10;
  private moveSpeed = 0.02;
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

  private updateIdle(deltaTime: number): ControlInput | null {
    this.idleTime += deltaTime;

    // Randomly move a bit every few seconds
    if (this.idleTime > this.idleMaxTime) {
      this.idleTime = 0;
      const randomDir = new Vector3(
        (Math.random() - 0.5) * this.moveSpeed,
        0,
        (Math.random() - 0.5) * this.moveSpeed,
      );
      return { movement: randomDir };
    }

    return null;
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
    if (distance < 2) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    }

    const movement = direction.normalize().scale(this.moveSpeed);
    return { movement };
  }

  private updateFollow(): ControlInput | null {
    if (!this.controlledObject || !this.target) return null;

    const direction = this.target.position.subtract(this.controlledObject.position);
    const distance = direction.length();

    // Stop following if too close
    if (distance < 3) {
      return null;
    }

    const movement = direction.normalize().scale(this.moveSpeed);
    return { movement };
  }

  private updateFlee(): ControlInput | null {
    if (!this.controlledObject || !this.target) return null;

    const direction = this.controlledObject.position.subtract(this.target.position);
    const distance = direction.length();

    // Only flee if target is close
    if (distance > 15) {
      return null;
    }

    const movement = direction.normalize().scale(this.moveSpeed * 1.5);
    return { movement };
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
