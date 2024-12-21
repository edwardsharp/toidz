import * as d3 from "d3";

export function renderD3GraphStuff(data) {
  renderLegend(data);
  renderLinez(data);
}

// linesToDraw will toggle showing/hiding lines groups
const linesToDraw = new Set();

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

  // points in pixel space as [x, y, z], where z is the name of the series.
  let points = [];
  Object.entries(data).forEach(([title, values]) => {
    if (linesToDraw.has(title)) {
      // kinda sloppy array, here, but also tack on the end data for .millis and .v
      // ...will looks this up later when showing a tooltip popever
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

  // when the pointer moves, find the closest point, update the interactive tooltip, and highlight
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
