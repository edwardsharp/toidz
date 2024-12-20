import { renderD3GraphStuff } from "./d3-graph-stuff.js";
import { renderThreeStuff } from "./three-stuff.js";
import { registerCallback } from "./file-input-etl.js";

registerCallback(renderD3GraphStuff);
registerCallback(renderThreeStuff);
