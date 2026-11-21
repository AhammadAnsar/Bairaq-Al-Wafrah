/**
 * Authentic SVG data-URI generators for the pre-loaded partner companies
 * (Green Medical Kabini & Salah Behbehani General Trading & Contracting Co. W.L.L.)
 * plus an HTML5 Canvas image transparency cleaner for user-uploaded stamps, signatures, and logos.
 */

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export const GMK_LOGO_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150" width="160" height="150">
  <!-- Stylized Green Cedar/Pine Tree matching Green Medical Kabini emblem -->
  <g fill="#4c7c34">
    <path d="M80 12 L62 42 L72 40 L54 68 L68 65 L46 95 L64 92 L38 122 L122 122 L96 92 L114 95 L92 65 L106 68 L88 40 L98 42 Z" />
    <!-- Foliage texture highlights -->
    <path d="M80 18 L68 38 L76 37 L61 62 L73 60 L54 88 L70 86 L48 115 L80 112 Z" fill="#5e9442" opacity="0.65"/>
    <!-- Trunk & Base -->
    <rect x="74" y="118" width="12" height="14" rx="2" fill="#3b6327" />
    <path d="M48 130 Q80 124 112 130 L116 135 Q80 130 44 135 Z" fill="#4c7c34" />
  </g>
</svg>
`);

export const GMK_STAMP_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 220" width="260" height="220">
  <defs>
    <path id="gmkTopArc" d="M 55,110 A 75,75 0 1,1 205,110" />
    <path id="gmkBottomArc" d="M 205,110 A 75,75 0 1,1 55,110" />
  </defs>
  <!-- Circular Blue Official Stamp -->
  <g transform="rotate(-4 130 110)" opacity="0.88">
    <circle cx="130" cy="110" r="88" fill="none" stroke="#1e40af" stroke-width="2.5" />
    <circle cx="130" cy="110" r="83" fill="none" stroke="#1e40af" stroke-width="1" />
    <circle cx="130" cy="110" r="56" fill="none" stroke="#1e40af" stroke-width="1.5" />
    <text fill="#1e40af" font-family="Cairo, sans-serif" font-size="9.5" font-weight="700" text-anchor="middle">
      <textPath href="#gmkTopArc" startOffset="50%">شركة جرين ميدكيل كابني لفتح وإدارة المراكز والعيادات</textPath>
    </text>
    <text fill="#1e40af" font-family="Public Sans, sans-serif" font-size="8.2" font-weight="700" letter-spacing="0.5" text-anchor="middle">
      <textPath href="#gmkBottomArc" startOffset="50%">G M K To Open &amp; Manage Centers &amp; Clinics</textPath>
    </text>
    <!-- Inner Cedar Emblem -->
    <path d="M130 64 L118 82 L124 81 L112 97 L122 96 L108 112 L152 112 L138 96 L148 97 L136 81 L142 82 Z" fill="#1e40af" />
    <rect x="127" y="111" width="6" height="7" fill="#1e40af" />
    <text x="130" y="131" fill="#1e40af" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="800" text-anchor="middle">Green Medical</text>
  </g>
  <!-- Overlapping Pen Signature -->
  <path d="M18 118 C55 104, 115 92, 162 84 C140 98, 95 114, 72 124 C105 114, 158 98, 196 89" fill="none" stroke="#1d4ed8" stroke-width="2.2" stroke-linecap="round" opacity="0.9" />
  <path d="M40 128 C78 122, 128 116, 174 112" fill="none" stroke="#1d4ed8" stroke-width="1.4" stroke-linecap="round" opacity="0.75" />
</svg>
`);

export const SB_LOGO_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 150" width="180" height="150">
  <!-- Salah Behbehani Blue & Gold Overlapping Rings + SB Monogram -->
  <g>
    <!-- Gold right crescent ring -->
    <ellipse cx="102" cy="76" rx="52" ry="54" fill="none" stroke="#eab308" stroke-width="7" opacity="0.85" />
    <!-- Deep Blue left crescent ring -->
    <ellipse cx="78" cy="74" rx="54" ry="56" fill="none" stroke="#1d4ed8" stroke-width="8" />
    <!-- S in Royal Blue -->
    <text x="52" y="96" fill="#1d4ed8" font-family="Georgia, serif" font-size="78" font-weight="bold" font-style="italic">S</text>
    <!-- B in Gold -->
    <text x="86" y="108" fill="#eab308" font-family="Georgia, serif" font-size="72" font-weight="bold" font-style="italic" opacity="0.9">B</text>
  </g>
