'use client';

import dynamic from 'next/dynamic';
import Splash from '@/components/Splash';

// The whole experience is client-side (WebGL, audio, local storage).
const App = dynamic(() => import('@/components/App'), { ssr: false, loading: () => <Splash /> });

export default function ClientApp() {
  return <App />;
}
