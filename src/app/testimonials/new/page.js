"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import useStatusToast from "@/hooks/useStatusToast";

export default function NewTestimonialPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ name: "", image_url: "", rating: 5, review: "", sort_order: 0, video_url: "", influencer_video_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [message, setMessage] = useStatusToast();
  useEffect(() => {
    fetch("/api/sort-order?table=testimonials").then((response) => response.json()).then((result) => {
      if (result.nextSortOrder) setForm((previous) => ({ ...previous, sort_order: result.nextSortOrder }));
    }).catch(() => {});
  }, []);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.imageUrl) throw new Error(result.error || "Image upload failed");
      setForm((previous) => ({ ...previous, image_url: result.imageUrl }));
    } catch (error) {
      setMessage(error.message || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.review.trim()) {
      setMessage("Customer name and review are required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, is_active: 1 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create testimonial");
      router.replace("/homepage?tab=testimonials");
    } catch (error) {
      setMessage(error.message || "Could not create testimonial");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Testimonial</h1>
            <p className="mt-1 text-sm text-gray-500">Create a testimonial for the homepage.</p>
          </div>
          <button type="button" onClick={() => router.push("/homepage?tab=testimonials")} className="admin-btn-secondary">Back to Testimonials</button>
        </div>

        {message && <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">{message}</div>}

        <div className="admin-card space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="admin-label">Customer Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Rating</label>
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value, 10) })} className="admin-input">
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} Stars</option>)}
              </select>
            </div>
            <div>
              <label className="admin-label">Customer Image</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleImageUpload} className="admin-input flex-1" disabled={uploading} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary whitespace-nowrap text-xs" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={uploading}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>
              {form.image_url && <img src={form.image_url} alt="Preview" className="mt-2 h-16 w-16 rounded-full border border-gray-200 object-cover" />}
            </div>
            <div>
              <label className="admin-label">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Customer Video URL</label>
              <input type="text" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Influencer Video URL</label>
              <input type="text" value={form.influencer_video_url} onChange={(e) => setForm({ ...form, influencer_video_url: e.target.value })} className="admin-input" />
            </div>
          </div>
          <div>
            <label className="admin-label">Review *</label>
            <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} className="admin-input" rows={6} />
          </div>
          <button type="button" onClick={handleSave} disabled={saving} className="admin-btn">{saving ? "Saving..." : "Add Testimonial"}</button>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setForm((prev) => ({ ...prev, image_url: url }));
          setMessage("Image selected from library!");
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
