import * as THREE from "three";
import Framebuffer from "./framebuffer.js"; // Ensure the path is correct

let camera, scene, renderer, container;
let flowmap;
let plane;
let mouse = new THREE.Vector2(),
  lastMouse = new THREE.Vector2();

init();
animate();

function init() {
  // Renderer
  container = document.getElementById("container");
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  let texture = new THREE.TextureLoader().load("./src/3.jpg", function () {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  });
  // Camera
  camera = new THREE.OrthographicCamera();
  camera.position.z = 2;

  // Scene
  scene = new THREE.Scene();

  // Flowmap setup
  flowmap = new Framebuffer(renderer);

  // Plane setup
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      utexture: {
        value: texture,
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
            uniform sampler2D utexture;
            varying vec2 vUv;
            
            void main() {
                vec2 uv = vUv;
                float s = 16.;
                vec2 m = floor(uv*s);
                float n = floor(uv.x*s);
                vec3 flow = texture2D(flowTexture, uv).rgb;
                vec3 tex = texture2D(flowTexture,vec2(m/s)).rgb;
                vec2 dist = resolution*.015;
                vec2 off = (tex.xy*.65)*(pow(tex.z,2.)*0.125);
                float v = vec2(uv-(off*dist)).x;
                vec3 col = texture2D(utexture,fract(vec2(v,uv.y))).rgb;
                //gl_FragColor = vec4(col+(flow/10.), 1.0);
                gl_FragColor = vec4(flow, 1.0);
            }
        `,
  });
  plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  document.addEventListener("resize", onWindowResize);
  document.addEventListener("mousemove", onDocumentMouseMove, false);
  document.addEventListener(
    "mousedown",
    () => {
      flowmap.setMousePressed(true);
    },
    false
  );
  document.addEventListener(
    "mouseup",
    () => {
      flowmap.setMousePressed(false);
    },
    false
  );
  onWindowResize();
}

function animate() {
  requestAnimationFrame(animate);

  flowmap.update();
  plane.material.uniforms.flowTexture.value = flowmap.readTarget.texture;
  renderer.render(scene, camera);
}

// need a better mouse handling - shouldn't display unless moved
function onDocumentMouseMove(event) {
  event.preventDefault();
  // Updating mouse positions
  mouse.x = event.clientX / window.innerWidth;
  mouse.y = 1 - event.clientY / window.innerHeight;

  // Calculate velocity based on the difference from the last frame
  let velocityX = mouse.x - lastMouse.x;
  let velocityY = mouse.y - lastMouse.y;

  // Update the flowmap with new mouse position and velocity
  flowmap.setMousePosition(mouse.x, mouse.y);
  flowmap.setVelocity(velocityX, velocityY);

  // Store last mouse position
  lastMouse.x = mouse.x;
  lastMouse.y = mouse.y;
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // plane.geometry.dispose(); // Disposing geometry first is good practice when replacing it
  // plane.geometry = new THREE.PlaneGeometry(2, 2);
  // flowmap.setAspect(window.innerWidth / window.innerHeight);
  console.log("resize");
}
function onDocumentMouseClick() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // plane.geometry.dispose(); // Disposing geometry first is good practice when replacing it
  // plane.geometry = new THREE.PlaneGeometry(2, 2);
  // flowmap.setAspect(window.innerWidth / window.innerHeight);
  console.log("resize");
}
