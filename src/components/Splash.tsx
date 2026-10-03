import { LogoMark, Wordmark } from './Logo';

/** First paint (server-rendered) while the app bundle loads. */
export default function Splash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(60% 55% at 55% 50%, #0f1730 0%, #070a14 55%, #04050a 100%)' }}
      />
      <div className="relative flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-accent/30 blur-2xl animate-pulse" />
          <LogoMark size={64} className="relative" />
        </div>
        <Wordmark className="text-3xl" />
      </div>
    </div>
  );
}
