import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createBox,
    createEngine,
    createGround,
    createHemisphericLight,
    createPcfSpotlightShadowGenerator,
    createSceneContext,
    createSpotLight,
    createSphere,
    createStandardMaterial,
    registerSceneWithShadowSupport,
    setShadowTaskCasterMeshes,
    startEngine,
    Vec3,
    subtractVec3,
} from "@babylonjs/lite";

const sunPosition: Vec3 = { x: 2, y: 3, z: 1 };
const planetPosition: Vec3 = { x: 5, y: 2, z: 0 }
const planetUnderSpotLight: Vec3 = { x: -1.7, y: 0.5, z: 0.8 }
async function main(): Promise<void> {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.05, g: 0.06, b: 0.09, a: 1 };

    const camera = createArcRotateCamera(-Math.PI / 2, 1.1, 10, { x: 0, y: 0.5, z: 0 });
    scene.camera = camera;
    attachControl(camera, canvas, scene);

    const box = createBox(engine, 1);
    box.id = 'sun';
    box.position.set(0.4, 0.5, 0);
    const boxMat = createStandardMaterial();
    boxMat.diffuseColor = [0.85, 0.34, 0.2];
    box.material = boxMat;
    addToScene(scene, box);

    const pretendSun = createSphere(engine, { diameter: 2 });
    pretendSun.id = 'sun';
    pretendSun.position.copyFrom(sunPosition);
    const sunMat = createStandardMaterial();
    sunMat.emissiveColor = [1.0, 0.85, 0.5]
    pretendSun.material = sunMat;
    addToScene(scene, pretendSun);

    const secondBox = createBox(engine, 0.5);
    secondBox.id = 'sun';
    secondBox.position.set(-1, 0.2, 0.45);
    const secondBoxMat = createStandardMaterial();
    secondBoxMat.diffuseColor = [0, 0, 0.9];
    secondBox.material = secondBoxMat;
    secondBox.receiveShadows = true;
    addToScene(scene, secondBox);

    const ground = createGround(engine, { width: 8, height: 8 });
    ground.id = 'sun'
    const groundMat = createStandardMaterial();
    groundMat.diffuseColor = [0.6, 0.6, 0.65];
    ground.material = groundMat;
    ground.receiveShadows = true;
    addToScene(scene, ground);

    const planet = createSphere(engine);
    planet.id = 'planet';
    planet.position.copyFrom(planetPosition)
    const sphereMat = createStandardMaterial();
    sphereMat.diffuseColor = [0.1, 0.9, 0.2]
    planet.material = sphereMat;

    planet.receiveShadows = true;

    addToScene(scene, planet);

    const bDir = subtractVec3(box.position, pretendSun.position);
    // spot light up and to the side, aimed at the box: the shadow falls away from the light
    const playerObjectsSpot = createSpotLight([sunPosition.x, sunPosition.y, sunPosition.z], [bDir.x, bDir.y, bDir.z], 1.2, 0, 1.0);
    playerObjectsSpot.range = 30;
    playerObjectsSpot.includedOnlyMeshIds = new Set(['sun'])
    playerObjectsSpot.shadowGenerator = createPcfSpotlightShadowGenerator(engine, playerObjectsSpot, { mapSize: 2048, near: 0.5, far: 6000 });
    setShadowTaskCasterMeshes(playerObjectsSpot.shadowGenerator, [box, secondBox]);
    addToScene(scene, playerObjectsSpot);

    // planet direction
    const psd = subtractVec3(planet.position, pretendSun.position);
    const planetSpot = createSpotLight([sunPosition.x, sunPosition.y, sunPosition.z], [psd.x, psd.y, psd.z], 1.2, 0, 1.0);
    planetSpot.range = 30;
    planetSpot.includedOnlyMeshIds = new Set(['planet'])
    planetSpot.shadowGenerator = createPcfSpotlightShadowGenerator(engine, planetSpot, { mapSize: 2048, near: 0.5, far: 6000 });
    setShadowTaskCasterMeshes(planetSpot.shadowGenerator, [planet]);
    addToScene(scene, planetSpot);

    await registerSceneWithShadowSupport(scene);
    await startEngine(engine);
}

main().catch((err) => console.error(err));
