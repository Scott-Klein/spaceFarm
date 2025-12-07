import { onMounted, onUnmounted, type Ref } from 'vue';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';

export interface BabylonSceneOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  onSceneReady?: (scene: Scene, engine: Engine) => void;
  onRender?: (scene: Scene) => void;
}

/**
 * Composable for setting up a BabylonJS scene
 *
 * @param options Configuration options
 * @returns Object containing scene and engine references
 *
 * @example
 * const canvasRef = ref<HTMLCanvasElement | null>(null)
 *
 * useBabylonScene({
 *   canvasRef,
 *   onSceneReady: (scene, engine) => {
 *     // Set up your scene here
 *   }
 * })
 */
export function useBabylonScene(options: BabylonSceneOptions) {
  const { canvasRef, onSceneReady, onRender } = options;

  let engine: Engine | null = null;
  let scene: Scene | null = null;

  onMounted(() => {
    const canvas = canvasRef.value;

    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    // Create engine and scene
    engine = new Engine(canvas, true);
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
