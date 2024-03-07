import { parseSync } from "svgson";
import puppeteer from "puppeteer";
import { svgPathProperties } from "svg-path-properties";
import { config } from "../config.js";

export const splitSvgLayers = (svgString) => {
  const parsedSvg = parseSync(svgString);
  // list all groups that have an id containing "layer"
  // it can be nested everywhere in the document
  // using the svgContent directly
  let svgLayers = svgString.match(/<g[^>]*id="[^"]*layer[^"]*"[^>]*>.*?<\/g>/g);

  const prefixSVG = `<svg width="${config.width}px" height="${config.height}px" viewBox="0 0 ${config.width} ${config.height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
  const suffixSVG = `</svg>`;

  svgLayers = svgLayers.map((layerGroup) => {
    return `${prefixSVG}${layerGroup}${suffixSVG}`.replace(/id="([^"]*)"/, "");
  });

  return svgLayers;
};
