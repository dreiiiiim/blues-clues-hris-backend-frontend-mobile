// src/lib/authApi.ts
import { API_BASE_URL } from "./api";
import {
  clearAuthStorage,
  getAccessToken,
  writeAccessToken,
  getUserInfo,
} from "./authStorage";

let refreshPromise: Promise<any> | null = null;

export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // receive the HttpOnly refresh_token cookie
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string };
}

export async function applicantRegisterApi(
  body: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone_number?: string;
  },
  companyId?: string,
) {
  const url = companyId
    ? `${API_BASE_URL}/applicants/register?company=${encodeURIComponent(companyId)}`
    : `${API_BASE_URL}/applicants/register`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Registration failed");

  return data as { applicant_id: string; email: string; message: string };
}

export async function applicantLoginApi(body: { email: string; password: string }) {
  const res = await fetch(`${API_BASE_URL}/applicants/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string };
}

// TODO (Sprint 2 - Backend): implement Google OAuth endpoint
// Expected endpoint: POST /api/tribeX/auth/v1/auth/google
//
// Request payload:
// { token: string } — Google ID token from @react-oauth/google credentialResponse.credential
//
// Expected response (same shape as loginApi):
// { access_token: string }
//
// Backend should:
// 1. Verify the Google token via Google's tokeninfo API or googleapis SDK
// 2. Find or create the user record matched by Google email
// 3. Ensure the user has an active staff role (reject applicants)
// 4. Return access_token same as regular login (refresh_token via HttpOnly cookie)
export async function googleLoginApi(googleToken: string) {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: googleToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Google login failed");
  return data as { access_token: string };
}

export async function refreshApi() {
  const res = await fetch(`${API_BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // sends the HttpOnly refresh_token cookie automatically
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Refresh failed");

  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);

  return data as { access_token: string };
}

export async function applicantRefreshApi() {
  const res = await fetch(`${API_BASE_URL}/applicants/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Applicant refresh failed");
  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);
  return data as { access_token: string };
}

export async function applicantResendVerificationApi(email: string) {
  const res = await fetch(`${API_BASE_URL}/applicants/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to resend verification email");
  return data as { message: string };
}

export async function applicantLogoutApi() {
  const access_token = getAccessToken();
  await fetch(`${API_BASE_URL}/applicants/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    credentials: "include",
  }).catch(() => {});
  clearAuthStorage();
}

export async function logoutApi() {
  const access_token = getAccessToken();

  await fetch(`${API_BASE_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    credentials: "include", // sends the HttpOnly refresh_token cookie for server to blacklist
  }).catch(() => {});

  clearAuthStorage();
}

// ---------------------------------------------------------------------------
// Job-related API helpers (applicant-facing)
// ---------------------------------------------------------------------------

export async function getApplicantJobs() {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/open`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch jobs");
  return data as JobPosting[];
}

export async function getJobQuestions(jobPostingId: string): Promise<ApplicationQuestion[]> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobPostingId}/questions`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to fetch questions");
  return data as ApplicationQuestion[];
}

export async function applyToJob(
  jobPostingId: string,
  dto?: {
    answers?: { question_id: string; answer_value?: string }[];
    resume_storage_path?: string;
    resume_file_name?: string;
  },
) {
  const res = await authFetch(`${API_BASE_URL}/jobs/${jobPostingId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to apply");
  return data;
}

export async function uploadApplicantSfiaResume(jobPostingId: string, file: File) {
  const content_base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const res = await authFetch(`${API_BASE_URL}/applicants/sfia-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_posting_id: jobPostingId,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      content_base64,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to upload resume");
  return data as {
    file_name: string;
    storage_path: string;
    signed_url: string;
  };
}

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const res = await authFetch(`${API_BASE_URL}/jobs/applications/${applicationId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch application detail");
  return data as ApplicationDetail;
}

export async function getMyApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications/${applicationId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch application detail");
  return data as ApplicationDetail;
}

export async function getMyApplications() {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch applications");
  return data as MyApplication[];
}

export type JobPosting = {
  job_posting_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
  department_id: string | null;
  company_id: string;
};

export type MyApplication = {
  application_id: string;
  status: string;
  applied_at: string;
  job_posting_id: string;
  job_postings: {
    title: string;
    location: string | null;
    employment_type: string | null;
    status: string;
  };
};

export type ApplicationQuestion = {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

export type ApplicationDetail = {
  application_id: string;
  status: string;
  applied_at: string;
  job_posting_id: string;
  applicant_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    applicant_code: string;
  };
  answers: {
    answer_id: string;
    answer_value: string | null;
    application_questions: {
      question_id: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
      sort_order: number;
    };
  }[];
  resume_upload?: {
    file_name: string;
    storage_path: string;
    signed_url: string;
  } | null;
};

// ---------------------------------------------------------------------------
// Public careers page API helpers (no auth required)
// ---------------------------------------------------------------------------

export type PublicCareersPage = {
  company_id: string;
  company_name: string;
  slug: string;
  jobs: Pick<JobPosting, 'job_posting_id' | 'title' | 'description' | 'location' | 'employment_type' | 'salary_range' | 'posted_at' | 'closes_at'>[];
};

export async function getPublicCareers(slug: string): Promise<PublicCareersPage> {
  const res = await fetch(`${API_BASE_URL}/jobs/public/careers/${encodeURIComponent(slug)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Company not found');
  return data as PublicCareersPage;
}

export async function getMyCompany(): Promise<{ company_id: string; company_name: string; slug: string }> {
  const res = await authFetch(`${API_BASE_URL}/users/company/me`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Failed to fetch company info');
  return data;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const access = getAccessToken();

  // 1) try request with access token
  // credentials: "include" ensures the HttpOnly refresh cookie is forwarded
  const first = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });

  // if not unauthorized, return
  if (first.status !== 401) return first;

  // 2) try refresh then retry (shared promise prevents concurrent refresh race)
  try {
    if (!refreshPromise) {
      const userInfo = getUserInfo();
      const doRefresh = userInfo?.role === "applicant" ? applicantRefreshApi : refreshApi;
      refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    }
    const { access_token } = await refreshPromise;

    const second = await fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${access_token}`,
      },
    });

    return second;
  } catch {
    // refresh failed: session is fully expired — clear storage and send to correct login page
    clearAuthStorage();
    if (typeof globalThis.window !== "undefined") {
      const userInfo = getUserInfo();
      globalThis.location.href = userInfo?.role === "applicant" ? "/applicant/login" : "/login";
    }
    return first;
  }
}
