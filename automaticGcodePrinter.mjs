import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import chokidar from "chokidar";
import { promises as fs } from "fs";
import { config } from "./config.js";

const plotterConfig = {
  path: "/dev/tty.usbserial-2140",
  baudRate: 115200,
};

// Initialisation et log du port
const port = new SerialPort(
  {
    path: plotterConfig.path,
    baudRate: plotterConfig.baudRate,
  },
  (err) => {
    if (err) {
      return console.log("Error: ", err.message);
    }
    console.log(
      `Listening on path: ${plotterConfig.path} with baudRate: ${plotterConfig.baudRate}`
    );
  }
);

// Lister les ports disponibles
SerialPort.list()
  .then((ports) => {
    console.log("Available Serial Ports:");
    ports.forEach((port) => {
      console.log(`- Port: ${port.path}, infos: ${port}`);
    });
  })
  .catch((err) => {
    console.error("Error listing ports", err);
  });

const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));
const queue = [];
let isProcessing = false;

const processQueue = async () => {
  if (queue.length === 0 || isProcessing) {
    return;
  }
  isProcessing = true;
  const filePath = queue.shift();
  console.log(`Processing ${filePath}...`);
  const gcodeContent = await fs.readFile(filePath, { encoding: "utf-8" });
  const lines = gcodeContent.split("\n");
  let lineCount = lines.length;
  let processedLines = 0;

  console.log(`Starting to process ${lineCount} commands from ${filePath}`);

  const sendLine = async (index) => {
    if (index >= lines.length) {
      console.log(`Finished processing ${filePath}.`);
      await fs.unlink(filePath);
      console.log(`Deleted ${filePath}.`);
      isProcessing = false;
      processQueue(); // Try to process the next file in the queue
      return;
    }

    const line = lines[index];
    port.write(line + "\n", (err) => {
      if (err) {
        console.error(`Error sending command: ${line}`, err);
        return;
      }
      console.log(`Command ${index + 1}/${lineCount} sent: ${line}`);
    });

    parser.once("data", (data) => {
      if (data === "ok") {
        processedLines++;
        console.log(`Progress: ${processedLines}/${lineCount}`);
        sendLine(index + 1); // Send next line after receiving 'ok'
      } else {
        // If the data is not 'ok', wait for the next 'ok' before proceeding
        parser.once("data", () => sendLine(index));
      }
    });
  };

  sendLine(0); // Start sending lines from the beginning
};

chokidar
  .watch("./data/automatic-gcode-printer-folder", { persistent: true })
  .on("add", (path) => {
    console.log(`File ${path} has been added. ${queue.length} files in queue.`);
    queue.push(path);
    if (!isProcessing) {
      processQueue();
    }
  });

// Handling graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Graceful shutdown...");
  port.write("M2\n");
  port.write("M2\n");
  port.close();
  process.exit();
});
