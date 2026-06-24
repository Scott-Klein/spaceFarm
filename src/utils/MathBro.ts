import { Scalar, Vector3 } from '@babylonjs/core';

export default class MathBro {
  static randomPointInSphere(center: Vector3, radius: number): Vector3 {
    let x: number, y: number, z: number;
    do {
      x = Scalar.RandomRange(-1, 1);
      y = Scalar.RandomRange(-1, 1);
      z = Scalar.RandomRange(-1, 1);
    } while (x * x + y * y + z * z > 1);
    return new Vector3(center.x + x * radius, center.y + y * radius, center.z + z * radius);
  }
}
