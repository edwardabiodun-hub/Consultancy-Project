import sharp from "sharp";

const sourcePath =
  "C:/Users/eddie/Eddie Consultancy Project/181101_KION_HR_Abiodun002 - Kopie.jpg";
const outputPath =
  "C:/Users/eddie/Eddie Consultancy Project/public/edward-abiodun-identity-locked.png";

const { data, info } = await sharp(sourcePath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixelCount = width * height;
const background = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let head = 0;
let tail = 0;

function isStudioWhite(index) {
  const offset = index * channels;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const minimum = Math.min(r, g, b);
  const maximum = Math.max(r, g, b);
  return minimum >= 226 && maximum - minimum <= 30;
}

function enqueue(index) {
  if (background[index] || !isStudioWhite(index)) return;
  background[index] = 1;
  queue[tail++] = index;
}

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const index = queue[head++];
  const x = index % width;
  const y = Math.floor(index / width);
  if (x > 0) enqueue(index - 1);
  if (x + 1 < width) enqueue(index + 1);
  if (y > 0) enqueue(index - width);
  if (y + 1 < height) enqueue(index + width);
}

const rgba = Buffer.allocUnsafe(pixelCount * 4);
let edgeBand = background.slice();
for (let pass = 0; pass < 8; pass += 1) {
  const expanded = edgeBand.slice();
  for (let index = 0; index < pixelCount; index += 1) {
    if (!edgeBand[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) expanded[index - 1] = 1;
    if (x + 1 < width) expanded[index + 1] = 1;
    if (y > 0) expanded[index - width] = 1;
    if (y + 1 < height) expanded[index + width] = 1;
  }
  edgeBand = expanded;
}

for (let index = 0; index < pixelCount; index += 1) {
  const sourceOffset = index * channels;
  const targetOffset = index * 4;
  const r = data[sourceOffset];
  const g = data[sourceOffset + 1];
  const b = data[sourceOffset + 2];
  rgba[targetOffset] = r;
  rgba[targetOffset + 1] = g;
  rgba[targetOffset + 2] = b;
  if (background[index]) {
    rgba[targetOffset + 3] = 0;
  } else if (edgeBand[index]) {
    const distanceFromWhite = 255 - Math.min(r, g, b);
    rgba[targetOffset + 3] = Math.max(
      0,
      Math.min(255, Math.round(((distanceFromWhite - 14) / 42) * 255)),
    );
  } else {
    rgba[targetOffset + 3] = 255;
  }
}

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;
for (let index = 0; index < pixelCount; index += 1) {
  if (background[index]) continue;
  const x = index % width;
  const y = Math.floor(index / width);
  minX = Math.min(minX, x);
  minY = Math.min(minY, y);
  maxX = Math.max(maxX, x);
  maxY = Math.max(maxY, y);
}

const subjectBounds = {
  left: Math.max(0, minX - 24),
  top: Math.max(0, minY - 24),
  width: Math.min(width - Math.max(0, minX - 24), maxX - minX + 49),
  height: Math.min(height - Math.max(0, minY - 24), maxY - minY + 49),
};

const subject = await sharp(rgba, {
  raw: { width, height, channels: 4 },
})
  .extract(subjectBounds)
  .resize({
    width: 1850,
    height: 1960,
    fit: "inside",
    kernel: sharp.kernel.lanczos3,
  })
  .png()
  .toBuffer({ resolveWithObject: true });

const backgroundSvg = Buffer.from(`
  <svg width="2048" height="2048" viewBox="0 0 2048 2048"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#173f32"/>
        <stop offset="0.58" stop-color="#102d24"/>
        <stop offset="1" stop-color="#0b211a"/>
      </linearGradient>
      <radialGradient id="bronze" cx="88%" cy="8%" r="72%">
        <stop offset="0" stop-color="#9a693a" stop-opacity="0.58"/>
        <stop offset="0.48" stop-color="#9a693a" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#9a693a" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="depth" cx="42%" cy="42%" r="68%">
        <stop offset="0" stop-color="#285c49" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#102d24" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="2048" height="2048" fill="url(#base)"/>
    <rect width="2048" height="2048" fill="url(#depth)"/>
    <rect width="2048" height="2048" fill="url(#bronze)"/>
  </svg>
`);

await sharp(backgroundSvg)
  .composite([
    {
      input: subject.data,
      left: Math.round((2048 - subject.info.width) / 2),
      top: Math.max(0, 2048 - subject.info.height),
      blend: "over",
    },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outputPath);

console.log(outputPath);
