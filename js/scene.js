// Scene and graphics initialization
class SceneSetup {
    static isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    constructor() {
        // If WebGL is not available, show a friendly overlay and skip renderer setup
        if (!SceneSetup.isWebGLAvailable()) {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.left = overlay.style.top = '0';
            overlay.style.width = overlay.style.height = '100%';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(220,240,255,0.9))';
            overlay.style.zIndex = 2000;
            overlay.innerHTML = `<div style="max-width:720px;padding:24px;border-radius:12px;text-align:center;color:#111;font-family:Arial, sans-serif;">
                <h2 style="margin-top:0;">WebGL unavailable</h2>
                <p>Your browser or system doesn't appear to support WebGL. Try enabling hardware acceleration, updating your browser or GPU drivers, or opening this page in Chrome or Firefox.</p>
                <p style="margin-top:12px;"><button id="webglDismiss" style="padding:8px 12px;border-radius:8px;border:none;background:#0078d4;color:white;cursor:pointer;">Dismiss</button></p>
            </div>`;
            document.body.appendChild(overlay);
            const btn = document.getElementById('webglDismiss');
            if (btn) btn.addEventListener('click', () => overlay.remove());
            // Set minimal properties so other code can check for renderer presence
            this.renderer = null;
            this.scene = new THREE.Scene();
            return;
        }

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
        try {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            // clear color alpha 0 to allow CSS background to be visible where scene.background is null
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
            document.body.appendChild(this.renderer.domElement);
        } catch (err) {
            console.error('WebGL renderer creation failed:', err);
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.left = overlay.style.top = '0';
            overlay.style.width = overlay.style.height = '100%';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'rgba(0,0,0,0.85)';
            overlay.style.zIndex = 2000;
            overlay.innerHTML = `<div style="max-width:720px;padding:24px;border-radius:12px;text-align:center;color:#fff;font-family:Arial, sans-serif;">
                <h2 style="margin-top:0;">WebGL initialization failed</h2>
                <p>Could not create a WebGL context. Try reloading the page, enabling hardware acceleration, or switching browsers.</p>
                <p style="margin-top:12px;"><button id="webglDismiss2" style="padding:8px 12px;border-radius:8px;border:none;background:#0078d4;color:white;cursor:pointer;">Dismiss</button></p>
            </div>`;
            document.body.appendChild(overlay);
            const btn2 = document.getElementById('webglDismiss2');
            if (btn2) btn2.addEventListener('click', () => overlay.remove());
            this.renderer = null;
        }

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
        // Always remember preference even if prototype mode overrides visuals
        this._darkMode = on;
        // If prototype/low-detail mode is active, don't change shader/renderer settings now
        if (this._prototypeMode) return;

        if (this._skyMesh) this._skyMesh.visible = on;
        if (this._lightSkyMesh) this._lightSkyMesh.visible = !on;
        // Always keep scene background null so shader skies show through
        this.scene.background = null;
    }

    setPrototypeMode(enabled) {
        const on = Boolean(enabled);
        this._prototypeMode = on;
        if (on) {
            // Low-detail: disable shadows, hide shader skies, use flat background and lower pixel ratio
            this._savedShadowEnabled = this.renderer.shadowMap.enabled;
            this.renderer.shadowMap.enabled = false;
            this._savedPixelRatio = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : window.devicePixelRatio;
            try { this.renderer.setPixelRatio(1); } catch (e) {}
            if (this._skyMesh) this._skyMesh.visible = false;
            if (this._lightSkyMesh) this._lightSkyMesh.visible = false;
            this.scene.background = new THREE.Color(0xdddddd);
        } else {
            // Restore previous settings
            this.renderer.shadowMap.enabled = this._savedShadowEnabled !== undefined ? this._savedShadowEnabled : true;
            try { this.renderer.setPixelRatio(this._savedPixelRatio || window.devicePixelRatio); } catch (e) {}
            // Re-apply sky visibility based on dark mode preference
            if (this._darkMode) {
                if (this._skyMesh) this._skyMesh.visible = true;
                if (this._lightSkyMesh) this._lightSkyMesh.visible = false;
            } else {
                if (this._skyMesh) this._skyMesh.visible = false;
                if (this._lightSkyMesh) this._lightSkyMesh.visible = true;
            }
            this.scene.background = null;
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
            if (this.renderer && typeof this.renderer.setSize === 'function') this.renderer.setSize(window.innerWidth, window.innerHeight);
            if (this.skyUniforms) this.skyUniforms.resolution.value.set(window.innerWidth, window.innerHeight);
            if (this.lightSkyUniforms) this.lightSkyUniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        });
    }

    render(scene, camera) {
        if (!this.renderer) return; // renderer may be null when WebGL unavailable
        this.renderer.render(scene, camera);
    }
}
