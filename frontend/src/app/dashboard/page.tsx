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
  Plus,
  ArrowRight,
} from "lucide-react";
import { interviewsApi, candidatesApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [candidateList, interviewList] = await Promise.all([
    candidatesApi.list(0, 100),
    interviewsApi.list(0, 100),
  ]);

  const completed = interviewList.filter((i) => i.status === "completed" || i.status === "evaluating");

  let totalScore = 0;
  let reportsCount = 0;

  const completedList = interviewList.filter((i) => i.status === "completed").slice(0, 10);
  await Promise.all(
    completedList.map(async (i) => {
      try {
        const r = await interviewsApi.getReport(i.id, { ignore404: true });
        if (r && r.overall_score !== undefined) {
          totalScore += r.overall_score;
          reportsCount += 1;
        }
      } catch (err) {
        // Ignore
      }
    })
  );

  const stats = {
    totalInterviews: interviewList.length,
    totalCandidates: candidateList.length,
    completedInterviews: completed.length,
    averageScore: reportsCount > 0 ? Number((totalScore / reportsCount).toFixed(1)) : 0,
  };

  const getCandidateName = (candidateId: string) => {
    const candidate = candidateList.find((c) => c.id === candidateId);
    return candidate ? candidate.name : "Unknown Candidate";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      created: { label: "Created", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      planning: { label: "Planning", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      ready: { label: "Ready", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
      in_progress: { label: "In Progress", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      evaluating: { label: "Evaluating", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    };
    const c = config[status] || { label: status, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
    return <Badge className={`border ${c.className}`}>{c.label}</Badge>;
  };

  const formattedStats = [
    {
      label: "Total Interviews",
      value: stats.totalInterviews,
      icon: MessageSquareText,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Candidates",
      value: stats.totalCandidates,
      icon: Users,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    {
      label: "Completed",
      value: stats.completedInterviews,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Avg. Score",
      value: stats.averageScore > 0 ? `${stats.averageScore}/10` : "N/A",
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const recentInterviews = interviewList.slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Recruiting insights & active interviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/interviews">
            <Button className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all duration-200 shadow-lg cursor-pointer">
              <Plus className="w-5 h-5" />
              New Interview
            </Button>
          </Link>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-6 auto-rows-min">
        
        {/* Main Stats Bento Card */}
        <Card className="col-span-1 md:col-span-2 md:row-span-2 bg-[#0F172A] border-[#334155] rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="border-b border-[#1E293B] bg-[#020617]/50 pb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Recruitment Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 gap-8">
              {formattedStats.map((stat) => (
                <div key={stat.label} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-400">{stat.label}</span>
                  </div>
                  <p className="text-4xl font-extrabold text-white pl-13">{stat.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Action Bento Card */}
        <Card className="col-span-1 md:col-span-2 md:row-span-1 bg-gradient-to-br from-indigo-900 to-purple-900 border-[#334155] rounded-3xl overflow-hidden shadow-xl flex items-center">
          <CardContent className="p-8 flex items-center justify-between w-full">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Ready to hire?</h3>
              <p className="text-indigo-200">Set up a new candidate profile.</p>
            </div>
            <Link href="/dashboard/candidates">
              <Button className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl px-6 py-6 shadow-lg border-0 cursor-pointer">
                Add Candidate <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Interviews Bento Card */}
        <Card className="col-span-1 md:col-span-2 md:row-span-2 bg-[#0F172A] border-[#334155] rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#1E293B] bg-[#020617]/50">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Clock className="w-5 h-5 text-emerald-400" />
              Recent Interviews
            </CardTitle>
            <Link href="/dashboard/interviews" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentInterviews.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageSquareText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No interviews configured yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B]">
                {recentInterviews.map((interview) => (
                  <div key={interview.id} className="flex items-center justify-between p-5 hover:bg-[#1E293B]/50 transition-colors">
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {getCandidateName(interview.candidate_id)}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <span className="font-medium text-slate-300">{interview.title}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(interview.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
