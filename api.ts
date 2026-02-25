/**
 * 대시보드(아이디어/기술팁) API
 * - 유지보수와 동일 패턴: 토큰 후보 탐색 + 동일 origin
 * - 관리자 판별: role.id 또는 role_id === 6
 */

export type DashboardCategory = "ALL" | "IDEA" | "TIP";

export function getAuthToken(): string | null {
  const keys = [
    "access_token",
    "accessToken",
    "token",
    "auth_token",
    "uplink_token",
    "uplink_access_token",
    "uplinkAccessToken",
    "jwt",
    "ACCESS_TOKEN",
  ];

  const stores: Storage[] = [localStorage, sessionStorage];

  for (const store of stores) {
    for (const k of keys) {
      const v = store.getItem(k);
      if (v && v.trim()) return v.trim();
    }
  }

  const jsonKeys = ["auth", "uplink_auth", "user", "session", "login", "authState"];
  for (const store of stores) {
    for (const k of jsonKeys) {
      const raw = store.getItem(k);
      if (!raw) continue;
      const s = raw.trim();
      if (!s.startsWith("{")) continue;
      try {
        const obj = JSON.parse(s);
        const candidates = [
          obj?.access_token,
          obj?.accessToken,
          obj?.token,
          obj?.auth_token,
          obj?.jwt,
          obj?.data?.access_token,
          obj?.data?.token,
          obj?.user?.access_token,
        ];
        for (const c of candidates) {
          if (typeof c === "string" && c.trim()) return c.trim();
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getAuthToken();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (token) h["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return h;
}

function apiUrl(path: string): string {
  return path; // 동일 origin
}

export type DashboardListItem = {
  id: number;
  category: "IDEA" | "TIP";
  title: string;
  created_at: string;
  created_by_name?: string | null;
  has_attachment?: boolean;
};

export type DashboardDetailOut = {
  id: number;
  category: "IDEA" | "TIP";
  title: string;
  content?: string | null;

  created_by_user_id?: number | null;
  created_by_name?: string | null;

  created_at: string;
  updated_at: string;

  // 첨부파일(1개 고정)
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_download_url?: string | null;
};

function normalizeRoleId(data: any): number | null {
  const v =
    data?.role_id ??
    data?.roleId ??
    data?.role?.id ??
    data?.user?.role_id ??
    data?.user?.role?.id ??
    data?.data?.role_id ??
    data?.data?.role?.id;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return null;
}

export async function fetchIsAdminRoleId6(): Promise<boolean> {
  const candidates = ["/api/auth/me", "/api/me", "/api/users/me", "/api/profile"];
  for (const path of candidates) {
    try {
      const res = await fetch(apiUrl(path), { method: "GET", headers: buildHeaders() });
      if (!res.ok) continue;
      const data = await res.json();
      const roleId = normalizeRoleId(data);
      if (roleId != null) return roleId === 6;
    } catch {
      // ignore
    }
  }
  return false;
}

export async function fetchDashboardPosts(params: {
  category: DashboardCategory;
  q?: string;
}): Promise<DashboardListItem[]> {
  const qs = new URLSearchParams();
  qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);

  const res = await fetch(apiUrl(`/api/dashboard/posts?${qs.toString()}`), {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`목록 조회 실패 (${res.status}) ${txt}`);
  }
  return (await res.json()) as DashboardListItem[];
}

export async function createDashboardPost(payload: {
  category: "IDEA" | "TIP";
  title: string;
  content?: string;
}): Promise<DashboardDetailOut> {
  const res = await fetch(apiUrl(`/api/dashboard/posts`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`신규 등록 실패 (${res.status}) ${txt}`);
  }
  return (await res.json()) as DashboardDetailOut;
}

export async function fetchDashboardPostDetail(postId: number): Promise<DashboardDetailOut> {
  const res = await fetch(apiUrl(`/api/dashboard/posts/${postId}`), {
    method: "GET",
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`상세 조회 실패 (${res.status}) ${txt}`);
  }
  return (await res.json()) as DashboardDetailOut;
}

export async function updateDashboardPost(
  postId: number,
  payload: { category?: "IDEA" | "TIP"; title?: string; content?: string }
): Promise<DashboardDetailOut> {
  const res = await fetch(apiUrl(`/api/dashboard/posts/${postId}`), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`수정 실패 (${res.status}) ${txt}`);
  }
  return (await res.json()) as DashboardDetailOut;
}

export async function deleteDashboardPost(postId: number): Promise<{ ok: boolean }> {
  const res = await fetch(apiUrl(`/api/dashboard/posts/${postId}`), {
    method: "DELETE",
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`삭제 실패 (${res.status}) ${txt}`);
  }
  return (await res.json()) as any;
}

export async function uploadDashboardAttachment(postId: number, file: File): Promise<DashboardDetailOut> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(apiUrl(`/api/dashboard/posts/${postId}/attachment`), {
    method: "POST",
    headers,
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`첨부 업로드 실패 (${res.status}) ${txt}`);
  }

  return (await res.json()) as DashboardDetailOut;
}

export async function downloadByUrl(downloadUrl: string, filename?: string) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  const res = await fetch(apiUrl(downloadUrl), { method: "GET", headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`다운로드 실패 (${res.status}) ${txt}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
