import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="py-32 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="mb-2 flex justify-center">
            <Image src="/logo.svg" alt="Word Lab" width={400} height={52} className="h-12 sm:h-16 w-auto" priority />
          </div>
          <p className="text-xl sm:text-2xl text-brand-navy/80 text-pretty mb-12 max-w-3xl mx-auto leading-relaxed tracking-tight font-semibold">
            Open To All, Earned By Few. 
          </p>
          <Link href="/pricing">
            <Button variant="primary"
              size="lg"
              className="text-lg px-12 py-4 bg-brand-strawberry hover:bg-brand-strawberry/90 text-white font-semibold bg-[rgba(238,18,51,1)]"
            >
              Join Today
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-brand-navy/10">
        <div className="container mx-auto text-center">
          <p className="text-brand-navy/60">&copy; {currentYear} Lacrosse Lab. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
