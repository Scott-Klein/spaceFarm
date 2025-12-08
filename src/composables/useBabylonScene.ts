import { onMounted, onUnmounted, type Ref } from 'vue';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Scene } from '@babylonjs/core/scene';

export interface BabylonSceneOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  onSceneReady?: (scene: Scene, engine: WebGPUEngine) => void;
  onRender?: (scene: Scene) => void;
  engineOptions?: {
    adaptToDeviceRatio?: boolean;
    antialias?: boolean;
  };
}

export function useBabylonScene(options: BabylonSceneOptions) {
  const {
    canvasRef,
    onSceneReady,
    onRender,
    engineOptions = { adaptToDeviceRatio: true, antialias: true }
  } = options;

  let engine: WebGPUEngine | null = null;
  let scene: Scene | null = null;

  onMounted(async () => {
    const canvas = canvasRef.value;
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    // Check WebGPU support
    const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

    if (!webGPUSupported) {
      console.error('WebGPU is not supported in this browser');
      // You could show an error message to the user here
      return;
    }

    // Load WebGPU extensions
    await import('@babylonjs/core/Engines/WebGPU/Extensions/');

    // Create WebGPU engine
    engine = new WebGPUEngine(canvas, engineOptions);
    await engine.initAsync();

    // Create scene
    scene = new Scene(engine);

    // Call the setup callback
    if (onSceneReady) {
      onSceneReady(scene, engine);
    }

    // Start render loop
    engine.runRenderLoop(() => {
      if (scene) {
        if (onRender) {
          onRender(scene);
        }
        scene.render();
      }
    });

    // Handle window resize
    const handleResize = () => {
      engine?.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      scene?.dispose();
      engine?.dispose();
    });
  });

  return {
    engine,
    scene,
  };
}
