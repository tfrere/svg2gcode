import { parseSync } from "svgson";
import puppeteer from "puppeteer";
import { svgPathProperties } from "svg-path-properties";
import { config } from "../config.js";

export const splitSvgLayers = (svgString) => {
  const parsedSvg = parseSync(svgString);
  // Essayez de lister tous les groupes ayant un id contenant "layer"
  let svgLayers = svgString.match(/<g[^>]*id="[^"]*layer[^"]*"[^>]*>.*?<\/g>/g);

  const prefixSVG = `<svg width="${config.width}px" height="${config.height}px" viewBox="0 0 ${config.width} ${config.height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
  const suffixSVG = `</svg>`;

  // Si aucun layer spécifique n'est trouvé, utilisez tout le contenu du SVG comme un seul layer
  if (!svgLayers || svgLayers.length === 0) {
    // Extrait tout le contenu intérieur du SVG pour le traiter comme un layer unique
    const fullSvgContentMatch = svgString.match(
      /<svg[^>]*>((.|[\r\n])*)<\/svg>/
    );
    if (fullSvgContentMatch && fullSvgContentMatch[1]) {
      svgLayers = [fullSvgContentMatch[1]];
    }
  } else {
    svgLayers = svgLayers.map((layerGroup) => {
      // Supprimez l'attribut id pour chaque layer trouvé
      return `${prefixSVG}${layerGroup}${suffixSVG}`.replace(
        /id="([^"]*)"/g,
        ""
      );
    });
  }

  // S'il n'y a toujours pas de layer (cas où le SVG ne contient pas de balises <svg></svg>),
  // retournez un tableau vide pour indiquer qu'aucun layer n'a pu être extrait.
  if (!svgLayers) {
    svgLayers = [];
  } else if (svgLayers.length === 1) {
    // Si un seul layer a été identifié ou créé, encapsulez-le dans les balises SVG
    svgLayers[0] = `${prefixSVG}${svgLayers[0]}${suffixSVG}`;
  }

  return svgLayers;
};
