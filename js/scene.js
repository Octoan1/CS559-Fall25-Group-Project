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

        // Make renderer transparent so the page background gradient can show through
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // clear color alpha 0 to allow CSS background to be visible where scene.background is null
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.setupLighting();
        this.setupWindowResize();
        this._setupSkySphere();
    }

    _setupSkySphere() {
        // Dark mode shader-based animated sky inside a large sphere
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

        const fragmentDark = `
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

        const matDark = new THREE.ShaderMaterial({
            uniforms: this.skyUniforms,
            vertexShader: vertex,
            fragmentShader: fragmentDark,
            side: THREE.BackSide,
            depthWrite: false
        });

        const geo = new THREE.SphereGeometry(500, 32, 32);
        const meshDark = new THREE.Mesh(geo, matDark);
        meshDark.frustumCulled = false;
        meshDark.renderOrder = -1;
        this.scene.add(meshDark);
        this._skyMesh = meshDark;

        // Light mode shader-based animated sky
        this.lightSkyUniforms = {
            time: { value: 0.0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        const fragmentLight = `
            uniform float time;
            varying vec2 vUv;

            void main() {
                vec2 uv = vUv;
                float t = time * 0.35;

                // moving waves similar to dark mode
                float w1 = sin((uv.x * 6.0) + t) * 0.5 + 0.5;
                float w2 = sin((uv.y * 8.0) - t * 0.7) * 0.5 + 0.5;
                float mixv = smoothstep(0.1, 0.9, (w1 * 0.6 + w2 * 0.4));

                // Light blue gradient colors
                vec3 colA = vec3(0.596, 0.471, 0.714); // #cbdee9
                vec3 colB = vec3(0.275, 0.647, 0.749); // #46a5bf
                vec3 colC = vec3(0.5, 0.7, 0.85); // softer light blue accent

                vec3 color = mix(colA, colB, mixv);
                color = mix(color, colC, 0.1 * sin(t + uv.x*3.0));

                // subtle radial vignette
                float dx = uv.x - 0.5;
                float dy = uv.y - 0.5;
                float dist = sqrt(dx*dx + dy*dy);
                color *= smoothstep(1.0, 0.4, dist);

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const matLight = new THREE.ShaderMaterial({
            uniforms: this.lightSkyUniforms,
            vertexShader: vertex,
            fragmentShader: fragmentLight,
            side: THREE.BackSide,
            depthWrite: false
        });

        const meshLight = new THREE.Mesh(geo.clone(), matLight);
        meshLight.frustumCulled = false;
        meshLight.renderOrder = -1;
        this.scene.add(meshLight);
        this._lightSkyMesh = meshLight;
    }

    update(delta) {
        if (this.skyUniforms) this.skyUniforms.time.value += delta;
        if (this.lightSkyUniforms) this.lightSkyUniforms.time.value += delta;
    }

    setDarkMode(enabled) {
        // enabled = true -> show dark shader sky; false -> show light shader sky
        const on = Boolean(enabled);
        if (this._skyMesh) this._skyMesh.visible = on;
        if (this._lightSkyMesh) this._lightSkyMesh.visible = !on;
        // Always keep scene background null so shader skies show through
        this.scene.background = null;
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
