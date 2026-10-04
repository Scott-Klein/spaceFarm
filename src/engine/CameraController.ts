import GameObject from './GameObject';
import useLogStore from '@/stores/logs';
import {
  type ArcRotateCamera,
  type Vec3,
  attachControl,
  createArcRotateCamera,
} from '@babylonjs/lite';

export default class CameraController {
  private camera: ArcRotateCamera;
  private cameraMode: 'arcRotate' | 'follow' | 'unset' = 'unset';
  private target: GameObject | null = null;
  logger: ReturnType<typeof useLogStore>;
  private localOffset: Vec3 = { x: 0, y: 5, z: 25 }; // new Vector3(0, 5, 25); // behind + above, local space

  constructor() {
    this.logger = useLogStore();
    this.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });

    this.logger.log('The camera controller is setup.');
    this.setArcRotateMode();
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
    if (this.target) this.camera.target = this.target.position;
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  update(): void {
    if (!this.target) return;
    // keep orbiting the ship without touching alpha/beta/radius
    this.camera.target = this.target.position;
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setDistance(distance: number): void {
    this.camera.radius = distance;
  }

  setAngle(alpha: number, beta: number): void {
    this.camera.alpha = alpha;
    this.camera.beta = beta;
  }

  setArcRotateMode(): void {
    console.log('Switching to arc rotate mode');
    this.cameraMode = 'arcRotate';

    // Make ArcRotateCamera the active camera and enable controls
    $scene.camera = this.camera;
    attachControl(this.camera, $canvas, $scene);
  }
}
