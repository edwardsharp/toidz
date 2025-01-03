import FFT from "fft.js";

// some shared audio stuff
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = [];
// wave & ramp config.
let oscillatorsConfig = [];
// let gainNode = audioContext.createGain();
let gainNodes = [];

export function renderWebAudioStuff() {
  // show the ui stuff
  document.getElementById("web-audio-stuff").style.display = "flex";
  document.getElementById("prompt-x-selection").style.display = "block";

  document.getElementById("sound-gain").addEventListener("input", (event) => {
    // console.log("zomg gain now:", event.target.value);
    gainNodes.forEach((gainNode) => (gainNode.gain.value = event.target.value));
    // gainNode.gain.value = event.target.value;
  });
}

export function renderWebAudioDataKeysSelect() {
  // called after d3 vis selection
  const selectedKeys = Object.keys(window.BNO08XVIZ.selectedData);
  if (!selectedKeys || selectedKeys.length === 0) return;

  document.querySelectorAll(".sound-wait-for-select").forEach((el) => (el.style.display = "block"));
  const webAudioKeys = document.getElementById("web-audio-keys");
  // clear any existing buttons first.
  webAudioKeys.innerHTML = "";

  // init window.BNO08XVIZ.selectedKey if one doesn't exist.
  if (!window.BNO08XVIZ.selectedKey) window.BNO08XVIZ.selectedKey = selectedKeys[0];
  oscillatorsConfig.length = 0;

  selectedKeys.forEach((k, idx) => {
    oscillatorsConfig.push({ wave: "sine", ramp: false });
    const div = document.createElement("div");

    const title = document.createElement("span");
    title.innerText = k;
    div.appendChild(title);

    const waveSelect = document.createElement("select");
    ["sine", "sawtooth", "square", "triangle"].forEach((wave) => {
      const option = document.createElement("option");
      option.innerText = wave;
      option.value = wave;
      waveSelect.appendChild(option);
    });
    waveSelect.addEventListener("input", (event) => {
      if (oscillators[idx]) {
        // set it immediatly
        oscillators[idx].type = event.target.value;
        // and also put it in config
        if (oscillatorsConfig[idx]) oscillatorsConfig[idx].wave = event.target.value;
      }
    });
    div.appendChild(waveSelect);

    const rampLabel = document.createElement("label");
    // exponential
    const rampInput = document.createElement("input");
    rampInput.type = "checkbox";
    rampInput.addEventListener("input", (event) => {
      if (oscillatorsConfig[idx]) {
        oscillatorsConfig[idx].ramp = event.target.checked;
      }
    });
    rampLabel.appendChild(rampInput);
    const rampTitle = document.createElement("span");
    rampTitle.innerText = "ramp";
    rampTitle.title = "check for exponential ramps. need to restart playback.";
    rampLabel.appendChild(rampTitle);
    div.appendChild(rampLabel);

    //gain
    // <label for="gain">gain:</label>
    // <input type="range" min="0" max="1" id="sound-gain" step="0.001" value="0.1" />

    const gainInput = document.createElement("input");
    gainInput.type = "range";
    gainInput.min = 0;
    gainInput.max = 0.1;
    gainInput.step = 0.001;
    gainInput.value = 0.1;
    gainInput.addEventListener("input", (event) => {
      if (!gainNodes[idx]) return;
      gainNodes[idx].gain.value = event.target.value;
    });
    const gainInputLabel = document.createElement("label");
    gainInputLabel.appendChild(gainInput);
    const gainInputTitle = document.createElement("span");
    gainInputTitle.innerText = "gain";
    gainInputLabel.appendChild(gainInputTitle);
    div.appendChild(gainInputLabel);

    webAudioKeys.appendChild(div);
  });
}

export function stopEmAll() {
  console.log("gonna try to stop ", oscillators.length, " oscillators...");

  oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch (e) {
      // 🤷
    }
  });
  // Clear the array after stopping all oscillators
  oscillators.length = 0;
}

