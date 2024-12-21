import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// THREE.JS ANIMATION STUFF!
// ...so this will take rotation (quaternion) & linear acceleration data
// to make a 3d cube move thru 3d space, leaving a pink trailing line,
// there's a couple camera controls to help keep it all in view.
// "follow cube" will lock the camera in front, looking back at the cube and line
// otherwise mouse orbit controls to zoom, rotate, and pan around the scene.
//
// note: MAX_POINTS is probably wrong. the line only will get so long,
// so i guess it's kinda broken, dunno, it needz some love :/

export function renderThreeStuff(data) {
  loadQuaternionData(data);
  loadAccelerationData(data);
}

// note: initalizing here, with some very basic example data
// quaternionData should otherwise get updated with data from user file input (see: loadQuaternionData)
let quaternionData = [
  { time: 0, q: { x: 0, y: 0, z: 0, w: 1 } },
  { time: 500, q: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } },
  { time: 1000, q: { x: 0.2, y: 0.3, z: 0.4, w: 0.8 } },
  // etc...
];
function loadQuaternionData(rawData) {
  // GameRotationVector-real
  // GameRotationVector-i
  // GameRotationVector-j
  // GameRotationVector-k
  // okay assume all these arrays are the same length

  quaternionData = [];

  for (let i = 0; i < rawData["GameRotationVector-real"].length - 1; i++) {
    const real = rawData["GameRotationVector-real"][i];
    const w = real.v;
    const x = rawData["GameRotationVector-i"][i].v;
    const y = rawData["GameRotationVector-j"][i].v;
    const z = rawData["GameRotationVector-k"][i].v;
    if (!real || !w || !x || !y || !z) continue;

    quaternionData.push({
      time: real.millis,
      q: { x, y, z, w },
    });
  }

  console.log("zomg quaternionData:", quaternionData);
}

let accelerationData = [
  { x: 0.0, y: 0.0, z: -9.81 }, // Example gravity (constant downward)
];
function loadAccelerationData(rawData) {
  // LinearAcceration-x
  // LinearAcceration-y
  // LinearAcceration-z
  // okay assume all these arrays are the same length

  accelerationData = [];

  for (let i = 0; i < rawData["LinearAcceration-x"].length - 1; i++) {
    const time = rawData["LinearAcceration-x"][i].millis;
    const x = rawData["LinearAcceration-x"][i].v;
    const y = rawData["LinearAcceration-y"][i].v;
    const z = rawData["LinearAcceration-z"][i].v;
    if (!time || !x || !y || !z) continue;
    accelerationData.push({
      time,
      a: { x, y, z },
    });
  }

  console.log("zomg accelerationData:", accelerationData);
}

// Three.js scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// camera.position.set(0, 5, 10); // Set an initial camera position

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth - 10, window.innerHeight - 100);

const threeContainer = document.getElementById("three-container");
threeContainer.appendChild(renderer.domElement);

// animation controlz
const threeStartAnimateBtn = document.getElementById("three-start-animate");
threeStartAnimateBtn.addEventListener("click", startAnimation);

const threeStopAnimateBtn = document.getElementById("three-stop-animate");
threeStopAnimateBtn.addEventListener("click", stopAnimation);

const elapsedTimeContainer = document.getElementById("elapsed-time");
const playbackTimeContainer = document.getElementById("playback-time");

const playbackSpeedSlider = document.getElementById("three-playback-speed");
const playbackSpeedValue = document.getElementById("three-playback-speed-value");
playbackSpeedSlider.addEventListener("input", (event) => {
  playbackSpeed = parseFloat(event.target.value);
  playbackSpeedValue.textContent = playbackSpeed;
});

// cube Model
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshNormalMaterial();
const model = new THREE.Mesh(geometry, material);
scene.add(model);

camera.position.z = 5;
// camera.position.set(0, 5, 10); // Set an initial camera position
// control toggle to follow cube
let followCube = false;

