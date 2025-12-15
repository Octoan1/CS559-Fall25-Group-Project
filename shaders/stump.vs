// Stump top vertex shader: pass position for radial rings
varying vec3 vPosition;

void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
