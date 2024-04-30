import * as THREE from "three";

export default function Framebuffer(renderer, options = {}) {
  this.options = {
    textureSize: options.textureSize ?? 256,
    swap: options.swap ?? true,
    fragment: options.fragment ?? fragmentShader(),
    vertex: options.vertex ?? vertexShader(),
    uniforms: options.uniforms ?? {
      uFalloff: { value: 0.3 },
      uAlpha: { value: 0.5 },
      uDissipation: { value: 0.95 },
      uVelocityFactor: { value: { x: 20, y: 20 } },
    },
  };
  console.log(this.options);
  this.renderer = renderer;
  // basic camera for rendering a full screen quad
  this.camera = new THREE.Camera();
  this.scene = new THREE.Scene();
  // Create two render targets in case of ping pong effect
  const rtOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // half float is usually faster than float, but in case of issues, try THREE.FloatType
    type: THREE.HalfFloatType,
  };
  // we draw to one of these render targets and read from the other, then swap them to preserve texture information
  // they are drawn as squares, then scaled to the screen ratio in the shader to avoid extra definition
  // one size fit all when you can uv.x *= aspect. In Shaderland, this is the way.
  this.readTarget = new THREE.WebGLRenderTarget(
    this.options.textureSize,
    this.options.textureSize,
    rtOptions
  );
  this.writeTarget = new THREE.WebGLRenderTarget(
    this.options.textureSize,
    this.options.textureSize,
    rtOptions
  );

  // Plane covering the screen
  this.geometry = new THREE.PlaneGeometry(2, 2);
  this.material = new THREE.ShaderMaterial({
    uniforms: {
      uBuffer: { value: this.readTarget.texture },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uAspect: { value: window.innerWidth / window.innerHeight },
      uMouse: { value: new THREE.Vector3(0.5, 0.5, 0) },
      uVelocity: { value: new THREE.Vector2() },
      ...this.options.uniforms,
    },
    vertexShader: this.options.vertex,
    fragmentShader: this.options.fragment,
  });

  this.mesh = new THREE.Mesh(this.geometry, this.material);
  this.scene.add(this.mesh);

  this.swapTexture = () => {
    let temp = this.readTarget;
    this.readTarget = this.writeTarget;
    this.writeTarget = temp;
    this.mesh.material.uniforms.uBuffer.value = this.readTarget.texture;
  };

  this.update = () => {
    this.renderer.setRenderTarget(this.writeTarget);
    this.renderer.render(this.scene, new THREE.Camera());
    this.renderer.setRenderTarget(null);
    if (this.options.swap) this.swapTexture();
    //console.log("update"); // Swap the buffers
  };

  this.setMousePosition = (x, y) => {
    this.mesh.material.uniforms.uMouse.value.set(x, y);
  };
  this.setMousePressed = (z) => {
    this.mesh.material.uniforms.uMouse.value.z = z;
  };

  this.setVelocity = (dx, dy) => {
    this.mesh.material.uniforms.uVelocity.value.set(dx, dy);
  };

  this.setAspect = (aspect) => {
    this.mesh.material.uniforms.uAspect.value = aspect;
  };

  this.setResolution = (x, y) => {
    this.mesh.material.uniforms.uResolution.value.set(x, y);
  };

  this.setSize = (width, height) => {
    this.renderTargetA.setSize(width, height);
    this.renderTargetB.setSize(width, height);
  };
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
        uniform sampler2D uBuffer;
        uniform float uFalloff;
        uniform float uAlpha;
        uniform float uDissipation;
        uniform float uAspect;
        uniform vec3 uMouse;
        uniform vec2 uVelocity;
        uniform vec2 uVelocityFactor;
        varying vec2 vUv;
        void main() {
            vec4 color = texture2D(uBuffer, vUv) * uDissipation;
            vec2 cursor = vUv - uMouse.xy;
            cursor.x *= uAspect;
            vec3 stamp = vec3(uVelocity *uVelocityFactor * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(uVelocity*uVelocityFactor)), 3.0));
            float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
            if(uMouse.z > 0.) color.rgb = mix(color.rgb, stamp, vec3(falloff));
            gl_FragColor = color;
        }
    `;
}
