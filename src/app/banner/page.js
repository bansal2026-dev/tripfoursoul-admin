"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import useStatusToast from "@/hooks/useStatusToast";

export default function BannerPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    heading: "",
    subtitle: "",
    button1_text: "Find Now",
    button2_text: "View All Packages",
    button2_link: "/packages",
  });
  const [images, setImages] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  const fetchBannerData = async () => {
    try {
      const res = await fetch("/api/banner");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.images) setImages(data.images);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/banner");
        const data = await res.json();
        if (active) {
          if (data.settings) setSettings(data.settings);
          if (data.images) setImages(data.images);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const [deletedImageIds, setDeletedImageIds] = useState([]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage("");
    try {
      // 1. Save banner text settings
      const res = await fetch("/api/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      // 2. Delete removed images from database
      if (deletedImageIds.length > 0) {
        await Promise.all(
          deletedImageIds.map((id) => fetch(`/api/banner/images?id=${id}`, { method: "DELETE" }))
        );
        setDeletedImageIds([]);
      }

      // 3. Save newly uploaded / added images to database
      const newImages = images.filter((img) => img.isNew);
      if (newImages.length > 0) {
        await Promise.all(
          newImages.map((img, idx) =>
            fetch("/api/banner/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: img.image_url, sort_order: images.length + idx }),
            })
          )
        );
      }

      if (res.ok) {
        setMessage("Banner settings and images saved successfully!");
        setTimeout(() => setMessage(""), 3000);
        fetchBannerData();
      }
    } catch (error) {
      setMessage("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), image_url: newImageUrl.trim(), isNew: true },
    ]);
    setNewImageUrl("");
    setMessage("Image added to list. Click 'Save Banner Settings' below to save changes.");
    setTimeout(() => setMessage(""), 4000);
  };

  const handleFileUpload = async (e) => {
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
        // Add to preview state only - saved to DB when user clicks Save Banner Settings
        setImages((prev) => [
          ...prev,
          { id: "temp-" + Date.now(), image_url: data.imageUrl, isNew: true },
        ]);
        setMessage("Image uploaded! Click 'Save Banner Settings' below to save changes.");
        setTimeout(() => setMessage(""), 4000);
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

  const handleDeleteImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (typeof id === "number" || (typeof id === "string" && !id.startsWith("temp-"))) {
      setDeletedImageIds((prev) => [...prev, id]);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Banner Management</h1>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            {message}
          </div>
        )}

        {loading && <LoadingSpinner text="Loading banner data..." />}

        {/* Banner Text Settings */}
        <div className="admin-card mb-8">
          <h2 className="text-lg font-semibold mb-4">Banner Text Content</h2>
          <div className="space-y-4">
            <div>
              <label className="admin-label">Heading</label>
              <input
                type="text"
                value={settings.heading}
                onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Subtitle</label>
              <textarea
                value={settings.subtitle}
                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                className="admin-input"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="admin-label">Button 1 Text</label>
                <input
                  type="text"
                  value={settings.button1_text}
                  onChange={(e) => setSettings({ ...settings, button1_text: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="admin-label">Button 2 Text</label>
                <input
                  type="text"
                  value={settings.button2_text}
                  onChange={(e) => setSettings({ ...settings, button2_text: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="admin-label">Button 2 Link</label>
                <input
                  type="text"
                  value={settings.button2_link}
                  onChange={(e) => setSettings({ ...settings, button2_link: e.target.value })}
                  className="admin-input"
                />
              </div>
            </div>
            <button onClick={handleSaveSettings} disabled={saving} className="admin-btn">
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Banner Images */}
        <div className="admin-card mb-8">
          <h2 className="text-lg font-semibold mb-4">Banner Images</h2>
          
          {/* Add Image */}
          <div className="space-y-3 mb-6">
            {/* File Upload */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleFileUpload}
                className="admin-input flex-1"
                disabled={uploading}
              />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="admin-btn whitespace-nowrap"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload from System"}
              </button>
            </div>
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileUpload}
                  className="admin-input flex-1"
                  disabled={uploading}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="admin-btn whitespace-nowrap"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload from System"}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowMediaLibrary(true)} 
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={uploading}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>

            {/* URL Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Or enter image URL"
                className="admin-input flex-1"
              />
              <button onClick={handleAddImage} className="admin-btn whitespace-nowrap">
                Add from URL
              </button>
            </div>
          </div>

          {/* Image List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img src={img.image_url} alt="" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleDeleteImage(img.id)}
                    className="admin-btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-gray-400 text-sm">No banner images added yet.</p>
          )}
        </div>

        {/* Current Banner Preview */}
        <div className="admin-card">
          <h2 className="text-lg font-semibold mb-4">Preview</h2>
          <div className="bg-gray-900 rounded-lg p-6 text-white text-center">
            <h3 className="text-xl font-bold mb-2">{settings.heading}</h3>
            <p className="text-gray-300 text-sm">{settings.subtitle}</p>
            <div className="flex justify-center gap-3 mt-4">
              <span className="px-4 py-2 bg-teal-500 rounded-full text-xs">{settings.button1_text}</span>
              <span className="px-4 py-2 bg-white/20 rounded-full text-xs">{settings.button2_text}</span>
            </div>
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setImages((prev) => [
            ...prev,
            { id: "temp-" + Date.now(), image_url: url, isNew: true },
          ]);
          setMessage("Image selected from library! Click 'Save Banner Settings' below to save changes.");
          setTimeout(() => setMessage(""), 4000);
        }}
      />
    </div>
  );
}
