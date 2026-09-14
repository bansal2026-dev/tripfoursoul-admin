"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import useStatusToast from "@/hooks/useStatusToast";
import { PAGE_KEYS } from "@/lib/pageBanners";

export default function NewPageBannerPage() {
  return (
    <Suspense fallback={<LoadingSpinner text="Loading..." />}>
      <NewPageBannerContent />
    </Suspense>
  );
}

function NewPageBannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKey = searchParams.get("key") || searchParams.get("page_key") || "";
  const fileInputRef = useRef(null);

  const [selectedKey, setSelectedKey] = useState(initialKey || PAGE_KEYS[0].key);
  const [customKey, setCustomKey] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const [form, setForm] = useState({
    background_image: "",
    is_active: 1,
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [message, setMessage] = useStatusToast();

  const handleKeySelect = (key) => {
    if (key === "__custom__") {
      setIsCustom(true);
      setSelectedKey("");
    } else {
      setIsCustom(false);
      setSelectedKey(key);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setForm((prev) => ({ ...prev, background_image: data.imageUrl }));
        setMessage("Image uploaded successfully!");
      } else {
        setMessage(data.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setMessage("Error uploading image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    const finalKey = isCustom
      ? customKey.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-")
      : selectedKey;

    if (!finalKey) {
      setMessage("Please choose or enter a valid Page Key");
      return;
    }

    if (!form.background_image.trim()) {
      setMessage("Please upload or enter a banner image URL");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/page-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: finalKey,
          heading: "",
          subheading: "",
          background_image: form.background_image.trim(),
          is_active: form.is_active ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save banner");

      router.push("/page-banners");
    } catch (error) {
      console.error("Error saving banner:", error);
      setMessage(error.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Page Banner</h1>
            <p className="mt-1 text-sm text-gray-500">Upload and configure a banner image for any site page.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/page-banners")}
            className="admin-btn-secondary"
          >
            ← Back to Page Banners
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm ${
              message.toLowerCase().includes("error") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("please")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className="admin-card max-w-3xl">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="admin-label">Page Selection *</label>
              <select
                value={isCustom ? "__custom__" : selectedKey}
                onChange={(e) => handleKeySelect(e.target.value)}
                className="admin-input"
              >
                {PAGE_KEYS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} (page_key: {item.key})
                  </option>
                ))}
                <option value="__custom__">+ Custom Page Key...</option>
              </select>

              {isCustom && (
                <div className="mt-3">
                  <label className="admin-label">Custom Page Key *</label>
                  <input
                    type="text"
                    placeholder="e.g. blog, faq, terms"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="admin-input"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only.</p>
                </div>
              )}
            </div>

            <div>
              <label className="admin-label">Banner Image *</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="admin-input flex-1"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="admin-btn-secondary whitespace-nowrap"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={form.background_image}
                  onChange={(e) => setForm({ ...form, background_image: e.target.value })}
                  placeholder="Or enter direct image URL (https://...)"
                  className="admin-input"
                />
              </div>

              {form.background_image && (
                <div className="mt-4">
                  <div className="relative overflow-hidden rounded-lg border border-gray-200">
                    <img
                      src={form.background_image}
                      alt="Banner Preview"
                      className="w-full h-52 object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, background_image: "" }))}
                        className="rounded-full bg-red-600 p-1.5 text-white hover:bg-red-700 shadow"
                        title="Remove Image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="is_active"
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Published & Active on Website
              </label>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving || uploading}
                className="admin-btn"
              >
                {saving ? "Saving..." : "Save Banner"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/page-banners")}
                className="admin-btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setForm((prev) => ({ ...prev, background_image: url }));
          setMessage("Image selected from library!");
        }}
        currentImageUrl={form.background_image}
      />
    </div>
  );
}
