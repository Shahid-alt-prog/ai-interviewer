"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Search,
  User,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Award,
  Calendar,
  Sparkles,
  Trash2,
  Pencil,
  X,
  Loader2,
} from "lucide-react";
import { interviewsApi, candidatesApi, Candidate, Interview, Report } from "@/lib/api";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState("all");

  // Edit Report Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
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

  async function loadData() {
    try {
      setLoading(true);
      const [completed, candidateList] = await Promise.all([
        interviewsApi.list(0, 50, "completed"),
        candidatesApi.list(0, 100),
      ]);

      setCandidates(candidateList);
      
      setInterviews(completed);

      // Fetch reports for all completed interviews in parallel
      const reportMap: Record<string, Report> = {};
      await Promise.all(
        completed.map(async (interview) => {
          try {
            const report = await interviewsApi.getReport(interview.id);
            reportMap[interview.id] = report;
          } catch (err) {
            console.error(`Error loading report for interview ${interview.id}:`, err);
          }
        })
      );
      setReports(reportMap);
    } catch (error) {
      console.error("Error loading reports data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteReport = async (interviewId: string) => {
    if (!confirm("Are you sure you want to delete this scorecard report and the associated interview session? This action cannot be undone.")) return;

    try {
      await interviewsApi.delete(interviewId);
      await loadData();
    } catch (error) {
      console.error("Error deleting report/interview:", error);
      alert("Failed to delete report.");
    }
  };

  const handleOpenEditModal = (interview: Interview, report: Report) => {
    setSelectedInterview(interview);
    setSelectedReport(report);
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
    if (!selectedInterview || !selectedReport) return;

    try {
      setIsUpdating(true);
      const updated = await interviewsApi.updateReport(selectedInterview.id, {
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

      // Update local state reports map
      setReports((prev) => ({
        ...prev,
        [selectedInterview.id]: updated,
      }));

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    return candidate ? candidate.name : "Unknown Candidate";
  };

  const getRecBadge = (rec: string) => {
    const r = rec.toLowerCase();
    if (r === "proceed") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-3 py-1 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          Proceed
        </Badge>
      );
    } else if (r === "hold") {
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-3 py-1 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Hold
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-bold px-3 py-1 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </Badge>
      );
    }
  };

  const filteredInterviews = interviews.filter((interview) => {
    const candidateName = getCandidateName(interview.candidate_id);
    const matchesSearch =
      interview.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidateName.toLowerCase().includes(searchQuery.toLowerCase());

    const report = reports[interview.id];
    const matchesRec =
      recommendationFilter === "all" ||
      (report && report.recommendation.toLowerCase() === recommendationFilter.toLowerCase());

    return matchesSearch && matchesRec;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assessment Reports</h1>
        <p className="text-muted-foreground mt-1">
          View deep analytical evaluations, ratings and recruiting feedback reports.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search report by candidate or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-border bg-white/[0.02]"
          />
        </div>

        <div className="flex gap-2 items-center w-full md:w-auto">
          {["all", "proceed", "hold", "reject"].map((rec) => (
            <button
              key={rec}
              onClick={() => setRecommendationFilter(rec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 capitalize cursor-pointer ${
                recommendationFilter === rec
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-white/[0.01] border-border text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {rec === "all" ? "All Recommendations" : rec}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredInterviews.length === 0 ? (
        <Card className="glass border-border py-16 text-center">
          <CardContent className="space-y-3">
            <BarChart3 className="w-16 h-16 mx-auto opacity-20 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">No reports matching filters</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Candidate evaluations are automatically compiled at the end of active interview sessions. Complete an interview to see results.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredInterviews.map((interview) => {
            const report = reports[interview.id];

            if (!report) {
              return (
                <Card key={interview.id} className="glass border-border opacity-60">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{getCandidateName(interview.candidate_id)}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{interview.title}</p>
                    </div>
                    <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20">Compiling Report...</Badge>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={interview.id}
                className="glass border-border flex flex-col justify-between hover:border-primary/30 transition-all duration-300 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {getCandidateName(interview.candidate_id)}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{interview.title}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    {getRecBadge(report.recommendation)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl text-center">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Overall</span>
                      <strong className="text-lg text-primary tracking-tight font-black mt-0.5 block">
                        {report.overall_score}/10
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Technical</span>
                      <strong className="text-lg text-sky-400 tracking-tight font-semibold mt-0.5 block">
                        {report.technical_rating}/10
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Communication</span>
                      <strong className="text-lg text-purple-400 tracking-tight font-semibold mt-0.5 block">
                        {report.communication_rating}/10
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {report.summary}
                  </p>

                  <div className="pt-4 border-t border-white/[0.04] flex justify-between items-center text-xs gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Compiled {new Date(report.generated_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(interview, report)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer rounded-lg flex items-center justify-center shrink-0"
                        title="Edit Report Scorecard"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteReport(interview.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-lg flex items-center justify-center shrink-0"
                        title="Delete Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>

                      <Link href={`/dashboard/reports/${interview.id}`}>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-primary font-semibold flex items-center gap-1 group/btn cursor-pointer">
                          View Report
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Report Scorecard Modal */}
      {isEditModalOpen && selectedReport && selectedInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] shrink-0">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Scorecard Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update candidate ratings, feedback, and hiring decision for {getCandidateName(selectedInterview.candidate_id)}
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
                        rows={3}
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
                          rows={4}
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
                          rows={4}
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
