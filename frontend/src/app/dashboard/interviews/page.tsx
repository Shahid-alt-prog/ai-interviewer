"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MessageSquareText,
  Search,
  User,
  Clock,
  Briefcase,
  Play,
  FileBarChart,
  X,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Sliders,
  Trash2,
  Pencil,
} from "lucide-react";
import { interviewsApi, candidatesApi, Candidate, Interview } from "@/lib/api";

const INTERVIEW_TYPES = [
  { value: "general_screening", label: "General Screening" },
  { value: "technical_round", label: "Technical Round" },
  { value: "manager_ops_round", label: "Manager/Ops Round" },
];

export default function InterviewsPage() {
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    candidate_id: "",
    title: "",
    job_description: "",
    interview_type: "general_screening",
    difficulty: "medium",
    duration_minutes: 30,
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    job_description: "",
    interview_type: "general_screening",
    difficulty: "medium",
    duration_minutes: 30,
    status: "created",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [interviewList, candidateList] = await Promise.all([
        interviewsApi.list(),
        candidatesApi.list(0, 100),
      ]);
      setInterviews(interviewList);
      setCandidates(candidateList);
      if (candidateList.length > 0) {
        setFormData((prev) => ({ ...prev, candidate_id: candidateList[0].id }));
      }
    } catch (error) {
      console.error("Error fetching interviews data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteInterview = async (interviewId: string) => {
    if (!confirm("Are you sure you want to delete this interview? This will also delete all associated reports, questions, plans, and answers.")) return;

    try {
      await interviewsApi.delete(interviewId);
      await fetchData();
    } catch (error) {
      console.error("Error deleting interview:", error);
      alert("Failed to delete interview.");
    }
  };

  const handleOpenEditModal = async (interview: Interview) => {
    try {
      // Fetch detail interview to get the job_description
      const detail = await interviewsApi.get(interview.id);
      setSelectedInterview(interview);
      setEditFormData({
        title: detail.title,
        job_description: detail.job_description,
        interview_type: detail.interview_type,
        difficulty: detail.difficulty || "medium",
        duration_minutes: detail.duration_minutes,
        status: detail.status,
      });
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error loading interview details:", error);
      alert("Failed to load interview details.");
    }
  };

  const handleUpdateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterview || !editFormData.title || !editFormData.job_description) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsUpdating(true);
      await interviewsApi.update(selectedInterview.id, {
        title: editFormData.title,
        job_description: editFormData.job_description,
        interview_type: editFormData.interview_type,
        difficulty: editFormData.difficulty,
        duration_minutes: editFormData.duration_minutes,
        status: editFormData.status,
      });
      setIsEditModalOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error("Error updating interview:", error);
      alert(error.detail || "Failed to update interview.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: name === "duration_minutes" ? Number(value) : value,
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "duration_minutes" ? Number(value) : value,
    }));
  };

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidate_id || !formData.title || !formData.job_description) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      await interviewsApi.create({
        candidate_id: formData.candidate_id,
        title: formData.title,
        job_description: formData.job_description,
        interview_type: formData.interview_type,
        difficulty: formData.difficulty,
        duration_minutes: formData.duration_minutes,
      });

      // Reset form title and description (keep candidate/type default)
      setFormData((prev) => ({
        ...prev,
        title: "",
        job_description: "",
      }));
      setIsModalOpen(false);

      // Re-fetch
      await fetchData();
    } catch (error: any) {
      console.error("Error scheduling interview:", error);
      alert(error.detail || "Failed to create the interview.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    return candidate ? candidate.name : "Unknown Candidate";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      created: { label: "Created", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      planning: { label: "Planning", className: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" },
      ready: { label: "Ready", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
      in_progress: { label: "In Progress", className: "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse-glow" },
      evaluating: { label: "Evaluating", className: "bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse" },
      completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    };
    const c = config[status] || { label: status, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
    return <Badge className={`border ${c.className}`}>{c.label}</Badge>;
  };

  const getDifficultyBadge = (difficulty: string) => {
    const diff = (difficulty || "medium").toLowerCase();
    const config: Record<string, { label: string; className: string }> = {
      easy: { label: "Easy AI", className: "bg-green-500/10 text-green-400 border-green-500/20" },
      medium: { label: "Medium AI", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
      hard: { label: "Hard AI", className: "bg-red-500/10 text-red-400 border-red-500/20 font-bold" },
    };
    const d = config[diff] || { label: diff, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
    return <Badge className={`border ${d.className} uppercase tracking-wider text-[10px]`}>{d.label}</Badge>;
  };

  const filteredInterviews = interviews.filter((interview) => {
    const matchesSearch =
      interview.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getCandidateName(interview.candidate_id)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || interview.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interviews Scheduler</h1>
          <p className="text-muted-foreground mt-1">
            Configure, launch, and monitor interview sessions.
          </p>
        </div>
        <Button
          onClick={() => {
            if (candidates.length === 0) {
              alert("You must create at least one candidate before setting up an interview.");
              return;
            }
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all duration-200 glow-primary cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          New Interview
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by candidate name or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-border bg-white/[0.02]"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          {["all", "created", "ready", "in_progress", "completed", "evaluating"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 capitalize cursor-pointer ${
                statusFilter === status
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-white/[0.01] border-border text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {status === "all" ? "All Statuses" : status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Interview Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredInterviews.length === 0 ? (
        <Card className="glass border-border py-16 text-center">
          <CardContent className="space-y-3">
            <MessageSquareText className="w-16 h-16 mx-auto opacity-20 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">No interview sessions found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Schedule a new interview for an existing candidate. You will be able to start the conversation and generate evaluations immediately.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInterviews.map((interview) => {
            const isCompleted = interview.status === "completed";
            const isEvaluating = interview.status === "evaluating";
            const inProgress = interview.status === "in_progress";
            const typeLabel = INTERVIEW_TYPES.find((t) => t.value === interview.interview_type)?.label || interview.interview_type;

            return (
              <Card
                key={interview.id}
                className="glass border-border flex flex-col justify-between hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary/80 capitalize bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                        {typeLabel}
                      </span>
                      {getDifficultyBadge(interview.difficulty)}
                      {getStatusBadge(interview.status)}
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight text-foreground mt-3 group-hover:text-primary transition-colors">
                      {interview.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">
                        {getCandidateName(interview.candidate_id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{interview.duration_minutes} minutes duration</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-xs">
                        Created {new Date(interview.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-0 border-t border-white/[0.04] mt-4 flex items-center justify-between gap-2">
                  {/* Start / Run Interview */}
                  {!isCompleted && !isEvaluating ? (
                    <div className="flex-1">
                      <Link href={`/interview/${interview.id}`} className="w-full">
                        <Button className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition cursor-pointer glow-primary">
                          <Play className="w-4 h-4 fill-current" />
                          {inProgress ? "Resume" : "Start"}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex-1">
                      {isEvaluating ? (
                        <Button
                          disabled
                          className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold text-xs px-2"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Evaluating
                        </Button>
                      ) : (
                        <Link href={`/dashboard/reports/${interview.id}`} className="w-full">
                          <Button className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer text-xs px-2">
                            <FileBarChart className="w-4 h-4" />
                            Scorecard
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenEditModal(interview)}
                    className="h-10 w-10 border-border text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer rounded-xl flex items-center justify-center shrink-0"
                    title="Edit Interview"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteInterview(interview.id)}
                    className="h-10 w-10 border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-xl flex items-center justify-center shrink-0"
                    title="Delete Interview"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule Interview Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <h3 className="text-lg font-bold text-foreground">Schedule Interview Session</h3>
              <button
                onClick={() => {
                  if (!isSubmitting) setIsModalOpen(false);
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateInterview} className="p-6 space-y-4">
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground text-center">
                    Creating interview plan. Customizing questions...
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="candidate_id" className="text-xs font-semibold text-muted-foreground">
                        Select Candidate *
                      </label>
                      <select
                        id="candidate_id"
                        name="candidate_id"
                        value={formData.candidate_id}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="interview_type" className="text-xs font-semibold text-muted-foreground">
                        Interview Type *
                      </label>
                      <select
                        id="interview_type"
                        name="interview_type"
                        value={formData.interview_type}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {INTERVIEW_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="difficulty" className="text-xs font-semibold text-muted-foreground">
                        Difficulty Level *
                      </label>
                      <select
                        id="difficulty"
                        name="difficulty"
                        value={formData.difficulty}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="easy">Easy (Supportive AI)</option>
                        <option value="medium">Medium (Standard AI)</option>
                        <option value="hard">Hard (Challenging AI)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="title" className="text-xs font-semibold text-muted-foreground">
                      Job Title *
                    </label>
                    <Input
                      id="title"
                      name="title"
                      required
                      placeholder="e.g. Senior Backend Engineer (Node/Python)"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="job_description" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Job Description *</span>
                      <span className="text-[10px] text-muted-foreground">Used to test specific traits</span>
                    </label>
                    <Textarea
                      id="job_description"
                      name="job_description"
                      required
                      rows={5}
                      placeholder="Specify core responsibilities, tech stack, minimum qualifications, and ideal candidates characteristics..."
                      value={formData.job_description}
                      onChange={handleInputChange}
                      className="border-border bg-white/[0.01] resize-none text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2 pt-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                      <span>Interview Duration (Minutes)</span>
                      <span className="text-primary font-bold">{formData.duration_minutes} Minutes</span>
                    </div>
                    <input
                      type="range"
                      name="duration_minutes"
                      min="5"
                      max="90"
                      step="5"
                      value={formData.duration_minutes}
                      onChange={handleInputChange}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>5 Min (Quick screen)</span>
                      <span>90 Min (Deep assessment)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-lg border-border cursor-pointer hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-primary text-primary-foreground font-semibold hover:opacity-90 transition rounded-lg px-5 py-2 cursor-pointer"
                    >
                      Schedule Interview
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Interview Modal */}
      {isEditModalOpen && selectedInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <h3 className="text-lg font-bold text-foreground">Edit Interview Details</h3>
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
            <form onSubmit={handleUpdateInterview} className="p-6 space-y-4">
              {isUpdating ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground text-center">
                    Updating interview details...
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Candidate
                      </label>
                      <Input
                        disabled
                        value={getCandidateName(selectedInterview.candidate_id)}
                        className="border-border bg-white/[0.01] opacity-50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit_interview_type" className="text-xs font-semibold text-muted-foreground">
                        Interview Type *
                      </label>
                      <select
                        id="edit_interview_type"
                        name="interview_type"
                        value={editFormData.interview_type}
                        onChange={handleEditInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {INTERVIEW_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit_difficulty" className="text-xs font-semibold text-muted-foreground">
                        Difficulty Level *
                      </label>
                      <select
                        id="edit_difficulty"
                        name="difficulty"
                        value={editFormData.difficulty}
                        onChange={handleEditInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="easy">Easy (Supportive AI)</option>
                        <option value="medium">Medium (Standard AI)</option>
                        <option value="hard">Hard (Challenging AI)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="edit_title" className="text-xs font-semibold text-muted-foreground">
                        Job Title *
                      </label>
                      <Input
                        id="edit_title"
                        name="title"
                        required
                        placeholder="e.g. Senior Backend Engineer"
                        value={editFormData.title}
                        onChange={handleEditInputChange}
                        className="border-border bg-white/[0.01]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit_status" className="text-xs font-semibold text-muted-foreground">
                        Interview Status *
                      </label>
                      <select
                        id="edit_status"
                        name="status"
                        value={editFormData.status}
                        onChange={handleEditInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-black text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="created">Created</option>
                        <option value="planning">Planning</option>
                        <option value="ready">Ready</option>
                        <option value="in_progress">In Progress</option>
                        <option value="evaluating">Evaluating</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit_job_description" className="text-xs font-semibold text-muted-foreground">
                      Job Description *
                    </label>
                    <Textarea
                      id="edit_job_description"
                      name="job_description"
                      required
                      rows={5}
                      placeholder="Specify core responsibilities..."
                      value={editFormData.job_description}
                      onChange={handleEditInputChange}
                      className="border-border bg-white/[0.01] resize-none text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2 pt-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                      <span>Interview Duration (Minutes)</span>
                      <span className="text-primary font-bold">{editFormData.duration_minutes} Minutes</span>
                    </div>
                    <input
                      type="range"
                      name="duration_minutes"
                      min="5"
                      max="90"
                      step="5"
                      value={editFormData.duration_minutes}
                      onChange={handleEditInputChange}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>5 Min (Quick screen)</span>
                      <span>90 Min (Deep assessment)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
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
                      Save Changes
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
