import * as d3 from "d3";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

//ondrop="dropHandler(event);" ondragover="dragOverHandler(event);"
const filedrop = document.getElementById("filedrop");
const fileinput = document.getElementById("fileinput");

document.addEventListener("drop", dropHandler);
document.addEventListener("dragover", dragOverHandler);
document.addEventListener("dragLeaveHandler", dragLeaveHandler);
fileinput.addEventListener("change", async (event) => {
  console.log("zomg fileinput change event.target.files:", event.target.files[0]);
  try {
    const file = event.target.files[0];
    console.log(`…FILEINPUT! file[0].name = ${file.name}`);
    await processDataFile(file);
  } catch (e) {
    //o noz!
    console.warn("fileinput change error:", e);
  }
});

// linesToDraw will toggle showing/hiding lines groups
const linesToDraw = new Set();

async function dropHandler(ev) {
  // avoid default behavior (e.g. file from being opened)
  ev.preventDefault();

  // note: only process one file (the first [0] one)
  if (ev.dataTransfer.items) {
    const item = ev.dataTransfer.items[0];
    if (item.kind === "file") {
      const file = item.getAsFile();
      console.log(`…ITEM! file[0].name = ${file.name}`);
      await processDataFile(file);
    }
  } else {
    // DataTransfer interface to access the file(s)
    const file = ev.dataTransfer.files[0];
    console.log(`…FILE! file[0].name = ${file.name}`);
    await processDataFile(firstFile);
  }
}
function dragOverHandler(ev) {
  // prevent default behavior (e.g. file from being opened with browser)
  ev.preventDefault();

  filedrop.style.display = "flex";
}
function dragLeaveHandler(ev) {
  ev.preventDefault();
  filedrop.style.display = "none";
}

async function processDataFile(blob) {
  const text = await blob.text();
  const filelinez = text.split("\n");
  console.log("zomg blob.text() first line:", filelinez[0]);

  const out = filelinez.reduce((acc, line) => {
    //first split on spacez
    const [unixts, millis, ...rest] = line.split(" ");
    /*
    1733065604 7901 MagneticField-x:-98.81, y:-50.25, z:-53.31
    1733065604 8025 Gyro-x:-0.61, y:-4.87, z:-1.39
    1733065604 8127 Gravity-x:9.09, y:3.49, z:-1.68
    1733065604 8252 Gyro-x:-2.06, y:2.83, z:3.40
    1733065604 8353 Gyro-x:-0.23, y:0.35, z:-0.23
    1733065604 8477 Gyro-x:0.08, y:-0.71, z:-0.07
    1733065604 8577 Accelerometer-x:10.88, y:1.52, z:0.78
    1733065605 8699 LinearAcceration-x:-0.03, y:0.21, z:0.09
    */

    const rest_str = rest.join(" ");

    if (rest_str.includes("-") && rest_str.includes(":")) {
      const [title, ...values] = rest_str.split("-");
      const values_str = values.join("-");
      // example: `x:-0.03, y:0.21, z:0.09`
      values_str.split(",").forEach((val) => {
        const [axis, v] = val.split(":");
        if (!isNaN(parseFloat(v))) {
          // okay! gotta number now ;-)
          const accKey = `${title}-${axis.trim()}`;
          if (!acc[accKey]) {
            acc[accKey] = [];
          }
          acc[accKey].push({ millis: parseInt(millis), v: parseFloat(v) });
        }
      });
    }

    return acc;
  }, {});

  renderLegend(out);
  renderLinez(out);
  loadQuaternionData(out);
  loadAccelerationData(out);
}

function renderLegend(data) {
  const legend = document.getElementById("legend");

  // clear any previous content.
  legend.innerHTML = "";

  // create checkboxes with labels with data keys
  Object.keys(data).forEach((k) => {
    // wrapper
    const checkboxen = document.createElement("div");

    // input
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = k;
    checkbox.value = k;
    checkbox.checked = true;
    linesToDraw.add(k);

    // toggle event
    checkbox.addEventListener("change", (ev) => {
      if (ev.target.checked) {
        linesToDraw.add(k);
      } else {
        linesToDraw.delete(k);
      }
      renderLinez(data);
    });

    // label
    const label = document.createElement("label");
    label.htmlFor = k;
    label.textContent = k;

    // append the checkbox and label to the container
    checkboxen.appendChild(checkbox);
    checkboxen.appendChild(label);

    // append the container to the legend
    legend.appendChild(checkboxen);
  });

  // uncheck all
  const button = document.createElement("button");
  button.innerText = "un-check everything";
  button.addEventListener("click", (ev) => {
    linesToDraw.clear();
    document.querySelectorAll("#legend input").forEach((el) => (el.checked = false));
    // don't rerender now, because it will be nothing; other checks will cause re-render.
    // renderLinez(data);
  });
  legend.appendChild(button);
}

