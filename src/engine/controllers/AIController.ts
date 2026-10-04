import { normalizeVec3, subtractVec3, type Vec3 } from '@babylonjs/lite';
import Controller, { type ControlInput } from '../Controller';
import type { FlightInput } from '../FlightSystem';
import GameObject from '../GameObject';
import useLogStore from '@/stores/logs';
import MathBro from '@/utils/MathBro';
import { invertQuat, rotateVec3ByQuat, vec3Length } from '@/utils/extensions';

export type AIBehavior = 'idle' | 'patrol' | 'follow' | 'flee';

export default class AIController extends Controller {
  private behavior: AIBehavior;
  private target: GameObject | null = null;
  private patrolPoints: Vec3[] = [];
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

  public get getPatrolPoints(): Vec3[] {
    return this.patrolPoints;
  }

  setTarget(target: GameObject | null): void {
    this.target = target;
  }

  setPatrolPoints(points: Vec3[]): void {
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
    
    const direction = subtractVec3(targetPoint, this.controlledObject.position);
    const distance = vec3Length(direction);

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

    const direction = subtractVec3(this.target.position, this.controlledObject.position);

    const distance = vec3Length(direction);

    const desiredDirection = normalizeVec3(direction);

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
    const direction = subtractVec3(this.controlledObject.position, this.target.position);

    const distance = vec3Length(direction);

    // Only flee if target is close
    if (distance > 20) {
      return { flight: { thrust: 0.3, pitch: 0, roll: 0, yaw: 0 } };
    }
    
    const desiredDirection = normalizeVec3(direction);;

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
    const center = this.controlledObject?.position || {x:0, y:0, z:0};
    const numPoints = 4;

    for (let i = 0; i < numPoints; i++) {
      const randomPoint = MathBro.randomPointInSphere(center, this.patrolRadius);
      this.patrolPoints.push(randomPoint);
    }
  }

  private computeSteering(targetPos: Vec3): { yaw: number; pitch: number } {
    const obj = this.controlledObject!;
    const toTarget = normalizeVec3(subtractVec3(targetPos, obj.position))

    const localDir = rotateVec3ByQuat(invertQuat(obj.orientation), toTarget);
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = -Math.atan2(localDir.y, Math.hypot(localDir.x, localDir.z));
    return { yaw, pitch };
  }
}
