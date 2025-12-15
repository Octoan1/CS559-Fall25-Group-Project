// Stump top fragment shader: subtle ring overlay preserving base color
#ifdef GL_ES
precision highp float;
#endif

varying vec3 vPosition;

uniform float uMaxRadius;
uniform float uRingCount;
uniform float uRingNoise;
uniform vec3  uBaseColor;
uniform float uRingStrength; // 0..1 small overlay

float hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

void main() {
    float r = length(vPosition.xz);
    float radiusNorm = clamp(r / max(uMaxRadius, 0.0001), 0.0, 1.0);

    float angle = atan(vPosition.z, vPosition.x);
    float wobble = hash(vec2(angle, r)) * uRingNoise;
    float ringIndex = radiusNorm * uRingCount + wobble;

    float band = smoothstep(0.45, 0.55, abs(fract(ringIndex) - 0.5));

    // Overlay rings without shifting average color: centered at 1.0 +/- strength
    float ringFactor = 1.0 + (band - 0.5) * (2.0 * uRingStrength);
    vec3 color = uBaseColor * ringFactor;

    // Gentle edge darkening
    color *= mix(1.0, 0.9, radiusNorm);

    gl_FragColor = vec4(color, 1.0);
}
