"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import BlogContentManager, { contentBlocksToHtml, createInitialContentBlocks, htmlToContentBlocks } from "@/components/BlogContentManager";

const MAX_IMAGE_SIZE = 1024 * 1024;

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "", cover_image: "", gallery_images: [],
    author: "", tags: "", meta_title: "", meta_description: "", category_id: "",
  });
  const [categories, setCategories] = useState([]);
  const [contentBlocks, setContentBlocks] = useState(createInitialContentBlocks);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [postsRes, catsRes] = await Promise.all([
          fetch("/api/blog?all=true"),
          fetch("/api/blog-categories?all=true"),
        ]);
        const postsData = await postsRes.json();
        const catsData = await catsRes.json();
        if (active && catsData.categories) setCategories(catsData.categories);
        const item = (postsData.posts || []).find((p) => p.id === Number(id));
        if (active && item) {
          setForm({
            title: item.title,
            slug: item.slug || "",
            excerpt: item.excerpt || "",
            content: item.content || "",
            cover_image: item.cover_image || "",
            gallery_images: (Array.isArray(item.gallery_images) ? item.gallery_images : (() => { try { return JSON.parse(item.gallery_images || '[]'); } catch { return []; } })()).slice(0, 3),
            author: item.author || "",
            tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
            meta_title: item.meta_title || "",
            meta_description: item.meta_description || "",
            category_id: item.category_id ? String(item.category_id) : "",
          });
          setContentBlocks(htmlToContentBlocks(item.content || ""));
        }
      } catch (error) { console.error(error); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  const handleSave = async () => {
    if (!form.title) {
      toast.error("Blog title is required");
      return;
    }
    if (form.gallery_images.length === 0) {
      toast.error("At least one blog image is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        content: contentBlocksToHtml(contentBlocks),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        category_id: form.category_id ? Number(form.category_id) : null,
      };
      const res = await fetch("/api/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: Number(id), is_active: 1 }),
      });
      if (res.ok) {
        toast.success("Blog post updated successfully!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error updating blog post");
      }
    } catch (error) {
      toast.error("Error updating blog post");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const remainingSlots = 3 - form.gallery_images.length;
    const files = Array.from(e.target.files || []);
    const clearSelectedFiles = () => { if (fileInputRef.current) fileInputRef.current.value = ""; };
    if (!files.length || remainingSlots <= 0) {
      toast.error("A blog can have a maximum of 3 images");
      clearSelectedFiles();
      return;
    }
    if (files.length > remainingSlots) {
      toast.error(`You can upload only ${remainingSlots} more image${remainingSlots > 1 ? "s" : ""} for this blog`);
      clearSelectedFiles();
      return;
    }
    if (files.some((file) => file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp"))) {
      toast.error("Upload failed: only WebP (.webp) images are accepted");
      clearSelectedFiles();
      return;
    }
    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      toast.error("Upload failed: each image must be 1 MB or smaller");
      clearSelectedFiles();
      return;
    }
    setUploading(true);
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok || !data.imageUrl) throw new Error(data.error || "Failed to upload image");
        return data.imageUrl;
      }));
      setForm((prev) => {
        const gallery_images = [...prev.gallery_images, ...uploads].slice(0, 3);
        return { ...prev, gallery_images, cover_image: prev.cover_image || gallery_images[0] || "" };
      });
      toast.success(`${uploads.length} image${uploads.length > 1 ? "s" : ""} uploaded successfully!`);
    } catch (error) {
      toast.error(error instanceof Error ? `Upload failed: ${error.message}` : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <LoadingSpinner text="Loading blog post..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Blog Post</h1>
            <p className="mt-1 text-sm text-gray-500">Update article sections and insert images exactly where they should appear.</p>
          </div>
          <button onClick={() => router.push("/blog")} className="admin-btn-secondary">← Back to List</button>
        </div>

        <div className="admin-card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-input" placeholder="e.g., Top 10 Travel Destinations for 2026" />
            </div>
            <div>
              <label className="admin-label">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" placeholder="Auto-generated from title if blank" />
            </div>
            <div>
              <label className="admin-label">Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="admin-input">
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Author</label>
              <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="admin-input" placeholder="e.g., TripForSoul Team" />
            </div>
            <div>
              <label className="admin-label">Tags (comma separated)</label>
              <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="admin-input" placeholder="e.g., Travel Tips, Europe, Adventure" />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Cover &amp; Gallery Images *</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" multiple accept="image/webp,.webp" onChange={handleImageUpload} className="admin-input flex-1" disabled={uploading || form.gallery_images.length >= 3} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary text-xs whitespace-nowrap" disabled={uploading || form.gallery_images.length >= 3}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={uploading || form.gallery_images.length >= 3}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Upload up to 3 WebP images, max 1 MB each. The first image becomes the cover. ({form.gallery_images.length}/3)</p>
              {form.gallery_images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {form.gallery_images.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative">
                      <img src={url} alt="Blog upload" className="w-full h-24 object-cover rounded border" />
                      {index === 0 && <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">Cover</span>}
                      <button type="button" onClick={() => setForm((prev) => { const gallery_images = prev.gallery_images.filter((_, i) => i !== index); return { ...prev, gallery_images, cover_image: gallery_images[0] || '' }; })} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Excerpt</label>
              <RichTextEditor value={form.excerpt} onChange={(html) => setForm({ ...form, excerpt: html })} rows={2} placeholder="Short summary shown on blog listing page..." />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Article Content</label>
              <BlogContentManager blocks={contentBlocks} onChange={setContentBlocks} />
            </div>
            <div>
              <label className="admin-label">Meta Title (SEO)</label>
              <input type="text" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} className="admin-input" placeholder="Defaults to post title" />
            </div>
            <div>
              <label className="admin-label">Meta Description (SEO)</label>
              <input type="text" value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} className="admin-input" placeholder="Defaults to excerpt" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="admin-btn">{saving ? "Saving..." : "Update Post"}</button>
            <button onClick={() => router.push("/blog")} className="admin-btn-secondary">Cancel</button>
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          if (form.gallery_images.includes(url)) {
            toast.error("Image is already added");
            return;
          }
          setForm((prev) => {
            const gallery_images = [...prev.gallery_images, url];
            return {
              ...prev,
              gallery_images,
              cover_image: prev.cover_image || url,
            };
          });
          toast.success("Image selected from library!");
        }}
        currentImageUrl={form.cover_image}
      />
    </div>
  );
}
