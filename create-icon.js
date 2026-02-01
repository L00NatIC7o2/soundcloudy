import toIco from "to-ico";
import fs from "fs";

// Create a simple 256x256 PNG buffer (blue square with white text)
const canvasModule = await import("canvas").catch(() => null);

if (!canvasModule) {
  console.log("Canvas not available, creating minimal PNG...");
  // Create a minimal valid 1x1 PNG
  const png = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xde,
    0x00,
    0x00,
    0x00,
    0x0c,
    0x49,
    0x44,
    0x41,
    0x54, // IDAT chunk
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xcf,
    0xc0,
    0x00,
    0x00,
    0x00,
    0x03,
    0x00,
    0x01,
    0x00,
    0x18,
    0xdd,
    0x8d,
    0xb4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44, // IEND chunk
    0xae,
    0x42,
    0x60,
    0x82,
  ]);

  const ico = await toIco([png]);
  fs.writeFileSync("src-tauri/icons/icon.ico", ico);
  console.log("Icon created successfully!");
} else {
  const { createCanvas } = canvasModule;
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#4169E1";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "white";
  ctx.font = "bold 100px Arial";
  ctx.fillText("SC", 60, 160);

  const png = canvas.toBuffer();
  const ico = await toIco([png]);
  fs.writeFileSync("src-tauri/icons/icon.ico", ico);
  console.log("Icon created successfully!");
}
