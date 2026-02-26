import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  fetchDashboardPostDetail,
  DashboardDetailOut,
  downloadByUrl,
  uploadDashboardAttachment,
  updateDashboardPost,
} from "./api";


// ✅ 대시보드 상단 고정(Pinned) - 로컬 저장(다른 기능 영향 없이 UI/정렬만 제어)
const DASHBOARD_PINNED_KEY = "uplink.dashboard.pinned_post_ids.v1";
function _readPinnedSet(): Set<number> {
  try {
    const raw = localStorage.getItem(DASHBOARD_PINNED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0));
  } catch {
    return new Set();
  }
}
function _isPinned(id: number): boolean {
  return _readPinnedSet().has(id);
}
function _setPinned(id: number, pinned: boolean) {
  const s = _readPinnedSet();
  if (pinned) s.add(id);
  else s.delete(id);
  localStorage.setItem(DASHBOARD_PINNED_KEY, JSON.stringify(Array.from(s)));
}

function formatDateTimeK(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function categoryLabel(cat: "IDEA" | "TIP"): string {
  return cat === "IDEA" ? "아이디어" : "기술팁";
}

function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DashboardBoardDetailPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const { user } = useAuth() as any;

  const id = useMemo(() => Number(postId), [postId]);
  const [data, setData] = useState<DashboardDetailOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


// ✅ 상단 고정 상태
const [isPinned, setIsPinned] = useState(false);

  // edit fields (간단 수정만)
  const [editMode, setEditMode] = useState(false);
  const [category, setCategory] = useState<"IDEA" | "TIP">("IDEA");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const out = await fetchDashboardPostDetail(id);
        if (!alive) return;
        setData(out);
        setCategory(out.category);
        setTitle(out.title || "");
        setContent(out.content || "");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);


useEffect(() => {
  if (!Number.isFinite(id) || id <= 0) return;
  setIsPinned(_isPinned(id));
}, [id]);

  const createdByLabel = useMemo(() => {
    return data?.created_by_name || "-";
  }, [data]);

  async function onUpload() {
    if (!data) return;
    if (!file) {
      alert("업로드할 파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    try {
      const out = await uploadDashboardAttachment(data.id, file);
      setData(out);
      setFile(null);
      alert("첨부 업로드 완료");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  function onSaveEdit() {
    if (!data) return;
    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }

    (async () => {
      try {
        setUploading(true);

        // 1) 본문 저장
        await updateDashboardPost(data.id, {
          category,
          title: title.trim(),
          content: content.trim(),
        });

        // 2) 첨부 교체(선택) - 수정 모드에서만 file이 세팅됨
        if (file) {
          await uploadDashboardAttachment(data.id, file);
          setFile(null);
        }

        // 3) 저장 직후 화면 동기화(리스트 갔다 오는 효과)
        const refreshed = await fetchDashboardPostDetail(data.id);
        setData(refreshed);
        setCategory(refreshed.category);
        setTitle(refreshed.title || "");
        setContent(refreshed.content || "");

        setEditMode(false);
        alert("저장 완료");
      } catch (e: any) {
        alert(e?.message || String(e));
      } finally {
        setUploading(false);
      }
    })();
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="card" style={{ padding: 12 }}>
        잘못된 접근입니다.
      </div>
    );
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="hstack" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>대시보드 상세</h2>
</div>

        <div className="hstack" style={{ gap: 8 }}>

<label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", height: 32, fontWeight: 900 }}>
  <input
    type="checkbox"
    checked={isPinned}
    onChange={(e) => {
      const next = e.target.checked;
      setIsPinned(next);
      _setPinned(id, next);
      alert(next ? "상단 고정되었습니다." : "상단 고정이 해제되었습니다.");
    }}
  />
  상단 고정
</label>
          <button className="btn" onClick={() => navigate(-1)}>
            뒤로
          </button>

          {!editMode ? (
            <button className="btn" onClick={() => setEditMode(true)} disabled={!data}>
              수정
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => setEditMode(false)}>
                취소
              </button>
              <button className="btn" onClick={onSaveEdit} style={{ fontWeight: 800 }}>
                저장
              </button>
            </>
          )}
        </div>
      </div>

      {loading && <div className="card" style={{ padding: 12 }}>로딩중...</div>}

      {error && (
        <div className="card" style={{ padding: 12, border: "1px solid rgba(239,68,68,0.35)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>오류</div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* 1그룹: 등록일/수정일, 구분/등록자, 제목 */}
          <div className="card" style={{ padding: 12 }}>
            <div className="vstack" style={{ gap: 10 }}>
              {/* 1) 등록일 - 수정일 */}
              <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 140, fontWeight: 800 }}>등록일</div>
                <div style={{ fontWeight: 800 }}>{formatDateTimeK(data.created_at)}</div>
                <div style={{ minWidth: 80 }} />
                <div style={{ minWidth: 80, fontWeight: 800 }}>수정일</div>
                <div style={{ fontWeight: 800 }}>{formatDateTimeK(data.updated_at || data.created_at)}</div>
              </div>

              {/* 2) 구분 - 등록자 */}
              <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 140, fontWeight: 800 }}>구분</div>
                {editMode ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{
                      height: 36,
                      padding: "0 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      fontWeight: 800,
                    }}
                  >
                    <option value="IDEA">아이디어</option>
                    <option value="TIP">기술팁</option>
                  </select>
                ) : (
                  <div style={{ fontWeight: 800 }}>{categoryLabel(data.category)}</div>
                )}

                <div style={{ marginLeft: 12, opacity: 0.85 }}>
                  <span style={{ fontWeight: 800 }}>등록자:</span> {createdByLabel}
                </div>
              </div>

              {/* 3) 제목 */}
              <div className="hstack" style={{ gap: 10, alignItems: "center" }}>
                <div style={{ minWidth: 140, fontWeight: 800 }}>제목</div>
                {editMode ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      flex: 1,
                      height: 36,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                    }}
                  />
                ) : (
                  <div style={{ fontWeight: 800 }}>{data.title}</div>
                )}
              </div>
            </div>
          </div>

          {/* 2그룹: 첨부파일 표시 */}
          <div className="card" style={{ padding: 12 }}>
            <div className="vstack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 800 }}>첨부파일</div>

              {data.attachment_name ? (
                <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    onClick={() => downloadByUrl(data.attachment_download_url, data.attachment_name)}
                    style={{ height: 32, padding: "0 12px", borderRadius: 10, fontWeight: 800 }}
                  >
                    다운로드
                  </button>
                  <div style={{ fontWeight: 800 }}>{data.attachment_name}</div>
                  <div className="small" style={{ opacity: 0.75 }}>
                    ({formatBytes(data.attachment_size)})
                  </div>
                </div>
              ) : (
                <div className="small" style={{ opacity: 0.75 }}>첨부파일 없음</div>
              )}

              {/* 수정 모드에서만 파일 교체 */}
              {editMode && (
                <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 140, fontWeight: 800 }}>파일 교체</div>
                  <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={uploading} />
                  <div className="small" style={{ opacity: 0.75 }}>
                    {file ? `선택됨: ${file.name}` : "파일을 선택하면 저장 시 교체됩니다."}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3그룹: 내용 */}
          <div className="card" style={{ padding: 12 }}>
            <div className="vstack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 800 }}>내용</div>
              {editMode ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 320,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    resize: "vertical",
                  }}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{data.content || "-"}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
