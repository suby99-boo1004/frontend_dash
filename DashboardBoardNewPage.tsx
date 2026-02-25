import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { createDashboardPost, uploadDashboardAttachment } from "./api";

export default function DashboardBoardNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth() as any;

  const createdByLabel = useMemo(() => {
    return user?.name ? `${user.name}` : "-";
  }, [user]);

  const [category, setCategory] = useState<"IDEA" | "TIP">("IDEA");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function onSubmit() {
    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const out = await createDashboardPost({
        category,
        title: title.trim(),
        content: content.trim() || undefined,
      });

      // ✅ 신규 등록 시 첨부 업로드(선택)
      if (selectedFile) {
        try {
          await uploadDashboardAttachment(out.id, selectedFile);
        } catch (e: any) {
          alert(e?.message || String(e));
          // 글은 생성된 상태이므로 상세 이동은 유지
        }
      }

      navigate(`/dashboard/board/${out.id}`);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="hstack" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>대시보드 신규 등록</h2>
        </div>

        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn" onClick={() => navigate(-1)}>
            뒤로
          </button>
          <button className="btn" onClick={onSubmit} disabled={loading} style={{ fontWeight: 800 }}>
            {loading ? "저장중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="vstack" style={{ gap: 10 }}>
          {/* 구분 + 작성자 */}
          <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 140, fontWeight: 800 }}>구분</div>
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

            <div style={{ marginLeft: 12, opacity: 0.85 }}>
              <span style={{ fontWeight: 800 }}>작성자:</span> {createdByLabel}
            </div>
          </div>

          {/* 제목 */}
          <div className="hstack" style={{ gap: 10, alignItems: "center" }}>
            <div style={{ minWidth: 140, fontWeight: 800 }}>제목</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              style={{
                flex: 1,
                height: 36,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
              }}
            />
          </div>

          {/* 첨부파일: 제목 아래 배치 */}
          <div className="hstack" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 140, fontWeight: 800 }}>첨부파일</div>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ maxWidth: 320 }}
            />
            <div className="small" style={{ opacity: 0.7 }}>
              허용: zip/pdf/png/jpg (20MB)
            </div>
          </div>

          {/* 내용: 좌→우 100% */}
          <div className="vstack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 800 }}>내용</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용"
              style={{
                width: "100%",
                minHeight: 320,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
