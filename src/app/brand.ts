// Shared by the generated icons / social image (rendered with next/og at build time).

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a6"/><stop offset=".45" stop-color="#ffb547"/><stop offset="1" stop-color="#ff7a3d"/></linearGradient>
<radialGradient id="d" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe2a8"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="30" cy="34" r="17" fill="none" stroke="url(#g)" stroke-width="3.4"/>
<ellipse cx="30" cy="34" rx="7.4" ry="17" fill="none" stroke="url(#g)" stroke-width="2.2" opacity=".5"/>
<path d="M13.5 34h33" stroke="url(#g)" stroke-width="2.2" opacity=".5"/>
<path d="M42.5 15.5a10 10 0 0 1 6 6M44.6 9.6a16.5 16.5 0 0 1 9.8 9.8" fill="none" stroke="url(#g)" stroke-width="3.2" stroke-linecap="round"/>
<circle cx="39" cy="25" r="9" fill="url(#d)"/>
<circle cx="39" cy="25" r="2.8" fill="#fff"/>
</svg>`;

export const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;
