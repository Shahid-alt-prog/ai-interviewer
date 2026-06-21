"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquareText,
  BarChart3,
  Clock,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  ArrowRight,
} from "lucide-react";
import { interviewsApi, candidatesApi, Candidate, Interview } from "@/lib/api";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState({
    totalInterviews: 0,
    totalCandidates: 0,
    completedInterviews: 0,
    averageScore: 0,
  });

  // Request microphone permission on mount so it's pre-approved before starting an interview
  useEffect(() => {
    if (typeof window !== "undefined" && navigator?.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn("Pre-requesting microphone permission failed/denied:", err);
        });
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [candidateList, interviewList] = await Promise.all([
          candidatesApi.list(0, 100),
          interviewsApi.list(0, 100),
        ]);

        setCandidates(candidateList);
        setInterviews(interviewList);

        // Calculate stats
        const completed = interviewList.filter((i) => i.status === "completed" || i.status === "evaluating");
        
        // Fetch reports to calculate actual average score
        let totalScore = 0;
        let reportsCount = 0;
        
        const completedList = interviewList.filter((i) => i.status === "completed").slice(0, 10);
        await Promise.all(
          completedList.map(async (i) => {
            try {
              const r = await interviewsApi.getReport(i.id);
              totalScore += r.overall_score;
              reportsCount += 1;
            } catch (err) {
              // Report not generated yet or errored
            }
          })
        );

        setStats({
          totalInterviews: interviewList.length,
          totalCandidates: candidateList.length,
          completedInterviews: completed.length,
          averageScore: reportsCount > 0 ? Number((totalScore / reportsCount).toFixed(1)) : 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    return candidate ? candidate.name : "Unknown Candidate";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      created: { label: "Created", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      planning: { label: "Planning", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      ready: { label: "Ready", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
      in_progress: { label: "In Progress", className: "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse-glow" },
      evaluating: { label: "Evaluating", className: "bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse" },
      completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    };
    const c = config[status] || { label: status, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
    return <Badge className={`border ${c.className}`}>{c.label}</Badge>;
  };

  const formattedStats = [
    {
      label: "Total Interviews",
      value: loading ? "..." : stats.totalInterviews,
      icon: MessageSquareText,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Candidates",
      value: loading ? "..." : stats.totalCandidates,
      icon: Users,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    {
      label: "Completed",
      value: loading ? "..." : stats.completedInterviews,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Avg. Score",
      value: loading ? "..." : (stats.averageScore > 0 ? `${stats.averageScore}/10` : "N/A"),
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const recentInterviews = interviews.slice(0, 5);
  const completedInterviews = interviews.filter((i) => i.status === "completed").slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Analyze, manage, and conduct intelligent candidates evaluations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/interviews">
            <Button className="group flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all duration-200 glow-primary cursor-pointer">
              <Plus className="w-4 h-4" />
              New Interview
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {formattedStats.map((stat) => (
          <Card key={stat.label} className="hover:border-primary/30 transition-colors duration-300 glass border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Interviews Card */}
        <Card className="glass border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="w-5 h-5 text-primary" />
              Recent Interviews
            </CardTitle>
            <Link href="/dashboard/interviews" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : recentInterviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquareText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No interviews configured yet.</p>
                <p className="text-xs mt-1">Configure candidates and schedule interviews above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentInterviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all duration-200"
                  >
                    <div>
                      <h4 className="font-medium text-sm text-foreground">
                        {getCandidateName(interview.candidate_id)}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{interview.title}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(interview.status)}
                      <Link href={`/dashboard/interviews`}>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Reports Card */}
        <Card className="glass border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="w-5 h-5 text-primary" />
              Latest Reports
            </CardTitle>
            <Link href="/dashboard/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : completedInterviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No reports generated yet.</p>
                <p className="text-xs mt-1">Assessment reports will appear once candidates complete interviews.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedInterviews.map((interview) => (
                  <Link
                    key={interview.id}
                    href={`/dashboard/reports/${interview.id}`}
                    className="block p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-primary/30 hover:bg-white/[0.04] transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm text-foreground">
                          {getCandidateName(interview.candidate_id)}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span>{interview.title}</span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span>Finished {interview.completed_at ? new Date(interview.completed_at).toLocaleDateString() : ""}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
