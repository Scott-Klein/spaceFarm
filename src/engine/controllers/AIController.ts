import { Quaternion, Vector3 } from '@babylonjs/core';
import Controller, { type ControlInput } from '../Controller';
import type { FlightInput } from '../FlightSystem';
import GameObject from '../GameObject';
import useLogStore from '@/stores/logs';
import MathBro from '@/utils/MathBro';

export type AIBehavior = 'idle' | 'patrol' | 'follow' | 'flee';

export default class AIController extends Controller {
  private behavior: AIBehavior;
  private target: GameObject | null = null;
  private patrolPoints: Vector3[] = [];
  private currentPatrolIndex = 0;
  private patrolRadius = 815;
  private patrolSatisfactiondistance = 1;
  private baseThrottle = 0.5;
  private idleTime = 0;
  private idleMaxTime = 3000; // 3 seconds
  logger: ReturnType<typeof useLogStore>;
  lastInput: FlightInput = {};

  constructor(behavior: AIBehavior = 'idle') {
    super();
    this.behavior = behavior;
    this.logger = useLogStore();
  }

  setBehavior(behavior: AIBehavior): void {
    this.behavior = behavior;
  }

  public get getBehaviour(): AIBehavior {
    return this.behavior;
  }

  public get getPatrolPoints(): Vector3[] {
    return this.patrolPoints;
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
    if (distance < this.patrolSatisfactiondistance) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      this.logger.log('Son of a bitch! ' + distance);
    }

    const { yaw, pitch } = this.computeSteering(targetPoint);
    const gain = 2;
    const flightInput: FlightInput = {
      thrust: 1,
      pitch: Math.max(-1, Math.min(1, pitch * gain)),
      roll: 0,
      yaw: Math.max(-1, Math.min(1, yaw * gain)),
    };
    this.lastInput = flightInput; // store it for debugging
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
      const randomPoint = MathBro.randomPointInSphere(center, this.patrolRadius);
      this.patrolPoints.push(randomPoint);
    }
  }

  private computeSteering(targetPos: Vector3): { yaw: number; pitch: number } {
    const obj = this.controlledObject!;
    const toTarget = targetPos.subtract(obj.position).normalize();

    // Use the authoritative quaternion; fall back to Euler only if it's not set
    const orientation = obj.getMesh()?.rotationQuaternion ?? Quaternion.FromEulerVector(obj.rotation);

    const localDir = new Vector3();
    toTarget.rotateByQuaternionToRef(Quaternion.Inverse(orientation), localDir);

    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.atan2(localDir.y, Math.hypot(localDir.x, localDir.z)) * -1;
    return { yaw, pitch };
  }
}
