"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import toast, { Toaster } from "react-hot-toast";

export default function MediaPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState("");
  const fileInputRef = useRef(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load media");
      setImages(data.images || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load media images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const filteredImages = useMemo(() => {
    if (!search.trim()) return images;
    const q = search.toLowerCase();
    return images.filter(
      (img) =>
        (img.name || "").toLowerCase().includes(q) ||
        (img.url || "").toLowerCase().includes(q)
    );
  }, [images, search]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setUploading(true);
    let successCount = 0;
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) successCount += 1;
      }
      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} image(s) successfully!`);
        await fetchMedia();
      } else {
        toast.error("Failed to upload image(s)");
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
    toast.success("Image URL copied to clipboard!");
    setTimeout(() => setCopiedUrl(""), 2500);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media?url=${encodeURIComponent(deleteTarget.url)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Image removed from server!");
      if (selectedImage?.url === deleteTarget.url) setSelectedImage(null);
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
                {images.length} images
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Browse, search, and manage all uploaded images across the website.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
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
              {uploading ? "Uploading..." : "+ Upload New Images"}
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="admin-card mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4">
          <div className="relative flex-1 max-w-md">
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
              placeholder="Search images by name or path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input pl-9 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={fetchMedia}
            disabled={loading}
            className="admin-btn-secondary text-xs flex items-center gap-1.5 self-end sm:self-auto"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Main Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <LoadingSpinner text="Loading media files..." />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="admin-card py-16 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-base font-semibold text-gray-700">No images found</p>
            <p className="text-xs text-gray-400 mt-1">Upload images using the button above or clear the search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredImages.map((img) => {
              const isSelected = selectedImage?.url === img.url;
              return (
                <div
                  key={img.url}
                  onClick={() => setSelectedImage(img)}
                  className={`group relative rounded-xl border overflow-hidden cursor-pointer bg-white transition-all flex flex-col ${
                    isSelected
                      ? "border-teal-600 ring-2 ring-teal-600/30 shadow-md"
                      : "border-gray-200 hover:border-teal-300 hover:shadow-sm"
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(img.url);
                        }}
                        className="rounded-lg bg-white/90 p-1.5 text-gray-700 hover:bg-white text-xs font-semibold shadow"
                        title="Copy URL"
                      >
                        {copiedUrl === img.url ? "✓" : "📋"}
                      </button>
                      {img.source === "upload" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(img);
                          }}
                          className="rounded-lg bg-red-600/90 p-1.5 text-white hover:bg-red-700 text-xs shadow"
                          title="Delete from server"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-gray-800 truncate" title={img.name || img.fileName}>
                      {img.name || img.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{formatFileSize(img.size) || (img.source === "database" ? "DB Record" : "Upload")}</span>
                      <span className="text-teal-600 font-medium">Click info</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Image Details Modal / Bottom Bar */}
        {selectedImage && (
          <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedImage.url}
                  alt="Preview"
                  className="w-14 h-14 rounded-lg object-cover border border-gray-200 shadow-sm"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {selectedImage.name || selectedImage.fileName}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {formatFileSize(selectedImage.size) || "Database Reference"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={selectedImage.url}
                className="admin-input py-1 text-xs font-mono flex-1 bg-gray-50"
              />
              <button
                type="button"
                onClick={() => handleCopy(selectedImage.url)}
                className="admin-btn py-1 text-xs whitespace-nowrap"
              >
                {copiedUrl === selectedImage.url ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        )}
      </main>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Image from Server?"
        description={`Are you sure you want to delete "${deleteTarget?.name || deleteTarget?.fileName}"? Any page or section using this image URL might break.`}
        confirmLabel="Delete Image"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

