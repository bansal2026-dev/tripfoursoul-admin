"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination, { usePagination } from "@/components/Pagination";
import MediaLibraryModal from "@/components/MediaLibraryModal";

export default function BlogCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  const {
    currentItems: paginatedCategories,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(categories, 10);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/blog-categories?all=true");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/blog-categories?all=true");
        const data = await res.json();
        if (active && data.categories) setCategories(data.categories);
      } catch (error) { console.error(error); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setForm((prev) => ({ ...prev, image_url: data.imageUrl }));
        toast.success("Image uploaded successfully!");
      } else {
        toast.error(data.error || "Failed to upload image");
      }
    } catch (error) {
      toast.error("Error uploading image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Category name is required");
      return;
    }
    if (!form.image_url) {
      toast.error("Category image is required");
      return;
    }
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const payload = editing ? { ...form, id: editing.id } : form;
      const res = await fetch("/api/blog-categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editing ? "Category updated successfully!" : "Category created successfully!");
        setShowForm(false);
        setEditing(null);
        setForm({ name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true });
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error saving category");
      }
    } catch (error) {
      toast.error("Error saving category");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      description: cat.description || "",
      image_url: cat.image_url || "",
      sort_order: cat.sort_order || 0,
      is_active: cat.is_active !== 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const res = await fetch(`/api/blog-categories?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Category deleted successfully!");
        fetchCategories();
      } else {
        toast.error(data.error || "Error deleting category");
      }
    } catch (error) {
      toast.error("Error deleting category");
    }
  };

  const toggleActive = async (cat) => {
    try {
      await fetch("/api/blog-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, is_active: cat.is_active ? 0 : 1 }),
      });
      toast.success(`Category "${cat.name}" ${cat.is_active ? "deactivated" : "activated"}!`);
      fetchCategories();
    } catch (error) {
      toast.error("Error updating category");
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Blog Categories</h1>
          <div className="flex gap-3">
            <button onClick={() => router.push("/blog")} className="admin-btn-secondary">← Back to Blog</button>
            <button onClick={() => router.push("/blog-categories/new")} className="admin-btn">
              Add Category
            </button>
          </div>
        </div>

        {showForm && (
          <div className="admin-card space-y-4 mb-6">
            <h2 className="text-lg font-semibold">{editing ? "Edit Category" : "Add New Category"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="admin-label">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="e.g., Adventure" />
              </div>
              <div>
                <label className="admin-label">Slug</label>
                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" placeholder="Auto-generated from name if blank" />
              </div>
              <div className="md:col-span-2">
                <label className="admin-label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input" rows={2} placeholder="Short description of this category..." />
              </div>
              <div className="md:col-span-2">
                <label className="admin-label">Category Image *</label>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleImageUpload} className="admin-input flex-1" disabled={uploading} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary text-xs whitespace-nowrap" disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload Image"}
                  </button>
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
                  <div className="mt-3">
                    <img src={form.image_url} alt="Category preview" className="w-32 h-24 object-cover rounded border" />
                    <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="mt-1 text-xs text-red-600 hover:text-red-700">Remove image</button>
                  </div>
                )}
              </div>
              <div>
                <label className="admin-label">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="admin-input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <label className="text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="admin-btn">{saving ? "Saving..." : editing ? "Update Category" : "Create Category"}</button>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="admin-btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="admin-card">
          <h2 className="text-lg font-semibold mb-6">All Categories</h2>
          {loading ? (
            <LoadingSpinner text="Loading categories..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><th className="px-3 py-3">Category</th><th className="px-3 py-3">Slug</th><th className="px-3 py-3">Posts</th><th className="px-3 py-3">Sort</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead>
                <tbody>{paginatedCategories.map((cat) => (
                  <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3"><div className="flex items-center gap-3">{cat.image_url && <img src={cat.image_url} alt={cat.name} className="h-10 w-14 rounded object-cover" />}<div><p className="font-medium text-gray-900">{cat.name}</p>{cat.description && <p className="max-w-xs truncate text-xs text-gray-500">{cat.description}</p>}</div></div></td>
                    <td className="px-3 py-3 text-gray-600">/{cat.slug}</td>
                    <td className="px-3 py-3 text-gray-600">{cat.post_count || 0}</td>
                    <td className="px-3 py-3 font-semibold text-teal-700">{cat.sort_order || "—"}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${cat.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{cat.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><button onClick={() => toggleActive(cat)} className="rounded border border-gray-300 px-2 py-1 text-xs">{cat.is_active ? "Deactivate" : "Activate"}</button><button onClick={() => router.push(`/blog-categories/${cat.id}`)} className="rounded border border-gray-300 px-2 py-1 text-xs">Edit</button><button onClick={() => handleDelete(cat.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Delete</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
              {categories.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">{`No categories yet. Click "Add Category" to create your first blog category.`}</p>
              )}
            </div>
          )}
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