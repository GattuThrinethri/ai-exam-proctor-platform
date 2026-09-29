"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Eye,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
  Camera,
  X,
  ExternalLink,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import {
  examinerApi,
  examsApi,
  proctoringApi,
  ProctoringSession,
  ProctorEvent,
  Exam,
} from "../../../services/api";
import { useLanguage } from "../../../i18n";

export default function ProctoringReviewPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("exam_id") ? parseInt(searchParams.get("exam_id")!, 10) : undefined;

  const [sessions, setSessions] = useState<ProctoringSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(initialExamId);
  const [minSuspicion, setMinSuspicion] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeline Drawer State
  const [selectedSession, setSelectedSession] = useState<ProctoringSession | null>(null);
  const [sessionEvents, setSessionEvents] = useState<ProctorEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [timelineSeverityFilter, setTimelineSeverityFilter] = useState<string>("");

  // Snapshot Viewer Modal
  const [selectedSnapshotUrl, setSelectedSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    examsApi
      .list()
      .then((data) => setExams(data))
      .catch((err) => console.error("Error loading exams for filter:", err));
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await examinerApi.getProctoringSessions({
        exam_id: selectedExamId,
        min_suspicion: minSuspicion,
      });
      setSessions(data);
    } catch (err: any) {
      console.error("Proctoring sessions fetch error:", err);
      setError(err.message || "Failed to load proctoring sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedExamId, minSuspicion]);

  // Load timeline events for a selected session
  const openTimeline = async (session: ProctoringSession) => {
    setSelectedSession(session);
    setEventsLoading(true);
    try {
      const events = await proctoringApi.getEvents(session.session_id);
      setSessionEvents(events);
    } catch (err: any) {
      console.error("Failed to load session proctoring events:", err);
      setSessionEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const getSuspicionColor = (score: number) => {
    if (score < 20) return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    if (score < 50) return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    return "text-rose-300 bg-rose-500/10 border-rose-500/20";
  };

  const getSeverityBadge = (sev: string) => {
    const s = sev.toLowerCase();
    if (s === "high" || s === "critical") {
      return <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-300 rounded border border-rose-500/20 uppercase">High</span>;
    }
    if (s === "medium") {
      return <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 uppercase">Medium</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-medium bg-teal-500/10 text-teal-300 rounded border border-teal-500/20 uppercase">Low</span>;
  };

  const filteredEvents = sessionEvents.filter((ev) => {
    if (!timelineSeverityFilter) return true;
    return (ev.severity || "").toLowerCase() === timelineSeverityFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("nav.proctoringReview")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="p-2 text-slate-300 hover:text-white bg-[#131D33] border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          title={t("common.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#131D33] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>{t("common.filter")}:</span>
        </div>

        <select
          value={selectedExamId || ""}
          onChange={(e) => setSelectedExamId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-teal-500 focus:outline-none max-w-xs"
        >
          <option value="">{t("examiner.totalExams")}</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title} ({ex.subject})
            </option>
          ))}
        </select>

        <select
          value={minSuspicion !== undefined ? minSuspicion.toString() : ""}
          onChange={(e) => setMinSuspicion(e.target.value !== "" ? parseInt(e.target.value, 10) : undefined)}
          className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
        >
          <option value="">Suspicion Score</option>
          <option value="20">Above 20 (Low Flags)</option>
          <option value="40">Above 40 (Medium Flags)</option>
          <option value="60">Above 60 (High Flags)</option>
        </select>

        {(selectedExamId || minSuspicion !== undefined) && (
          <button
            onClick={() => {
              setSelectedExamId(undefined);
              setMinSuspicion(undefined);
            }}
            className="text-xs text-teal-400 hover:text-teal-300 font-medium ml-auto"
          >
            {t("common.clear")}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Proctoring Sessions Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
      ) : sessions.length === 0 ? (
        <div className="bg-[#131D33] p-12 rounded-xl border border-slate-800 text-center text-slate-400 text-sm">
          No proctoring session records found for the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((session) => {
            const suspicionColor = getSuspicionColor(session.suspicion_score);
            return (
              <div
                key={session.session_id}
                className="bg-[#131D33] rounded-2xl border border-slate-800 p-5 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-100 truncate">{session.student_name}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${suspicionColor}`}>
                      Score: {session.suspicion_score}/100
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">{session.exam_title} • {session.subject || "General"}</p>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Tab Switches</span>
                      <span className="font-bold text-slate-100">{session.tab_switch_count || 0} times</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Gaze Deviations</span>
                      <span className="font-bold text-slate-100">{session.gaze_deviation_count || 0} events</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Face Off-Screen</span>
                      <span className="font-bold text-slate-100">{session.face_not_visible_count || 0} events</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Multiple Faces</span>
                      <span className="font-bold text-slate-100">{session.multiple_faces_count || 0} events</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800">
                  <button
                    onClick={() => openTimeline(session)}
                    className="w-full py-2 bg-[#0B132B] border border-slate-700 text-teal-300 hover:bg-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Proctoring Timeline</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Audit Drawer / Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-2xl rounded-2xl shadow-xl border border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B132B]">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">
                  Proctoring Audit Log: {selectedSession.student_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedSession.exam_title}</p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter toolbar inside drawer */}
            <div className="px-6 py-3 border-b border-slate-800 bg-[#131D33] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Filter Severity:</span>
              <div className="flex items-center gap-1.5">
                {["", "high", "medium", "low"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setTimelineSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded-lg capitalize text-xs font-semibold transition-colors ${
                      timelineSeverityFilter === sev
                        ? "bg-teal-500 text-slate-950"
                        : "bg-[#0B132B] text-slate-300 border border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    {sev || "All Events"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {eventsLoading ? (
                <div className="p-8 text-center text-slate-400">{t("common.loading")}</div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No proctoring events recorded for this session.</div>
              ) : (
                filteredEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="p-3 bg-[#0B132B] border border-slate-800 rounded-xl flex items-start justify-between gap-3 text-slate-300"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(ev.severity || "low")}
                        <span className="font-bold text-slate-100">{ev.event_type}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-400">{ev.details || "Automated violation record"}</p>
                    </div>

                    {(ev.snapshot_url || ev.webcam_snapshot_url) && (
                      <button
                        onClick={() => setSelectedSnapshotUrl((ev.snapshot_url || ev.webcam_snapshot_url)!)}
                        className="px-2.5 py-1 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded-lg hover:bg-teal-500/20 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" /> Snapshot
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-[#0B132B] flex justify-end">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Preview Modal */}
      {selectedSnapshotUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] max-w-lg w-full rounded-2xl border border-slate-800 overflow-hidden shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-400" /> Proctoring Webcam Snapshot
              </span>
              <button
                onClick={() => setSelectedSnapshotUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={selectedSnapshotUrl}
              alt="Proctoring snapshot"
              className="w-full max-h-96 object-contain rounded-xl border border-slate-800 bg-[#0B132B]"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedSnapshotUrl(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
