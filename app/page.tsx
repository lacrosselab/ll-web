import { Button } from "@/components/ui/button"
import { AnimatedSection } from "@/components/animated-section"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {

  return (
    <div className="flex-col bg-cover bg-bottom bg-no-repeat overflow-hidden" style={{backgroundImage: 'url(/web-bg.png)'}}>
      {/* Main content area - takes up remaining space */}
      <main className="flex-1 min-h-[70vh] lg:min-h-[77vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-0 bg-black/25 backdrop-blur-xs">
        <div className="container mx-auto text-center max-w-4xl">
          <AnimatedSection animation="fadeIn" delay={0.2}>
            <div className="mb-2 flex justify-center">
              <Image src="/logo.svg" alt="Word Lab" width={400} height={52} className="h-12 sm:h-16 w-auto" priority />
            </div>
          </AnimatedSection>
          
          <AnimatedSection animation="fadeIn" delay={0.4}>
            <p className="text-xl sm:text-2xl text-cream text-pretty mb-12 max-w-3xl mx-auto leading-relaxed tracking-tight font-semibold">
              Open To All, Earned By Few. 
            </p>
          </AnimatedSection>
          
          <AnimatedSection animation="slideIn" direction="up" delay={0.6}>
            <Link href="/pricing">
              <Button 
                size="lg"
                className="text-lg px-12 py-4 bg-primary hover:bg-primary/90 text-cream font-semibold"
              >
                Find A Session
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </main>
    </div>
  )
}
