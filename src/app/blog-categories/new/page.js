"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import MediaLibraryModal from "@/components/MediaLibraryModal";

const emptyForm = { name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true };

export default function NewBlogCategoryPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  useEffect(() => {
    fetch("/api/sort-order?table=blog_categories")
      .then((response) => response.json())
      .then((result) => {
        if (result.nextSortOrder) setForm((previous) => ({ ...previous, sort_order: result.nextSortOrder }));
      })
      .catch(() => {});
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
      toast.success("Image uploaded successfully!");
    } catch (error) {
      toast.error(error.message || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    if (!form.image_url.trim()) {
      toast.error("Category image is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/blog-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create category");
      toast.success("Category created successfully!");
      router.replace("/blog-categories");
    } catch (error) {
      toast.error(error.message || "Could not create category");
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
            <h1 className="text-2xl font-bold text-gray-900">Add New Blog Category</h1>
            <p className="mt-1 text-sm text-gray-500">Create a category for blog posts.</p>
          </div>
          <button type="button" onClick={() => router.push("/blog-categories")} className="admin-btn-secondary">Back to Categories</button>
        </div>

        <div className="admin-card space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="admin-label">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="e.g., Adventure" />
            </div>
            <div>
              <label className="admin-label">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" placeholder="Auto-generated if blank" />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input" rows={3} />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Category Image *</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleImageUpload} className="admin-input flex-1" disabled={uploading} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary whitespace-nowrap text-xs" disabled={uploading}>{uploading ? "Uploading..." : "Upload Image"}</button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={uploading}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>
              {form.image_url && (
                <div className="mt-3 flex items-start gap-3">
                  <img src={form.image_url} alt="Category preview" className="h-24 w-32 rounded border object-cover" />
                  <button type="button" onClick={() => setForm((previous) => ({ ...previous, image_url: "" }))} className="admin-btn-danger text-xs whitespace-nowrap">Remove Image</button>
                </div>
              )}
            </div>
            <div>
              <label className="admin-label">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} className="admin-input" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
          </div>
          <button type="button" onClick={handleSave} disabled={saving} className="admin-btn">{saving ? "Saving..." : "Create Category"}</button>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setForm((prev) => ({ ...prev, image_url: url }));
          toast.success("Image selected from library!");
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
