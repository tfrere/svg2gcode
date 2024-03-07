// import { parseSync } from "svgson";
import puppeteer from "puppeteer";
import { config } from "../config.js";

// Définition de la fonction rasterizeSvg
async function createGcodeFromLayer(svgString, filename, sizeMultiplier) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Injecter Snap.svg dans la page. Ici, on suppose que Snap.svg est accessible via CDN.
  await page.addScriptTag({
    url: "https://cdnjs.cloudflare.com/ajax/libs/snap.svg/0.5.1/snap.svg-min.js",
  });

  // Définir le contenu de la page avec le SVG passé en paramètre
  await page.setContent(`<body>${svgString}</body>`);
  config.sizeMultiplier = sizeMultiplier;
  // Appliquer les transformations avec Snap.svg
  const finalGcode = await page.evaluate((config) => {
    // ----------------
    // INSIDE BROWSER
    // ----------------

    const PEN_UP = config.gcode.penUp;
    const PEN_DOWN = config.gcode.penDown;
    const ORIGIN = config.gcode.origin;
    const FEEDRATE = config.feedrate;
    const PAUSE = config.gcode.pause;

    // Setup et go origin
    const PREFIX = `G21 ; Set units to millimeters
G90 ; Use absolute positioning
${PEN_UP}
${ORIGIN}`;

    // On retourne a origin
    const SUFFIX = `${ORIGIN}`;

    // Création d'une instance Snap sur l'élément SVG
    const s = Snap("body svg");
    let gcode = [PREFIX];

    function applyMatrixToPoint(matrix, point) {
      const { a, b, c, d, e, f } = matrix;
      const { x, y } = point;

      const newX = a * x + c * y + e;
      const newY = b * x + d * y + f;

      return { x: newX, y: newY };
    }

    // Itère sur les paths du SVG
    s.selectAll("path").forEach((path) => {
      let pathLength = Snap.path.getTotalLength(path);
      var globalMatrix = path.transform().globalMatrix;
      let numPoints = Math.ceil(pathLength / config.segmentLength);

      let points = [];
      for (let i = 0; i <= numPoints; i++) {
        let point = Snap.path.getPointAtLength(
          path,
          (i / numPoints) * pathLength
        );

        const endPoint = applyMatrixToPoint(globalMatrix, point);
        endPoint.x = endPoint.x / config.sizeMultiplier;
        endPoint.y = endPoint.y / config.sizeMultiplier;

        points.push(endPoint);
      }
      gcode.push(PEN_UP);
      gcode.push(PAUSE);
      points.forEach((point, index) => {
        if (index === 0) {
          gcode.push(
            `G0 X${point.x.toFixed(2)} Y${point.y.toFixed(2)} F${FEEDRATE}`
          );
          gcode.push(PEN_DOWN);
        } else {
          gcode.push(
            `G1 X${point.x.toFixed(2)} Y${point.y.toFixed(2)} F${FEEDRATE}`
          );
        }
      });
      gcode.push(PEN_UP);
      gcode.push(PAUSE);
    });

    gcode.push(SUFFIX);
    // Retourner la chaîne de caractères SVG modifiée
    return gcode.join("\n");
  }, config);

  await browser.close();
  return finalGcode;
}

export const svgLayersToGcodeStrings = async (
  svgLayers,
  filename,
  sizeMultiplier
) => {
  // console.log("svgLayers", svgLayers);
  // console.log("filename", filename);
  // console.log("sizeMultiplier", sizeMultiplier);

  const gcodesPromises = svgLayers.map((layer, i) => {
    return createGcodeFromLayer(layer, filename, sizeMultiplier);
  });

  const gcodes = await Promise.all(gcodesPromises);
  // gcodes.forEach((gcode) => console.log("gcode", gcode));

  return gcodes;
};
