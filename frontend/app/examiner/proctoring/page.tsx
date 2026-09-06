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

export default function ProctoringReviewPage() {
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
    if (score < 20) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score < 50) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-rose-700 bg-rose-50 border-rose-200";
  };

  const getSeverityBadge = (sev: string) => {
    const s = sev.toLowerCase();
    if (s === "high" || s === "critical") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-300 uppercase">
          {s}
        </span>
      );
    }
    if (s === "medium") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300 uppercase">
          Medium
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-300 uppercase">
        Low
      </span>
    );
  };

  const filteredEvents = sessionEvents.filter((ev) => {
    if (!timelineSeverityFilter) return true;
    return ev.severity.toLowerCase() === timelineSeverityFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proctoring Review</h1>
          <p className="text-sm text-slate-500 mt-1">
            Examine real-time proctoring indicators, visual timelines, and evidence snapshots with neutral telemetry metrics.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Review</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Exam:</span>
          <select
            value={selectedExamId || ""}
            onChange={(e) => setSelectedExamId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
          >
            <option value="">All Proctored Exams</option>
            {exams
              .filter((ex) => ex.proctoring_enabled)
              .map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Min Suspicion:</span>
          <select
            value={minSuspicion ?? ""}
            onChange={(e) => setMinSuspicion(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
          >
            <option value="">Any Score (&gt;= 0)</option>
            <option value="10">&gt;= 10 (Review Recommended)</option>
            <option value="25">&gt;= 25 (Multiple Indicators)</option>
            <option value="50">&gt;= 50 (Elevated Flags)</option>
          </select>
        </div>

        {(selectedExamId || minSuspicion !== undefined) && (
          <button
            onClick={() => {
              setSelectedExamId(undefined);
              setMinSuspicion(undefined);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading proctoring sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Eye className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No proctoring sessions match filter</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Candidate sessions with webcam telemetry, gaze estimation, or tab switches will display here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Exam</th>
                  <th className="py-3.5 px-4">Suspicion Score</th>
                  <th className="py-3.5 px-4">Indicators Logged</th>
                  <th className="py-3.5 px-4">Evidence Snapshot</th>
                  <th className="py-3.5 px-4">Session Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sessions.map((session) => (
                  <tr key={session.session_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{session.student_name}</p>
                      <p className="text-[11px] text-slate-400">{session.student_email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{session.exam_title}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${getSuspicionColor(
                            session.suspicion_score
                          )}`}
                        >
                          {session.suspicion_score} / 100
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{session.event_count} events</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {session.has_evidence_snapshot ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                          <Camera className="w-3 h-3 text-indigo-600" />
                          <span>Available</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap uppercase font-semibold text-[10px] text-slate-600">
                      {session.status}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openTimeline(session)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <span>Review Timeline</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Timeline Drawer Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Proctoring Indicator Timeline</h2>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${getSuspicionColor(
                      selectedSession.suspicion_score
                    )}`}
                  >
                    Suspicion: {selectedSession.suspicion_score}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Candidate: {selectedSession.student_name} ({selectedSession.student_email})
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Severity Filter in Timeline */}
            <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Filter Severity:</span>
              <button
                onClick={() => setTimelineSeverityFilter("")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  timelineSeverityFilter === "" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                All ({sessionEvents.length})
              </button>
              <button
                onClick={() => setTimelineSeverityFilter("high")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  timelineSeverityFilter === "high" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700"
                }`}
              >
                High
              </button>
              <button
                onClick={() => setTimelineSeverityFilter("medium")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  timelineSeverityFilter === "medium" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700"
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => setTimelineSeverityFilter("low")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  timelineSeverityFilter === "low" ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Low
              </button>
            </div>

            {/* Events Timeline Feed */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {eventsLoading ? (
                <div className="p-12 text-center text-slate-400">Loading timeline telemetry...</div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No proctoring events recorded for this criteria.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                  {filteredEvents.map((ev) => {
                    const timeStr = new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    return (
                      <div key={ev.id} className="relative pl-6">
                        {/* Dot */}
                        <div className="absolute -left-2 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-600"></div>

                        {/* Card */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-xs">{timeStr}</span>
                              <span className="px-2 py-0.5 font-bold text-[10px] bg-slate-200 text-slate-800 rounded">
                                {ev.event_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getSeverityBadge(ev.severity)}
                              <span className="text-[10px] font-bold text-rose-600">
                                +{ev.suspicion_increment}
                              </span>
                            </div>
                          </div>

                          {/* Snapshot preview if present */}
                          {ev.webcam_snapshot_url ? (
                            <div className="pt-2 border-t border-slate-200">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                  <Camera className="w-3 h-3 text-indigo-600" />
                                  Evidence Snapshot
                                </span>
                                <button
                                  onClick={() => setSelectedSnapshotUrl(ev.webcam_snapshot_url!)}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                                >
                                  Expand
                                </button>
                              </div>
                              <div
                                onClick={() => setSelectedSnapshotUrl(ev.webcam_snapshot_url!)}
                                className="cursor-pointer border border-slate-200 rounded-lg overflow-hidden max-w-[200px] hover:opacity-90"
                              >
                                <img
                                  src={ev.webcam_snapshot_url}
                                  alt="Proctor evidence"
                                  className="w-full h-28 object-cover bg-slate-100"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">No evidence snapshot available.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Lightbox Modal */}
      {selectedSnapshotUrl && (
        <div
          onClick={() => setSelectedSnapshotUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl border border-slate-800"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-400" />
                Examiner Evidence Viewer
              </span>
              <button
                onClick={() => setSelectedSnapshotUrl(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[300px]">
              <img
                src={selectedSnapshotUrl}
                alt="Enlarged evidence"
                className="max-h-[60vh] max-w-full rounded-lg object-contain shadow"
              />
            </div>
            <div className="p-3 bg-slate-900 text-slate-400 text-[11px] text-center border-t border-slate-800">
              Indicator snapshot preserved for human examiner review. Does not represent automated cheating judgment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
