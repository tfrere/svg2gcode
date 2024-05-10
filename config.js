export const config = {
  width: 190,
  height: 280,
  feedrate: 6000,
  penUp: 0,
  penDown: 90,
  plotter: {
    path: "/dev/tty.usbserial-2140",
    baudRate: 115200,
  },
  gcode: {
    origin: `G0 X0.00 Y0.00 F3000`,
    penUp: "M3 S0",
    penDown: "M3 S90",
    pause: "G4 P0.1",
  },
  folderToWatch: "/Users/frerethibaud/Downloads",
  outputFolder: "/Users/frerethibaud/Downloads",
  segmentLength: 1,
};
