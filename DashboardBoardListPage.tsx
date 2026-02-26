import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardPosts, DashboardCategory, DashboardListItem, fetchIsAdminRoleId6, deleteDashboardPost } from "./api";


// ✅ 대시보드 상단 고정(Pinned) - 로컬 저장 기반
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

function formatDateK(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function categoryLabel(cat: "IDEA" | "TIP"): string {
  return cat === "IDEA" ? "아이디어" : "기술팁";
}

function categoryBadgeStyle(cat: "IDEA" | "TIP"): React.CSSProperties {
  const isIdea = cat === "IDEA";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,0.10)",
    background: isIdea ? "#E6F3FF" : "#EAFBE7",
    color: isIdea ? "#0B5FA5" : "#1F7A1F",
    whiteSpace: "nowrap",
  };
}

export default function DashboardBoardListPage() {
  const navigate = useNavigate();

  const [category, setCategory] = useState<DashboardCategory>("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DashboardListItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pinVer, setPinVer] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await fetchIsAdminRoleId6();
        if (!alive) return;
        setIsAdmin(v);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
  const bump = () => setPinVer((v) => v + 1);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DASHBOARD_PINNED_KEY) bump();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", bump);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", bump);
  };
}, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const t = window.setTimeout(async () => {
      try {
        const data = await fetchDashboardPosts({ category, q: q.trim() || undefined });
        if (!alive) return;
        setItems(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [category, q]);

  const filteredHint = useMemo(() => {
    if (category === "IDEA") return "아이디어만 표시 중";
    if (category === "TIP") return "기술팁만 표시 중";
    return "전체 표시 중";
  }, [category]);


const sortedItems = useMemo(() => {
  const pinnedSet = _readPinnedSet();
  // 기존 정렬을 최대한 유지하면서 pinned만 상단으로
  return [...items].sort((a, b) => {
    const ap = pinnedSet.has(a.id) ? 1 : 0;
    const bp = pinnedSet.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    // created_at 기준 최근순(기존 서비스 정렬과 동일하게 유지 목적)
    const at = new Date(a.created_at).getTime();
    const bt = new Date(b.created_at).getTime();
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
    return b.id - a.id;
  });
}, [items, pinVer]);

  async function onDelete(postId: number) {
    if (!isAdmin) return;
    const ok = window.confirm("삭제하시겠습니까?");
    if (!ok) return;

    try {
      await deleteDashboardPost(postId);
      setItems((prev) => prev.filter((x) => x.id !== postId));
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="hstack" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>대시보드(아이디어/기술팁)</h2>
          <div className="small" style={{ opacity: 0.75 }}>
            {filteredHint} · 아이디어/기술팁을 기록하고 공유합니다.
          </div>
        </div>
      </div>

      {/* 상단: 필터(전체/아이디어/기술팁) - 검색 - + 신규등록 */}
      <div className="card" style={{ padding: 12 }}>
        <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DashboardCategory)}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              fontWeight: 700,
            }}
          >
            <option value="ALL">전체</option>
            <option value="IDEA">아이디어</option>
            <option value="TIP">기술팁</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='검색(제목/내용/작성자)'
            style={{
              flex: 1,
              minWidth: 220,
              height: 36,
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
            }}
          />

          <button
            className="btn"
            onClick={() => navigate("/dashboard/board/new")}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 10,
			  background: "linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontWeight: 950,
              
            }}
          >
            + 신규등록
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 12, border: "1px solid rgba(239,68,68,0.35)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>오류</div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        </div>
      )}

      {/* 리스트 */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.04)" }}>
                <th style={{ padding: "10px 12px", color: "#000000" , backgroundColor: "#8ec7fa" }}>구분</th>
                <th style={{ padding: "10px 20px", color: "#000000" , backgroundColor: "#8ec7fa" }}>제목</th>
                <th style={{ padding: "10px 25px", color: "#000000" , backgroundColor: "#8ec7fa" }}>등록일</th>
                <th style={{ padding: "10px 20px", color: "#000000" , backgroundColor: "#8ec7fa" }}>등록자</th>
                <th style={{ color: "#000000" , backgroundColor: "#8ec7fa", textAlign: "center" }}>첨부</th>
                {isAdmin && <th style={{ color: "#000000" , backgroundColor: "#8ec7fa", padding: "10px 12px", width: 90, textAlign: "center" }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ padding: 16 }}>
                    로딩중...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ padding: 16, opacity: 0.8 }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedItems.map((it) => (
                  <tr
                    key={it.id}
                    onClick={() => navigate(`/dashboard/board/${it.id}`)}
                    style={{
                      cursor: "pointer",
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      {_isPinned(it.id) && (
                        <span title="상단 고정" style={{ marginRight: 8 }}>📌</span>
                      )}
                      <span style={categoryBadgeStyle(it.category)}><span style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: it.category === "IDEA" ? "#0B5FA5" : "#1F7A1F" }} /><span>{categoryLabel(it.category)}</span></span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 800 }}>{it.title}</td>
                    <td style={{ padding: "10px 12px" }}>{formatDateK(it.created_at)}</td>
                    <td style={{ padding: "10px 12px" }}>{it.created_by_name || "-"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {it.has_attachment ? "●" : "-"}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button
                          className="btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(it.id);
                          }}
                          style={{
                            height: 30,
                            padding: "0 10px",
                            borderRadius: 10,
                            fontWeight: 800,
                          }}
                        >
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
