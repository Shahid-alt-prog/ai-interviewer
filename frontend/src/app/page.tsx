import Link from "next/link";
import {
  BrainCircuit,
  MessageSquareText,
  BarChart3,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AI Interviewer</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200 text-sm font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Autonomous Assessment Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in">
            <span className="gradient-text">Intelligent</span>
            <br />
            Interview Platform
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
            Conduct structured job interviews with AI that asks intelligent
            follow-up questions, evaluates responses in real-time, and generates
            comprehensive candidate assessments.
          </p>
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all duration-200 glow-primary"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/dashboard/interviews"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl glass text-foreground font-medium hover:bg-white/5 transition-all duration-200"
            >
              View Interviews
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquareText,
                title: "Conversational AI",
                description:
                  "Natural interview flow with intelligent follow-up questions that dig deeper into candidate responses.",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
              },
              {
                icon: BarChart3,
                title: "Real-time Evaluation",
                description:
                  "Every response is scored across multiple dimensions — technical skill, communication, problem solving, and more.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
              },
              {
                icon: Users,
                title: "Assessment Reports",
                description:
                  "Comprehensive recruiter-friendly reports with scores, strengths, weaknesses, and hiring recommendations.",
                color: "text-sky-400",
                bg: "bg-sky-500/10",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-6 hover:bg-white/[0.03] transition-all duration-300 group"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            <span>AI Interviewer</span>
          </div>
            <span>AI Powered Scorecards</span>
        </div>
      </footer>
    </div>
  );
}
