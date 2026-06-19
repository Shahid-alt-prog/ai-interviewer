"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Users,
  Search,
  Mail,
  Phone,
  FileText,
  Upload,
  Loader2,
  Calendar,
  X,
  Briefcase,
  GraduationCap,
  Sparkles,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import { candidatesApi, Candidate, getFileUrl } from "@/lib/api";

export default function CandidatesPage() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail resume upload state
  const [isDetailUploading, setIsDetailUploading] = useState(false);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", email: "", phone: "" });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm("Are you sure you want to delete this candidate? This will also delete all scheduled interviews and scorecard reports for this candidate.")) return;

    try {
      await candidatesApi.delete(candidateId);
      const data = await candidatesApi.list();
      setCandidates(data);
      if (data.length > 0) {
        setSelectedCandidate(data[0]);
      } else {
        setSelectedCandidate(null);
      }
    } catch (error) {
      console.error("Error deleting candidate:", error);
      alert("Failed to delete candidate.");
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedCandidate) return;
    setEditFormData({
      name: selectedCandidate.name,
      email: selectedCandidate.email,
      phone: selectedCandidate.phone || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !editFormData.name || !editFormData.email) return;

    try {
      setIsUpdating(true);
      const updated = await candidatesApi.update(selectedCandidate.id, {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || "",
      });
      setSelectedCandidate(updated);
      setIsEditModalOpen(false);
      await fetchCandidates();
    } catch (error: any) {
      console.error("Error updating candidate:", error);
      alert(error.detail || "Failed to update candidate.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  async function fetchCandidates() {
    try {
      setLoading(true);
      const data = await candidatesApi.list();
      setCandidates(data);
      if (data.length > 0 && !selectedCandidate) {
        setSelectedCandidate(data[0]);
      } else if (selectedCandidate) {
        const updated = data.find((c) => c.id === selectedCandidate.id);
        if (updated) setSelectedCandidate(updated);
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      setIsSubmitting(true);
      setProgressMsg("Saving candidate details...");

      // 1. Create candidate
      const candidate = await candidatesApi.create({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
      });

      // 2. Upload resume if selected
      if (resumeFile) {
        setProgressMsg("Uploading and parsing PDF resume...");
        const updatedCandidate = await candidatesApi.uploadResume(candidate.id, resumeFile);
        setSelectedCandidate(updatedCandidate);
      } else {
        setSelectedCandidate(candidate);
      }

      // Reset form
      setFormData({ name: "", email: "", phone: "" });
      setResumeFile(null);
      setIsModalOpen(false);
      
      // Re-fetch list
      await fetchCandidates();
    } catch (error: any) {
      console.error("Error adding candidate:", error);
      alert(error.detail || "An error occurred while adding the candidate.");
    } finally {
      setIsSubmitting(false);
      setProgressMsg("");
    }
  };

  const handleDetailResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCandidate || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setIsDetailUploading(true);
      const updatedCandidate = await candidatesApi.uploadResume(selectedCandidate.id, file);
      setSelectedCandidate(updatedCandidate);
      
      // Update candidate in the main list
      setCandidates((prev) =>
        prev.map((c) => (c.id === updatedCandidate.id ? updatedCandidate : c))
      );
    } catch (error: any) {
      console.error("Error uploading resume:", error);
      alert(error.detail || "An error occurred while uploading the resume.");
    } finally {
      setIsDetailUploading(false);
    }
  };

  const filteredCandidates = candidates.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidate Directory</h1>
          <p className="text-muted-foreground mt-1">
            Manage candidates, parse resumes, and view AI extraction outputs.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all duration-200 glow-primary cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          Add Candidate
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Candidates List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidate by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 border-border bg-white/[0.02]"
            />
          </div>

          <Card className="glass border-border overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-foreground">No candidates found</p>
                  <p className="text-xs mt-1">Add a candidate using the button above.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05] max-h-[600px] overflow-y-auto">
                  {filteredCandidates.map((c) => {
                    const isSelected = selectedCandidate?.id === c.id;
                    const hasResume = !!c.parsed_resume;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCandidate(c)}
                        className={`p-4 cursor-pointer transition-all duration-200 flex items-center justify-between ${
                          isSelected
                            ? "bg-primary/10 border-l-4 border-primary"
                            : "hover:bg-white/[0.02] border-l-4 border-transparent"
                        }`}
                      >
                        <div>
                          <h4 className="font-medium text-sm text-foreground">{c.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasResume ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0">
                              Resume Parsed
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[10px] px-1.5 py-0">
                              No Resume
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Candidate Detailed View */}
        <div className="lg:col-span-7">
          {selectedCandidate ? (
            <Card className="glass border-border">
              <CardHeader className="border-b border-white/[0.05] pb-6 flex flex-row items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {selectedCandidate.name}
                  </h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-primary" />
                      {selectedCandidate.email}
                    </span>
                    {selectedCandidate.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-primary" />
                        {selectedCandidate.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Added {new Date(selectedCandidate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".pdf"
                    ref={detailFileInputRef}
                    onChange={handleDetailResumeUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    disabled={isDetailUploading}
                    onClick={() => detailFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 h-9 rounded-lg border-border text-xs cursor-pointer hover:bg-white/5"
                  >
                    {isDetailUploading ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-primary" />
                    ) : (
                      <Upload className="w-4.5 h-4.5" />
                    )}
                    {selectedCandidate.parsed_resume ? "Re-upload Resume" : "Upload PDF Resume"}
                  </Button>
                  
                  {selectedCandidate.resume_file_path && (
                    <a
                      href={getFileUrl(selectedCandidate.resume_file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="flex items-center gap-1.5 h-9 rounded-lg border-border text-xs cursor-pointer hover:bg-white/5 text-emerald-400 hover:text-emerald-300"
                      >
                        <FileText className="w-4.5 h-4.5" />
                        View PDF
                      </Button>
                    </a>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleOpenEditModal}
                    className="flex items-center gap-1.5 h-9 rounded-lg border-border text-xs cursor-pointer hover:bg-white/5 text-sky-400 hover:text-sky-300"
                  >
                    Edit Details
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteCandidate(selectedCandidate.id)}
                    className="flex items-center gap-1.5 h-9 rounded-lg border-border text-xs cursor-pointer hover:bg-white/5 text-red-400 hover:text-red-300"
                  >
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 max-h-[600px] overflow-y-auto">
                {isDetailUploading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">Parsing resume...</p>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                      We are extracting work history, educational achievements, skills, and projects in structured form.
                    </p>
                  </div>
                )}

                {!isDetailUploading && !selectedCandidate.parsed_resume && (
                  <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
                    <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <h4 className="font-semibold text-foreground">No parsed resume data</h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      Upload a PDF resume to extract skills, professional experience, education history, and projects.
                    </p>
                    <Button
                      onClick={() => detailFileInputRef.current?.click()}
                      className="mt-4 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Choose PDF File
                    </Button>
                  </div>
                )}

                {!isDetailUploading && selectedCandidate.parsed_resume && (
                  <div className="space-y-6">
                    {/* Skills Tag Section */}
                    {selectedCandidate.parsed_resume.skills && selectedCandidate.parsed_resume.skills.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          SKILLS ({selectedCandidate.parsed_resume.skills.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedCandidate.parsed_resume.skills.map((skill: string) => (
                            <Badge
                              key={skill}
                              className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all font-medium py-0.5 px-2.5 rounded-md text-xs"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Professional Experience Section */}
                    {selectedCandidate.parsed_resume.experience && selectedCandidate.parsed_resume.experience.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-sky-400" />
                          PROFESSIONAL EXPERIENCE
                        </h3>
                        <div className="space-y-4">
                          {selectedCandidate.parsed_resume.experience.map((exp: any, index: number) => (
                            <div
                              key={index}
                              className="relative pl-4 border-l-2 border-primary/20 hover:border-primary transition-all duration-200"
                            >
                              <div className="flex flex-wrap justify-between items-start gap-1">
                                <h4 className="font-semibold text-foreground text-sm">{exp.role || exp.title}</h4>
                                <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full font-medium">
                                  {exp.period || exp.duration || "N/A"}
                                </span>
                              </div>
                              <p className="text-xs text-primary font-medium mt-0.5">{exp.company || exp.employer}</p>
                              {exp.description && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
                                  {exp.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education Section */}
                    {selectedCandidate.parsed_resume.education && selectedCandidate.parsed_resume.education.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-emerald-400" />
                          EDUCATION
                        </h3>
                        <div className="space-y-4">
                          {selectedCandidate.parsed_resume.education.map((edu: any, index: number) => (
                            <div key={index} className="pl-4 border-l-2 border-emerald-500/20">
                              <div className="flex justify-between items-start">
                                <h4 className="font-semibold text-foreground text-sm">{edu.degree}</h4>
                                <span className="text-xs text-muted-foreground font-medium">{edu.year || edu.period}</span>
                              </div>
                              <p className="text-xs text-emerald-400 font-medium mt-0.5">{edu.school || edu.institution}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Projects Section */}
                    {selectedCandidate.parsed_resume.projects && selectedCandidate.parsed_resume.projects.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-400" />
                          PROJECTS
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedCandidate.parsed_resume.projects.map((proj: any, index: number) => (
                            <div key={index} className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] transition-all">
                              <h4 className="font-semibold text-sm text-foreground flex items-center justify-between">
                                {proj.name || proj.title}
                              </h4>
                              {proj.description && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                  {proj.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Certifications Section */}
                    {selectedCandidate.parsed_resume.certifications && selectedCandidate.parsed_resume.certifications.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-sm font-semibold text-muted-foreground">CERTIFICATIONS</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedCandidate.parsed_resume.certifications.map((cert: string) => (
                            <Badge
                              key={cert}
                              className="bg-zinc-500/10 text-zinc-300 border border-zinc-500/20 py-0.5 px-2.5 text-xs font-medium"
                            >
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-20 text-muted-foreground border border-dashed border-white/[0.08] rounded-2xl glass">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p>Add and select a candidate to view resume profile.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <h3 className="text-lg font-bold text-foreground">Add New Candidate</h3>
              <button
                onClick={() => {
                  if (!isSubmitting) {
                    setIsModalOpen(false);
                    setResumeFile(null);
                  }
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCandidate} className="p-6 space-y-4">
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground text-center">
                    {progressMsg}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-xs font-semibold text-muted-foreground">
                      Full Name *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      required
                      placeholder="Jane Doe"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                      Email Address *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="jane.doe@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">
                      Phone Number
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="+1 (555) 019-2834"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Resume (PDF format only)</span>
                      {resumeFile && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </label>
                    
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed border-white/[0.12] rounded-xl p-6 text-center hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        resumeFile ? "border-emerald-500/30" : "hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Upload className={`w-8 h-8 mx-auto mb-2 ${resumeFile ? "text-emerald-400" : "text-muted-foreground/50"}`} />
                      {resumeFile ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground truncate max-w-[280px] mx-auto">
                            {resumeFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Click to change
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-foreground">Click to select PDF resume</p>
                           <p className="text-xs text-muted-foreground mt-0.5">PDF limit 10MB • Auto-parsed</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsModalOpen(false);
                        setResumeFile(null);
                      }}
                      className="rounded-lg border-border cursor-pointer hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-primary text-primary-foreground font-semibold hover:opacity-90 transition rounded-lg px-5 py-2 cursor-pointer"
                    >
                      Create Candidate
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl glass border border-white/[0.1] shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <h3 className="text-lg font-bold text-foreground">Edit Candidate Details</h3>
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
            <form onSubmit={handleUpdateCandidate} className="p-6 space-y-4">
              {isUpdating ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground text-center">
                    Updating candidate details...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="edit_name" className="text-xs font-semibold text-muted-foreground">
                      Full Name *
                    </label>
                    <Input
                      id="edit_name"
                      name="name"
                      required
                      placeholder="Jane Doe"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit_email" className="text-xs font-semibold text-muted-foreground">
                      Email Address *
                    </label>
                    <Input
                      id="edit_email"
                      name="email"
                      type="email"
                      required
                      placeholder="jane.doe@example.com"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="border-border bg-white/[0.01]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit_phone" className="text-xs font-semibold text-muted-foreground">
                      Phone Number
                    </label>
                    <Input
                      id="edit_phone"
                      name="phone"
                      placeholder="+1 (555) 019-2834"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="border-border bg-white/[0.01]"
                    />
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
