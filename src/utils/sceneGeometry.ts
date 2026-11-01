import * as THREE from 'three';

export function createBox(size: [number, number, number], position: [number, number, number], color: THREE.ColorRepresentation, opacity = 1): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .83, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  return mesh;
}
