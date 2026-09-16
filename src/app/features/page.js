"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [form, setForm] = useState({ icon: "", title: "", description: "", sort_order: 0, image_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useStatusToast();

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      setMessage("Only WebP (.webp) images are allowed! Kripya .webp image select karein.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setForm((prev) => ({ ...prev, image_url: data.imageUrl }));
      } else {
        setMessage(data.error || "Failed to upload image");
      }
    } catch {
      setMessage("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const {
    currentItems: paginatedFeatures,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(features, 10);

  useEffect(() => { fetchFeatures(); }, []);

  async function fetchFeatures() {
    try {
      const res = await fetch("/api/features?all=true");
      const data = await res.json();
      if (data.features) setFeatures(data.features);
    } catch (error) { console.error(error); }
  }

  const togglePublish = async (feature) => {
    try {
      await fetch("/api/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: feature.id, is_active: feature.is_active ? 0 : 1 }),
      });
      setMessage(`Feature "${feature.title}" ${feature.is_active ? 'unpublished' : 'published'}!`);
      setTimeout(() => setMessage(""), 3000);
      fetchFeatures();
    } catch (error) {
      setMessage("Error updating feature");
      console.error(error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingFeature) {
        await fetch("/api/features", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id: editingFeature.id, is_active: 1 }),
        });
        setMessage("Feature updated successfully!");
      } else {
        await fetch("/api/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, is_active: 1 }),
        });
        setMessage("Feature added successfully!");
      }
      setTimeout(() => setMessage(""), 3000);
      setForm({ icon: "", title: "", description: "", sort_order: 0, image_url: "" });
      setShowForm(false);
      setEditingFeature(null);
      fetchFeatures();
    } catch (error) { 
      setMessage("Error saving feature");
      console.error(error); 
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this feature?")) return;
    try {
      await fetch(`/api/features?id=${id}`, { method: "DELETE" });
      setMessage("Feature deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
      fetchFeatures();
    } catch (error) { console.error(error); }
  };

  const startEdit = (feature) => {
    setEditingFeature(feature);
    setForm({
      icon: feature.icon || "",
      title: feature.title || "",
      description: feature.description || "",
      sort_order: feature.sort_order || 0,
      image_url: feature.image_url || "",
    });
    setShowForm(true);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Features Management</h1>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Features</h2>
            <button 
              onClick={() => router.push("/features/new")}
              className="admin-btn"
            >
              Add New Feature
            </button>
          </div>

          {/* Add/Edit Form */}
          {(showForm || editingFeature) && (
            <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">{editingFeature ? "Edit Feature" : "Add New Feature"}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Icon Name *</label>
                  <input 
                    type="text" 
                    value={form.icon} 
                    onChange={(e) => setForm({ ...form, icon: e.target.value })} 
                    className="admin-input" 
                    placeholder="e.g., best-price, easy-booking, support"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use icon names like: best-price, easy-booking, support</p>
                </div>
                
                <div>
                  <label className="admin-label">Sort Order</label>
                  <input 
                    type="number" 
                    value={form.sort_order} 
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} 
                    className="admin-input" 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">Title *</label>
                  <input 
                    type="text" 
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })} 
                    className="admin-input" 
                    placeholder="e.g., Best Price Guarantee"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">Feature Image / Icon (WebP Image)</label>
                  <div className="flex items-center gap-4 mt-1">
                    {form.image_url ? (
                      <div className="relative w-16 h-16 rounded-lg border border-gray-200 bg-white p-1 flex items-center justify-center">
                        <img src={form.image_url} alt="Feature preview" className="w-full h-full object-contain rounded" />
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 bg-white flex items-center justify-center text-gray-400">
                        <span className="text-xl">🖼️</span>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/webp,.webp"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Strictly WebP (.webp) format.</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">Description *</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    className="admin-input" 
                    rows={3}
                    placeholder="Feature description..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="admin-btn">
                  {saving ? "Saving..." : editingFeature ? "Update Feature" : "Add Feature"}
                </button>
                <button 
                  onClick={() => { setShowForm(false); setEditingFeature(null); }} 
                  className="admin-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Features List */}
          <div className="space-y-3">
            {paginatedFeatures.map((feature) => (
              <div key={feature.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {feature.image_url ? (
                  <div className="w-14 h-14 rounded-lg border border-gray-200 bg-white p-1 shadow-xs flex items-center justify-center flex-shrink-0">
                    <img
                      src={feature.image_url}
                      alt={feature.title}
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-teal-200 bg-teal-50 flex items-center justify-center text-teal-700 flex-shrink-0 text-xl font-bold shadow-xs">
                    ✨
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                    <span className="text-xs text-gray-500">({feature.icon})</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
                  <p className="text-xs text-gray-400">Sort Order: {feature.sort_order || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublish(feature)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      feature.is_active
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {feature.is_active ? 'Published' : 'Unpublished'}
                  </button>
                  <button 
                    onClick={() => router.push(`/features/${feature.id}`)}
                    className="admin-btn-secondary text-xs px-3 py-1.5"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(feature.id)} 
                    className="admin-btn-danger text-xs px-3 py-1.5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
            {features.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center">No features added yet. Click &quot;Add New Feature&quot; to create your first feature.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
