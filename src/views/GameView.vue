<template>
  <canvas ref="canvasRef" touch-action="none" class="h-full w-full"></canvas>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  ArcRotateCamera,
  Color3,
  CreateBox,
  CreateCylinder,
  CreateGround,
  CreateSphere,
  FreeCamera,
  HemisphericLight,
  Mesh,
  StandardMaterial,
  Texture,
  Vector3,
  Vector4,
} from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials";
import { useBabylonScene } from "@/composables/useBabylonScene";

const canvasRef = ref<HTMLCanvasElement | null>(null);

useBabylonScene({
  canvasRef,
  onSceneReady: (scene) => {
    const canvas = canvasRef.value!;

    // This creates and positions a free camera (non-mesh)
    const arcCamera = new ArcRotateCamera(
      "ArcCamera",
      Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      scene,
    );
    arcCamera.attachControl(canvas, true);

    // Set background color to yellow
    scene.clearColor = new Color3(0.01, 0.01, 0.01).toColor4();

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'sphere' shape.
    const sphere = CreateSphere("sphere1", { segments: 16, diameter: 2 }, scene);
    const faceUV = [];
    faceUV[0] = new Vector4(0.5, 0.0, 0.75, 1.0); //rear face
    faceUV[1] = new Vector4(0.0, 0.0, 0.25, 1.0); //front face
    faceUV[2] = new Vector4(0.25, 0, 0.5, 1.0); //right side
    faceUV[3] = new Vector4(0.75, 0, 1.0, 1.0); //left side
    const box = CreateBox("box1", { faceUV: faceUV, wrap: true });
    const roof = CreateCylinder("roof1", { diameter: 1.3, height: 1.2, tessellation: 3 }, scene);

    roof.position.y = 1.2;
    roof.rotation.z = Math.PI / 2;
    roof.scaling.x = 0.75;
    box.position.y = 0.5;

    // Move the sphere upward 1/2 its height
    sphere.position.y = 5;

    // Our built-in 'ground' shape.
    const ground = CreateGround("ground1", { width: 6, height: 6, subdivisions: 2 }, scene);
    const groundMat = new StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new Color3(0, 0.5, 0);
    ground.material = groundMat;

    const roofMat = new StandardMaterial("roofMat", scene);
    roofMat.diffuseTexture = new Texture(
      "https://assets.babylonjs.com/environments/roof.jpg",
      scene,
    );
    roof.material = roofMat;

    const boxMat = new StandardMaterial("boxMat", scene);
    boxMat.diffuseTexture = new Texture(
      "https://assets.babylonjs.com/environments/cubehouse.png",
      scene,
    );
    box.material = boxMat;
    const house = Mesh.MergeMeshes([box, roof], true, false, undefined, false, true);

    // Keyboard controls for moving the house
    const moveSpeed = 0.05;
    const keysPressed = new Set<string>();

    // Listen for key down events
    scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === 1) {
        // BABYLON.KeyboardEventTypes.KEYDOWN
        keysPressed.add(key);
      } else if (kbInfo.type === 2) {
        // BABYLON.KeyboardEventTypes.KEYUP
        keysPressed.delete(key);
      }
    });

    // Update house position every frame based on pressed keys
    scene.onBeforeRenderObservable.add(() => {
      if (!house) return;

      if (keysPressed.has("w")) {
        house.position.z += moveSpeed;
      }
      if (keysPressed.has("s")) {
        house.position.z -= moveSpeed;
      }
      if (keysPressed.has("a")) {
        house.position.x -= moveSpeed;
      }
      if (keysPressed.has("d")) {
        house.position.x += moveSpeed;
      }

      // Update camera target to follow the house
      arcCamera.target = house.position;
    });
  },
});
</script>