function renderLinez(data) {
  console.log("zomg renderLinez data:", data);

  // hide filedrop container, if showing.
  filedrop.style.display = "none";

  const container = document.getElementById("linez");

  //clear any previous visualization
  container.innerHTML = "";

  // chart dimensions and margins.
  const width = window.innerWidth;
  const height = window.innerHeight - 5;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 30;
  const marginLeft = 40;

  // init x & y domains
  // note; using null place holders so something from the data is set as these values
  const y_domain = [null, null];
  const x_domain = [null, null];
  // try to get x & y domain ranges from data
  Object.entries(data).forEach(([title, values]) => {
    if (linesToDraw.has(title)) {
      values.forEach((v) => {
        // try to automagically infer x & y axis domains
        if (v.millis < x_domain[0] || x_domain[0] === null) x_domain[0] = v.millis;
        if (v.millis > x_domain[1] || x_domain[1] === null) x_domain[1] = v.millis;
        if (v.v < y_domain[0] || y_domain[0] === null) y_domain[0] = v.v;
        if (v.v > y_domain[1] || y_domain[1] === null) y_domain[1] = v.v;
      });
    }
  });

  // x axis horizontal position scale
  const x = d3
    .scaleLinear()
    .domain(x_domain)
    .range([marginLeft, width - marginRight]);

  // y axis vertical position scale
  const y = d3
    .scaleLinear()
    .domain(y_domain)
    .range([height - marginBottom, marginTop]);

  // SVG container.
  const svg = d3.create("svg").attr("width", width).attr("height", height);

  // add the x-axis.
  svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(
      d3.axisBottom(x).tickFormat((milliseconds) => {
        // minutes
        return `${Math.floor(milliseconds / 60000)}m`;
      }),
    );

  // add the y-axis.
  svg.append("g").attr("transform", `translate(${marginLeft},0)`).call(d3.axisLeft(y));

  // Compute the points in pixel space as [x, y, z], where z is the name of the series.
  let points = [];
  Object.entries(data).forEach(([title, values]) => {
    if (linesToDraw.has(title)) {
      // kinda sloppy array, here, but also tack on the edn .millis and .v
      // to be referenced later when showing a tooltip popever
      points = [...points, ...values.map((v) => [x(v.millis), y(v.v), title, v.millis, v.v])];
    }
  });
  // group the points
  const groups = d3.rollup(
    points,
    (v) => Object.assign(v, { z: v[0][2] }),
    (d) => d[2],
  );

  // draw a line for x-axis zero
  svg
    .append("line")
    .attr("x1", marginLeft)
    .attr("x2", width - (marginLeft + marginRight))
    .attr("y1", y(0))
    .attr("y2", y(0))
    .style("stroke", "dimgray");

  // draw the data lines
  // note: .curve(d3.curveStepAfter) makes the lines more like a square wave
  // (vs. without, which is more sawtooth)
  const line = d3.line().curve(d3.curveStepAfter);
  const path = svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "hotpink")
    .attr("stroke-width", 1.5)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .selectAll("path")
    .data(groups.values())
    .join("path")
    .style("mix-blend-mode", "lighten")
    .attr("d", line);

  // invisible layer for the interactive tip.
  const dot = svg.append("g").attr("display", "none");

  dot.append("circle").attr("r", 2.5).attr("fill", "white");

  dot.append("text").attr("text-anchor", "middle").attr("y", -8);

  // when the pointer moves, find the closest point, update the interactive tip, and highlight
  // the corresponding line
  svg
    .on("pointerenter", () => {
      path.style("mix-blend-mode", null).style("stroke", "#efefef");
      dot.attr("display", null);
    })
    .on("pointermove", (event) => {
      const [xm, ym] = d3.pointer(event);
      const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
      const [x, y, k, millis, v] = points[i];
      path
        .style("stroke", ({ z }) => (z === k ? null : "DimGray"))
        .filter(({ z }) => z === k)
        .raise();
      dot.attr("transform", `translate(${x},${y})`);
      dot
        .select("text")
        .text(`${k} [${formatMillisecondsToMinSec(millis)} ${v}]`)
        .style("fill", "white");
      svg.property("value", k).dispatch("input", { bubbles: true });
    })
    .on("pointerleave", () => {
      path.style("mix-blend-mode", "lighten").style("stroke", "hotpink");
      dot.attr("display", "none");
      svg.node().value = null;
      svg.dispatch("input", { bubbles: true });
    })
    .on("touchstart", (event) => event.preventDefault());

  // append the SVG element to the container div
  container.append(svg.node());
}

function formatMillisecondsToMinSec(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // make seconds always have two digits
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${minutes}:${formattedSeconds}`;
}

// THREE.JS STUFF!
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

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);

// Optional: Set control parameters
controls.enableDamping = true; // Smooth motion
controls.dampingFactor = 0.1;
// controls.screenSpacePanning = false; // Restrict panning to XY plane
controls.minDistance = 2; // Minimum zoom distance
// controls.maxDistance = 10000; // Maximum zoom distance
// controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation to "top view"

// path trace stuff
// Array to store the path positions
const pathPositions = [];

// Path line setup
const pathGeometry = new THREE.BufferGeometry();
// Pre-allocate the buffer
const MAX_POINTS = 10000; // Maximum number of points in the path
const positions = new Float32Array(MAX_POINTS * 3); // Each point has (x, y, z)
pathGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red line
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

  // Store the new position in the path
  pathPositions.push(currentPosition.clone());

  // Update the line geometry
  pathGeometry.setFromPoints(pathPositions);
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
