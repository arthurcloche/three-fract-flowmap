import * as THREE from "three";

export class Flowmap {
  constructor(renderer, options = {}) {
    const {
      size = 128,
      falloff = 0.5,
      alpha = 1,
      dissipation = 0.1,
      velocityFactor = { x: 20, y: 20 },
      swap = true,
    } = options;
    this.options = options;
    this.renderer = renderer;
    this.camera = new THREE.Camera();
    // Create two render targets for ping pong effect
    const rtOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };
    this.renderTargetA = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.renderTargetB = new THREE.WebGLRenderTarget(size, size, rtOptions);

    this.readTarget = this.renderTargetA;
    this.writeTarget = this.renderTargetB;

    // Triangle covering the screen
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tMap: { value: this.readTarget.texture },
        uFalloff: { value: falloff },
        uAlpha: { value: alpha },
        uDissipation: { value: dissipation },
        uAspect: { value: window.innerWidth / window.innerHeight },
        uMouse: { value: new THREE.Vector2(0.5) },
        uVelocity: { value: new THREE.Vector2() },
        uVelocityFactor: {
          value: new THREE.Vector2(velocityFactor.x, velocityFactor.y),
        },
      },
      vertexShader: vertexShader(),
      fragmentShader: fragmentShader(),
      depthTest: false,
    });

    this.plane = new THREE.Mesh(geometry, material);
    this.scene = new THREE.Scene();
    this.scene.add(this.plane);
  }

  swap() {
    let temp = this.readTarget;
    this.readTarget = this.writeTarget;
    this.writeTarget = temp;
    this.plane.material.uniforms.tMap.value = this.readTarget.texture;
  }

  update() {
    this.renderer.setRenderTarget(this.writeTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    if (this.options.swap) this.swap(); // Swap the buffers
    // console.log("update");
  }
  setMousePosition(x, y) {
    this.plane.material.uniforms.uMouse.value.set(x, y);
  }

  setVelocity(dx, dy) {
    this.plane.material.uniforms.uVelocity.value.set(dx, dy);
  }

  setAspect(aspect) {
    this.plane.material.uniforms.uAspect.value = aspect;
  }

  setSize(width, height) {
    this.renderTargetA.setSize(width, height);
    this.renderTargetB.setSize(width, height);
  }
}

function vertexShader() {
  return `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
    `;
}

function fragmentShader() {
  return `
        precision highp float;
        uniform sampler2D tMap;
        uniform float uFalloff;
        uniform float uAlpha;
        uniform float uDissipation;
        uniform float uAspect;
        uniform vec2 uMouse;
        uniform vec2 uVelocity;
        uniform vec2 uVelocityFactor;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(tMap, vUv) * uDissipation;
            vec2 cursor = vUv - uMouse;
            cursor.x *= uAspect;
            vec3 stamp = vec3(uVelocity *uVelocityFactor * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(uVelocity*uVelocityFactor)), 3.0));
            float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
            color.rgb = mix(color.rgb, stamp, vec3(falloff));
            gl_FragColor = color;
            //gl_FragColor = vec4(vec3(vUv,1.),1.);
        }
    `;
}
