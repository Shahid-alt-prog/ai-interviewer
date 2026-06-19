"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Award,
  Calendar,
  Sparkles,
  BookOpen,
  Mail,
  Phone,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  TrendingUp,
  Loader2,
  BrainCircuit,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { interviewsApi, candidatesApi, Candidate, InterviewDetail, Report } from "@/lib/api";

export default function DetailedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  // Edit Report Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    overall_score: 0,
    technical_rating: 0,
    communication_rating: 0,
    problem_solving_rating: 0,
    leadership_rating: 0,
    domain_expertise_rating: 0,
    strengthsText: "",
    weaknessesText: "",
    recommendation: "Hold",
    recommendation_reasoning: "",
    summary: "",
  });

  const handleDeleteReport = async () => {
    if (!confirm("Are you sure you want to delete this scorecard report and the associated interview session? This action cannot be undone.")) return;

    try {
      await interviewsApi.delete(interviewId);
      router.push("/dashboard/reports");
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("Failed to delete report.");
    }
  };

  const handleOpenEditModal = () => {
    if (!report) return;
    setEditFormData({
      overall_score: report.overall_score,
      technical_rating: report.technical_rating,
      communication_rating: report.communication_rating,
      problem_solving_rating: report.problem_solving_rating,
      leadership_rating: report.leadership_rating,
      domain_expertise_rating: report.domain_expertise_rating || 6,
      strengthsText: report.strengths.join("\n"),
      weaknessesText: report.weaknesses.join("\n"),
      recommendation: report.recommendation,
      recommendation_reasoning: report.recommendation_reasoning,
      summary: report.summary,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    try {
      setIsUpdating(true);
      const updated = await interviewsApi.updateReport(interviewId, {
        overall_score: editFormData.overall_score,
        technical_rating: editFormData.technical_rating,
        communication_rating: editFormData.communication_rating,
        problem_solving_rating: editFormData.problem_solving_rating,
        leadership_rating: editFormData.leadership_rating,
        domain_expertise_rating: editFormData.domain_expertise_rating,
        strengths: editFormData.strengthsText.split("\n").map(s => s.trim()).filter(Boolean),
        weaknesses: editFormData.weaknessesText.split("\n").map(w => w.trim()).filter(Boolean),
        recommendation: editFormData.recommendation,
        recommendation_reasoning: editFormData.recommendation_reasoning,
        summary: editFormData.summary,
      });

      setReport(updated);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    async function loadReportDetails() {
      try {
        setLoading(true);
        const [intResult, repResult] = await Promise.allSettled([
          interviewsApi.get(interviewId, { ignore404: true }),
          interviewsApi.getReport(interviewId, { ignore404: true }),
        ]);
        
        let fetchedInterview: InterviewDetail | null = null;
        if (intResult.status === "fulfilled") {
          fetchedInterview = intResult.value;
          setInterview(fetchedInterview);
        } else {
          console.error("Error loading interview details:", intResult.reason);
        }

        if (repResult.status === "fulfilled") {
          setReport(repResult.value);
        } else {
          console.error("Error loading report details:", repResult.reason);
        }

        if (fetchedInterview) {
          try {
            const cand = await candidatesApi.get(fetchedInterview.candidate_id, { ignore404: true });
            setCandidate(cand);
          } catch (candError) {
            console.error("Error loading candidate details:", candError);
          }
        }
      } catch (error) {
        console.error("Error in loadReportDetails:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReportDetails();
  }, [interviewId]);

  const getRecommendationStyle = (rec: string) => {
    const r = rec.toLowerCase();
    if (r === "proceed") {
      return {
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        bg: "bg-emerald-500/[0.02] border-emerald-500/10",
        icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
        text: "text-emerald-400",
      };
    } else if (r === "hold") {
      return {
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        bg: "bg-amber-500/[0.02] border-amber-500/10",
        icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
        text: "text-amber-400",
      };
    } else {
      return {
        badge: "bg-red-500/10 text-red-400 border-red-500/20",
        bg: "bg-red-500/[0.02] border-red-500/10",
        icon: <XCircle className="w-8 h-8 text-red-400" />,
        text: "text-red-400",
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <LoaderSpinner />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Compiling scorecard data...
        </p>
      </div>
    );
  }

  if (!interview || !report || !candidate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-xl font-bold">Assessment Report Not Available</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          We could not locate a completed evaluation report for this interview. Please ensure the candidate has finished all interview sections.
        </p>
        <Link href="/dashboard/reports">
          <Button className="mt-2 bg-primary">Back to Reports</Button>
        </Link>
      </div>
    );
  }

  const recStyle = getRecommendationStyle(report.recommendation);

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard/reports">
          <Button variant="outline" size="sm" className="border-border rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenEditModal}
            className="border-border rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-white/5 text-xs text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Scorecard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteReport}
            className="border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Report
          </Button>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-2">
            <Calendar className="w-3.5 h-3.5" />
            Generated {new Date(report.generated_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Candidate Profile Header Card */}
      <Card className="glass border-border overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-indigo-500/5 to-purple-500/10 p-6 md:p-8 border-b border-white/[0.05] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
              Assessment Scorecard
            </span>
            <h1 className="text-3xl font-black text-foreground tracking-tight mt-3">
              {candidate.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {interview.title} • <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-black/30 p-3.5 rounded-xl border border-white/[0.04]">
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-primary" />
              {candidate.email}
            </span>
            {candidate.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary" />
                {candidate.phone}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Main Analysis Section GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruiter summary Card */}
        <Card className={`glass border-border ${recStyle.bg}`}>
          <CardHeader className="pb-3 border-b border-white/[0.04]">
            <CardTitle className="text-base font-bold text-muted-foreground">
              Selection Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              {recStyle.icon}
              <span className={`text-2xl font-black tracking-wide uppercase mt-1 ${recStyle.text}`}>
                {report.recommendation}
              </span>
            </div>

            <div className="border border-white/[0.06] bg-black/20 p-4 rounded-xl">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block font-bold">
                Overall AI Rating
              </span>
              <strong className="text-4xl text-primary font-black tracking-tight mt-1.5 block">
                {report.overall_score}/10
              </strong>
            </div>

            <div className="text-xs text-muted-foreground text-left leading-relaxed">
              <strong>Recommendation Reasoning:</strong>
              <p className="mt-1 leading-relaxed">{report.recommendation_reasoning}</p>
            </div>
          </CardContent>
        </Card>

        {/* Trait breakdown ratings Card */}
        <Card className="glass border-border lg:col-span-2">
          <CardHeader className="pb-3 border-b border-white/[0.04]">
            <CardTitle className="text-base font-bold text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
              Evaluated Traits Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Individual traits */}
              {[
                { label: "Technical Competence", value: report.technical_rating, color: "bg-sky-500" },
                { label: "Communication Skills", value: report.communication_rating, color: "bg-purple-500" },
                { label: "Problem Solving", value: report.problem_solving_rating, color: "bg-amber-500" },
                { label: "Leadership & Impact", value: report.leadership_rating, color: "bg-emerald-500" },
                { label: "Domain Expertise", value: report.domain_expertise_rating || 6, color: "bg-indigo-500" },
              ].map((trait) => (
                <div key={trait.label} className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-muted-foreground">{trait.label}</span>
                    <span className="text-foreground">{trait.value}/10</span>
                  </div>
                  <Progress value={trait.value * 10} className={`h-1.5 bg-white/10 rounded-full ${trait.color}`} />
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 text-xs flex gap-2.5 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                Each score is calculated by cross-analyzing answers against topic expectations, keyword occurrences, confidence scores, and clarity indicators.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary section */}
      <Card className="glass border-border">
        <CardHeader className="pb-3 border-b border-white/[0.04]">
          <CardTitle className="text-base font-bold text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="w-4.5 h-4.5 text-primary" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 text-sm text-foreground leading-relaxed">
          <p className="whitespace-pre-line leading-relaxed">{report.summary}</p>
        </CardContent>
      </Card>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card className="glass border-border">
          <CardHeader className="pb-3 border-b border-emerald-500/10 bg-emerald-500/[0.01]">
            <CardTitle className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <ThumbsUp className="w-4.5 h-4.5" />
              Key Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              {report.strengths.map((str, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-foreground">{str}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="glass border-border">
          <CardHeader className="pb-3 border-b border-red-500/10 bg-red-500/[0.01]">
            <CardTitle className="text-sm font-bold text-red-400 flex items-center gap-1.5">
              <ThumbsDown className="w-4.5 h-4.5" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              {report.weaknesses.map((weak, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-foreground">{weak}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Interview Transcripts Log */}
      <Card className="glass border-border overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.01] flex flex-row items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <CardTitle className="text-base font-bold text-muted-foreground">
            Interview Transcripts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {interview.conversation_history && interview.conversation_history.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {interview.conversation_history.map((msg: any, index: number) => {
                const isAI = msg.role === "assistant" || msg.role === "interviewer";
                return (
                  <div
                    key={index}
                    className={`p-6 flex gap-4 ${isAI ? "bg-white/[0.01]" : "bg-black/10"}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isAI
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {isAI ? <BrainCircuit className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        {isAI ? "AI Interviewer" : "Candidate Response"}
                      </span>
                      <p className="text-xs md:text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {msg.content || msg.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No conversation transcript loaded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Report Scorecard Modal */}
      {isEditModalOpen && report && candidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Scorecard Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update candidate ratings, feedback, and hiring decision for {candidate.name}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isUpdating) setIsEditModalOpen(false);
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateReport} className="flex-1 overflow-y-auto p-6 space-y-6">
              {isUpdating ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground text-center">
                    Saving updated scorecard report...
                  </p>
                </div>
              ) : (
                <>
                  {/* Score & Recommendation Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                        <span>Overall Rating *</span>
                        <span className="text-primary font-bold">{editFormData.overall_score}/10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editFormData.overall_score}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, overall_score: Number(e.target.value) }))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit_recommendation" className="text-xs font-semibold text-muted-foreground">
                        Hiring Decision Recommendation *
                      </label>
                      <select
                        id="edit_recommendation"
                        value={editFormData.recommendation}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, recommendation: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Proceed">Proceed</option>
                        <option value="Hold">Hold</option>
                        <option value="Reject">Reject</option>
                      </select>
                    </div>
                  </div>

                  {/* Ratings Breakdown Grid */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Traits Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "technical_rating", label: "Technical Competence" },
                        { key: "communication_rating", label: "Communication Skills" },
                        { key: "problem_solving_rating", label: "Problem Solving" },
                        { key: "leadership_rating", label: "Leadership & Impact" },
                        { key: "domain_expertise_rating", label: "Domain Expertise" },
                      ].map((trait) => (
                        <div key={trait.key} className="space-y-1.5 p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-muted-foreground">{trait.label}</span>
                            <span className="text-foreground font-bold">{editFormData[trait.key as keyof typeof editFormData] || 6}/10</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={editFormData[trait.key as keyof typeof editFormData] || 6}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, [trait.key]: Number(e.target.value) }))}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Written feedback */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Written Evaluation</h4>
                    <div className="space-y-1.5">
                      <label htmlFor="edit_summary" className="text-xs font-semibold text-muted-foreground">
                        Executive Summary *
                      </label>
                      <textarea
                        id="edit_summary"
                        required
                        rows={4}
                        value={editFormData.summary}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, summary: e.target.value }))}
                        className="w-full p-3 rounded-lg border border-border bg-black text-foreground text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Provide a high-level summary of the candidate's performance..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit_reasoning" className="text-xs font-semibold text-muted-foreground">
                        Recommendation Reasoning *
                      </label>
                      <textarea
                        id="edit_reasoning"
                        required
                        rows={3}
                        value={editFormData.recommendation_reasoning}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, recommendation_reasoning: e.target.value }))}
                        className="w-full p-3 rounded-lg border border-border bg-black text-foreground text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Justify the hiring recommendation..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="edit_strengths" className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          Key Strengths (one per line)
                        </label>
                        <textarea
                          id="edit_strengths"
                          rows={6}
                          value={editFormData.strengthsText}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, strengthsText: e.target.value }))}
                          className="w-full p-3 rounded-lg border border-emerald-500/20 bg-black text-foreground text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g. Excellent system design knowledge&#10;Clear and structured communication"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="edit_weaknesses" className="text-xs font-semibold text-red-400 flex items-center gap-1">
                          Key Weaknesses (one per line)
                        </label>
                        <textarea
                          id="edit_weaknesses"
                          rows={6}
                          value={editFormData.weaknessesText}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, weaknessesText: e.target.value }))}
                          className="w-full p-3 rounded-lg border border-red-500/20 bg-black text-foreground text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g. Lacks depth in concurrent databases&#10;Somewhat fast speaking pace"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.05] shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditModalOpen(false)}
                      className="rounded-lg border-border cursor-pointer hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-primary text-primary-foreground font-semibold hover:opacity-90 transition rounded-lg px-5 py-2 cursor-pointer"
                    >
                      Save Scorecard Changes
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LoaderSpinner() {
  return (
    <div className="relative flex items-center justify-center h-12 w-12">
      <Loader2 className="w-12 h-12 animate-spin text-primary absolute" />
      <Award className="w-6 h-6 text-primary absolute" />
    </div>
  );
}
