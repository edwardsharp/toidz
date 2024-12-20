let callbacks = [];
export function registerCallback(callback) {
  callbacks.push(callback);
}

function callbackWithData(data) {
  callbacks.forEach((cb) => cb(data));
}

// FILE INPUT STUFF

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

  callbackWithData(out);
}
