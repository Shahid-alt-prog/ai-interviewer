const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol; // "http:" or "https:"
    const hostname = window.location.hostname;
    
    // Cloud workspace port mapping translation (Gitpod, GitHub Codespaces, etc.)
    if (hostname.includes("-3000.")) {
      return `${protocol}//${hostname.replace("-3000.", "-8000.")}/api/v1`;
    }
    if (hostname.includes("3000-")) {
      return `${protocol}//${hostname.replace("3000-", "8000-")}/api/v1`;
    }
    
    // For local development, align with the active protocol (handles secure context loopbacks)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000/api/v1`;
    }
  }
  return "http://127.0.0.1:8000/api/v1";
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getApiBaseUrl();

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  ignore404?: boolean;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = "ApiError";
  }
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T | null> {
  const { method = "GET", body, headers = {}, ignore404 = false } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    if (ignore404 && response.status === 404) {
      return null as unknown as T;
    }
    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, errorData.detail || "Request failed");
  }

  if (response.status === 204) {
    // No content; return undefined for void responses
    return undefined as unknown as T;
  }
  return response.json();
}

// Candidates API
export const candidatesApi = {
  create: (data: { name: string; email: string; phone?: string }) =>
    apiRequest<Candidate>("/candidates/", { method: "POST", body: data }),

  list: (skip = 0, limit = 50) =>
    apiRequest<Candidate[]>(`/candidates/?skip=${skip}&limit=${limit}`),

  get: (id: string, options?: { ignore404?: boolean }) =>
    apiRequest<Candidate>(`/candidates/${id}`, options),

  update: (id: string, data: Partial<{ name: string; email: string; phone: string }>) =>
    apiRequest<Candidate>(`/candidates/${id}`, { method: "PUT", body: data }),

  delete: (id: string) =>
    apiRequest<void>(`/candidates/${id}`, { method: "DELETE" }),

  uploadResume: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/candidates/${id}/resume`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Upload failed" }));
      throw new ApiError(response.status, errorData.detail);
    }
    return response.json() as Promise<Candidate>;
  },
};

// Interviews API
export const interviewsApi = {
  create: (data: {
    candidate_id: string;
    title: string;
    job_description: string;
    interview_type?: string;
    difficulty?: string;
    duration_minutes?: number;
  }) => apiRequest<Interview>("/interviews/", { method: "POST", body: data }),

  list: (skip = 0, limit = 50, status?: string) => {
    let url = `/interviews/?skip=${skip}&limit=${limit}`;
    if (status) url += `&status_filter=${status}`;
    return apiRequest<Interview[]>(url);
  },

  get: (id: string, options?: { ignore404?: boolean }) =>
    apiRequest<InterviewDetail>(`/interviews/${id}`, options),

  update: (id: string, data: Partial<{
    title: string;
    job_description: string;
    interview_type: string;
    difficulty: string;
    duration_minutes: number;
    status: string;
  }>) => apiRequest<InterviewDetail>(`/interviews/${id}`, { method: "PUT", body: data }),

  delete: (id: string) =>
    apiRequest<void>(`/interviews/${id}`, { method: "DELETE" }),

  start: (id: string, interviewerName = "Alex") =>
    apiRequest<InterviewMessage>(
      `/interviews/${id}/start?interviewer_name=${encodeURIComponent(interviewerName)}`,
      { method: "POST" }
    ),

  sendMessage: (id: string, message: string) =>
    apiRequest<InterviewMessage>(`/interviews/${id}/message`, {
      method: "POST",
      body: { message },
    }),

  getReport: (id: string, options?: { ignore404?: boolean }) =>
    apiRequest<Report>(`/interviews/${id}/report`, options),

  updateReport: (id: string, data: Partial<{
    overall_score: number;
    technical_rating: number;
    communication_rating: number;
    problem_solving_rating: number;
    leadership_rating: number;
    domain_expertise_rating: number;
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
    recommendation_reasoning: string;
    summary: string;
  }>) =>
    apiRequest<Report>(`/interviews/${id}/report`, { method: "PUT", body: data }),

  deleteReport: (id: string) =>
    apiRequest<void>(`/interviews/${id}/report`, { method: "DELETE" }),
};

// Types
export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  resume_file_path?: string;
  parsed_resume?: {
    skills: string[];
    experience: Record<string, unknown>[];
    projects: Record<string, unknown>[];
    education: Record<string, unknown>[];
    certifications: string[];
  };
  skills?: string[];
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  title: string;
  interview_type: string;
  difficulty: string;
  status: string;
  duration_minutes: number;
  current_section?: string;
  started_at?: string;
  completed_at?: string;
  metadata_json?: Record<string, any>;
  server_time?: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewDetail extends Interview {
  job_description: string;
  covered_topics?: string[];
  conversation_history?: { role: string; content?: string; text?: string }[];
}

export interface InterviewMessage {
  interview_id: string;
  question_id: string;
  ai_message: string;
  section: string;
  is_follow_up: boolean;
  interview_progress: number;
  is_complete: boolean;
}

export interface Report {
  id: string;
  interview_id: string;
  overall_score: number;
  technical_rating: number;
  communication_rating: number;
  problem_solving_rating: number;
  leadership_rating: number;
  domain_expertise_rating?: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  recommendation_reasoning: string;
  summary: string;
  detailed_feedback?: Record<string, unknown>;
  section_scores?: Record<string, unknown>;
  generated_at: string;
}

export const getFileUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const baseUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${baseUrl}/${path.startsWith("/") ? path.slice(1) : path}`;
};

export { ApiError };
