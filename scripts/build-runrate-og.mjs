import sharp from "sharp";

const lockupPath =
  "C:/Users/eddie/Eddie Consultancy Project/public/brand/runrate-lockup-light.svg";
const outputPath =
  "C:/Users/eddie/Eddie Consultancy Project/public/og.png";

const lockup = await sharp(lockupPath)
  .resize({ width: 440 })
  .png()
  .toBuffer();

const card = Buffer.from(`
  <svg width="1800" height="945" viewBox="0 0 1800 945"
       xmlns="http://www.w3.org/2000/svg">
    <rect width="1800" height="945" fill="#EDEFEC"/>
    <rect x="126" y="175" width="8" height="520" rx="4" fill="#23384A"/>
    <text x="190" y="430" fill="#172733"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="102" letter-spacing="-3">
      <tspan x="190" dy="0">Build a business that</tspan>
      <tspan x="190" dy="116">runs on systems.</tspan>
    </text>
    <text x="194" y="660" fill="#536C7F"
          font-family="'Segoe UI', Arial, sans-serif"
          font-size="34" font-weight="600" letter-spacing="1">
      BUSINESS INDEPENDENCE &amp; DECISION SYSTEMS
    </text>
  </svg>
`);

await sharp(card)
  .composite([{ input: lockup, left: 126, top: 34 }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
