'use client';

import dynamic from 'next/dynamic';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center w-full h-full bg-neutral-900/50 animate-pulse text-neutral-500">Loading 3D Scene...</div>
});

interface SplineSceneProps {
    scene: string;
    className?: string;
}

export default function SplineScene({ scene, className }: SplineSceneProps) {
    return (
        <div className={className}>
            {/* @ts-ignore - dynamic import loses exact prop types */}
            <Spline scene={scene} />
        </div>
    );
}
