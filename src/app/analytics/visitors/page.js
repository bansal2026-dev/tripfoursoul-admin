"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Pagination from "@/components/Pagination";
import {
  ArrowLeft,
  Search,
  Download,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Clock,
  ExternalLink,
  RefreshCw,
  X,
  MapPin,
  Compass,
  MousePointerClick,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

export default function AllVisitorsPage() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("");
  const [range, setRange] = useState("all");

  // Selected session for journey detail modal
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchVisitors = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: targetPage.toString(),
        limit: limit.toString(),
        range,
        ...(device ? { device } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/analytics/visitors?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setVisitors(json.visitors || []);
          setTotal(json.pagination.total || 0);
          setTotalPages(json.pagination.totalPages || 1);
          setPage(json.pagination.page || targetPage);
        }
      }
    } catch (err) {
      console.error("Failed to load visitors:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, range, device, search]);

  useEffect(() => {
    fetchVisitors(1);
  }, [range, device, limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchVisitors(1);
  };

  const handlePageChange = (newPage) => {
    fetchVisitors(newPage);
  };

  const openSessionDetail = async (sessionId) => {
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/analytics/visitors?session_id=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const json = await res.json();
        setSessionDetail(json);
      }
    } catch (err) {
      console.error("Failed to load session detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (secs) => {
    if (!secs || secs < 1) return "0s";
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${rem}s`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getDeviceIcon = (type) => {
    const t = String(type || "").toLowerCase();
    if (t === "mobile") return <Smartphone className="w-4 h-4 text-emerald-600" />;
    if (t === "tablet") return <Tablet className="w-4 h-4 text-blue-600" />;
    return <Monitor className="w-4 h-4 text-slate-700" />;
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!visitors.length) return;
    const headers = ["Visitor ID", "Country", "City", "Device", "OS", "Browser", "Landed Page", "Last Page", "Total Pages", "Duration (s)", "Referrer", "Timestamp"];
    const rows = visitors.map(v => [
      `"${v.visitor_id || ''}"`,
      `"${v.country || ''}"`,
      `"${v.city || ''}"`,
      `"${v.device_type || ''}"`,
      `"${v.os || ''}"`,
      `"${v.browser || ''}"`,
      `"${v.first_page || ''}"`,
      `"${v.last_page || ''}"`,
      v.total_pages || 1,
      v.duration_seconds || 0,
      `"${v.referrer_domain || 'Direct'}"`,
      `"${formatDate(v.created_at)}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tripforsoul_visitors_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#24564c] hover:underline mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analytics Overview
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Visitors & Activity Logs</h1>
              <p className="text-gray-500 text-sm mt-1">
                Complete paginated list of visitors, IP addresses, locations, and user sessions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={visitors.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => fetchVisitors(page)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#24564c] text-white hover:bg-[#173f38] shadow-sm transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search IP, City, Page URL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#24564c]/20 focus:border-[#24564c]"
              />
            </form>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {/* Date Filter */}
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#24564c]/20"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>

              {/* Device Filter */}
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#24564c]/20"
              >
                <option value="">All Devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>

              {/* Per Page */}
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#24564c]/20"
              >
                <option value={15}>15 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Visitors Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Visitor & IP</th>
                  <th className="py-3.5 px-4">Visitor ID</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Device & Browser</th>
                  <th className="py-3.5 px-4">Landed Page / Views</th>
                  <th className="py-3.5 px-4">Referrer</th>
                  <th className="py-3.5 px-4">Time Spent</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#24564c]" />
                      Loading visitor logs...
                    </td>
                  </tr>
                ) : visitors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                      No visitor records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  visitors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-800" title={v.visitor_id}>
                            {v.visitor_id ? `${v.visitor_id.substring(0, 12)}...` : `Visitor #${v.id}`}
                          </span>
                          {v.visitor_id && (
                            <button
                              onClick={() => copyToClipboard(v.visitor_id, `vis_${v.id}`)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy Visitor ID"
                            >
                              {copiedId === `vis_${v.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={v.session_id}>
                          Session: {v.session_id ? v.session_id.substring(0, 10) + "..." : "-"}
                        </div>
                        <div className="mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                            v.cookie_consent === 'accepted'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.cookie_consent === 'essential_only'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {v.cookie_consent === 'accepted' ? 'Cookies: Accepted' : v.cookie_consent === 'essential_only' ? 'Cookies: Essential Only' : 'Cookies: Essential'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>
                            {v.city ? `${v.city}, ` : ""}
                            {v.country || "Unknown"}
                          </span>
                        </div>
                        {v.region && <div className="text-[11px] text-slate-400 ml-4">{v.region}</div>}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          {getDeviceIcon(v.device_type)}
                          <span className="capitalize">{v.device_type}</span>
                          <span className="text-slate-300">·</span>
                          <span>{v.browser}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {v.os} {v.screen_resolution ? `(${v.screen_resolution})` : ""}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs text-[#24564c] font-medium truncate max-w-[150px]" title={v.first_page}>
                          {v.first_page || "/"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {v.total_pages || 1} {v.total_pages === 1 ? "page" : "pages"} viewed
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span className="font-medium">{v.referrer_domain || "Direct"}</span>
                        {v.utm_source && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            utm: {v.utm_source}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {formatDuration(v.duration_seconds)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(v.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openSessionDetail(v.session_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-[#24564c] hover:text-white text-slate-700 transition"
                        >
                          Journey
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Proper Pagination Component */}
          {total > 0 && (
            <div className="p-4 border-t border-slate-100 bg-white">
              <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {/* Modal: Full Visitor Journey & Session Timeline */}
        {selectedSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#24564c]" />
                    Visitor Session Journey
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    Session ID: {selectedSessionId}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedSessionId(null); setSessionDetail(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {detailLoading ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#24564c]" />
                    Loading visitor journey...
                  </div>
                ) : sessionDetail ? (
                  <>
                    {/* Visitor Specs Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">IP Address</span>
                        <span className="font-mono font-bold text-slate-800">{sessionDetail.session?.ip_address}</span>
                        <span className="text-slate-400 block font-medium">Visitor ID</span>
                        <span className="font-mono font-bold text-slate-800 truncate block" title={sessionDetail.session?.visitor_id}>
                          {sessionDetail.session?.visitor_id ? `${sessionDetail.session?.visitor_id.substring(0, 14)}...` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Location</span>
                        <span className="font-semibold text-slate-800">{sessionDetail.session?.city ? `${sessionDetail.session?.city}, ` : ''}{sessionDetail.session?.country}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Device</span>
                        <span className="font-semibold text-slate-800 capitalize">{sessionDetail.session?.device_type} · {sessionDetail.session?.browser}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Total Duration</span>
                        <span className="font-semibold text-emerald-700">{formatDuration(sessionDetail.session?.duration_seconds)}</span>
                      </div>
                    </div>

                    {/* Timeline of Pages & Events */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Activity Timeline
                      </h4>
                      <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
                        {/* Page views */}
                        {sessionDetail.pageviews?.map((pv, i) => (
                          <div key={pv.id || i} className="relative">
                            <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-[#24564c] ring-4 ring-white" />
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 font-mono">{pv.page_path}</span>
                              <span className="text-slate-400">{formatDate(pv.created_at)}</span>
                            </div>
                            {pv.page_title && (
                              <p className="text-xs text-slate-500 mt-0.5">{pv.page_title}</p>
                            )}
                          </div>
                        ))}

                        {/* Events */}
                        {sessionDetail.events?.map((evt, i) => (
                          <div key={evt.id || i} className="relative">
                            <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-emerald-700 flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" />
                                Action: {evt.event_name.replace(/_/g, " ")}
                              </span>
                              <span className="text-slate-400">{formatDate(evt.created_at)}</span>
                            </div>
                            {evt.page_path && (
                              <p className="text-xs text-slate-500 mt-0.5">On page: {evt.page_path}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-slate-400 py-6">No detailed history found for this session</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

