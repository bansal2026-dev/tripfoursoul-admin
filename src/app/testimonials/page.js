"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";
import MediaLibraryModal from "@/components/MediaLibraryModal";

export default function TestimonialsPage() {
  const router = useRouter();
  const [testimonials, setTestimonials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", image_url: "", rating: 5, review: "", sort_order: 0, video_url: "", influencer_video_url: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  const {
    currentItems: paginatedTestimonials,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(testimonials, 10);

  useEffect(() => { fetchTestimonials(); }, []);

  async function fetchTestimonials() {
    try {
      const res = await fetch("/api/testimonials?all=true");
      const data = await res.json();
      if (data.testimonials) setTestimonials(data.testimonials);
    } catch (error) { console.error(error); }
  }

  const togglePublish = async (item) => {
    try {
      await fetch("/api/testimonials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: item.is_active ? 0 : 1 }),
      });
      setMessage(`Testimonial "${item.name}" ${item.is_active ? 'unpublished' : 'published'}!`);
      setTimeout(() => setMessage(""), 3000);
      fetchTestimonials();
    } catch (error) {
      setMessage("Error updating testimonial");
      console.error(error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await fetch("/api/testimonials", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id: editingItem.id, is_active: 1 }),
        });
        setMessage("Testimonial updated successfully!");
      } else {
        await fetch("/api/testimonials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, is_active: 1 }),
        });
        setMessage("Testimonial added successfully!");
      }
      setTimeout(() => setMessage(""), 3000);
      setForm({ name: "", image_url: "", rating: 5, review: "", sort_order: 0, video_url: "", influencer_video_url: "" });
      setShowForm(false);
      setEditingItem(null);
      fetchTestimonials();
    } catch (error) { 
      setMessage("Error saving testimonial");
      console.error(error); 
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await fetch(`/api/testimonials?id=${id}`, { method: "DELETE" });
      setMessage("Testimonial deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
      fetchTestimonials();
    } catch (error) { console.error(error); }
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      image_url: item.image_url,
      rating: item.rating || 5,
      review: item.review,
      sort_order: item.sort_order || 0,
      video_url: item.video_url || "",
      influencer_video_url: item.influencer_video_url || "",
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.imageUrl) {
        setForm(prev => ({ ...prev, image_url: data.imageUrl }));
        setMessage("Image uploaded successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.error || "Failed to upload image");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error uploading image");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Testimonials Management</h1>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Testimonials</h2>
            <button 
              onClick={() => router.push("/testimonials/new")}
              className="admin-btn"
            >
              Add New Testimonial
            </button>
          </div>

          {/* Add/Edit Form */}
          {(showForm || editingItem) && (
            <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">{editingItem ? "Edit Testimonial" : "Add New Testimonial"}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Customer Name *</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    className="admin-input" 
                    placeholder="e.g., John Doe"
                  />
                </div>
                
                <div>
                  <label className="admin-label">Rating</label>
                  <select 
                    value={form.rating} 
                    onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) })} 
                    className="admin-input"
                  >
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>

                <div>
                  <label className="admin-label">Customer Image</label>
                  <div className="flex gap-2">
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
                      className="admin-btn-secondary text-xs whitespace-nowrap"
                      disabled={uploading}
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMediaLibrary(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                      disabled={uploading}
                      title="Choose an existing image from uploaded library"
                    >
                      <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose from Uploaded
                    </button>
                  </div>
                  {form.image_url && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={form.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-full border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                        className="admin-btn-danger text-xs whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  )}
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

                <div>
                  <label className="admin-label">Customer Video URL</label>
                  <input 
                    type="text" 
                    value={form.video_url} 
                    onChange={(e) => setForm({ ...form, video_url: e.target.value })} 
                    className="admin-input" 
                    placeholder="e.g., https://youtube.com/watch?v=... or /uploads/video.mp4"
                  />
                  <p className="text-xs text-gray-500 mt-1">YouTube/Vimeo link or uploaded video file</p>
                </div>

                <div>
                  <label className="admin-label">Influencer Video URL</label>
                  <input 
                    type="text" 
                    value={form.influencer_video_url} 
                    onChange={(e) => setForm({ ...form, influencer_video_url: e.target.value })} 
                    className="admin-input" 
                    placeholder="e.g., https://instagram.com/reel/... or /uploads/video.mp4"
                  />
                  <p className="text-xs text-gray-500 mt-1">Influencer testimonial video link</p>
                </div>

                <div className="md:col-span-2">
                  <label className="admin-label">Review *</label>
                  <textarea 
                    value={form.review} 
                    onChange={(e) => setForm({ ...form, review: e.target.value })} 
                    className="admin-input" 
                    rows={4}
                    placeholder="Customer review..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="admin-btn">
                  {saving ? "Saving..." : editingItem ? "Update Testimonial" : "Add Testimonial"}
                </button>
                <button 
                  onClick={() => { setShowForm(false); setEditingItem(null); }} 
                  className="admin-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Testimonials List */}
          <div className="space-y-3">
            {paginatedTestimonials.map((item) => (
              <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                    <span className="text-yellow-500">{'★'.repeat(item.rating)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{item.review}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.video_url && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                        🎥 Customer Video
                      </span>
                    )}
                    {item.influencer_video_url && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-600">
                        ⭐ Influencer Video
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Sort Order: {item.sort_order || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublish(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      item.is_active
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item.is_active ? 'Published' : 'Unpublished'}
                  </button>
                  <button 
                    onClick={() => router.push(`/testimonials/${item.id}`)}
                    className="admin-btn-secondary text-xs px-3 py-1.5"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)} 
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
            {testimonials.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center">No testimonials added yet. Click &quot;Add New Testimonial&quot; to create your first testimonial.</p>
            )}
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setForm((prev) => ({ ...prev, image_url: url }));
          setMessage("Image selected from library!");
          setTimeout(() => setMessage(""), 3000);
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
