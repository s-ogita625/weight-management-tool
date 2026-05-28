import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
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
            'radial-gradient(circle at 28% 18%, rgba(163,255,18,0.32), transparent 34%), linear-gradient(145deg, #070a0f 0%, #101827 58%, #04070b 100%)',
          color: '#f5f7fa',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 28,
            borderRadius: 104,
            border: '4px solid rgba(163,255,18,0.55)',
            boxShadow: '0 0 60px rgba(163,255,18,0.22) inset',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 168,
              height: 168,
              borderRadius: 42,
              background: 'linear-gradient(135deg, #a3ff12, #60e52f)',
              color: '#071006',
              fontSize: 96,
              fontWeight: 900,
              boxShadow: '0 24px 70px rgba(163,255,18,0.38)',
            }}
          >
            W
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            <span>FIT</span>
            <span style={{ color: '#a3ff12' }}>CUT</span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
            }}
          >
            {[72, 108, 144].map((width, index) => (
              <div
                key={width}
                style={{
                  width,
                  height: 10,
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
