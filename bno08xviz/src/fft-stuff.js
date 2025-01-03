import FFT from "fft.js";

// some shared stuff
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let testOscillator = audioContext.createOscillator();
let testOscGain = audioContext.createGain();

export function renderFFTStuff() {
  // show the ui stuff
  document.getElementById("sound").style.display = "flex";
}

export function renderDataKeysSelect() {
  // called after d3 vis selection
  const selectedKeys = Object.keys(window.BNO08XVIZ.selectedData);
  if (!selectedKeys || selectedKeys.length === 0) return;

  document.querySelectorAll(".sound-wait-for-select").forEach((el) => (el.style.display = "block"));
  const soundButtons = document.getElementById("sound-fft-keys");
  // clear any existing buttons first.
  soundButtons.innerHTML = "";

  // init window.BNO08XVIZ.selectedKey if one doesn't exist.
  if (!window.BNO08XVIZ.selectedKey) window.BNO08XVIZ.selectedKey = selectedKeys[0];

  selectedKeys.forEach((k) => {
    const button = document.createElement("button");

    button.innerText = k;
    button.addEventListener("mousedown", () => {
      window.BNO08XVIZ.selectedKey = k;
      processAndPlayFFT();
      window.addEventListener("mousemove", mousemove);
    });
    // #TODO: disabling mouseup for now
    button.addEventListener("mouseup", () => {
      try {
        testOscillator.stop();
      } catch (e) {
        // 🤷
      }
    });

    // touch devices :/
    button.addEventListener("touchstart", (event) => {
      event.preventDefault(); // prevents touchstart from triggering mousedown
      window.BNO08XVIZ.selectedKey = k;
      processAndPlayFFT();
      window.addEventListener("mousemove", mousemove);
    });
    // #TODO: disabling mouseup for now
    button.addEventListener("touchend", (event) => {
      event.preventDefault();
      try {
        testOscillator.stop();
      } catch (e) {
        // 🤷
      }
    });

    soundButtons.appendChild(button);
  });
}

export async function processAndPlayFFT() {
  try {
    testOscillator.stop();
  } catch (e) {
    /* 🤷 */
  }

  if (!window.BNO08XVIZ.selectedKey) {
    console.warn("no data key selected!");
    return;
  }
  const timeSeriesData = window.BNO08XVIZ.selectedData[window.BNO08XVIZ.selectedKey];

  console.log("gonna fft data key:", window.BNO08XVIZ.selectedKey, " timeSeriesData:", timeSeriesData);

  const data = adjustToPowerOfTwo(timeSeriesData.map((d) => d.v));

  const fftSize = data.length;

  // FFT setup
  const fft = new FFT(fftSize);
  const input = new Float32Array(fftSize);
  const outputReal = new Float32Array(fftSize);
  const outputImag = new Float32Array(fftSize);

  // Copy time-series data to input (real part)
  input.set(data);

  // Perform FFT
  const result = fft.createComplexArray();
  fft.realTransform(result, input);

  // Separate into real and imaginary parts
  fft.completeSpectrum(result);
  for (let i = 0; i < fftSize; i++) {
    outputReal[i] = result[2 * i];
    outputImag[i] = result[2 * i + 1];
  }

  // console.log("Real part of FFT:", outputReal);
  // console.log("Imaginary part of FFT:", outputImag);

  // Web Audio API Setup
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const realInput = new Float32Array(outputReal);
  const imagInput = new Float32Array(outputImag);

  // Normalize inputs to avoid loud noises or silence
  const normalize = (array) => {
    const max = Math.max(...array.map((val) => Math.abs(val)));
    if (max === 0) return array;
    return array.map((val) => val / max);
  };
  realInput.set(normalize(realInput));
  imagInput.set(normalize(imagInput));

  const wave = audioContext.createPeriodicWave(realInput, imagInput);
  testOscillator = audioContext.createOscillator();

  testOscillator.setPeriodicWave(wave);
  testOscillator.frequency.value = 440; // Set desired frequency

  testOscillator.connect(testOscGain);

  testOscGain.connect(audioContext.destination);

  // set the initial gain (volume)
  testOscGain.gain.value = 0.75; // 75% volume

  // play sound
  testOscillator.start();
}

function mousemove(event) {
  // fn defined here to .addEventListener and .removeEventListener
  try {
    testOscillator.frequency.value = event.clientX;
    // (1 - ) invert
    testOscGain.gain.value = Math.abs(1 - event.clientY / window.innerHeight);
  } catch (e) {
    // 🤷
  }
}

function adjustToPowerOfTwo(data) {
  const length = data.length;

  if (isPowerOfTwo(length)) {
    return data; // Already correct length
  }

  // Find the nearest power of two
  const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(length)));
  const adjustedData = new Float32Array(nextPowerOfTwo);

  // Copy existing data and pad with zeros if needed
  for (let i = 0; i < length; i++) {
    adjustedData[i] = data[i];
  }

  return adjustedData;
}
function isPowerOfTwo(n) {
  return (n & (n - 1)) === 0 && n > 0;
}
