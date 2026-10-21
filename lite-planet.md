# Babylon Lite — Reference for Procedural Planet Work

API surface, defaults and constraints. Verified against `@babylonjs/lite` **1.31.1** typings.

Assumes you know planet generation elsewhere. This is only what differs or constrains.

---

## Engine model

- WebGPU only. `createEngine()` throws where WebGPU is unavailable. No WebGL fallback.
- Factory functions, not constructors. No `new`.
- Plain data, not classes. `Vec3` is `{x,y,z}`, `Quat` is `{x,y,z,w}`, `Color3` is `{r,g,b}`, colour *factors* on materials are `[number,number,number]` tuples.
- `Mat4` is an opaque interface (`{readonly length: 16, readonly [i: number]: number}`) — may be backed by `Float32Array` or `Float64Array`; depending on the concrete storage is explicitly unsupported.
- Nothing auto-registers. `addToScene(scene, entity)` is required for meshes, lights, cameras, shadow generators, transform nodes and asset containers. Materials are **not** scene entities.
- Left-handed world. Reverse-Z depth by default (`depthCompare` defaults `"greater-equal"`, reverse-Z targets clear depth to `0`).
- Counter-clockwise front faces. All colour targets render upright; there is no flip flag on descriptors or target signatures.

### Lifecycle order

```
createEngine → createSceneContext → build content → registerScene → startEngine
```

- `registerScene(scene)` — shadow-free. `registerSceneWithShadowSupport(scene)` inserts the internal `ShadowTask` at the front of the frame graph. Picking the wrong one is a silent no-shadow failure.
- Texture-slot setters and feature opt-ins (`setStandard*Texture`, `setPbr*`, `enableStandardVertexColors`, `enableMaterialPlugins`, `enableMirroredMeshes`, `enableMaterialStencil`) must run **before** `registerScene`. Documented per-function as "Call before the scene is first built."
- Meshes added after registration are picked up: the default render task re-syncs when `scene._renderableVersion` changes.
- `getFrameGraph(scene).build()` — needed when tasks are added or inserted outside the startup/resize path.
- Tasks execute in array order. No dependency solving; caller order is the contract.

### Precision

```ts
createEngine(canvas, {
  useHighPrecisionMatrix: true,   // Float64 intermediates, downcast at GPU upload
  useFloatingOrigin: true,        // eye-relative upload. Requires the above — throws without it
})
```

Both engine-wide, inherited by every scene on that engine. LWR runtime module is dynamic-imported only when `useFloatingOrigin` is true.

If matrices are in a rebased frame, pass `worldOrigin` to `ScreenProjectionOptions` when projecting.

---

## Geometry

```ts
createMeshFromData(
  engine, name,
  positions: Float32Array,   // xyz
  normals: Float32Array,     // xyz
  indices: Uint32Array,      // triangle list
  uvs?, uvs2?, tangents?,    // Float32Array; tangents are xyzw
  colors?,                   // Float32Array, RGBA, 4 floats/vertex
): Mesh
```

- Indices are **Uint32** — no 16-bit vertex ceiling.
- No material assigned; `mesh.material` must be set before `addToScene`.
- Strip topologies unsupported (`topology` is `point-list | line-list | triangle-list`) because the required index format is mesh-specific.

### Base topology

```ts
createSphereData(options?: SphereOptions): SphereMeshData
// → { positions, normals, uvs, indices, vertexCount, indexCount }
// SphereOptions: { segments?, diameter?, diameterX?, diameterY?, diameterZ? }
```

UV sphere, equirectangular UVs. Cube-sphere/icosphere is yours to generate.

Also available as raw data: `createGroundData`, `createBoxData`, `createDiscData`, `createCylinderData` and friends — check for a `create*Data` variant of any builder.

### Mutation

```ts
updateMeshGeometry(engine, mesh, positions, normals, indices, uvs?, uvs2?, tangents?, colors?)

updateMeshPositions(engine, mesh, positions, vertexOffset?, vertexCount?, sourceVertexOffset?)
updateMeshNormals  (engine, mesh, normals,   vertexOffset?, vertexCount?, sourceVertexOffset?)
updateMeshTangents (engine, mesh, tangents,  vertexOffset?, vertexCount?, sourceVertexOffset?)
updateMeshColors   (engine, mesh, colors,    vertexOffset?, vertexCount?, sourceVertexOffset?)

updateMeshGeometryCapacity(engine, mesh, positions, normals, indices,
  uvs?, uvs2?, tangents?, colors?, reserveFactor?, ranges?): MeshGeometryCapacityResult
```