// Define a fixed offset for the camera relative to the cube
const cameraOffsetBack = new THREE.Vector3(0, 10, 20); // behind cube.
const cameraOffsetFront = new THREE.Vector3(0, 10, -20); // in front of the cube

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);

// Optional: Set control parameters
controls.enableDamping = true; // Smooth motion
controls.dampingFactor = 0.1;
// controls.screenSpacePanning = false; // Restrict panning to XY plane
// controls.minDistance = 2; // Minimum zoom distance. default is zero
// controls.maxDistance = 10000; // Maximum zoom distance. default is infinity.
// controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation to "top view"

// path trace stuff
// Array to store the path positions
const pathPositions = [];
let currentPathIndex = 0; // Tracks the number of points in the path

// Path line setup
const pathGeometry = new THREE.BufferGeometry();
// Pre-allocate the buffer
const MAX_POINTS = 1_00_000; // Maximum number of points in the path
const positions = new Float32Array(MAX_POINTS * 3); // Each point has (x, y, z)
pathGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff11ff }); // pink line!
const pathLine = new THREE.Line(pathGeometry, pathMaterial);
scene.add(pathLine);

// Physics variables
let currentPosition = new THREE.Vector3(0, 0, 0); // Start at origin
let velocity = new THREE.Vector3(0, 0, 0); // Initial velocity is zero
let lastTimestamp = null; // Track time between frames

// Update the path using linear acceleration and orientation
function updatePath(quaternion, acceleration, currentTimestamp) {
  if (!lastTimestamp) {
    lastTimestamp = currentTimestamp; // Initialize the first timestamp
    return;
  }

  // keep pathPositions constrained...
  if (pathPositions.length > MAX_POINTS) pathPositions.shift();

  // Calculate delta time (in seconds)
  const deltaTime = (currentTimestamp - lastTimestamp) / 1000.0; // ms -> s
  lastTimestamp = currentTimestamp;

  // Transform the acceleration vector into world space using the quaternion
  const accelVector = new THREE.Vector3(acceleration.x, acceleration.y, acceleration.z);
  accelVector.applyQuaternion(quaternion);

  // Integrate acceleration to compute velocity
  velocity.addScaledVector(accelVector, deltaTime); // v = v + a * dt

  // Integrate velocity to compute position
  currentPosition.addScaledVector(velocity, deltaTime); // p = p + v * dt

  // note: so using setFromPoints will cause a closed path to get drawn
  // i.e. there will also be a line from the cube, back to the first point
  // which isn't desireable :(
  // pathGeometry.setFromPoints(pathPositions);

  /// instead of setFromPoints do this:
  if (currentPathIndex >= MAX_POINTS) return; // avoid overflow
  // Add the current position to the pathPositions array
  pathPositions.push(currentPosition.clone());
  // Update the pre-allocated buffer
  positions[currentPathIndex * 3] = currentPosition.x;
  positions[currentPathIndex * 3 + 1] = currentPosition.y;
  positions[currentPathIndex * 3 + 2] = currentPosition.z;
  currentPathIndex++; // Move to the next point
  // Update the geometry's draw range to include only the new segment
  pathGeometry.setDrawRange(0, currentPathIndex);
  // Mark the position attribute for updates
  pathGeometry.attributes.position.needsUpdate = true;
  // /hmmmmmm

  // MOVE DA CUBE, MA!
  model.position.copy(currentPosition);
}

// animation Playback variables
let playbackSpeed = 1.0; // 1x real-time, 0.5x = half-speed, 2x = double-speed
let startTime = Date.now();

// animation control
let isAnimating = false;

