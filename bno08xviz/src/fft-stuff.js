import FFT from "fft.js";

// some shared stuff
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = [audioContext.createOscillator()];
let gainNode = audioContext.createGain();

function mousemove(event) {
  // fn defined here to .addEventListener and .removeEventListener
  try {
    // gainNode.gain.value = Math.abs(event.clientY / window.innerHeight);
  } catch (e) {
    // 🤷
  }
}

export function renderFFTStuff() {
  // show the ui stuff
  document.getElementById("sound").style.display = "flex";
}

export function renderDataKeysSelect() {
  // called after d3 vis selection
  const selectedKeys = Object.keys(window.BNO08XVIZ.selectedData);
  if (!selectedKeys || selectedKeys.length === 0) return;

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
      BNO08XVIZ.fft();
      window.addEventListener("mousemove", mousemove);
    });
    // #TODO: disabling mouseup for now
    // button.addEventListener("mouseup", stopFFT);

    // touch devices :/
    button.addEventListener("touchstart", (event) => {
      event.preventDefault(); // prevents touchstart from triggering mousedown
      window.BNO08XVIZ.selectedKey = k;
      BNO08XVIZ.fft();
      window.addEventListener("mousemove", mousemove);
    });
    // #TODO: disabling mouseup for now
    // button.addEventListener("touchend", (event) => {
    //   event.preventDefault();
    //   stopFFT();
    // });

    soundButtons.appendChild(button);
  });
}

export function stopFFT() {
  console.log("gonna try to stop ", oscillators.length, " oscillators...");

  oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch (e) {
      console.warn("Oscillator already stopped or invalid:", e);
    }
  });
  // Clear the array after stopping all oscillators
  oscillators.length = 0;

  window.removeEventListener("mousemove", mousemove);
}

export async function processAndPlayFFT(timeSeriesData) {
  // try {
  //   oscillator.stop();
  // } catch (e) {
  //   /* 🤷 */
  // }

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
  const oscillator = audioContext.createOscillator();

  oscillator.setPeriodicWave(wave);
  oscillator.frequency.value = 440; // Set desired frequency

  oscillator.connect(gainNode);

  gainNode.connect(audioContext.destination);

  // set the initial gain (volume)
  gainNode.gain.value = 0.75; // 75% volume

  // play sound
  oscillator.start();
  oscillators.push(oscillator);
  loadOscFreqSeq(window.BNO08XVIZ.selectedData[window.BNO08XVIZ.selectedKey], oscillator);
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

function loadOscFreqSeq(data, oscillator) {
  // data here is window.BNO08XVIZ.selectedData[window.BNO08XVIZ.selectedKey]
  console.log("[loadOscFreqSeq] ", { key: window.BNO08XVIZ.selectedKey, data });
  let prevMillis = null;
  // so the audioContext will just be running away.. so start from whereever it's currently at.
  let runningTime = audioContext.currentTime;

  // const { min, max } = data.reduce(
  //   (acc, v) => {
  //     if (v.v < acc.min) acc.min = v.v;
  //     if (v.v > acc.max) acc.max = v.v;
  //     return acc;
  //   },
  //   { min: 0, max: 0 },
  // );

  const [min, max] = window.BNO08XVIZ.dataRange;

  console.log("zomg so window.BNO08XVIZ.dataRange", { min, max });
  data.forEach((d) => {
    const { millis, v } = d;
    if (prevMillis === null) prevMillis = millis;
    runningTime += (millis - prevMillis) / 1000;

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

    // #TODO: config to switch between ramp & step osc.freq values
    oscillator.frequency.exponentialRampToValueAtTime(freq, runningTime);
    // oscillator.frequency.setValueAtTime(freq, runningTime);

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
