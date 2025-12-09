import { Scene, Color3, Mesh, ImportMeshAsync, CreateBox } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Spaceship } from './Spaceship';
import { EngineParticleSystem } from './EngineParticleSystem';

export class CapitalShip extends Spaceship {
  private modelPath: string;
  private engineParticles?: EngineParticleSystem;

  constructor(id: string, color: Color3, modelPath: string) {
    super(id, color);
    this.modelPath = modelPath;
  }

  create(scene: Scene): void {
    // Create a placeholder mesh immediately (simple box)
    this.mesh = CreateBox(`${this.id}-placeholder`, { size: 2 }, scene);
    this.mesh.position = this.position.clone();
    this.mesh.rotation = this.rotation.clone();

    // Load the actual model asynchronously in the background
    this.loadModelAsync(scene);
  }

  update(deltaTime: number): void {
    // Call parent update (handles controller input, flight physics)
    super.update(deltaTime);

    // Update engine particles based on current throttle
    if (this.engineParticles) {
      const throttle = this.getThrustPercent();
      this.engineParticles.updateThrottle(throttle);
    }
  }

  dispose(): void {
    // Clean up particle systems
    if (this.engineParticles) {
      this.engineParticles.dispose();
    }
    super.dispose();
  }

  private async loadModelAsync(scene: Scene): Promise<void> {
    try {
      // Load the GLB model using the modern async method
      const result = await ImportMeshAsync(this.modelPath, scene);

      if (result.meshes.length > 0) {
        // Store the current position and rotation from placeholder
        const currentPosition = this.mesh?.position.clone();
        const currentRotation = this.mesh?.rotation.clone();

        // Dispose of the placeholder mesh
        if (this.mesh) {
          this.mesh.dispose();
        }

        // Use the loaded model
        if (result.meshes.length === 1) {
          this.mesh = result.meshes[0] as Mesh;
        } else {
          // If multiple meshes, use the first as parent
          this.mesh = result.meshes[0] as Mesh;
          // Parent all other meshes to the first one
          for (let i = 1; i < result.meshes.length; i++) {
            const childMesh = result.meshes[i];
            if (childMesh && this.mesh) {
              childMesh.parent = this.mesh;
            }
          }
        }

        if (this.mesh && currentPosition && currentRotation) {
          this.mesh.name = this.id;

          // Restore position and rotation from placeholder
          this.mesh.position = currentPosition;
          this.mesh.rotation = currentRotation;
        }

        // Find engine nodes in the loaded model (by naming convention)
        // Use result.transformNodes instead of scene.transformNodes to get the imported nodes
        const allEngines = result.transformNodes.filter(
          (node) =>
            node.name.includes('ENGINE_SMALL') ||
            node.name.includes('ENGINE_MEDIUM') ||
            node.name.includes('ENGINE_LARGE') ||
            node.name.includes('ENGINE_MASSIVE'),
        );

        console.log(
          'Found transform nodes:',
          result.transformNodes.map((n) => n.name),
        );
        console.log('Engine nodes found:', allEngines.length);
        allEngines.forEach((engine) => console.log(`  - ${engine.name}`));
        if (allEngines.length > 0) {
          this.engineParticles = new EngineParticleSystem(scene);
          this.engineParticles.createEngineExhaust(allEngines);
          console.log(`Created ${allEngines.length} engine particle systems`);
        } else {
          console.warn(
            'No engine nodes found. Expected nodes named ENGINE_MEDIUM_* or ENGINE_LARGE_*',
          );
        }

        // Optional: Apply color tint to the material if needed
        // You can uncomment this if you want to tint the model
        /*
        if (this.mesh.material) {
          const material = this.mesh.material as StandardMaterial;
          if (material.diffuseColor) {
            material.diffuseColor = this.color;
          }
        }
        */
      }
    } catch (error) {
      console.error(`Failed to load model ${this.modelPath}:`, error);
    }
  }
}
