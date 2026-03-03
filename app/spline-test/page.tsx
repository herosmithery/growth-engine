import SplineScene from '@/components/SplineScene';

export default function SplineTestPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-neutral-950">
            <h1 className="text-4xl font-bold mb-8 text-white">Spline Integration Test</h1>
            <div className="w-full h-[500px] border border-neutral-800 rounded-lg overflow-hidden bg-black/50">
                <SplineScene
                    scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode"
                    className="w-full h-full"
                />
            </div>
            <p className="mt-8 text-neutral-400">
                If you see the 3D scene above, the integration is successful.
            </p>
        </main>
    );
}
