import { watch, promises as fsPromises } from "fs";
import fs from "fs";
import path from "path";
import { optimize } from "svgo";
import { parseSync } from "svgson";
import { svgPathProperties } from "svg-path-properties";

// Dossiers de surveillance, temporaire et de sortie
const folderToWatch = path.join("./", "input-svg-folder");
const tmpFolder = path.join("./", "tmp-folder");
const outputFolder = path.join("./", "output-gcode-folder");

const PEN_UP = "M3 S0";
const PEN_DOWN = "M3 S90";
const FEEDRATE = 3000;

// Setup et go origin
const PREFIX = `
G21 ; Set units to millimeters
G90 ; Use absolute positioning
${PEN_UP}
G0 X0.00 Y0.00 F3000
`;

// On retourne a origin
const SUFFIX = `
G0 X0.00 Y0.00 F3000
`;

// Configuration spécifique pour SVGO
const svgoConfig = {
  plugins: [
    {
      name: "convertShapeToPath",
      active: true,
    },
    {
      name: "convertTransform",
      active: true, // Appliquer les transformations aux éléments
    },
    {
      name: "removeAttrs",
      params: {
        attrs: "(stroke|fill)",
      },
    },
    {
      name: "removeUselessDefs",
      active: true, // Supprimer les définitions inutiles sans affecter les groupes
    },
    {
      name: "cleanupNumericValues",
      active: true, // Réduire la précision numérique des attributs
    },
    {
      name: "collapseGroups",
      active: false, // Désactiver l'effondrement des groupes pour les conserver
    },
  ],
};

// Fonction pour calculer la distance entre deux points
function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
}

// Fonction pour trier les chemins en fonction de la proximité de leurs points de départ
function sortPathsByProximity(pathsPoints) {
  // Calculer les points de départ pour chaque chemin
  const startPoints = pathsPoints.map((points) => {
    return points[0]; // On prend le premier point de chaque chemin comme point de départ
  });

  // Trier les chemins en utilisant une approche de tri par distance minimum
  // Note : Cette approche simple ne garantit pas le chemin le plus court entre tous les points
  // mais vise à rapprocher les chemins géographiquement proches
  let sortedPaths = [];
  let currentPoint = { x: 0, y: 0 }; // On commence du point d'origine (0,0)

  while (pathsPoints.length > 0) {
    let closestIndex = 0;
    let minimumDistance = calculateDistance(currentPoint, startPoints[0]);

    for (let i = 1; i < pathsPoints.length; i++) {
      let distance = calculateDistance(currentPoint, startPoints[i]);
      if (distance < minimumDistance) {
        closestIndex = i;
        minimumDistance = distance;
      }
    }

    sortedPaths.push(pathsPoints[closestIndex]);
    currentPoint = startPoints[closestIndex];
    pathsPoints.splice(closestIndex, 1); // Retirer le chemin traité
    startPoints.splice(closestIndex, 1); // Retirer le point de départ traité
  }

  return sortedPaths;
}

const readSVGFile = (filePath) => fs.readFileSync(filePath, "utf8");

// Fonction pour convertir les chemins en points, en appliquant les transformations translate
const convertPathsToPoints = (pathsData, segmentLength, offset) => {
  return pathsData.map((pathData, index) => {
    const properties = new svgPathProperties(pathData);
    const length = properties.getTotalLength();
    const numPoints = Math.ceil(length / segmentLength);
    let points = [];
    for (let i = 0; i <= numPoints; i++) {
      let point = properties.getPointAtLength((i / numPoints) * length);
      // Appliquer la transformation translate
      point = {
        x: point.x + offset.x,
        y: point.y + offset.y,
      };
      points.push(point);
    }
    return points;
  });
};

const generateGCode = (pathsPoints) => {
  let gcode = [PREFIX];
  pathsPoints.forEach((points) => {
    points.forEach((point, index) => {
      if (index === 0) {
        gcode.push(
          `${PEN_UP}\nG0 X${point.x.toFixed(2)} Y${point.y.toFixed(
            2
          )} F${FEEDRATE}`
        );
        gcode.push(PEN_DOWN);
      } else {
        gcode.push(
          `G1 X${point.x.toFixed(2)} Y${point.y.toFixed(2)} F${FEEDRATE}`
        );
      }
    });
    gcode.push(PEN_UP);
  });
  gcode.push(SUFFIX);
  return gcode.join("\n");
};

