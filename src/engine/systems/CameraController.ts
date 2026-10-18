import GameObject from '@/engine/core/GameObject';
import useLogStore from '@/stores/logs';
import {
  type ArcRotateCamera,
  type Mat4,
  type Mesh,
  type ScreenProjectionOptions,
  type ScreenProjectionResult,
  type Vec3,
  attachControl,
  createArcRotateCamera,
  getEffectiveAspectRatio,
  getViewMatrix,
  getViewProjectionMatrix,
  projectWorldToScreenToRef,
  resolveCameraViewport,
  setCameraLimits,
} from '@babylonjs/lite';

export default class CameraController {
  private camera: ArcRotateCamera;
  private cameraMode: 'arcRotate' | 'follow' | 'unset' = 'unset';
  private target: GameObject | null = null;
  private skybox: Mesh | null = null;

  private w2sResult: ScreenProjectionResult = {
    clipped: false,
    cssX: 0,
    cssY: 0,
    clipW: 0,
    behindCamera: false,
    offscreen: false,
    x: 0,
    y: 0,
    z: 0
  };
  logger: ReturnType<typeof useLogStore>;
  private localOffset: Vec3 = { x: 0, y: 5, z: 25 }; // new Vector3(0, 5, 25); // behind + above, local space

  constructor() {
    this.logger = useLogStore();
    this.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
    this.camera.farPlane = 750000;
    this.logger.log('The camera controller is setup.');
    setCameraLimits(this.camera, { lowerRadiusLimit: 10, upperRadiusLimit: 100 });
    this.setArcRotateMode();
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
    this.update();
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  world2Screen(pos: Vec3): {x: number, y: number, behindCamera: boolean} {
    const view = this.getView();
    const viewProject = this.getViewProjection();
    const opts: ScreenProjectionOptions = {
      viewport: resolveCameraViewport(this.camera, $canvas.width, $canvas.height),
      backingWidth: $canvas.width,
      backingHeight: $canvas.height,
      cssWidth: $canvas.clientWidth,
      cssHeight: $canvas.clientHeight
    };
    const w2s = projectWorldToScreenToRef(pos, view, viewProject, opts, this.w2sResult);
    return { x: w2s.cssX, y: w2s.cssY, behindCamera: w2s.offscreen }
  }

  getView(): Mat4 {
    if (this.camera) {
      return getViewMatrix(this.camera);
    }
    throw new Error('Dont call this without a camera you idiot. you must wait until the camera is ready.')
  }

  getViewProjection(): Mat4 {
    if (this.camera) {
      const aspect = getEffectiveAspectRatio(this.camera, $engine.canvas.width, $engine.canvas.height);
      return getViewProjectionMatrix(this.camera, aspect);
    }
    throw new Error('dont call this without a camera? Are you stupid?')
  }

  update(): void {
    if (!this.target) return;
    // keep orbiting the ship without touching alpha/beta/radius
    // camera.target is an ObservableVec3; copy into it (don't replace it) so the camera is marked dirty
    const { x, y, z } = this.target.position;
    this.camera.target.x = x;
    this.camera.target.y = y;
    this.camera.target.z = z;

    if (this.skybox) {
      this.skybox.position.copyFrom(this.target.position);
    }
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setDistance(distance: number): void {
    this.camera.radius = distance;
  }

  setSkyBox(sky: Mesh): void {
    this.skybox = sky;
  }

  setArcRotateMode(): void {
    console.log('Switching to arc rotate mode');
    this.cameraMode = 'arcRotate';

    // Make ArcRotateCamera the active camera and enable controls
    $scene.camera = this.camera;
    attachControl(this.camera, $canvas, $scene);
  }
}
