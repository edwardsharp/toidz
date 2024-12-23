import FFT from "fft.js";

// some shared stuff
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = audioContext.createOscillator();

export function renderFFTStuff() {
  document.getElementById("sound").style.display = "flex";

  // add button events
  const button = document.getElementById("generate-sound");
  button.addEventListener("mousedown", BNO08XVIZ.fft);
  button.addEventListener("mouseup", stopFFT);

  // touch devices :/
  button.addEventListener("touchstart", (event) => {
    event.preventDefault(); // prevents touchstart from triggering mousedown
    BNO08XVIZ.fft();
  });
  button.addEventListener("touchend", (event) => {
    event.preventDefault();
    stopFFT();
  });
}

export function renderDataKeysSelect() {
  document.getElementById("generate-sound").style.display = "block";
  const selectedKeys = Object.keys(window.BNO08XVIZ.selectedData);

  const selectElement = document.createElement("select");
  selectElement.addEventListener("change", (event) => {
    window.BNO08XVIZ.selectedKey = event.target.value;
    document.getElementById("generate-sound").innerText = `GENERATE SOUND WITH ${window.BNO08XVIZ.selectedKey}`;
  });

  window.BNO08XVIZ.selectedKey = selectedKeys[0];
  document.getElementById("generate-sound").innerText = `GENERATE SOUND WITH ${window.BNO08XVIZ.selectedKey}`;

  // gen <option> elements from the array
  selectedKeys.forEach((k) => {
    const optionElement = document.createElement("option");
    optionElement.value = k;
    optionElement.textContent = k;
    selectElement.appendChild(optionElement);
  });

  document.getElementById("sound-fft-keys").innerHTML = "";
  document.getElementById("sound-fft-keys").appendChild(selectElement);
}

export function stopFFT() {
  oscillator.stop();
}

export async function processAndPlayFFT(timeSeriesData) {
  try {
    oscillator.stop();
  } catch (e) {
    /* 🤷 */
  }
  const data = adjustToPowerOfTwo(timeSeriesData);

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

  console.log("Real part of FFT:", outputReal);
  console.log("Imaginary part of FFT:", outputImag);

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
  oscillator = audioContext.createOscillator();
  oscillator.setPeriodicWave(wave);
  oscillator.frequency.value = 440; // Set desired frequency
  oscillator.connect(audioContext.destination);

  // Play sound
  oscillator.start();
  // oscillator.stop(audioContext.currentTime + 5); // Play for 5 seconds
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
