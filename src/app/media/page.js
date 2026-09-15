"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import toast, { Toaster } from "react-hot-toast";

export default function MediaPage() {
  const [mediaList, setMediaList] = useState([]);
  const [totalImages, setTotalImages] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'image' | 'video'
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [clientDims, setClientDims] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const fileInputRef = useRef(null);

  // Check user role on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role === "super_admin") {
          setIsSuperAdmin(true);
        }
      })
      .catch((err) => console.error("Error fetching user profile:", err));
  }, []);

  const formatDate = (isoOrTimestamp) => {
    if (!isoOrTimestamp) return "—";
    try {
      const d = new Date(isoOrTimestamp);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getPixels = (item) => {
    if (!item || item.mediaType === "video") return null;
    if (item.width && item.height) return `${item.width} × ${item.height} px`;
    return clientDims[item.url] || null;
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load media");
      const list = data.media || data.images || [];
      setMediaList(list);
      setTotalImages(data.totalImages || list.filter((m) => m.mediaType === "image").length);
      setTotalVideos(data.totalVideos || list.filter((m) => m.mediaType === "video").length);
    } catch (err) {
      console.error("Media load error:", err);
      toast.error("Could not load media files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const filteredMedia = useMemo(() => {
    let list = mediaList;
    if (activeTab === "image") {
      list = list.filter((m) => m.mediaType === "image");
    } else if (activeTab === "video") {
      list = list.filter((m) => m.mediaType === "video");
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.url || "").toLowerCase().includes(q)
    );
  }, [mediaList, activeTab, search]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const invalidImage = files.find((file) => {
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|bmp|svg|tiff|webp)$/i.test(file.name);
      if (isImage) {
        return file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp");
      }
      return false;
    });

    if (invalidImage) {
      toast.error("Upload failed: only WebP (.webp) images are accepted.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    let successCount = 0;
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          successCount += 1;
        } else {
          const errData = await res.json();
          toast.error(errData.error || `Failed to upload ${file.name}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} file(s) successfully!`);
        await fetchMedia();
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload error occurred");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("Media URL copied to clipboard!");
    setTimeout(() => setCopiedUrl(""), 2500);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete files!");
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/media?url=${encodeURIComponent(deleteTarget.url)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("File deleted from server!");
      if (selectedMedia?.url === deleteTarget.url) setSelectedMedia(null);
      await fetchMedia();
    } catch (err) {
      toast.error(err.message || "Failed to delete file");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || typeof bytes !== "number") return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Sidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                {mediaList.length} files
              </span>
              {isSuperAdmin ? (
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 flex items-center gap-1">
                  🛡️ Super Admin
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  Read Only (Delete restricted to Super Admin)
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Browse, search, and manage images and videos across the website.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/webp,.webp,video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="admin-btn flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? "Uploading..." : "+ Upload Media"}
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="admin-card mb-6 flex flex-col gap-4 p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "all"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({mediaList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("image")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "image"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>🖼️ Images</span>
                <span className="rounded-full bg-gray-200 px-1.5 py-0.2 text-[10px] text-gray-700">
                  {totalImages}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("video")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "video"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>🎬 Videos</span>
                <span className="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] text-purple-700">
                  {totalVideos}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* View Mode Toggle: List vs Grid */}
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === "list"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="List View"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="Grid View"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span>Grid</span>
                </button>
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchMedia}
                disabled={loading}
                className="admin-btn-secondary text-xs flex items-center gap-1.5"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search files by name, type, or URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input pl-9 text-sm w-full"
            />
          </div>
        </div>

        {/* Main Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <LoadingSpinner text="Loading media files..." />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="admin-card py-16 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-base font-semibold text-gray-700">No media found</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload images or videos using the button above or clear the search query.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="admin-card overflow-x-auto shadow-sm border border-gray-200 rounded-xl bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 w-16 text-center">Preview</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date Added</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMedia.map((item) => {
                  const isSelected = selectedMedia?.url === item.url;
                  const isVideo = item.mediaType === "video";
                  const pixels = getPixels(item);
                  const ext = item.url.split(".").pop()?.split("?")[0]?.toUpperCase() || (isVideo ? "VIDEO" : "WEBP");

                  return (
                    <tr
                      key={item.url}
                      onClick={() => setSelectedMedia(item)}
                      className={`cursor-pointer transition-colors hover:bg-teal-50/40 ${
                        isSelected ? "bg-teal-50/70" : ""
                      }`}
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-2.5 text-center">
                        <div className="relative w-12 h-12 mx-auto rounded-lg overflow-hidden bg-gray-900 border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                          {isVideo ? (
                            <>
                              <video src={item.url} className="w-full h-full object-cover opacity-80" />
                              <span className="absolute inset-0 flex items-center justify-center text-white text-xs">▶</span>
                            </>
                          ) : (
                            <img
                              src={item.url}
                              alt={item.name}
                              loading="lazy"
                              onLoad={(e) => {
                                const w = e.currentTarget.naturalWidth;
                                const h = e.currentTarget.naturalHeight;
                                if (w && h && (!item.width || !item.height)) {
                                  setClientDims((prev) => ({ ...prev, [item.url]: `${w} × ${h} px` }));
                                }
                              }}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      </td>

                      {/* Name & URL */}
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="font-semibold text-gray-900 text-xs truncate" title={item.name || item.fileName}>
                          {item.name || item.fileName}
                        </p>
                        <p className="text-[11px] font-mono text-gray-400 truncate mt-0.5" title={item.url}>
                          {item.url}
                        </p>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isVideo
                              ? "bg-purple-100 text-purple-700"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {isVideo ? "🎬 Video" : "🖼️ Image"}
                          <span className="text-[9px] uppercase opacity-75 font-mono">({ext})</span>
                        </span>
                      </td>

                      {/* Resolution / Dimensions */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-mono">
                        {pixels ? (
                          <span className="inline-block bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {pixels}
                          </span>
                        ) : isVideo ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* File Size */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600 font-medium">
                        {formatFileSize(item.size) || "—"}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(item.date || item.timestamp)}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.source === "upload"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {item.source === "upload" ? "Server File" : "DB Record"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Copy URL */}
                          <button
                            type="button"
                            onClick={() => handleCopy(item.url)}
                            className="p-1.5 text-gray-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl === item.url ? (
                              <span className="text-xs font-bold text-teal-700">✓ Copied</span>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>

                          {/* View Details / Select */}
                          <button
                            type="button"
                            onClick={() => setSelectedMedia(item)}
                            className="p-1.5 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Open in new tab */}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Open original file in new tab"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>

                          {/* Delete (Super Admin only) */}
                          {isSuperAdmin && item.source === "upload" && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete file from server (Super Admin only)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredMedia.map((item) => {
              const isSelected = selectedMedia?.url === item.url;
              const isVideo = item.mediaType === "video";
              const pixels = getPixels(item);

              return (
                <div
                  key={item.url}
                  onClick={() => setSelectedMedia(item)}
                  className={`group relative rounded-xl border overflow-hidden cursor-pointer bg-white transition-all flex flex-col ${
                    isSelected
                      ? "border-teal-600 ring-2 ring-teal-600/30 shadow-md"
                      : "border-gray-200 hover:border-teal-300 hover:shadow-sm"
                  }`}
                >
                  {/* Thumbnail / Video Container */}
                  <div className="relative aspect-[4/3] w-full bg-gray-900 overflow-hidden flex items-center justify-center">
                    {isVideo ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-gray-950">
                        <video
                          src={item.url}
                          preload="metadata"
                          muted
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-md">
                            ▶
                          </div>
                        </div>
                        <span className="absolute top-1.5 left-1.5 bg-purple-900/90 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          VIDEO
                        </span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={item.url}
                          alt={item.name}
                          loading="lazy"
                          onLoad={(e) => {
                            const w = e.currentTarget.naturalWidth;
                            const h = e.currentTarget.naturalHeight;
                            if (w && h && (!item.width || !item.height)) {
                              setClientDims((prev) => ({ ...prev, [item.url]: `${w} × ${h} px` }));
                            }
                          }}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Pixel Badge Overlay */}
                        {pixels && (
                          <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs pointer-events-none">
                            {pixels}
                          </span>
                        )}
                      </>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item.url);
                        }}
                        className="rounded-lg bg-white/90 p-1.5 text-gray-700 hover:bg-white text-xs font-semibold shadow"
                        title="Copy URL"
                      >
                        {copiedUrl === item.url ? "✓" : "📋"}
                      </button>

                      {/* Super Admin only Delete button */}
                      {isSuperAdmin && item.source === "upload" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(item);
                          }}
                          className="rounded-lg bg-red-600/90 p-1.5 text-white hover:bg-red-700 text-xs shadow"
                          title="Delete from server (Super Admin only)"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Meta Details */}
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-gray-800 truncate" title={item.name || item.fileName}>
                      {item.name || item.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{formatFileSize(item.size) || (item.source === "database" ? "DB Record" : "Upload")}</span>
                      {isVideo ? (
                        <span className="text-purple-600 font-semibold bg-purple-50 px-1 rounded border border-purple-200">
                          Video
                        </span>
                      ) : pixels ? (
                        <span className="text-teal-700 font-semibold bg-teal-50 px-1 rounded border border-teal-200">
                          {pixels}
                        </span>
                      ) : (
                        <span className="text-teal-600 font-medium">Image</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Media Drawer / Floating Preview */}
        {selectedMedia && (
          <div className="fixed bottom-6 right-6 z-40 max-w-md w-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 bg-black flex items-center justify-center">
                  {selectedMedia.mediaType === "video" ? (
                    <video
                      src={selectedMedia.url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={selectedMedia.url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate" title={selectedMedia.name || selectedMedia.fileName}>
                    {selectedMedia.name || selectedMedia.fileName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      {selectedMedia.mediaType || "file"}
                    </span>
                    {getPixels(selectedMedia) && (
                      <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                        {getPixels(selectedMedia)}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      {formatFileSize(selectedMedia.size) || "Database Reference"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Video Player if video is selected */}
            {selectedMedia.mediaType === "video" && (
              <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 bg-black">
                <video
                  src={selectedMedia.url}
                  controls
                  className="w-full max-h-48 object-contain"
                />
              </div>
            )}

            {/* URL Copy and Delete actions */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={selectedMedia.url}
                className="admin-input py-1.5 text-xs font-mono flex-1 bg-gray-50"
              />
              <button
                type="button"
                onClick={() => handleCopy(selectedMedia.url)}
                className="admin-btn py-1.5 text-xs whitespace-nowrap"
              >
                {copiedUrl === selectedMedia.url ? "Copied!" : "Copy URL"}
              </button>

              {/* Super Admin Delete Button */}
              {isSuperAdmin && selectedMedia.source === "upload" && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedMedia)}
                  className="admin-btn-danger py-1.5 text-xs whitespace-nowrap"
                  title="Super Admin Only"
                >
                  Delete
                </button>
              )}
            </div>

            {!isSuperAdmin && selectedMedia.source === "upload" && (
              <p className="mt-2 text-[10px] text-gray-400 text-right">
                🔒 Only Super Admin can delete files from server
              </p>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Modal - strictly for Super Admin */}
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Media File from Server?"
        description={`Are you sure you want to delete "${deleteTarget?.name || deleteTarget?.fileName}"? Any website page or banner using this URL will no longer be able to display it.`}
        confirmLabel="Delete File"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