</svg>
`);

export const SB_WATERMARK_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 450" width="500" height="450">
  <g opacity="0.16">
    <ellipse cx="280" cy="225" rx="165" ry="170" fill="none" stroke="#eab308" stroke-width="24" />
    <ellipse cx="215" cy="220" rx="170" ry="175" fill="none" stroke="#1d4ed8" stroke-width="26" />
    <text x="125" y="285" fill="#1d4ed8" font-family="Georgia, serif" font-size="240" font-weight="bold" font-style="italic">S</text>
    <text x="235" y="325" fill="#eab308" font-family="Georgia, serif" font-size="220" font-weight="bold" font-style="italic">B</text>
  </g>
</svg>
`);

export const SB_SIGNATURE_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 90" width="180" height="90">
  <!-- Authentic Royal Blue Executive Signature matching Salah Behbehani PDF -->
  <g fill="none" stroke="#0026ff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 42 C48 44, 88 52, 134 62" stroke-width="4" />
    <path d="M68 45 C62 60, 65 76, 75 74 C83 72, 82 54, 72 46" stroke-width="3.5" />
    <path d="M95 36 C88 56, 94 78, 108 77 C118 76, 116 55, 102 44 C94 38, 112 26, 126 32" stroke-width="3.8" />
    <path d="M88 26 C96 22, 118 16, 128 24 C132 28, 118 38, 106 36" stroke-width="3.2" />
  </g>
</svg>
`);

export const SB_STAMP_DATA_URL = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <path id="sbTopArc" d="M 34,100 A 66,66 0 1,1 166,100" />
    <path id="sbBottomArc" d="M 166,100 A 66,66 0 1,1 34,100" />
  </defs>
  <g transform="rotate(-8 100 100)" opacity="0.92">
    <circle cx="100" cy="100" r="82" fill="none" stroke="#0026ff" stroke-width="3" />
    <circle cx="100" cy="100" r="76" fill="none" stroke="#0026ff" stroke-width="1.2" />
    <text fill="#0026ff" font-family="Public Sans, sans-serif" font-size="8.5" font-weight="700" text-anchor="middle">
      <textPath href="#sbTopArc" startOffset="50%">Salah Behbehani General</textPath>
    </text>
    <text fill="#0026ff" font-family="Public Sans, sans-serif" font-size="8" font-weight="700" text-anchor="middle">
      <textPath href="#sbBottomArc" startOffset="50%">Trading &amp; Contracting Co. W.L.L.</textPath>
    </text>
    <ellipse cx="96" cy="100" rx="36" ry="36" fill="none" stroke="#0026ff" stroke-width="4.5" />
    <text x="75" y="112" fill="#0026ff" font-family="Georgia, serif" font-size="48" font-weight="bold" font-style="italic">S</text>
    <text x="98" y="122" fill="#0026ff" font-family="Georgia, serif" font-size="42" font-weight="bold" font-style="italic">B</text>
  </g>
</svg>
`);

/**
 * Processes an uploaded image file (Logo, Stamp, Signature, Watermark, or Letterhead Pad).
 * When `removeWhiteBg` is true, pixels near white are converted to transparent alpha
 * so stamps and signatures overlay cleanly over tables and text.
 */
export async function processUploadedAssetImage(
  file: File,
  options: { removeWhiteBg?: boolean; maxDimension?: number } = {}
): Promise<string> {
  const { removeWhiteBg = false, maxDimension = 1200 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        if (removeWhiteBg) {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Calculate luminance
            const brightness = (r + g + b) / 3;
            if (brightness > 238 && r > 225 && g > 225 && b > 225) {
              data[i + 3] = 0; // Fully transparent
            } else if (brightness > 215) {
              // Smooth anti-aliased edge feathering
              const alphaFactor = (238 - brightness) / (238 - 215);
              data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alphaFactor)));
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Invalid image format'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
