import * as THREE from "three";
import Framebuffer from "./framebuffer.js"; // Ensure the path is correct

let camera, scene, renderer, container;
let flowmap;
let plane;
let mouse = new THREE.Vector2(),
  lastMouse = new THREE.Vector2();
const FIXED_DISTANCE = 10;
init();
animate();

function init() {
  // Renderer
  container = document.getElementById("container");
  const [width, height] = [window.innerWidth, window.innerHeight];
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  const texture = new THREE.TextureLoader().load("./src/3.jpg", function () {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  });
  console.log(texture.source);
  // Camera
  camera = new THREE.PerspectiveCamera(50, width / height, 0.001, 1000);
  camera.position.z = FIXED_DISTANCE;

  // Scene
  scene = new THREE.Scene();

  // Flowmap setup
  flowmap = new Framebuffer(renderer);
  // Plane setup
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      imageResolution: {
        value: new THREE.Vector2(texture.width, texture.height),
      },
      uTexture: {
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
            uniform vec2 uResolution;
            uniform vec2 imageResolution;
            uniform sampler2D flowTexture;
            uniform sampler2D uTexture;
            varying vec2 vUv;
            
            vec2 coords(in vec2 p) {
             
              if (uResolution.x < uResolution.y) {
                p.x *= uResolution.x / uResolution.y;
                p.x += (uResolution.y - uResolution.x) / uResolution.y * 0.5;
              } else {
                p.y *= uResolution.y / uResolution.x;
                p.y += (uResolution.x - uResolution.y) / uResolution.x * 0.5;
              }
              return p;
            }

            void main() {
                vec2 uv = coords(vUv);
                float s = 16.;
                vec2 m = floor(uv*s);
                float n = floor(uv.x*s);
                vec3 flow = texture2D(flowTexture, uv).rgb;
                vec3 tex = texture2D(flowTexture,vec2(m/s)).rgb;
                vec2 dist = uResolution*.015;
                vec2 off = (tex.xy*.65)*(pow(tex.z,2.)*0.125);
                vec2 v = vec2(uv-(off*dist));
                vec3 col = texture2D(uTexture,v).rgb;
                gl_FragColor = vec4(flow, 1.0);
                gl_FragColor = vec4(col, 1.0);

            }
        `,
  });
  plane = new THREE.Mesh(geometry, material);
  plane.scale.set();
  scene.add(plane);

  window.addEventListener("resize", onResize);
  document.addEventListener("mousemove", mousemove, false);
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
  onResize();
}

function animate() {
  requestAnimationFrame(animate);

  flowmap.update();
  plane.material.uniforms.flowTexture.value = flowmap.readTarget.texture;
  renderer.render(scene, camera);
}

// need a better mouse handling - shouldn't display unless moved
function mousemove(event) {
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

function onResize() {
  const [width, height] = [window.innerWidth, window.innerHeight];
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  // kinda fancy but i found this online and wanted to test it out
  planeFitPerspectiveCamera(plane, camera, FIXED_DISTANCE);
  plane.material.uniforms.uResolution.value.set(width, height);
  animate();
}

function planeFitPerspectiveCamera(plane, camera, relativeZ = null) {
  const cameraZ = relativeZ !== null ? relativeZ : camera.position.z;
  const distance = cameraZ - plane.position.z;
  const vFov = (camera.fov * Math.PI) / 180;
  const scaleY = 2 * Math.tan(vFov / 2) * distance;
  const scaleX = scaleY * camera.aspect;
  plane.scale.set(scaleX, scaleY, 1);
}
