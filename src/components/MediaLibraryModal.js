"use client";

import { useEffect, useState, useMemo } from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelectImage,
  currentImageUrl = "",
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [clientDims, setClientDims] = useState({});

  const getPixels = (img) => {
    if (!img) return null;
    if (img.width && img.height) return `${img.width} × ${img.height} px`;
    return clientDims[img.url] || null;
  };

  const fetchMedia = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load media");
      const list = data.images || [];
      setImages(list);

      // Pre-select current image if matches
      if (currentImageUrl) {
        const found = list.find((img) => img.url === currentImageUrl);
        if (found) setSelectedImage(found);
      }
    } catch (err) {
      console.error("Error fetching media library:", err);
      setError(err.message || "Failed to load uploaded images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
      setSearch("");
      setCopied(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredImages = useMemo(() => {
    if (!search.trim()) return images;
    const q = search.toLowerCase();
    return images.filter(
      (img) =>
        (img.name || "").toLowerCase().includes(q) ||
        (img.url || "").toLowerCase().includes(q)
    );
  }, [images, search]);

  const formatFileSize = (bytes) => {
    if (!bytes || typeof bytes !== "number") return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleConfirmSelection = () => {
    if (!selectedImage) return;
    onSelectImage(selectedImage.url);
    onClose();
  };

  const handleCopyUrl = (url, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        className="relative flex flex-col w-full max-w-5xl h-[88vh] max-h-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Media Library</h3>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                  {images.length} images
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Select an already uploaded image or search by name.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-gray-50/70 border-b border-gray-100">
          <div className="relative flex-1 min-w-[260px]">
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
              placeholder="Search images by name or url..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMedia}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh images list"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Gallery Grid Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-16">
              <LoadingSpinner text="Loading uploaded images..." />
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{error}</p>
              <button
                type="button"
                onClick={fetchMedia}
                className="mt-2 text-xs text-teal-600 hover:underline font-medium"
              >
                Try reloading
              </button>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">No images match your search</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for a different name or clear the search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredImages.map((img) => {
                const isSelected = selectedImage?.url === img.url;
                return (
                  <div
                    key={img.url}
                    onClick={() => setSelectedImage(img)}
                    onDoubleClick={() => {
                      setSelectedImage(img);
                      onSelectImage(img.url);
                      onClose();
                    }}
                    className={`group relative rounded-xl border overflow-hidden cursor-pointer bg-gray-50 transition-all flex flex-col ${
                      isSelected
                        ? "border-teal-600 ring-2 ring-teal-600/30 shadow-md bg-teal-50/20"
                        : "border-gray-200 hover:border-teal-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.name}
                        loading="lazy"
                        onLoad={(e) => {
                          const w = e.currentTarget.naturalWidth;
                          const h = e.currentTarget.naturalHeight;
                          if (w && h && (!img.width || !img.height)) {
                            setClientDims((prev) => ({ ...prev, [img.url]: `${w} × ${h} px` }));
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Pixel Badge Overlay */}
                      {getPixels(img) && (
                        <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs pointer-events-none">
                          {getPixels(img)}
                        </span>
                      )}

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-teal-600 text-white rounded-full p-1 shadow-md">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="p-2 flex flex-col gap-0.5 bg-white">
                      <p
                        className="text-xs font-medium text-gray-800 truncate"
                        title={img.name || img.fileName}
                      >
                        {img.name || img.fileName}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{formatFileSize(img.size) || (img.source === "database" ? "DB Record" : "Upload")}</span>
                        {getPixels(img) && (
                          <span className="font-semibold text-teal-700 bg-teal-50 px-1 rounded border border-teal-200">
                            {getPixels(img)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Selected Image Preview & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            {selectedImage ? (
              <>
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                  <img
                    src={selectedImage.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {selectedImage.name || selectedImage.fileName}
                    </p>
                    {getPixels(selectedImage) && (
                      <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded flex-shrink-0">
                        {getPixels(selectedImage)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate max-w-md font-mono mt-0.5">
                    {selectedImage.url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleCopyUrl(selectedImage.url, e)}
                  className="text-xs text-teal-600 hover:text-teal-700 underline flex-shrink-0 ml-1"
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400 italic">
                No image selected. Click any image card to select it.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={!selectedImage}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use Selected Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

