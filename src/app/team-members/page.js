"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";
import MediaLibraryModal from "@/components/MediaLibraryModal";

export default function TeamMembersPage() {
  const [team, setTeam] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState({ name: "", role: "", bio: "", image_url: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  const {
    currentItems: paginatedTeam,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(team, 10);

  useEffect(() => { fetchTeam(); }, []);

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      if (data.team) setTeam(data.team);
    } catch (error) { console.error(error); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (res.ok && result.imageUrl) {
        setForm(prev => ({ ...prev, image_url: result.imageUrl }));
        setMessage("Image uploaded successfully!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) { console.error(error); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSave = async () => {
    if (!form.name || !form.role) {
      setMessage("Name and Role are required!");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    setSaving(true);
    try {
      if (editingMember) {
        await fetch("/api/team-members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id: editingMember.id, is_active: 1 }),
        });
        setMessage("Team member updated successfully!");
      } else {
        await fetch("/api/team-members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setMessage("Team member added successfully!");
      }
      setTimeout(() => setMessage(""), 3000);
      setForm({ name: "", role: "", bio: "", image_url: "", sort_order: 0 });
      setShowForm(false);
      setEditingMember(null);
      fetchTeam();
    } catch (error) { 
      setMessage("Error saving team member");
      console.error(error); 
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this team member?")) return;
    try {
      await fetch(`/api/team-members?id=${id}`, { method: "DELETE" });
      setMessage("Team member deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
      fetchTeam();
    } catch (error) { console.error(error); }
  };

  const startEdit = (member) => {
    setEditingMember(member);
    setForm({
      name: member.name,
      role: member.role,
      bio: member.bio || "",
      image_url: member.image_url || "",
      sort_order: member.sort_order || 0,
    });
    setShowForm(true);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Members Management</h1>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Team Members</h2>
            <button 
              onClick={() => { setShowForm(true); setEditingMember(null); setForm({ name: "", role: "", bio: "", image_url: "", sort_order: 0 }); }}
              className="admin-btn"
            >
              Add New Member
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleImageUpload}
            className="hidden"
            disabled={uploading}
          />

          {/* Add/Edit Form */}
          {(showForm || editingMember) && (
            <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
              <h3 className="text-lg font-semibold mb-4">{editingMember ? "Edit Team Member" : "Add New Team Member"}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="e.g., John Doe" />
                </div>
                <div>
                  <label className="admin-label">Role *</label>
                  <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="admin-input" placeholder="e.g., Travel Consultant" />
                </div>
                <div className="md:col-span-2">
                  <label className="admin-label">Bio</label>
                  <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="admin-input" rows={3} placeholder="Short bio..." />
                </div>
                <div>
                  <label className="admin-label">Image</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary text-xs whitespace-nowrap" disabled={uploading}>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose from Uploaded
                    </button>
                    <input type="text" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="admin-input flex-1" placeholder="Image URL..." />
                  </div>
                  {form.image_url && <img src={form.image_url} alt="" className="w-16 h-16 rounded-full object-cover mt-2 border" />}
                  {form.image_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <img src={form.image_url} alt="" className="w-16 h-16 rounded-full object-cover border" />
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
                  <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="admin-input" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="admin-btn">
                  {saving ? "Saving..." : editingMember ? "Update Member" : "Add Member"}
                </button>
                <button onClick={() => { setShowForm(false); setEditingMember(null); }} className="admin-btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Team List */}
          <div className="space-y-3">
            {paginatedTeam.map((member) => (
              <div key={member.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <img src={member.image_url || "https://tripforsoul.com/public/img/logo.png"} alt={member.name} className="w-14 h-14 rounded-full object-cover border" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{member.name}</h4>
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{member.role}</span>
                  </div>
                  {member.bio && <p className="text-sm text-gray-600 mb-1">{member.bio}</p>}
                  <p className="text-xs text-gray-400">Sort: {member.sort_order || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(member)} className="admin-btn-secondary text-xs px-3 py-1.5">Edit</button>
                  <button onClick={() => handleDelete(member.id)} className="admin-btn-danger text-xs px-3 py-1.5">Delete</button>
                </div>
              </div>
            ))}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
            {team.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center">No team members added yet. Click "Add New Member" to create one.</p>
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