export async function playEmAll() {
  if (!window.BNO08XVIZ.selectedData) return;
  Object.entries(window.BNO08XVIZ.selectedData).forEach(([key, data], idx) => {
    // console.log("gonna play key:", key);
    playSeq(data, idx);
  });
}

async function playSeq(data, idx) {
  const oscillator = audioContext.createOscillator();
  if (oscillatorsConfig[idx] && oscillatorsConfig[idx].wave) {
    oscillator.type = oscillatorsConfig[idx].wave;
  } else {
    oscillator.type = "sine"; // init with sine
  }

  oscillator.frequency.value = 0; // init freq to 0, i guess.
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // set the initial gain (volume)
  gainNode.gain.value = 0.05; // more-quite-is-more

  // play sound
  oscillator.start();
  oscillators.push(oscillator);
  gainNodes.push(gainNode);
  loadOscFreqSeq(data, oscillator);
}

function loadOscFreqSeq(data, oscillator) {
  // data here is window.BNO08XVIZ.selectedData[window.BNO08XVIZ.selectedKey]
  // console.log("[loadOscFreqSeq] ", { key: window.BNO08XVIZ.selectedKey, data });
  let prevMillis = 0;
  // so the audioContext will just be running away.. so start from whereever it's currently at.
  let runningTime = audioContext.currentTime;

  // #TODO: should each voice datum have min/max scale config?
  // .reduce below scale to the datum
  // const { min, max } = data.reduce(
  //   (acc, v) => {
  //     if (v.v < acc.min) acc.min = v.v;
  //     if (v.v > acc.max) acc.max = v.v;
  //     return acc;
  //   },
  //   { min: 0, max: 0 },
  // );
  // otherwise: scale values to entire range of dataset (which is the y-axis from the d3 line plot).
  const [min, max] = window.BNO08XVIZ.dataRange;

  // console.log("zomg so window.BNO08XVIZ.dataRange", { min, max });
  data.forEach((d, idx) => {
    const { millis, v } = d;

    const note = toMidi(v, min, max);
    const freq = mtof(note);

    // console.log(
    //   "so current millis:",
    //   millis,
    //   " midi-note:",
    //   note,
    //   "set value:",
    //   freq,
    //   "at endTimeSeconds:",
    //   runningTime,
    // );

    if (oscillatorsConfig[idx] && oscillatorsConfig[idx].ramp) {
      // set runningTime first, to ramp for the entire note duration
      runningTime += (millis - prevMillis) / 1000;
      oscillator.frequency.exponentialRampToValueAtTime(freq, runningTime);
    } else {
      // still ramp, but just a very smol (0.1 sec) ramp [ATTACK]
      oscillator.frequency.exponentialRampToValueAtTime(freq, runningTime + 0.1);
      // then increment running time after.
      runningTime += (millis - prevMillis) / 1000;
      // also .setValueAtTime so the next .exponentialRampToValueAtTime will have a small window of time for the [ATTACK] ramp
      oscillator.frequency.setValueAtTime(freq, runningTime);
    }

    prevMillis = millis;
  });

  // stop it after it's done.
  oscillator.stop(runningTime + 1);

  function updateCurrentTime() {
    const currentTime = audioContext.currentTime;
    document.getElementById("currentTimeDisplay").textContent = currentTime.toFixed(2);
  }

  // update the current time every 100 milliseconds
  const intervalId = setInterval(updateCurrentTime, 100);

  setTimeout(
    () => {
      clearInterval(intervalId);
    },
    (runningTime + 1) * 1000,
  );
}

function toMidi(value, fromMin, fromMax) {
  const toMin = 0;
  const toMax = 127;
  if (fromMin === fromMax) {
    throw new Error("Input range cannot be zero.");
  }
  return ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin) + toMin;
}
function mtof(midiNote) {
  // midi note to frequency (in Hz)
  const A440 = 440; // frequency of A4
  return A440 * Math.pow(2, (midiNote - 69) / 12);
}
