// Scene and graphics initialization
class SceneSetup {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 16, 15);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.setupLighting();
        this.setupWindowResize();
        this._setupSkySphere();
    }

    _setupSkySphere() {
        // Shader-based animated sky inside a large sphere
        this.skyUniforms = {
            time: { value: 0.0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        const vertex = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragment = `
            uniform float time;
            varying vec2 vUv;

            // Simple palette helper
            vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                return a + b * cos(6.28318*(c*t + d));
            }

            void main() {
                vec2 uv = vUv;
                float t = time * 0.35;

                // moving waves
                float w1 = sin((uv.x * 6.0) + t) * 0.5 + 0.5;
                float w2 = sin((uv.y * 8.0) - t * 0.7) * 0.5 + 0.5;
                float mixv = smoothstep(0.1, 0.9, (w1 * 0.6 + w2 * 0.4));

                vec3 colA = vec3(0.05, 0.02, 0.2);
                vec3 colB = vec3(0.2, 0.05, 0.6);
                vec3 colC = vec3(0.9, 0.6, 0.3);

                vec3 color = mix(colA, colB, mixv);
                color = mix(color, colC, 0.15 * sin(t + uv.x*3.0));

                // subtle radial vignette
                float dx = uv.x - 0.5;
                float dy = uv.y - 0.5;
                float dist = sqrt(dx*dx + dy*dy);
                color *= smoothstep(1.0, 0.2, dist);

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const mat = new THREE.ShaderMaterial({
            uniforms: this.skyUniforms,
            vertexShader: vertex,
            fragmentShader: fragment,
            side: THREE.BackSide,
            depthWrite: false
        });

        const geo = new THREE.SphereGeometry(500, 32, 32);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;
        this.scene.add(mesh);
        this._skyMesh = mesh;
    }

    update(delta) {
        if (this.skyUniforms) this.skyUniforms.time.value += delta;
    }

    setDarkMode(enabled) {
        // enabled = true -> show shader sky (dark mode); false -> basic background color
        const on = Boolean(enabled);
        if (this._skyMesh) this._skyMesh.visible = on;
        if (on) {
            this.scene.background = null;
        } else {
            this.scene.background = new THREE.Color(0x87ceeb);
        }
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.camera.far = 100;
        this.scene.add(directionalLight);
    }

    setupWindowResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    render(scene, camera) {
        this.renderer.render(scene, camera);
    }
}
