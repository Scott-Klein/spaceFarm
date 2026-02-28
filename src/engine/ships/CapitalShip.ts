import { Scene, Color3, Mesh, ImportMeshAsync, CreateBox } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import Spaceship from './Spaceship';
import TrailMeshSystem from './TrailMeshSystem';

export default class CapitalShip extends Spaceship {
  private modelPath: string;

  constructor(id: string, color: Color3, modelPath: string) {
    super(id, color);
    this.modelPath = modelPath;
  }

  create(scene: Scene): void {
    this.scene = scene;

    // Create a placeholder mesh immediately (simple box)
    this.mesh = CreateBox(`${this.id}-placeholder`, { size: 2 }, scene);
    this.mesh.position = this.position.clone();
    this.mesh.rotation = this.rotation.clone();

    // Create default engine node for placeholder, then load actual model
    this.createDefaultEngineNodes();
    this.engineTrail = new TrailMeshSystem(this.engineNodes, scene);

    // Load the actual model asynchronously in the background
    this.loadModelAsync(scene);
  }

  update(deltaTime: number): void {
    // Call parent update (handles controller input, flight physics, trail)
    super.update(deltaTime);
  }

  dispose(): void {
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

        // Dispose of the placeholder mesh and its trail
        if (this.engineTrail) {
          this.engineTrail.dispose();
          this.engineTrail = null;
        }
        // Dispose old engine nodes
        for (const node of this.engineNodes) {
          node.dispose();
        }
        this.engineNodes = [];

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

          // Find ENGINE_* nodes from the loaded model
          const modelEngineNodes = result.transformNodes.filter(
            (node) =>
              node.name.includes('ENGINE_SMALL') ||
              node.name.includes('ENGINE_MEDIUM') ||
              node.name.includes('ENGINE_LARGE') ||
              node.name.includes('ENGINE_MASSIVE'),
          );

          if (modelEngineNodes.length > 0) {
            this.engineNodes = modelEngineNodes;
            console.log(
              `Found ${modelEngineNodes.length} engine nodes:`,
              modelEngineNodes.map((n) => n.name),
            );
          } else {
            // Fallback to default engine node if no ENGINE_* nodes found
            console.warn('No ENGINE_* nodes found in model, using default');
            this.createDefaultEngineNodes();
          }

          // Create engine trails for all engine nodes
          this.engineTrail = new TrailMeshSystem(this.engineNodes, scene);
        }
      }
    } catch (error) {
      console.error(`Failed to load model ${this.modelPath}:`, error);
    }
  }
}
