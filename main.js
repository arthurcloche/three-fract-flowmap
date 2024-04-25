import * as THREE from "three";
import { Flowmap } from "./flowmap.js"; // Ensure the path is correct

let camera, scene, renderer;
let flowmap;
let plane;
let mouse = new THREE.Vector2(),
  lastMouse = new THREE.Vector2();

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Camera
  camera = new THREE.OrthographicCamera();
  camera.position.z = 2;

  // Scene
  scene = new THREE.Scene();

  // Flowmap setup
  flowmap = new Flowmap(renderer, {
    size: 256, // Choose the size based on performance needs
    falloff: 0.3,
    alpha: 0.5,
    dissipation: 0.95,
  });

  // Plane setup
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      flowTexture: { value: flowmap.readTarget.texture },
    },
    vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            uniform sampler2D flowTexture;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv;
                vec3 flow = texture2D(flowTexture, uv).rgb;
                gl_FragColor = vec4(flow, 1.0);
            }
        `,
  });
  plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  document.addEventListener("mousemove", onDocumentMouseMove, false);
}

function animate() {
  requestAnimationFrame(animate);

  flowmap.update();
  plane.material.uniforms.flowTexture.value = flowmap.readTarget.texture;
  renderer.render(scene, camera);
}

function onDocumentMouseMove(event) {
  event.preventDefault();

  // Updating mouse positions
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Calculate velocity based on the difference from the last frame
  let velocityX = (mouse.x - lastMouse.x) * window.innerWidth * 0.5;
  let velocityY = (mouse.y - lastMouse.y) * window.innerHeight * 0.5;

  // Update the flowmap with new mouse position and velocity
  flowmap.setMousePosition(mouse.x, mouse.y);
  flowmap.setVelocity(velocityX, velocityY);

  // Store last mouse position
  lastMouse.x = mouse.x;
  lastMouse.y = mouse.y;
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
