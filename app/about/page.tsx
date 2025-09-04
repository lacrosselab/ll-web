import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Target, Award, Heart } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              About Us
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Building the future of <span className="text-primary">business management</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We're on a mission to empower businesses of all sizes with the tools they need to succeed in today's
              digital world. Our platform combines simplicity with powerful features to help you achieve your goals.
            </p>
          </div>

          {/* Values Section */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            <Card className="text-center">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Customer First</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Every decision we make is guided by what's best for our customers and their success.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Target className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Innovation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  We continuously push boundaries to deliver cutting-edge solutions that drive results.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Award className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Excellence</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  We maintain the highest standards in everything we do, from product quality to customer service.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Heart className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Integrity</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  We build trust through transparency, honesty, and ethical business practices.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Story Section */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Story</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Founded in 2024, our company started with a simple observation: businesses were struggling with
                  fragmented tools and complex workflows that hindered their growth potential.
                </p>
                <p>
                  We set out to create a unified platform that would simplify business operations while providing the
                  advanced features that growing companies need. Today, we serve thousands of businesses worldwide,
                  helping them streamline their operations and achieve their goals.
                </p>
                <p>
                  Our team of experienced developers, designers, and business experts work tirelessly to ensure our
                  platform evolves with the changing needs of modern businesses.
                </p>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-8">
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">10K+</div>
                  <div className="text-sm text-muted-foreground">Active Users</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">50+</div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">Support</div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-6">Meet Our Team</h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              We're a diverse team of passionate individuals committed to building the best possible experience for our
              users.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Alex Johnson",
                  role: "CEO & Founder",
                  bio: "Former VP of Engineering at a Fortune 500 company with 15+ years of experience building scalable platforms.",
                },
                {
                  name: "Sarah Chen",
                  role: "CTO",
                  bio: "Full-stack engineer and architect with expertise in cloud infrastructure and modern web technologies.",
                },
                {
                  name: "Michael Rodriguez",
                  role: "Head of Design",
                  bio: "Award-winning designer focused on creating intuitive user experiences that drive business results.",
                },
              ].map((member, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4"></div>
                    <CardTitle>{member.name}</CardTitle>
                    <CardDescription className="text-primary font-medium">{member.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{member.bio}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
