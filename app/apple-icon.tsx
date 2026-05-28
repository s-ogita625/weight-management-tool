import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 28% 18%, rgba(163,255,18,0.35), transparent 34%), linear-gradient(145deg, #070a0f 0%, #101827 58%, #04070b 100%)',
          color: '#f5f7fa',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 10,
            borderRadius: 36,
            border: '2px solid rgba(163,255,18,0.58)',
            boxShadow: '0 0 22px rgba(163,255,18,0.2) inset',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 58,
              height: 58,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #a3ff12, #60e52f)',
              color: '#071006',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            W
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 31,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            <span>FIT</span>
            <span style={{ color: '#a3ff12' }}>CUT</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[24, 36, 48].map((width, index) => (
              <div
                key={width}
                style={{
                  width,
                  height: 4,
                  borderRadius: 999,
                  background: index === 1 ? '#20e0ff' : '#a3ff12',
                  opacity: index === 2 ? 0.62 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
