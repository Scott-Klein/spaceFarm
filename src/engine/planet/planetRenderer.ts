import {
  createMeshFromData,
  createShaderMaterial,
  createTexture2DArrayFromPixels,
  getOrCreateSampler,
  releaseTexture,
  setShaderTexture,
  setShaderUniform,
  type EngineContext,
  type Mesh,
  type ShaderMaterial,
  type Texture2DArray,
} from '@babylonjs/lite';
import { createCubeSphereData } from './cubeSphere';
import type { PlanetMaps } from './generatePlanet';
import { PLANET_FRAGMENT_WGSL, PLANET_VERTEX_WGSL, SHELL_RADIUS } from './shaders';

export interface PlanetViewOptions {
  /** world-space direction toward the sun */
  sunDirection: readonly [number, number, number];
  /** lean of the rotation axis toward -z (the default camera side), radians */
  tilt?: number;
  /** seconds per rotation */
  spinPeriod?: number;
  /** seconds for the clouds to lap the ground once */
  cloudDriftPeriod?: number;
}

export interface PlanetView {
  /** the planet's mesh (an atmosphere-sized shell, radius 1 planet inside); add it to a scene */
  mesh: Mesh;
  material: ShaderMaterial;
  /** spin the planet and drift its clouds */
  update(dtMs: number): void;
  setExposure(exposure: number): void;
  /** release the textures (the mesh goes with its scene) */
  dispose(): void;
}

/** Builds the renderable planet from baked maps: one ray-traced pass over a shell mesh. */
export function createPlanetView(engine: EngineContext, maps: PlanetMaps, options: PlanetViewOptions): PlanetView {
  const { size } = maps;
  const tilt = options.tilt ?? 0;
  const spinRate = (2 * Math.PI) / (options.spinPeriod ?? 240);
  const cloudRate = (2 * Math.PI) / (options.cloudDriftPeriod ?? 900);

  // anisotropic, trilinear, clamped at the face edges (the faces are separate layers)
  const sampler = getOrCreateSampler(engine, {
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    maxAnisotropy: 16,
  });
  const textures: Texture2DArray[] = [];
  const cube = (data: Uint8Array, srgb: boolean) => {
    const tex = createTexture2DArrayFromPixels(engine, data, size, size, 6, { srgb });
    tex.sampler = sampler;
    textures.push(tex);
    return tex;
  };

  const shell = createCubeSphereData(48, SHELL_RADIUS);
  const mesh = createMeshFromData(engine, 'planet', shell.positions, shell.normals, shell.indices);
  const material = createShaderMaterial({
    name: 'planet',
    vertexSource: PLANET_VERTEX_WGSL,
    fragmentSource: PLANET_FRAGMENT_WGSL,
    attributes: ['position'],
    uniforms: [
      'world',
      'cameraPosition',
      { name: 'sunDirection', type: 'vec3<f32>', defaultValue: options.sunDirection },
      { name: 'cloudAngle', type: 'f32', defaultValue: 0 },
      { name: 'reliefStrength', type: 'f32', defaultValue: 1 },
      { name: 'exposure', type: 'f32', defaultValue: 1 },
    ],
    samplers: [
      { name: 'albedoMap', viewDimension: '2d-array' },
      { name: 'reliefMap', viewDimension: '2d-array' },
      { name: 'cloudMap', viewDimension: '2d-array' },
    ],
  });
  setShaderTexture(material, 'albedoMap', cube(maps.albedo, true));
  setShaderTexture(material, 'reliefMap', cube(maps.relief, false));
  setShaderTexture(material, 'cloudMap', cube(maps.clouds, false));
  mesh.material = material;

  let spin = 0;
  let clouds = 0;
  const orient = () => {
    // tilt ⊗ spin: turn about the planet's own axis, then lean that axis
    const st = Math.sin(-tilt / 2);
    const ct = Math.cos(-tilt / 2);
    const ss = Math.sin(spin / 2);
    const cs = Math.cos(spin / 2);
    mesh.rotationQuaternion.set(st * cs, ct * ss, st * ss, ct * cs);
  };
  orient();

  return {
    mesh,
    material,
    update(dtMs) {
      spin += (dtMs / 1000) * spinRate;
      clouds += (dtMs / 1000) * cloudRate;
      orient();
      setShaderUniform(material, 'cloudAngle', clouds);
    },
    setExposure(exposure) {
      setShaderUniform(material, 'exposure', exposure);
    },
    dispose() {
      for (const tex of textures) releaseTexture(tex);
      textures.length = 0;
    },
  };
}
