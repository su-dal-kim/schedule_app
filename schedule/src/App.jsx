import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, AlertCircle, RotateCcw, Trash2, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- palette / tokens ----------
const C = {
  paper: "#FBFAF5",
  ink: "#20241D",
  inkSoft: "#5C6355",
  line: "#DAD6C6",
  card: "#FFFFFF",
  moss: "#3F5B45",
  holiday: "#EFECE2",
  danger: "#A3432F",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
    .sn-serif { font-family: 'Fraunces', serif; font-feature-settings: 'ss01'; }
    .sn-sans { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `}</style>
);

function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

const DAY_START = 6 * 60;
const DAY_END = 26 * 60;
function pct(mins) {
  if (mins == null) return null;
  let m = mins;
  if (m < DAY_START) m += 24 * 60;
  const clamped = Math.min(Math.max(m, DAY_START), DAY_END);
  return ((clamped - DAY_START) / (DAY_END - DAY_START)) * 100;
}

function DayBar({ checkIn, checkOut }) {
  const s = toMinutes(checkIn);
  const e = toMinutes(checkOut);
  if (s == null || e == null) return null;
  let left = pct(s);
  let right = pct(e);
  if (right < left) right = 100;
  const width = Math.max(right - left, 2);
  return (
    <div style={{ position: "relative", height: 6, background: "#EEEBDF", borderRadius: 4, marginTop: 10 }}>
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          width: `${width}%`,
          top: 0,
          bottom: 0,
          background: C.moss,
          borderRadius: 4,
        }}
      />
    </div>
  );
}

function DayRow({ day }) {
  const isHoliday = !!day.holiday || (!day.checkIn && !day.checkOut);
  return (
    <div style={{ display: "flex", gap: 16, padding: "16px 4px", borderBottom: `1px solid ${C.line}`, alignItems: "center" }}>
      <div style={{ width: 52, flexShrink: 0 }}>
        <div className="sn-sans" style={{ fontSize: 11, color: C.inkSoft }}>{day.date}</div>
        <div className="sn-serif" style={{ fontSize: 18, color: C.ink }}>{day.dayOfWeek}</div>
      </div>

      {isHoliday ? (
        <div style={{ flex: 1, background: C.holiday, borderRadius: 8, padding: "10px 14px", color: C.inkSoft }} className="sn-sans">
          {day.holidayLabel || "정규휴일"}
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div className="sn-sans" style={{ fontSize: 15, color: C.ink, fontWeight: 600 }}>
              {day.checkIn || "--:--"} <span style={{ color: C.inkSoft, fontWeight: 400 }}>→</span> {day.checkOut || "--:--"}
            </div>
            <div className="sn-sans" style={{ fontSize: 11.5, color: day.status && day.status !== "정상" ? C.danger : C.moss, whiteSpace: "nowrap" }}>
              {day.status || "정상"}
            </div>
          </div>
          <DayBar checkIn={day.checkIn} checkOut={day.checkOut} />
        </div>
      )}
    </div>
  );
}

// 파일의 실제 바이트를 읽어 진짜 이미지 형식을 판별 (브라우저가 보고하는 타입에 의존하지 않음)
function fileToBase64AndType(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bytes = new Uint8Array(reader.result);
        let mediaType = "image/png";
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          mediaType = "image/jpeg";
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
          mediaType = "image/png";
        } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
          mediaType = "image/gif";
        } else if (
          bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        ) {
          mediaType = "image/webp";
        }
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        resolve({ base64: btoa(binary), mediaType });
      } catch (err) {
        reject(new Error("이미지를 처리하지 못했어요. 다른 사진으로 시도해줄래요?"));
      }
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했어요. 다른 사진으로 시도해줄래요?"));
    reader.readAsArrayBuffer(file);
  });
}

const weekStartValue = (label) => {
  const match = (label || "").match(/(\d{1,2})[.\/](\d{1,2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
};
const sortHistory = (arr) => [...arr].sort((a, b) => weekStartValue(b.label) - weekStartValue(a.label));

export default function App() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]); // [{key, label, data}]
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from("schedules")
          .select("key,label,data,created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (rows) setHistory(sortHistory(rows));
      } catch (e) {
        setSaveError(`저장된 주차를 불러오지 못했어요. Supabase 설정을 확인해주세요. (${e.message || e})`);
      }
    })();
  }, []);

  const goToUpload = () => {
    setStatus("idle");
    setErrorMsg("");
    setSaveError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelUpload = () => {
    setStatus(data ? "done" : "idle");
    setErrorMsg("");
    setSaveError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setErrorMsg("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    setSaveError("");
    try {
      let base64, mediaType;
      try {
        const res = await fileToBase64AndType(file);
        base64 = res.base64;
        mediaType = res.mediaType;
      } catch (stepErr) {
        throw new Error(`[이미지 처리] ${stepErr.message || stepErr}`);
      }

      let apiRes;
      try {
        apiRes = await fetch("/api/parse-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType }),
        });
      } catch (netErr) {
        throw new Error(`[네트워크] ${netErr.message || netErr}`);
      }

      const body = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        throw new Error(`[분석 서버] ${body.error || apiRes.status}`);
      }
      const parsed = body.data;
      if (!parsed) throw new Error("[분석 서버] 응답에 데이터가 없어요.");

      const label = (parsed.weekRange || `week-${Date.now()}`).toString();
      const safeKey = label.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `week-${Date.now()}`;

      const { error: saveErr } = await supabase
        .from("schedules")
        .upsert({ key: safeKey, label, data: parsed }, { onConflict: "key" })
        .select("key,label,data")
        .single();
      if (saveErr) {
        throw new Error(`주차 데이터 저장에 실패했어요. Supabase의 schedules 테이블과 정책을 확인해주세요. (${saveErr.message})`);
      }

      // 서버 저장이 성공한 뒤에만 화면 목록을 갱신합니다.
      setData(parsed);
      setStatus("done");
      setHistory((prev) => sortHistory([...prev.filter((item) => item.key !== safeKey), { key: safeKey, label, data: parsed }]));
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "알 수 없는 오류가 발생했어요.");
    }
  };

  const openFromHistory = (key) => {
    const found = history.find((item) => item.key === key);
    if (found) {
      setData(found.data);
      setStatus("done");
    }
  };

  const deleteFromHistory = async (key, ev) => {
    ev.stopPropagation();
    setHistory((prev) => prev.filter((item) => item.key !== key));
    try {
      const { error } = await supabase.from("schedules").delete().eq("key", key);
      if (error) throw error;
    } catch (e) {
      console.error("삭제 실패:", e.message || e);
    }
  };

  return (
    <div className="sn-sans" style={{ background: C.paper, minHeight: "100vh", padding: "28px 16px 60px", color: C.ink }}>
      {FONTS}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div className="sn-serif" style={{ fontSize: 28, color: C.ink, letterSpacing: -0.3 }}>근무표 정리</div>
          <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 4 }}>스케줄 화면을 캡처해서 올리면 보기 좋게 정리해드려요</div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />

        {saveError && status !== "error" && (
          <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "#FBF1EC", border: "1px solid #E3C4B4", color: C.danger, fontSize: 12.5, lineHeight: 1.5 }}>
            {saveError}
          </div>
        )}

        {status === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", border: `1.5px dashed ${C.line}`, background: C.card, borderRadius: 14, padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer" }}
            >
              <Upload size={26} color={C.moss} strokeWidth={1.6} />
              <div style={{ fontWeight: 600, fontSize: 15 }}>스케줄 캡처 올리기</div>
              <div style={{ fontSize: 12.5, color: C.inkSoft }}>탭해서 사진을 선택하세요</div>
            </button>
            {data && (
              <button onClick={cancelUpload} style={{ width: "100%", background: "transparent", border: "none", padding: "10px", fontSize: 13.5, color: C.inkSoft, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> 취소하고 돌아가기
              </button>
            )}
          </div>
        )}

        {status === "loading" && (
          <div style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Loader2 size={24} color={C.moss} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 13.5, color: C.inkSoft }}>근무표를 읽고 있어요…</div>
          </div>
        )}

        {status === "error" && (
          <div style={{ width: "100%", background: "#FBF1EC", border: "1px solid #E3C4B4", borderRadius: 14, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={18} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 13.5, color: C.ink }}>{errorMsg}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={goToUpload} style={{ background: C.moss, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <RotateCcw size={14} /> 다시 시도
              </button>
              {data && (
                <button onClick={cancelUpload} style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                  취소
                </button>
              )}
            </div>
          </div>
        )}

        {status === "done" && data && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.inkSoft, fontSize: 13 }}>
                <CalendarDays size={14} /> {data.weekRange || "기간 미확인"}
              </div>
            </div>
            <div style={{ padding: "4px 20px 12px" }}>
              {(data.days || []).map((d, i) => (
                <DayRow key={i} day={d} />
              ))}
            </div>
            <button
              onClick={goToUpload}
              style={{ width: "100%", borderTop: `1px solid ${C.line}`, background: "transparent", padding: "14px", fontSize: 13.5, color: C.moss, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, cursor: "pointer", border: "none" }}
            >
              <Upload size={14} /> 다음 주 스케줄 올리기
            </button>
          </div>
        )}

        {history.length > 0 ? (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>저장된 주 ({history.length}주)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((item) => (
                <div
                  key={item.key}
                  onClick={() => openFromHistory(item.key)}
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 13.5 }}>{item.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Trash2 size={14} color={C.inkSoft} onClick={(ev) => deleteFromHistory(item.key, ev)} />
                    <ChevronRight size={15} color={C.inkSoft} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          status !== "loading" && (
            <div style={{ marginTop: 28, fontSize: 12, color: C.inkSoft, textAlign: "center" }}>
              아직 저장된 주가 없어요. 스케줄을 올리면 여기 목록에 쌓여요.
            </div>
          )
        )}
      </div>
    </div>
  );
}
