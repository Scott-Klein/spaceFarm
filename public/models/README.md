# 3D Models Directory

Place your `.glb` or `.gltf` model files in this directory.

## Usage with CapitalShip

```typescript
import { CapitalShip } from '@/engine';
import { Color3 } from '@babylonjs/core';

// Create a capital ship with a custom model
const capitalShip = new CapitalShip(
  'my-capital-ship',
  new Color3(0.5, 0.5, 0.8), // Color (optional tint)
  '/models/your-model.glb'   // Path to your GLB file
);

// Add to scene (async)
await capitalShip.create(scene);
```

## Model Requirements

- Format: `.glb` or `.gltf`
- Recommended orientation: Forward facing along positive Z-axis
- Scale: Models will use their imported scale (adjust in Blender if needed)

## Finding Free Models

- [Sketchfab](https://sketchfab.com/) - Many free spaceship models
- [Poly Haven](https://polyhaven.com/models) - Free CC0 models
- [TurboSquid](https://www.turbosquid.com/Search/3D-Models/free/glb) - Free section