function extractPathsDataAndTransforms(node, pathsData = [], transforms = []) {
  if (node.name === "path") {
    pathsData.push(node.attributes.d);
    const transformMatch =
      node.attributes.transform?.match(/translate\(([^)]+)\)/);
    if (transformMatch) {
      const [x, y] = transformMatch[1].split(/[\s,]+/).map(Number);
      transforms.push({ x, y });
    } else {
      transforms.push({ x: 0, y: 0 }); // Pas de transformation
    }
  }
  node.children?.forEach((child) =>
    extractPathsDataAndTransforms(child, pathsData, transforms)
  );
  return { pathsData, transforms };
}

const convertSVGToGCode = (filePath) => {
  const svgContent = readSVGFile(filePath);
  const parsedSvg = parseSync(svgContent);
  // list all groups that have an id containing "layer"
  // it can be nested everywhere in the document
  // using the svgContent directly
  let layerGroups = svgContent.match(
    /<g[^>]*id="[^"]*layer[^"]*"[^>]*>.*?<\/g>/g
  );

  const prefixSVG = `<svg width="280px" height="190px" viewBox="0 0 280 190" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
  const suffixSVG = `</svg>`;

  layerGroups = layerGroups.map((layerGroup) => {
    return `${prefixSVG}${layerGroup}${suffixSVG}`.replace(/id="([^"]*)"/, "");
  });

  let gcodes = [];

  layerGroups.map((layerGroup) => {
    const parsedSvg = parseSync(layerGroup);
    const transform = parsedSvg.children[0].attributes.transform.split(" ");
    const values = {
      x: parseInt(transform[0].slice(10, transform[0].length), 10),
      y: parseInt(transform[1].slice(0, transform[1].length - 1), 10),
    };

    // extract {x,y} transform values from transform string

    const informations = extractPathsDataAndTransforms(parsedSvg);
    console.log(informations);
    const pathsPoints = convertPathsToPoints(informations.pathsData, 1, values);
    const sortedPathsPoints = sortPathsByProximity(pathsPoints); // Trier les chemins par proximité
    const gcode = generateGCode(sortedPathsPoints);
    gcodes.push(gcode);
  });

  return gcodes;
};

watch(folderToWatch, async (eventType, filename) => {
  if (filename && path.extname(filename) === ".svg") {
    console.log(`Change on ${filename} detected. Type: ${eventType}`);

    try {
      // Lire le contenu du fichier SVG
      const filePath = path.join(folderToWatch, filename);

      // extract --x3 from the filename, the numeric insformation should be stored in variable
      // and used as the offset for the gcode generation
      // if no --x3 is found, the offset should be 1
      const multiplierMatch = filename.match(/--(\d+)x/);
      const multiplier = multiplierMatch ? parseInt(multiplierMatch[1], 10) : 1;

      console.log(`Offset: ${multiplier}`);

      const svgData = await fsPromises.readFile(filePath, "utf8");

      // Optimiser le SVG avec SVGO
      const result = optimize(svgData, {
        multipass: true,
        plugins: svgoConfig.plugins,
      });

      // Enregistrer le SVG optimisé dans le dossier temporaire
      const tmpPath = path.join(tmpFolder, filename);
      await fsPromises.writeFile(tmpPath, result.data);

      let outputPath = path.join(outputFolder, filename);
      outputPath = outputPath.replace(/\.svg$/, ".gcode");

      let gcodes = convertSVGToGCode(tmpPath);
      for (let i = 0; i < gcodes.length; i++) {
        const gcode = gcodes[i];
        const outputFilePath = outputPath.replace(
          /\.gcode$/,
          `--layer-${i}.gcode`
        );
        await fsPromises.writeFile(outputFilePath, gcode);
      }

      console.log(`Gcode generated`);

      // Ici, vous pouvez ajouter une logique supplémentaire pour déplacer ou traiter davantage le fichier dans le dossier de sortie
    } catch (error) {
      console.error(`Error ${filename}: ${error}`);
    }
  }
});

console.log(`Watching folder: ${folderToWatch}. Waiting for modifications...`);
