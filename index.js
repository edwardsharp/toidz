import * as d3 from "d3";

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
    .domain(x_domain) // [0, 1_139_906]
    .range([marginLeft, width - marginRight]);

  // y axis vertical position scale
  const y = d3
    .scaleLinear()
    .domain(y_domain) //[-110, 50] [-15, 35]
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
  const line = d3.line();
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
