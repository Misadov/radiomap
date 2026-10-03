import { ImageResponse } from 'next/og';
import { LOGO_DATA_URI } from './brand';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 40%, #16203d 0%, #0b0c15 70%)',
        }}
      >
        <img src={LOGO_DATA_URI} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
