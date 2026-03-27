import { Metadata } from 'next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, MapPin, Star, ShieldCheck } from "lucide-react";

interface PageProps {
    params: Promise<{
        service: string;
        city: string;
    }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { service, city } = await params;
    const decodedService = decodeURIComponent(service).replace(/-/g, ' ');
    const decodedCity = decodeURIComponent(city).replace(/-/g, ' ');

    const title = `Best ${decodedService} in ${decodedCity} | Premium Results`;
    const description = `Discover transformative ${decodedService} in ${decodedCity}. Experience premium care and exceptional results. Book your consultation today.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: ['/og-seo.png'],
        },
    };
}

export default async function LocalSEOPage({ params }: PageProps) {
    const { service, city } = await params;
    const decodedService = decodeURIComponent(service).replace(/-/g, ' ');
    const decodedCity = decodeURIComponent(city).replace(/-/g, ' ');

    // structuredData (JSON-LD)
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "MedicalBusiness",
        "name": `Premium ${decodedService} ${decodedCity}`,
        "image": "https://example.com/clinic-photo.jpg",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": decodedCity,
            "addressRegion": "FL" // Example region
        },
        "description": `Premium ${decodedService} treatments in ${decodedCity}.`,
        "openingHours": "Mo-Fr 09:00-18:00",
        "telephone": "+18005550199"
    };

    return (
        <div className="min-h-screen bg-[#FAF9F6] text-[#2D2D2D] font-sans selection:bg-[#A3B18A]/30">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] py-4">
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#A3B18A] to-[#8A9A5B] bg-clip-text text-transparent">
                        GROWTH PARTNERS
                    </div>
                    <Button className="bg-[#A3B18A] hover:bg-[#8A9A5B] text-white rounded-full px-6">
                        Book Appointment
                    </Button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-12 lg:py-24 space-y-24">

                {/* Hero Section */}
                <section className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 animate-in fade-in slide-in-from-left duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#A3B18A]/10 text-[#588157] text-sm font-medium">
                            <Sparkles className="w-4 h-4" />
                            #1 Rated Wellness in {decodedCity}
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight">
                            Premium <span className="text-[#A3B18A] italic">{decodedService}</span> <br />
                            Tailored for {decodedCity}
                        </h1>
                        <p className="text-lg text-[#6B7280] max-w-xl leading-relaxed">
                            Experience the pinnacle of aesthetic care. Our bespoke treatments combine medical precision with
                            luxe relaxation to help you feel your absolute most confident self.
                        </p>
                        <div className="flex flex-wrap gap-4 pt-4">
                            <Button size="lg" className="bg-[#A3B18A] hover:bg-[#8A9A5B] text-white h-14 px-8 text-lg rounded-full">
                                Schedule Consultation
                            </Button>
                            <Button size="lg" variant="outline" className="border-[#A3B18A] text-[#A3B18A] h-14 px-8 text-lg rounded-full">
                                View Gallery
                            </Button>
                        </div>
                    </div>
                    <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-700 delay-200">
                        {/* Placeholder for Luxe Imagery */}
                        <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-black/10 to-black/40" />
                        <div className="absolute bottom-8 left-8 right-8 text-white">
                            <div className="flex items-center gap-2 mb-2">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />)}
                            </div>
                            <p className="font-medium italic">"The most life-changing results I've ever had in {decodedCity}."</p>
                            <p className="text-sm opacity-80">— Sarah J., Verified Patient</p>
                        </div>
                        <img
                            src="https://images.unsplash.com/photo-1512290923902-8a9f81dc2069?auto=format&fit=crop&q=80&w=1000"
                            alt={`${decodedService} Treatment`}
                            className="object-cover w-full h-full"
                        />
                    </div>
                </section>

                {/* Benefits Grid */}
                <section className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-bold tracking-tight">Why Choose Our {decodedCity} Clinic?</h2>
                        <p className="text-[#6B7280]">Uncompromising quality in every treatment.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 space-y-4 text-center">
                            <div className="w-12 h-12 bg-[#A3B18A]/10 rounded-xl flex items-center justify-center mx-auto">
                                <ShieldCheck className="w-6 h-6 text-[#A3B18A]" />
                            </div>
                            <h3 className="font-bold">Expert Practitioners</h3>
                            <p className="text-sm text-[#6B7280]">Treatments administered by highly trained, board-certified medical professionals.</p>
                        </Card>
                        <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 space-y-4 text-center">
                            <div className="w-12 h-12 bg-[#A3B18A]/10 rounded-xl flex items-center justify-center mx-auto">
                                <MapPin className="w-6 h-6 text-[#A3B18A]" />
                            </div>
                            <h3 className="font-bold">Local Convenience</h3>
                            <p className="text-sm text-[#6B7280]">Centrally located in {decodedCity} with easy parking and luxury amenities.</p>
                        </Card>
                        <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 space-y-4 text-center">
                            <div className="w-12 h-12 bg-[#A3B18A]/10 rounded-xl flex items-center justify-center mx-auto">
                                <Calendar className="w-6 h-6 text-[#A3B18A]" />
                            </div>
                            <h3 className="font-bold">Seamless Booking</h3>
                            <p className="text-sm text-[#6B7280]">Book your ${decodedService} session in seconds with our automated scheduling system.</p>
                        </Card>
                    </div>
                </section>

                {/* CTA Banner */}
                <section className="bg-[#A3B18A] rounded-[2.5rem] p-12 lg:p-24 text-center space-y-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    <h2 className="text-4xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
                        Ready to Begin Your Transformation Journey?
                    </h2>
                    <p className="text-white/80 text-lg max-w-xl mx-auto">
                        Join the hundreds of satisfied clients in {decodedCity} who trust us with their aesthetic goals.
                    </p>
                    <Button variant="secondary" className="bg-white text-[#A3B18A] hover:bg-[#FAF9F6] h-16 px-12 text-xl rounded-full transition-transform hover:scale-105 active:scale-95">
                        Book Now
                    </Button>
                </section>

            </main>

            <footer className="border-t border-[#E5E7EB] py-12 text-center text-sm text-[#9CA3AF]">
                &copy; {new Date().getFullYear()} Growth System. All rights reserved.
            </footer>
        </div>
    );
}
