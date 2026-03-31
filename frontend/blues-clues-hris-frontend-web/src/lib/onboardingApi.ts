import { API_BASE_URL } from './api';
import { getAccessToken } from './authStorage';
import type { OnboardingSession, OnboardingSessionSummary, OnboardingTemplate, ProfileData, TemplateItem } from '@/types/onboarding.types';

function headers() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
  };
}

// ---- Employee endpoints ----

export async function getMySession(): Promise<OnboardingSession | null> {
  const res = await fetch(`${API_BASE_URL}/onboarding/applicant/session`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch onboarding session');
  return res.json();
}

export async function uploadDocument(onboardingItemId: string, file: File, isProofOfReceipt = false): Promise<any> {
  const formData = new FormData();
  formData.append('onboardingItemId', onboardingItemId);
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE_URL}/onboarding/applicant/upload-document?isProofOfReceipt=${isProofOfReceipt}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: formData,
    },
  );
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function confirmTask(onboardingItemId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/applicant/items/${onboardingItemId}/confirm`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to confirm task');
  return res.json();
}

export async function saveProfile(sessionId: string, profile: Omit<ProfileData, 'profile_id' | 'session_id' | 'status'>): Promise<ProfileData> {
  const res = await fetch(`${API_BASE_URL}/onboarding/applicant/session/${sessionId}/profile`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to save profile');
  return res.json();
}

export async function submitForReview(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/applicant/session/${sessionId}/submit`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to submit');
  return res.json();
}

export async function requestEquipment(onboardingItemId: string, is_requested: boolean, delivery_method: 'office' | 'delivery', delivery_address?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/applicant/items/${onboardingItemId}/request-equipment`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ is_requested, delivery_method, delivery_address }),
  });
  if (!res.ok) throw new Error('Failed to submit equipment request');
  return res.json();
}

// ---- HR endpoints ----

export async function getAllSessions(): Promise<OnboardingSessionSummary[]> {
  const res = await fetch(`${API_BASE_URL}/onboarding/hr/sessions`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function getSessionById(sessionId: string): Promise<OnboardingSession> {
  const res = await fetch(`${API_BASE_URL}/onboarding/hr/sessions/${sessionId}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export async function updateItemStatus(onboardingItemId: string, status: string, remarks?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/hr/items/${onboardingItemId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status, remarks }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function addRemark(session_id: string, tab_tag: string, remark_text: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/hr/remarks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ session_id, tab_tag, remark_text }),
  });
  if (!res.ok) throw new Error('Failed to add remark');
  return res.json();
}

export async function approveSession(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/hr/sessions/${sessionId}/approve`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to approve');
  return res.json();
}

// ---- Admin endpoints ----

export async function getAllTemplates(): Promise<OnboardingTemplate[]> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/templates`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function createTemplate(template: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/templates`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
}

export async function assignTemplate(assignment: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/assign`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(assignment),
  });
  if (!res.ok) throw new Error('Failed to assign template');
  return res.json();
}

export async function getAllPositions(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/positions`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch positions');
  return res.json();
}

export async function createPosition(department_id: string, position_name: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/positions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ department_id, position_name }),
  });
  if (!res.ok) throw new Error('Failed to create position');
  return res.json();
}

export async function addTemplateItem(templateId: string, item: { type: string; tab_category: string; title: string; description?: string; is_required: boolean }): Promise<TemplateItem> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/templates/${templateId}/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('Failed to add template item');
  return res.json();
}

export async function updateTemplateItem(itemId: string, updates: { title?: string; description?: string; is_required?: boolean }): Promise<TemplateItem> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/template-items/${itemId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update template item');
  return res.json();
}

export async function getDepartments(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/onboarding/system-admin/departments`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch departments');
  return res.json();
}
