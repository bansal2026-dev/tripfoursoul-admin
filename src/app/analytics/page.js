"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import {
  Eye,
  Users,
  Activity,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Compass,
  ArrowUpRight,
  RefreshCw,
  Share2,
  MousePointerClick,
  Sparkles,
} from "lucide-react";

export default function AnalyticsPage() {
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [data, setData] = useState({
    totalPageviews: 0,
    uniqueVisitors: 0,
    totalSessions: 0,
    avgDuration: 0,
    topPages: [],
    topReferrers: [],
    deviceBreakdown: [],
    browserBreakdown: [],
    topCountries: [],
    topCities: [],
    topEvents: [],
    recentVisitors: [],
  });

  const fetchAnalytics = async (selectedRange = range, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/analytics/stats?range=${selectedRange}`);
      if (res.ok) {
        const json = await res.json();
        if (json.stats) {
          setData(json.stats);
          setLastUpdated(new Date());
        }
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range, true);
  }, [range]);

  // Live Auto-Refresh Polling every 8 seconds
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchAnalytics(range, false);
    }, 8000);
    return () => clearInterval(interval);
  }, [isLive, range]);

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
        hour: "2-digit",
        minute: "2-digit",
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <h1 className="text-2xl font-bold text-gray-900">Visitor Analytics</h1>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isLive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {isLive ? "Live Sync Active" : "Sync Paused"}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Live tracking of visitors, devices, pages, referrers, and locations
              {lastUpdated && (
                <span className="text-xs text-slate-400 ml-2">
                  (Updated {lastUpdated.toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border shadow-sm transition ${
                isLive
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
              {isLive ? "Auto-Refresh: ON (8s)" : "Auto-Refresh: OFF"}
            </button>

            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
              {[
                { key: "today", label: "Today" },
                { key: "7d", label: "7 Days" },
                { key: "30d", label: "30 Days" },
                { key: "all", label: "All Time" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setRange(item.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    range === item.key
                      ? "bg-[#24564C] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchAnalytics(range, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              title="Refresh Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#24564C]" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* 4 Stat Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Page Views</p>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">{data.totalPageviews.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Total pages viewed by visitors</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Unique Visitors</p>
              <div className="w-10 h-10 rounded-xl bg-[#dce8df] text-[#24564c] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">{data.uniqueVisitors.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Distinct users tracked via cookie</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Sessions</p>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">{data.totalSessions.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Visits across 30-min active windows</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg Time on Site</p>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">{formatDuration(data.avgDuration)}</p>
            <p className="text-xs text-slate-500 mt-1">Average visitor engagement</p>
          </div>
        </div>

        {/* Top Pages & Traffic Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Pages */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#24564c]" />
                Top Visited Pages
              </h2>
              <span className="text-xs text-slate-400 font-medium">By views</span>
            </div>

            {data.topPages.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No page views recorded yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.topPages.map((page, idx) => (
                  <div key={page.page_path} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                      <span className="font-medium text-slate-800 truncate" title={page.page_path}>
                        {page.page_path}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">{page.unique_visitors} unique</span>
                      <span className="font-semibold text-[#24564c] bg-[#dce8df]/60 px-2 py-0.5 rounded-md text-xs">
                        {page.views} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traffic Sources */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#c8755a]" />
                Traffic Sources & Referrers
              </h2>
              <span className="text-xs text-slate-400 font-medium">Where users come from</span>
            </div>

            {data.topReferrers.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No referral data recorded yet</p>
            ) : (
              <div className="space-y-3">
                {data.topReferrers.map((ref) => {
                  const percent = data.totalSessions > 0 ? Math.round((Number(ref.count) / data.totalSessions) * 100) : 0;
                  return (
                    <div key={ref.referrer_domain}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{ref.referrer_domain}</span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {ref.count} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#c8755a] rounded-full" style={{ width: `${Math.max(percent, 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Devices, Geographic, & Interactions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Device & Browser */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#24564c]" />
              Devices & Browsers
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Device Type</p>
                <div className="space-y-2">
                  {data.deviceBreakdown.map((dev) => (
                    <div key={dev.device_type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 capitalize text-slate-700">
                        {getDeviceIcon(dev.device_type)}
                        {dev.device_type}
                      </div>
                      <span className="font-semibold text-slate-900">{dev.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Top Browsers</p>
                <div className="space-y-2">
                  {data.browserBreakdown.map((b) => (
                    <div key={b.browser} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{b.browser}</span>
                      <span className="font-semibold text-slate-900">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-600" />
              Visitor Locations
            </h2>
            {data.topCountries.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No location data yet</p>
            ) : (
              <div className="space-y-3">
                {data.topCountries.map((c) => (
                  <div key={c.country} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{c.country}</span>
                    <span className="text-xs font-bold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full">
                      {c.count} visits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Interaction Clicks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-emerald-600" />
              Key Actions & Clicks
            </h2>
            {data.topEvents.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No interaction events yet</p>
            ) : (
              <div className="space-y-3">
                {data.topEvents.map((evt) => (
                  <div key={evt.event_name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 capitalize">
                      {evt.event_name.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      {evt.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live / Recent Visitor Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recent Visitor Activity Log</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live recent visitors with IP, location, and device</p>
            </div>
            <Link
              href="/analytics/visitors"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#24564c] text-white hover:bg-[#173f38] shadow-sm transition self-start sm:self-auto"
            >
              View Full Visitor List & Pagination &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Visitor & IP</th>
                  <th className="py-3 px-4">Visitor ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Device & Browser</th>
                  <th className="py-3 px-4">First / Last Page</th>
                  <th className="py-3 px-4">Referrer</th>
                  <th className="py-3 px-4">Time Spent</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      No visitors tracked yet. Visit the website to see live data here!
                    </td>
                  </tr>
                ) : (
                  data.recentVisitors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-800" title={v.visitor_id}>
                          {v.visitor_id ? `${v.visitor_id.substring(0, 12)}...` : `Visitor #${v.id}`}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={v.session_id}>
                          Session: {v.session_id ? v.session_id.substring(0, 8) + "..." : "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {v.city ? `${v.city}, ` : ""}
                          {v.country || "Unknown"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          {getDeviceIcon(v.device_type)}
                          <span className="capitalize">{v.device_type}</span>
                          <span className="text-slate-300">·</span>
                          <span>{v.browser}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{v.os}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs text-[#24564c] font-medium truncate max-w-[160px]" title={v.first_page}>
                          {v.first_page || "/"}
                        </div>
                        {v.total_pages > 1 && (
                          <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                            {v.total_pages} pages viewed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {v.referrer_domain || "Direct"}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {formatDuration(v.duration_seconds)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(v.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.recentVisitors.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing recent {data.recentVisitors.length} visitors
              </span>
              <Link
                href="/analytics/visitors"
                className="text-xs font-bold text-[#24564c] hover:underline flex items-center gap-1"
              >
                Open Full Paginated Visitor List &rarr;
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