Sub-range patching plus over-allocation via `reserveFactor`. This is the only LOD mechanism — see [Limits](#limits).

Readback: `getMeshGeometry(mesh)`, `getMeshTriangles(mesh)`.
Teardown of a mesh never added to a scene: `disposeMeshGpu(mesh)`, not `removeFromScene`.

### Transform

`Mesh extends SceneNode`:

```ts
readonly position: ObservableVec3           // .set(x,y,z) / .copyFrom(Vec3) / .toArray(out, off)
readonly rotationQuaternion: ObservableQuat // source of truth for the local matrix
readonly rotation: EulerProxy               // bidirectional; reads decompose, writes convert atomically
readonly scaling: ObservableVec3
parent: IWorldMatrixProvider | null
readonly worldMatrix: Mat4
readonly worldMatrixVersion: number         // integer version, bumped on change
receiveShadows: boolean
visible?: boolean
id?: string                                 // light include/exclude filtering only
metadata?: LiteMetadata
```

All transform slots are `readonly` references — mutate, don't reassign. `worldMatrixVersion` is the cheap dirty check.

Negative scaling needs `await enableMirroredMeshes(scene)` before `registerScene` (glTF negative-scale nodes are handled at load time); otherwise winding isn't reversed. Installs process-wide pipeline winding resolution plus a per-scene runtime watcher.

### Vertex colours

- PBR consumes them automatically.
- Standard requires `enableStandardVertexColors()` once before `registerScene`, with a tightly packed RGBA buffer.

### CSG

| CSG1 | CSG2 |
|---|---|
| `createCsgFromMesh(mesh, materialSlot?)` | `createCsg2FromMesh(mesh, materialSlot?)` |
| `csgUnion` / `csgSubtract` / `csgIntersect` | `csg2Add` / `csg2Subtract` / `csg2Intersect` |
| `createMeshFromCsg(engine, solid, name?)` | `createMeshFromCsg2` / `createMeshesFromCsg2(engine, solid, materials, name?)` |
| sync, single material | wasm — `await initializeCsg2Async()` first; `isCsg2Ready()`; `disposeCsg2(solid)`; multi-material |

Source meshes must retain CPU positions, normals and indices. `createCsgFromMesh` docs do not state that the world matrix is baked — verify against your transform assumptions.

---

## Materials

### PBR

```ts
createPbrMaterial(props?: Partial<PbrMaterialProps>): PbrMaterialProps
```

| Field | Default / note |
|---|---|
| `baseColorTexture` | — |
| `baseColorFactor` | `[1,1,1,1]`, linear |
| `normalTexture` | cotangent frame — **no mesh tangent attribute required** |
| `normalTextureScale` | `1.0` |
| `ormTexture` | packed R=occlusion, G=roughness, B=metallic |
| `occlusionTexture` | separate, UV2, when `occlusionTexCoord=1`; then ORM.r unused |
| `metallicFactor` | `1.0`, multiplies ORM.b |
| `roughnessFactor` | `1.0`, multiplies ORM.g |
| `occlusionStrength` | `1.0`; `0` ignores ORM.r |
| `emissiveTexture` | — |
| `specGlossTexture` | RGB=specular, A=glossiness (KHR_materials_pbrSpecularGlossiness) |
| `reflectance` | `0.04` dielectric F0; glass ≈ `0.2` |
| `environmentIntensity` | `1.0` |
| `directIntensity` | `1.0` |
| `usePhysicalLightFalloff` | `true`; `false` = Standard-style linear range + spot exponent |
| `enableSpecularAA` | `false`; auto-set by the glTF loader |
| `doubleSided` | disables back-face culling |
| `alpha` / `alphaBlend` | `1.0` / off |
| `lightmapTexture`, `lightmapLevel`, `lightmapCoordIndex`, `useLightmapAsShadowmap`, `gammaLightmap` | `lightmapCoordIndex` defaults `1` |
| `stencil` | inert unless `enableMaterialStencil()` called |
| `plugins` | requires `enableMaterialPlugins(scene)` before `registerScene` |

Extension setters (register globally, idempotent, call before scene build):
`setPbrEnvironment`, `setPbrLocalEnvironment`, `setPbrLightmap`, `setPbrEmissive`, `setPbrMetallicReflectance`, `setPbrSubsurface`, `setPbrClearCoat`, `setPbrSheen`, `setPbrAnisotropy`, `setPbrIridescence`, `setPbrTransmission`, `setPbrDispersion`, `setPbrUnlit`, `setPbrSkybox`, `setPbrAlphaCutoff`, `setPbrGammaAlbedo`.

### Standard

```ts
createStandardMaterial(): StandardMaterialProps
```

`diffuseColor`, `specularColor`, `emissiveColor`, `ambientColor` are `[r,g,b]`. `diffuseTexture` is a plain assignable field; other slots go through `setStandardAmbientTexture` / `setStandardBumpTexture` / `setStandardEmissiveTexture` / `setStandardLightmapTexture` / `setStandardOpacityTexture` / `setStandardReflectionTexture` / `setStandardReflectionCubeTexture` / `setStandardSpecularTexture`.

Also: `backFaceCulling` (default `true`), `disableLighting` (outputs emissive × diffuse × base), `alphaCutOff` (default `0` = no alpha test), `uvScale`, `uvOffset`, `bumpLevel`, `specularPower`.

### Runtime mutation

Material props are baked into a UBO at build. Changing them later requires:

```ts
markMaterialUboDirty(material)          // manual, ~50 bytes bundle, zero per-frame cost
enableMaterialTracking(material)        // ~1.5 KB, installs setters; catches `color[0] = x`
```

Only `enableMaterialTracking` catches in-place array index writes.

### ShaderMaterial (WGSL)

```ts
createShaderMaterial(options: ShaderMaterialOptions): ShaderMaterial
setShaderUniform(material, name, value)
setShaderTexture(material, name, texture | null)
```

```ts
interface ShaderMaterialOptions {
  name?; vertexSource; fragmentSource;          // WGSL strings
  attributes: readonly ShaderAttributeName[];
  uniforms?; samplers?; storageBuffers?; defines?;
  useThinInstanceColors?;                       // bind the mesh's thin-instance RGBA stream
  needAlphaBlending?;
  blendMode?: "alpha" | "additive";             // "alpha" default; additive adds premultiplied
  blend?: GPUBlendState;                        // REPLACES blendMode/needAlphaBlending choice
  transmissive?;                                // scene-colour grab; requires needAlphaBlending
  needAlphaTesting?; backFaceCulling?;
  depthWrite?;                                  // default true opaque / false blended
  depthCompare?; depthOnlyFragment?;            // latter: run fragment on depth-only targets (discard)
  depthBias?; depthBiasSlopeScale?;             // default 0
  topology?: "point-list" | "line-list" | "triangle-list";
}
```

Attributes: `"position" | "normal" | "uv" | "uv2" | "tangent" | "color" | "joints" | "weights" | "joints1" | "weights1"`

Samplers accept `sampleType: "float" | "unfilterable-float" | "depth"`, `viewDimension: "2d" | "2d-array"`, `comparison: boolean` (hardware `sampler_comparison`).

Pipeline layouts: `"mesh" | "thin-instances" | "thin-instances-color"`.

`wgsl` tagged-template identity function is exported for build-time processing.

### Node material

`parseNodeMaterialFromSnippet(engine, snippetId, options?): Promise<NodeMaterial>` — snippet import only. No programmatic graph builder. `createNodeMaterialBlockLoader(blocks)` supplies custom block emitters; `loadNodeBlockEmitterWithGeometry` for geometry-renderer scenes.

NME block coverage: core, PBR, math, texture, procedural, normal, screen/depth, matrix, loop, storage.

### Tone mapping

Pluggable as a value, not a closed union — a pair of WGSL fragments (`helpersWGSL` + `callWGSL`) injected into the PBR fragment shader, keyed by `id`. `StandardToneMapping` is the default (BJS exponential). Set via `setSceneImageProcessing`.

---

## Textures

```ts
createTexture2DFromPixels(engine, data: Uint8Array, w, h, options?): Texture2D
  // w*h*4 bytes, row-major, top-to-bottom, straight RGBA

createTexture2DFromExternalImage(engine, source: GPUCopyExternalImageSource, options?): Promise<Texture2D>
  // ImageBitmap | ImageData | DOM/offscreen canvas | image/video element | VideoFrame
  // ASYNC. Caller keeps ownership of source; never closed for you.
  // Extra option: maxDimension (silently downscales above it)

createTexture2DArrayFromPixels(engine, data, w, h, layers, options?)
createTexture2DArray(engine, w, h, layers, options?)
createTexture2DArrayFromUrls(engine, urls, options?)
createDynamicTexture(engine, w, h, options?): DynamicTexture2D
createSolidTexture2D(engine, r, g, b, a?): Texture2D
createRenderTexture2D(engine, w, h, options?): Texture2D
createHtmlTexture(engine, element, options?): HtmlTexture2D
cloneTexture2D(...)
```

```ts
interface Texture2DOptions {
  mipMaps?: boolean;              // DEFAULT TRUE
  addressModeU?: GPUAddressMode;  // default 'repeat'
  addressModeV?: GPUAddressMode;  // default 'repeat'
  minFilter?: GPUFilterMode;      // default 'linear'
  magFilter?: GPUFilterMode;      // default 'linear'
  invertY?: boolean;              // DEFAULT TRUE (Babylon convention)
  srgb?: boolean;                 // default false → rgba8unorm-srgb when true
  premultiplyAlpha?: boolean;     // default false (straight RGBA, matches PNG-on-disk)
}
```

Non-obvious:

- `invertY` default `true` flips generated data.
- `srgb: true` only for colour/albedo. Data maps (height, roughness, normal) must stay linear.
- `addressModeV: 'clamp-to-edge'` for equirectangular, else the poles wrap into each other.
- Every `createTexture2DFromExternalImage` call allocates a distinct GPU texture; no source or URL cache.
- Returned textures hold one resource-pool reference. `releaseTexture(texture)` after detaching from every material. `acquireTexture` / `releaseTexture` must be paired per sampled owner; clone creation does **not** acquire.

### Compressed / HDR

```ts
loadKtxTexture2D(engine, baseUrl, suffixes)        // KTX1, direct
loadBasisTexture2D(engine, url, opts?)             // .basis; mipMaps and invertY ignored
loadCubeTexture(engine, baseUrl, ext?)             // six faces _px/_nx/_py/_ny/_pz/_nz; cached per device
loadHdrEnvironment(scene, url, options?): Promise<EnvironmentTextures>
loadEnvironment(scene, url, options?)
```

KTX2 / BasisU is **glTF-scoped** — handled through `KHR_texture_basisu` during `loadGltf`, not exposed as a standalone 2D loader.

`CubeTexture` carries an opaque nominal brand so a `Texture2D` can't satisfy a cube slot (would otherwise pass structurally and fail WebGPU validation at bind-group creation).

---

## Compute

```ts
createComputeShader(engine, options: ComputeShaderOptions): ComputeShader
createComputeTask(engine, name?): ComputeTask
addComputeDispatch(task, dispatch)
submitComputeTasks(tasks)
createComputeStorageTexture2D(engine, options)
createComputeStorageTexture(engine, options)
createComputeTextureResource(engine, texture, options?): Promise<ComputeTextureResource>
createComputeTextureViewResource(engine, texture, options)
createStorageBuffer(...) / disposeStorageBuffer(...)
disposeComputeShader / disposeComputeBindingSet / disposeComputeOneShot / disposeComputeStorageTexture
```

---

## Instancing

```ts
setThinInstances(mesh, matrices: Float32Array | Float64Array, count)  // 16 floats/instance, column-major
setThinInstanceColors(mesh, colors: Float32Array)                     // 4 floats/instance RGBA
addThinInstance(mesh, matrix: Mat4): number
addHierarchyInstance(pool, matrix: Mat4): number

setThinInstanceLodPartner(fullMesh, lodMesh, { distance, band? })
clearThinInstanceLodPartner(fullMesh)
```

`distance` = camera distance (world units) at which an in-frustum instance swaps to the LOD mesh. `band` = width of a per-instance dithered threshold window centred on it; `0` (default) is a hard cut.

Matrix composition: `composeMat4(tx,ty,tz, qx,qy,qz,qw, sx,sy,sz): Mat4`, `createMat4FromQuat(qx,qy,qz,qw)`, `mat4Identity()`, `writeMat4FromQuatIntoBuffer(out, qx,qy,qz,qw)`, `decomposeMat4`-style via `createQuatFromRotationMat4`.

Thin-instance AABB composition is `worldMatrix × instanceMatrix × corner`.

VAT (vertex animation textures) support per-instance clips: `setInstances(params)` with 4 floats/instance `(fromRow, toRow, timeOffset, fps)`, or `setInstancesBlend(params)` with 8 floats for dual-clip cross-fade. Must be called before `registerScene` the first time.

`EXT_mesh_gpu_instancing` expands glTF per-node TRS accessors into thin instances automatically.

---

## Lights and shadows

```ts
createDirectionalLight(direction: [x,y,z], intensity?): DirectionalLight
createHemisphericLight(direction: [x,y,z], intensity?): HemisphericLight
createSpotLight(pos, dir, angle, exponent): SpotLight
createPointLight(...)
```

`LightBase extends SceneNode`:

```ts
readonly lightType: string
excludedMeshIds?: ReadonlySet<string>        // these meshes NOT lit
includedOnlyMeshIds?: ReadonlySet<string>    // if non-empty, ONLY these; takes priority
shadowGenerator?: ShadowGenerator            // set this to make the light cast
```

`DirectionalLight` adds `readonly direction: ObservableVec3`, `readonly position: ObservableVec3`, `diffuse`/`specular` as `[r,g,b]`, `intensity`.

Mesh filtering is by `mesh.id` string, not object identity.

### Generators

```ts
createCsmDirectionalShadowGenerator(engine, light, cfg?)   // cascaded, 5×5 PCF receiver
createEsmDirectionalShadowGenerator(engine, light, cfg?)   // exponential + blur
createPcfDirectionalShadowGenerator(engine, light, cfg?)
createPcfSpotlightShadowGenerator(engine, light, cfg?)
```

**CSM config:**

| Field | Default |
|---|---|
| `mapSize` | `1024` (per cascade, square) |
| `numCascades` | `4` — **4 is the hard max** |
| `lambda` | `0.5` (log↔uniform split blend, 0..1) |
| `cascadeBlendPercentage` | `0.1`; `0` disables cross-fade |
| `stabilizeCascades` | `false` (stable bounding-sphere fit vs tight AABB) |
| `shadowMaxZ` | **= camera far plane** |
| `bias` | `0.00005` |
| `worldSpaceBias` | world units; **overrides `bias`** when supplied; non-positive/non-finite disables bias |
| `darkness` | `0` (0 = black, 1 = none) |
| `frustumEdgeFalloff` | `0` (0..1) |
| `forceRefreshEveryFrame` | `false` |

**ESM config:** `mapSize`, `depthScale`, `bias`, `blurKernel` (default `1`, matches BJS `ShadowGenerator.blurKernel`), `blurScale`, `darkness`, `frustumEdgeFalloff`, `orthoMinZ` (default `1`), `orthoMaxZ` (default `10000`), `forceRefreshEveryFrame`.

**PCF directional:** `mapSize`, `bias`, `darkness`, `normalBias`, `orthoMinZ` (1), `orthoMaxZ` (10000), `forceRefreshEveryFrame`.

### Wiring

```ts
light.shadowGenerator = createCsmDirectionalShadowGenerator(engine, light, cfg)
setShadowTaskCasterMeshes(generator, casterMeshes: readonly Mesh[])
mesh.receiveShadows = true                       // per receiver, DEFAULT FALSE
await registerSceneWithShadowSupport(scene)

setShadowGeneratorEnabled(generator, enabled)
enableSkeletonShadows(generator)                 // else bind-pose geometry
enableMorphTargetShadows(generator)
getCsmReceiverTexture(sg): Texture2D
onCsmReceiverUpdate(sg, cb): () => void
enableCsmStaticCache(engine, sg, options: CsmStaticCacheOptions): Promise<void>
```

Silent-failure set: `receiveShadows` default `false`; casters only from `setShadowTaskCasterMeshes`; plain `registerScene`; `shadowMaxZ` defaulting to the far plane.

### Static cache (perf, not quality)

```ts
interface CsmStaticCacheOptions {
  refitAngle: number;                  // accumulated sun rotation (rad) forcing a refit
  refitMaxIntervalMs?: number;         // wall-time floor, default 0 = none
  staticCascadesPerFrame?: number;     // round-robin drift refits across frames
}
```

Gate internals exposed via `createCsmRefitGate` / `CsmRefitGate` / `CsmRefitDecision` if you need to drive it yourself. Invariant owned by the caller: cascade matrices, receiver UBO and shadow-camera versions may change **only** on frames where `update()` returns `refit: true` — the dynamic overlay depth-tests against the cached static depth, so both halves must use the same cameras or shadows tear.

### Memory

`depth32float`, `texture_2d_array`, one layer per cascade. `mapSize: 4096` × 4 cascades ≈ 268 MB **per generator**; 2048 ≈ 67 MB. Browser cap ~2 GB total.

Receivers sample with a **fixed 5×5 PCF kernel**. No PCSS, no contact hardening anywhere in the API.

---

## Sky, atmosphere, fog

```ts
loadProceduralSkyEnvironment(scene, options: ProceduralSkyEnvironmentLoadOptions)
  : Promise<ProceduralSkyEnvironment>
updateProceduralSkyEnvironment(environment, options): Promise<boolean>
computeProceduralSkySunColor(options): [number, number, number]
```

```ts
interface ProceduralSkyEnvironmentOptions {
  readonly sunDirection: readonly [number, number, number];  // normalized, scene → sun
  readonly luminance: number;
  readonly turbidity: number;          // aerosol density
  readonly rayleigh: number;
  readonly mieCoefficient: number;
  readonly mieDirectionalG: number;    // Mie phase directionality
}
// Load options add: readonly brdfUrl: string
```

Preetham-family daytime scattering. Produces a **full PBR environment** (hence `brdfUrl`), not just a backdrop. No star/nebula/space variant. `ProceduralSkyEnvironment` is an opaque handle.

```ts
loadSkybox(scene, baseUrl, ext, size?)       // cube faces; size default 100
buildDdsSkyboxRenderable(scene, skyHalfSize, rootPosition, primaryColor, skyboxTextureUrl?, enableNoise?)
setFog(scene, config: FogConfig)
```

HDR load options: `useCubemapSkybox`, `skipSkybox`, `skyboxUrl` (`.dds` → DDS cube; `.env` → reuse loaded specular cubemap), `skyboxSize` (default 20), `skyboxPosition`.

**No `infiniteDistance`.** Skyboxes are fixed-size meshes at an explicit position. Track the camera yourself if needed.

An orbital atmosphere shell is not provided — build it as a ShaderMaterial with `blendMode: "additive"`, `backFaceCulling: false`.

---

## Transmission / water

```ts
enableRenderTaskTransmission(task: RenderTask, engine, options?: TransmissionOptions): SceneColorGrab
enableSceneTransmission(scene, engine)
setPbrTransmission(mat, refraction: RefractionProps)
```

ShaderMaterial route: `transmissive: true` **and** `needAlphaBlending: true`, then bind the grab texture with `setShaderTexture`.

`RenderTaskConfig.transmission`: `copyCount` (`0` = refresh before every transmissive draw; otherwise default one refresh), `generateMipmaps` (default `true`), `mipLevelCount`, `grabDepth`.

`enableSceneTransmission` retargets render tasks to linear `rgba16float` offscreen output and appends a `"transmission-image-processing"` task after the last render task. Refraction textures allocate only mip levels reachable by the shader's fixed `-4.0` LOD bias (7 levels for 1024², not 11).

Screen-space refraction; documented parity "within-5 = 100% of pixels".

---

## Frame graph

Ordered task list, not a DAG. `createSceneContext(engine, options?)` appends one default swapchain `RenderTask` named `"scene"` unless `options.defaultRenderTask === false`.

```ts
getFrameGraph(scene): FrameGraph        // build() / execute() / dispose()
addTask(sceneOrGraph, task)             // append
addTaskAtStart(sceneOrGraph, task)      // after built-in system tasks (e.g. ShadowTask)
addTaskBefore(sceneOrGraph, task, before)   // appends if `before` not found
addTaskAfter(sceneOrGraph, task, after)     // appends if `after` not found
addRenderPass(target, name): RenderPass     // only valid inside Task.record()
addPassDependencies(pass, deps)             // informational today
createRenderTask(config: RenderTaskConfig, engine, scene?)
addMeshToTask(task, mesh, opts?)            // opts.material accepts a Material or MaterialView
removeMeshFromTask(task, mesh)
enableRenderTaskMeshRefresh(task)           // must run BEFORE the task is recorded
```

`RenderTaskConfig`: `name`, `rt`, `rst?` (single-sample resolve when `rt` is MSAA), `depth?`, `clrColor?`, `clr?`, `depthClear?`, `sharedRt?`, `cam?`, `cs?` (canvas-sized aspect), `transmission?`, `autoMirror?`.

- A task with explicit renderables does **not** auto-mirror the scene.
- `autoMirror: false` + first committed `addMeshToTask` switches the task permanently to explicit mode.
- Adds before first `record()` are queued and drained at record time; adds after resolve and re-bucket immediately (no `build()` needed — a full rebuild would reallocate the shared scene UBO and every task's render target mid-frame).
- Overlay tasks: `sharedRt: true`, `clr: false`, plus `depthClear: false` to depth-test against the owner's depth.
- Buckets: opaque (`!isTransparent && !_direct`) → cached `GPURenderBundle`; direct (`_direct`) → direct draw; transparent (`isTransparent || _transmissive`) → camera-depth sorted back-to-front per frame, never pipeline-sorted.

Fixed-size eager RTTs are **not** reallocated on graph rebuild (their GPU handles may already be captured in material bind groups). Surface-sized ones rebuild on backing-store dimension change.

Diagnostics: `setGpuTimingEnabled(engine, bool)` + `engine.gpuFrameTimeMs` (async readback, a frame or two behind, includes marker dispatches), `isGpuTimingSupported(engine)`, `engine.drawCallCount`, `measureRenderTaskOverdrawCost(engine, task, opts?)` (needs `timestamp-query`; rejects `depthClear: false` overlays and eager external depth; never in a production loop).

---

## Maths

Everything takes/returns `Vec3` objects (`{x,y,z}`), not tuples.

```ts
vec3(x, y, z): Vec3
Vec3Up: Readonly<Vec3>
lengthVec3(v) · normalizeVec3(v) · scaleVec3(v, s) · addVec3(a,b) · subtractVec3(a,b)
crossVec3(a,b) · dotVec3(a,b) · lerpVec3(a,b,t)
// each of the above (except length/dot) also has *InPlace(target, …) and *ToRef(…, out)
normalizeVec3TupleOrUp(x,y,z,eps?): Vec3Tuple
writeVec3(out: Float32Array, offset, v)
```

Quaternions:

```ts
eulerXYZToQuatTuple(rx,ry,rz): [x,y,z,w]      // intrinsic XYZ
quatToEulerXYZTuple(qx,qy,qz,qw): [rx,ry,rz]
createQuatFromLookDirectionRH(forward, up): Quat   // local +Z→forward, +Y→up. RIGHT-handed
createQuatFromRotationMat4(matrix): Quat
createMat4FromQuat(qx,qy,qz,qw): Mat4
composeMat4(tx,ty,tz, qx,qy,qz,qw, sx,sy,sz): Mat4
mat4Identity()
```

**No quaternion multiply and no slerp are exported.** Slerp exists only inside the animation system. `lerpAngleShortest(current, goal, t)` is offered as the single-angle alternative. `normalizeRadians(angle)` exists.

Engine renders left-handed; `createQuatFromLookDirectionRH` is right-handed — negate forward if it comes out reversed.

Also: `addPolarToRef` / `scalePolarToRef` / `subtractPolarToRef`, spherical equivalents, `scaleBoundsFromCenterToRef`, easing functions (`quadraticEase`, `quarticEase`, `quinticEase`, …), `dampingWeight`-style frame-rate-independent interpolation primitives.

---

## Cameras and projection

```ts
createArcRotateCamera(alpha, beta, radius, target: Vec3): ArcRotateCamera
createFreeCamera(position, target): FreeCamera
createDefaultCamera(scene): ArcRotateCamera        // auto-assigns scene.camera
attachControl(camera, canvas, scene?, options?): () => void          // arc-rotate
attachFreeControl(camera, canvas, scene?): () => void
attachConfigurableFreeControl(camera, canvas, scene?, options?)
enableOrthographicCamera(camera, { halfHeight }) / disableOrthographicCamera(camera)
setCameraLimits(camera, limits: ArcRotateCameraLimits, scene?): () => void
interpolateArcRotateCamera(camera, scene, goal, signal?, options?): Promise<void>
```

- `scene.camera = camera` must be set explicitly unless you used `createDefaultCamera`.
- Orbit limits are **opt-in** and enforced by `attachControl`'s per-frame loop; the camera self-clamps in its setters. Set them via `setCameraLimits` (clamps current pose immediately and zeroes inertia at the wall) rather than assigning the raw `lowerBetaLimit` / `upperBetaLimit` / `lower*` fields, which skips that.
- `ArcRotateCamera.target` is a plain mutable `Vec3`. Right-drag panning writes into it.
- `attachControl` cleanup is **not** tied to scene lifetime — DOM listeners live on the canvas. `onSceneDispose(scene, attachControl(...))` to bind them.
- Keyboard controls need `enableArcRotateKeyboardControls()` first.

### World → screen

```ts
projectWorldToScreen(point, view: Mat4, viewProjection: Mat4, options): ScreenProjectionResult
projectWorldToScreenToRef(point, view, viewProjection, options, result): T      // no allocation
projectPointToViewportToRef(point, world, transform, viewport, result)

getViewMatrix(camera): Mat4
getProjectionMatrix(camera, aspectRatio): Mat4
getViewProjectionMatrix(camera, aspectRatio): Mat4   // cached per _cameraChangeKey + aspect
getEffectiveAspectRatio(camera, targetWidth, targetHeight): number
resolveCameraViewport(camera, targetWidth, targetHeight): PixelViewport
```

```ts
interface ScreenProjectionOptions {
  viewport: PixelViewport;      // backing pixels, origin top-left
  backingWidth: number;         // engine.canvas.width
  backingHeight: number;
  worldOrigin?: Vec3;           // for rebased (floating-origin) matrices
  cssWidth?: number;            // both or neither
  cssHeight?: number;
}

interface ScreenProjectionResult extends Vec3 {
  cssX: number; cssY: number;   // canvas-relative CSS pixels
  clipW: number;                // homogeneous clip W before divide
  behindCamera: boolean;        // left-handed view-space Z at/behind camera plane
  clipped: boolean;             // outside any clip plane, or non-finite
  offscreen: boolean;           // cannot appear in the viewport rect, incl. negative W
}
```

`x`/`y` are backing pixels, `z` is WebGPU NDC depth. `cssX`/`cssY` are **canvas-relative**, not page-relative. Coordinates are not clamped — finite offscreen points keep extrapolated positions (for edge indicators). `view` is taken separately from `viewProjection` so `behindCamera` works under orthographic projection, where clip W stays 1.

Derive matrices/viewport once per frame; reuse both `options` and `result` across points.

---

## Scene / surface

```ts
createSceneContext(engine, options?): SceneContext
scene.clearColor: GPUColorDict               // { r, g, b, a }
scene.camera
scene.imageProcessing                        // exposure, contrast, toneMappingEnabled
onBeforeRender(scene, fn)                    // delta in ms
onSceneDispose(scene, fn)
startEngine(engine): Promise<void>           // resolves after the first frame
renderFrame(engine, delta, surfaces?)
resizeEngine(engine) / resizeSurface(...)
disposeScene(scene) / disposeEngine(engine)
waitForGpuIdle(engine) / waitForGpuResourceRetirements(engine)
captureScreenshot(surface): Promise<Screenshot>   // RGBA8, alpha forced 255
```

`SurfaceContext` (and `EngineContext extends` it): `canvas: RenderCanvas` (`HTMLCanvasElement | OffscreenCanvas`), `format`, `msaaSamples` (1 or 4, default **4**), `scRT`, `maxDevicePixelRatio` (default `Infinity`; backing store = `min(devicePixelRatio, max) × cssPixels`).

Canvas backing size is `engine.canvas.width` / `.height`. CSS size is the DOM element's layout size. They differ by effective DPR.

`createSurface(engine, canvas, …)` appends additional surfaces; `engine.surfaces[0]` is the engine itself.

Render loop is `requestAnimationFrame`-paced — frame rate is capped at display refresh with no opt-out.

Device-lost recovery is opt-in per subsystem: `enableDeviceLostSceneContextRecovery` and the `enableDeviceLost*Recovery` family.

---

## Limits

| | |
|---|---|
| **No tessellation or geometry shaders** | WebGPU lacks them. All LOD is CPU-side generation + `updateMesh*`. |
| **No dynamic global illumination** | IBL (procedural sky / HDR env) and baked lightmaps only. |
| **Max 4 CSM cascades** | Hard cap. |
| **Fixed 5×5 PCF shadow kernel** | No PCSS, no contact hardening. |
| **Screen-space SSS: not implemented** | Only BRDF-layer translucency. |
| **No programmatic node-material builder** | Snippet import only. |
| **No quat multiply / slerp exported** | Hand-roll. |
| **KTX2/BasisU is glTF-scoped** | No standalone 2D KTX2 loader. |
| **No `infiniteDistance`** | Skyboxes are fixed meshes. |
| **WebGPU only** | `createEngine()` throws otherwise. |
| **~2 GB browser memory** | Total texture + buffer budget. |
| **Single JS thread for scene graph, culling, matrices** | Workers can only help with data generation. |
| **Partial subsystems** | Physics = Havok V2 subset. Navigation = Recast V2. Sprites = not the full BJS SpriteManager API. |

---

## Feature opt-ins (all before `registerScene`)

| Call | Enables |
|---|---|
| `enableStandardVertexColors()` | vertex colours on Standard material |
| `await enableMirroredMeshes(scene)` | winding reversal for negative-scale meshes |
| `enableMaterialStencil()` | per-material stencil test |
| `enableMaterialPlugins(scene)` | `material.plugins` |
| `enableSkeletonShadows(gen)` / `enableMorphTargetShadows(gen)` | skinned / morphed shadow casters |
| `enableArcRotateKeyboardControls()` | arrow-key camera |
| `enableRenderTaskMeshRefresh(task)` | task follows scene renderable rebuilds (before first record) |
| `enableMaterialTracking(mat)` | auto-dirty material UBO |
| `enableSceneTransmission(scene, engine)` | scene-colour grab pipeline |
| `enableDeviceLost*Recovery(...)` | device-loss recovery per subsystem |
| `enableCsmStaticCache(engine, sg, opts)` | CSM static/dynamic split |
| `enableGltfCameras()` | import glTF cameras into `container.cameras` |
| `enableBoneControl()` | populate `container.skeletons` |

Each is tree-shakable — not importing it costs nothing.

---

## glTF loading

```ts
loadGltf(engine, source: string | ArrayBuffer | Blob): Promise<AssetContainer>
addToScene(scene, container)
getContainerMeshes(container): Mesh[]
```

```ts
interface AssetContainer {
  entities: Array<SceneNode | LightBase>;   // glTF: [root TransformNode]
  animationGroups?; clearColor?; camera?; cameras?;
  materialVariants?; xmpMetadata?; skeletons?;
  flowGraphs?; flowGraphRuntimes?;
}
```

`entities` for glTF is a **single root transform node**, not a mesh list — use `getContainerMeshes` for the renderable leaves. `addToScene` applies `clearColor`, activates `camera` (but never one from `cameras`), and registers animation groups with the scene-owned `AnimationManager`.

Supported extensions include `KHR_materials_*` (clearcoat, sheen, anisotropy, variants, ior, specular, volume, transmission, emissive_strength, unlit, pbrSpecularGlossiness), `KHR_texture_transform`, `KHR_texture_basisu`, `EXT_texture_webp`, `KHR_draco_mesh_compression` (override path with `setDracoBaseUrl()`), `KHR_lights_punctual`, `KHR_node_visibility`, `KHR_animation_pointer`, `EXT_mesh_gpu_instancing`, `EXT_meshopt_compression` (`setMeshoptBaseUrl()`), `KHR_mesh_quantization`, `KHR_xmp_json_ld`, `ExtrasAsMetadata`, genuine GPU-level interleaved vertex buffers.

Morph targets are **PBR-only** (not Standard). Skeletal animation supports 4 or 8 bones.

---

## Migration escape hatch

`@babylonjs/lite-compat` — Babylon.js-shaped layer over the native API, keeping `new WebGPUEngine`, `new Scene`, `MeshBuilder`, `StandardMaterial` etc. Bundler plugins (Vite / Rollup / Webpack / esbuild) rewrite `@babylonjs/core`, `/loaders`, `/addons`, `/materials` imports at build time. Unsupported APIs throw `LiteCompatError` rather than mis-rendering.

Intended path: `@babylonjs/core` → `@babylonjs/lite-compat` → `@babylonjs/lite`.