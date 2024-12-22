import { registerCallback, processDataFile } from "./file-input-etl.js";
import { renderD3GraphStuff } from "./d3-graph-stuff.js";
import { renderThreeStuff } from "./three-stuff.js";
import { processAndPlayFFT } from "./fft-stuff.js";

// hey, so this file just rollz up a buncha other stuff
// spread out across the js filez above☝️
//
// basically what's going on here is:
// 1. load user data file; parse each line into a shared js obj.
// 2. d3 graph stuff to draw lines for each shared js obj key (and some html input controls)
// 3. three.js 3b cube and line animation using quaternion & linear acceleration data
//
// notez:
// #TODO
// i should probably have exported html input event hander functions
// for html control & display ui elements
// instead of doing document.querySelectorById('') in the js 😔
//
// #1. the data file format should be .csv; but it's not currently :/
//     it's just crude, freeform `key1: value1 key2: 2` log format.
//
// #3. the three.js animation consumes mouse input, so it's a little dangerous if it fills the entire window.
//     as in: you can't scroll to the other controlz & stuff on the page if this happens ;(

registerCallback(renderD3GraphStuff);
registerCallback(renderThreeStuff);

// some global functions for use with index.html elements
window.BNO08XVIZ = {
  fft: () => {
    console.log("[fft]");
    // Example usage
    const exampleTimeSeriesData = [0, 2, 3, 4, 0, -1, -2, -3, -5, 4, 2, 4, 0, 1, 0, -1, 33, 66, 99]; // Replace with your data
    processAndPlayFFT(exampleTimeSeriesData);
  },
  loadExample: (href) => {
    console.log("[loadExample] zomg fetch href:", `/example-data/${href}`);
    fetch(`/example-data/${href}`)
      .then((response) => response.text())
      .then((text) => {
        console.log("[loadExample] zomg fetch has text, gonna processDataFile()");
        processDataFile(text);
      })
      .catch((error) => {
        // Handle any errors
        console.error("[loadExample] zomg error fetching example data:", error);
      });
  },
};
