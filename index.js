import { watch, promises as fsPromises } from "fs";
import fs from "fs";
import path from "path";

import { optimiseSvg } from "./tools/svg.js";
import { svgLayersToGcodeStrings } from "./tools/gcode.js";
import { splitSvgLayers } from "./tools/splitSvgLayers.js";
import { config } from "./config.js";

watch(config.folderToWatch, async (eventType, filename) => {
  if (filename && path.extname(filename) === ".svg") {
    console.log(`Change on ${filename} detected. Type: ${eventType}`);

    try {
      // Lire le contenu du fichier SVG
      const filePath = path.join(config.folderToWatch, filename);

      // extract --x3 from the filename, the numeric insformation should be stored in variable
      // and used as the offset for the gcode generation
      // if no --x3 is found, the offset should be 1
      const sizeMultiplierMatch = filename.match(/--(\d+)x/);
      const sizeMultiplier = sizeMultiplierMatch
        ? parseInt(sizeMultiplierMatch[1], 10)
        : 1;

      console.log(`sizeMultiplier : ${sizeMultiplier}`);

      const svgString = await fsPromises.readFile(filePath, "utf8");

      const optimizedSvgString = optimiseSvg(svgString);
      // console.log("optimizedSvgString", optimizedSvgString);
      // console.log("------------------------");
      console.log("optimizing...");

      const svgLayers = splitSvgLayers(optimizedSvgString);
      console.log("splitting layers...");

      const gcodes = await svgLayersToGcodeStrings(
        svgLayers,
        filename,
        sizeMultiplier
      );
      console.log("gcode generation...");

      let outputPath = path.join(config.outputFolder, filename);
      outputPath = outputPath.replace(/\.svg$/, ".gcode");

      // let gcodes = convertSVGToGCode(optimizedSvgString);
      for (let i = 0; i < gcodes.length; i++) {
        const gcode = gcodes[i];
        const outputFilePath = outputPath.replace(
          /\.gcode$/,
          `--layer-${i}.gcode`
        );
        await fsPromises.writeFile(outputFilePath, gcode);
      }

      console.log(`Done!`);

      // Ici, vous pouvez ajouter une logique supplémentaire pour déplacer ou traiter davantage le fichier dans le dossier de sortie
    } catch (error) {
      console.error(`Error ${filename}: ${error}`);
    }
  }
});

console.log(
  `Watching folder: ${config.folderToWatch}. Waiting for modifications...`
);
