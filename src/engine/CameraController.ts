import { ArcRotateCamera, Vector3, Scene, FollowCamera, TransformNode } from '@babylonjs/core';
import GameObject from './GameObject';
import type { useGameStore } from '@/stores/gameState';
import useLogStore from '@/stores/logs';

type GameStore = ReturnType<typeof useGameStore>;

export default class CameraController {
  private camera: ArcRotateCamera;
  private followCamera?: FollowCamera;
  private cameraPivot?: TransformNode;
  private cameraMode: 'arcRotate' | 'follow' | 'unset' = 'unset';
  private target: GameObject | null = null;
  private scene: Scene;
  private offset: Vector3;
  private gameStore: GameStore;
  logger: ReturnType<typeof useLogStore>;
  private localOffset = new Vector3(0, 5, 25); // behind + above, local space

  constructor(scene: Scene, canvas: HTMLCanvasElement, gameStore: GameStore) {
    this.logger = useLogStore();
    this.scene = scene;
    this.gameStore = gameStore;
    this.camera = new ArcRotateCamera(
      'GameCamera',
      Math.PI / 2,
      Math.PI / 4,
      15,
      Vector3.Zero(),
      scene,
    );
    this.offset = new Vector3(0, 5, -10);
    this.logger.log('The camera controller is setup.');
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
    if (this.target) this.camera.setTarget(this.target.position);
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  update(): void {
    const desiredMode = this.gameStore.cameraMode === 'free' ? 'arcRotate' : 'follow';
    if (desiredMode !== this.cameraMode) {
      if (desiredMode === 'arcRotate') this.setArcRotateMode();
      else this.setFollowMode();
    }

    if (!this.target) return;
    if (this.cameraMode === 'arcRotate') {
      // keep orbiting the ship without touching alpha/beta/radius
      this.camera.target.copyFrom(this.target.position);
      return;
    }

    if (this.cameraMode !== 'follow') return;

    const q = this.target.orientation;

    const offset = new Vector3();
    this.localOffset.rotateByQuaternionToRef(q, offset);
    const desiredPos = this.target.position.add(offset);

    const up = new Vector3();
    Vector3.Up().rotateByQuaternionToRef(q, up);

    this.camera.setTarget(this.target.position);
    this.camera.setPosition(Vector3.Lerp(this.camera.position, desiredPos, 0.1));
    this.camera.upVector = up;
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

  setFollowMode(): void {
    this.cameraMode = 'follow';
    this.scene.activeCamera = this.camera;
    this.camera.detachControl();
  }

  setArcRotateMode(): void {
    console.log('Switching to arc rotate mode');
    this.cameraMode = 'arcRotate';

    // Make ArcRotateCamera the active camera and enable controls
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    this.camera.upVector = Vector3.Up();
  }
}
