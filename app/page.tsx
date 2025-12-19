import { Button } from "@/components/ui/button"
import { AnimatedSection } from "@/components/animated-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="flex-col bg-cover bg-no-repeat overflow-hidden" style={{backgroundImage: 'url(/web-bg.png)'}}>
      {/* Main content area - takes up remaining space */}
      <main className="flex-1 min-h-[70vh] lg:min-h-[77vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-0 bg-[navy]/10 backdrop-blur-md">
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

      {/* About The Lab Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="container mx-auto max-w-4xl">
          <AnimatedSection animation="fadeIn" delay={0.2} scrollTrigger>
            <div className="text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-foreground">
                About The Lab
              </h2>
              <div className="w-24 h-1 bg-primary mx-auto mb-8"></div>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="slideIn" direction="up" delay={0.4} scrollTrigger>
            <div className="prose prose-lg max-w-none text-center">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                The Lacrosse Lab is Central Virginia's first dedicated women's lacrosse training program—a space built for players who bring energy, positivity, and a love of hard work.
              </p>
              
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Our mission is simple: help athletes of all levels sharpen their skills, play with confidence, and grow their love for the game. Training sessions focus on everything from stick work and shooting accuracy to footwork, body control, and playing through contact.
              </p>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                We welcome all players—regardless of school, club, or experience level—who are ready to learn, compete, and have fun.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Meet Our Coaches Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="container mx-auto max-w-6xl">
          <AnimatedSection animation="fadeIn" delay={0.2} scrollTrigger>
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
                Meet Our Coaches
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Our experienced coaching staff brings decades of lacrosse expertise to help you reach your potential.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

            {/* Coach Carter */}
            <AnimatedSection animation="slideIn" direction="right" delay={0.6} scrollTrigger>
              <Card className="overflow-hidden">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-300 h-300 rounded-full overflow-hidden bg-muted">
                    <Image 
                      src="/CoachCarter.png" 
                      alt="Coach Carter" 
                      width={300} 
                      height={300}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardTitle className="text-2xl">Coach Carter</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-7">
                  Coach Carter played Division I Lacrosse at James Madison University and has been deeply involved in the game ever since. With over a decade of coaching experience, she's helped hundreds of athletes grow through skill development, discipline, and teamwork.
                  She has spent four years as an assistant coach at Douglas Freeman High School, coached in six straight All-American games, earned three Coach of the Year honors, and serves as the Head of Women's Lacrosse at The Collegiate School.
                  Carter is also a certified lacrosse official.
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Coach Reif */}
            <AnimatedSection animation="slideIn" direction="left" delay={0.4} scrollTrigger>
              <Card className="overflow-hidden">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-300 h-300 rounded-full overflow-hidden bg-muted">
                    <Image 
                      src="/CoachReif.png" 
                      alt="Coach Reif" 
                      width={300} 
                      height={300}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardTitle className="text-2xl">Coach Reif</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                  Coach Reif brings over 30 years of coaching experience across youth and high-school sports, including his current role with the Collegiate School women's lacrosse program. Known for his creativity, energy, and infectious enthusiasm, he's the "drill king" who makes every session challenging and fun.
                  Reif's approach blends strong fundamentals with imaginative, fast-paced training designed to keep players engaged and improving. His commitment to community, joy, and player development is at the heart of The Lacrosse Lab experience.
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>

            
          </div>

          <AnimatedSection animation="fadeIn" delay={0.8} scrollTrigger>
            <div className="text-center mt-16">
              <Link href="/pricing">
                <Button 
                  size="lg"
                  className="text-lg px-12 py-4 bg-primary hover:bg-primary/90"
                >
                  Start Training Today
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  )
}
