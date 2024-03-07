import { optimize } from "svgo";

// ------------------------
// SVGO
// ------------------------

const optimiseSvg = (svgData) => {
  // Optimiser le SVG avec SVGO
  const result = optimize(svgData, {
    multipass: true,
    plugins: [
      { name: "removeTitle", active: true },
      { name: "removeXMLProcInst", active: true },
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
  });
  return result.data;
};

export { optimiseSvg };