// Find quaternion at specific time
function interpolateQuaternionAndAcceleration(elapsedTime) {
  // Adjust for playback speed
  const playbackTime = elapsedTime * playbackSpeed;
  playbackTimeContainer.innerText = formatMillisecondsToMinSec(playbackTime);

  // Find surrounding data points
  for (let i = 0; i < quaternionData.length - 1; i++) {
    const curr = quaternionData[i];
    const next = quaternionData[i + 1];

    const acceleration = accelerationData[i] && accelerationData[i].a ? accelerationData[i].a : null;

    if (playbackTime >= curr.time && playbackTime <= next.time) {
      const alpha = (playbackTime - curr.time) / (next.time - curr.time);

      // Spherical Linear Interpolation (SLERP)
      const q1 = new THREE.Quaternion(curr.q.x, curr.q.y, curr.q.z, curr.q.w);
      const q2 = new THREE.Quaternion(next.q.x, next.q.y, next.q.z, next.q.w);

      const interpolatedQ = new THREE.Quaternion();
      interpolatedQ.slerpQuaternions(q1, q2, alpha);

      // acceleration
      return { quaternion: interpolatedQ, acceleration };
    }
  }
  return null;
}

// Animation loop
function animate() {
  if (!isAnimating) return;

  requestAnimationFrame(animate);

  // Elapsed time since playback start
  const elapsedTime = Date.now() - startTime;

  elapsedTimeContainer.innerText = formatMillisecondsToMinSec(elapsedTime);

  // Get interpolated quaternion
  const out = interpolateQuaternionAndAcceleration(elapsedTime);
  if (out && out.quaternion) {
    model.quaternion.copy(out.quaternion);
  }

  // path stuff
  if (out && out.acceleration) {
    updatePath(out.quaternion, out.acceleration, elapsedTime);
  }

  controls.update(); // Only required if damping is enabled

  if (followCube) goToCube();

  renderer.render(scene, camera);
}

// playback ctrl
function stopAnimation() {
  isAnimating = false;
}
function startAnimation() {
  isAnimating = true;
  startTime = Date.now();
  animate();
}

const followCubeCheckbox = document.getElementById("follow-cube");
const goToCubeBtn = document.getElementById("go-to-cube");
const setCameraViewTopBtn = document.getElementById("set-camera-view-top");
const setCameraViewBottomBtn = document.getElementById("set-camera-view-bottom");
const setCameraViewLeftBtn = document.getElementById("set-camera-view-left");
const setCameraViewRightBtn = document.getElementById("set-camera-view-right");
const setCameraViewBackBtn = document.getElementById("set-camera-view-back");
const setCameraViewFrontBtn = document.getElementById("set-camera-view-front");

followCubeCheckbox.addEventListener("change", (event) => (followCube = event.target.checked));
goToCubeBtn.addEventListener("click", goToCube);
setCameraViewTopBtn.addEventListener("click", () => setCameraView("top"));
setCameraViewBottomBtn.addEventListener("click", () => setCameraView("bottom"));
setCameraViewLeftBtn.addEventListener("click", () => setCameraView("left"));
setCameraViewRightBtn.addEventListener("click", () => setCameraView("right"));
setCameraViewBackBtn.addEventListener("click", () => setCameraView("back"));
setCameraViewFrontBtn.addEventListener("click", () => setCameraView("front"));

function goToCube() {
  // Update the camera's position to follow the cube
  const cameraPosition = model.position.clone().add(cameraOffsetFront); // or cameraOffsetBack...
  camera.position.copy(cameraPosition);
  // Make the camera look at the cube
  camera.lookAt(model.position);
}

function setCameraView(view) {
  switch (view) {
    case "top":
      camera.position.set(model.position.x, model.position.y + 10, model.position.z);
      break;
    case "bottom":
      camera.position.set(model.position.x, model.position.y - 10, model.position.z);
      break;
    case "front":
      camera.position.set(model.position.x, model.position.y, model.position.z + 10);
      break;
    case "back":
      camera.position.set(model.position.x, model.position.y, model.position.z - 10);
      break;
    case "left":
      camera.position.set(model.position.x - 10, model.position.y, model.position.z);
      break;
    case "right":
      camera.position.set(model.position.x + 10, model.position.y, model.position.z);
      break;
    default:
      console.warn("Unknown view:", view);
      return;
  }

  // Make the camera look at the cube's position
  camera.lookAt(model.position);
}

function formatMillisecondsToMinSec(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // make seconds always have two digits
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${minutes}:${formattedSeconds}`;
}
