"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import useStatusToast from "@/hooks/useStatusToast";

const MAX_BANNER_IMAGES = 5;

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
  const [mediaTarget, setMediaTarget] = useState(null); // 'banner' | 'banner_mobile'
  const [activeSlideForMedia, setActiveSlideForMedia] = useState(null);

  const fileInputRef = useRef(null);
  const mobileFileInputRef = useRef(null);

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
              body: JSON.stringify({
                image_url: img.image_url,
                mobile_image_url: img.mobile_image_url || "",
                sort_order: images.length + idx,
              }),
            })
          )
        );
      }

      // 4. Save modified existing images
      const modifiedImages = images.filter((img) => !img.isNew && img.isModified);
      if (modifiedImages.length > 0) {
        await Promise.all(
          modifiedImages.map((img) =>
            fetch("/api/banner/images", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: img.id,
                image_url: img.image_url,
                mobile_image_url: img.mobile_image_url || "",
                sort_order: img.sort_order,
                is_active: img.is_active !== false,
              }),
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
    if (images.length >= MAX_BANNER_IMAGES) {
      setMessage(`Maximum ${MAX_BANNER_IMAGES} banner images allowed! Please delete an existing slide first.`);
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setImages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), image_url: newImageUrl.trim(), mobile_image_url: "", isNew: true },
    ]);
    setNewImageUrl("");
    setMessage(`Image added to list (${images.length + 1}/${MAX_BANNER_IMAGES}). Click 'Save Banner Settings & Images' below to save changes.`);
    setTimeout(() => setMessage(""), 4000);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const nonWebp = files.some(f => f.type !== "image/webp" && !f.name.toLowerCase().endsWith(".webp"));
    if (nonWebp) {
      setMessage("Only WebP (.webp) images are allowed! Kripya .webp image select karein.");
      setTimeout(() => setMessage(""), 4000);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const remainingSlots = MAX_BANNER_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setMessage(`Maximum ${MAX_BANNER_IMAGES} banner images allowed! Please delete an existing slide first.`);
      setTimeout(() => setMessage(""), 4000);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setMessage(`Only ${remainingSlots} more image(s) can be added (max ${MAX_BANNER_IMAGES}). Uploading ${filesToUpload.length}...`);
    }

    setUploading(true);
    try {
      const uploadedSlides = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.imageUrl) {
          uploadedSlides.push({
            id: "temp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
            image_url: data.imageUrl,
            mobile_image_url: "",
            isNew: true,
          });
        }
      }

      if (uploadedSlides.length > 0) {
        setImages((prev) => [...prev, ...uploadedSlides]);
        setMessage(`${uploadedSlides.length} desktop banner(s) uploaded! (${images.length + uploadedSlides.length}/${MAX_BANNER_IMAGES}). You can optionally attach mobile banners below.`);
        setTimeout(() => setMessage(""), 4000);
      } else {
        setMessage("Failed to upload image(s)");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error uploading image");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerMobileUpload = (slideId) => {
    setActiveSlideForMedia(slideId);
    if (mobileFileInputRef.current) {
      mobileFileInputRef.current.value = "";
      mobileFileInputRef.current.click();
    }
  };

  const triggerMobileMediaLibrary = (slideId) => {
    setActiveSlideForMedia(slideId);
    setMediaTarget("banner_mobile");
    setShowMediaLibrary(true);
  };

  const handleMobileFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlideForMedia) return;

    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      setMessage("Only WebP (.webp) images are allowed! Kripya .webp image select karein.");
      setTimeout(() => setMessage(""), 4000);
      if (mobileFileInputRef.current) mobileFileInputRef.current.value = "";
      return;
    }

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
        setImages((prev) =>
          prev.map((img) =>
            img.id === activeSlideForMedia
              ? { ...img, mobile_image_url: data.imageUrl, isModified: true }
              : img
          )
        );
        setMessage("Mobile image uploaded! Click 'Save Banner Settings' below to save.");
        setTimeout(() => setMessage(""), 4000);
      } else {
        setMessage(data.error || "Failed to upload mobile image");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error uploading mobile image");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setUploading(false);
      if (mobileFileInputRef.current) mobileFileInputRef.current.value = "";
    }
  };

  const handleRemoveMobileImage = (slideId) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === slideId
          ? { ...img, mobile_image_url: "", isModified: true }
          : img
      )
    );
    setMessage("Mobile image removed. Desktop image will be used on mobile screens.");
    setTimeout(() => setMessage(""), 3000);
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
                value={settings.heading || ""}
                onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Subtitle</label>
              <textarea
                value={settings.subtitle || ""}
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
                  value={settings.button1_text || ""}
                  onChange={(e) => setSettings({ ...settings, button1_text: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="admin-label">Button 2 Text</label>
                <input
                  type="text"
                  value={settings.button2_text || ""}
                  onChange={(e) => setSettings({ ...settings, button2_text: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="admin-label">Button 2 Link</label>
                <input
                  type="text"
                  value={settings.button2_link || ""}
                  onChange={(e) => setSettings({ ...settings, button2_link: e.target.value })}
                  className="admin-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Banner Images */}
        <div className="admin-card mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-gray-900">Banner Images (Desktop & Mobile)</h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                images.length >= MAX_BANNER_IMAGES
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-teal-50 text-teal-700 border-teal-200"
              }`}>
                {images.length}/{MAX_BANNER_IMAGES} Slides
              </span>
            </div>
            <span className="text-xs text-gray-500">Upto {MAX_BANNER_IMAGES} slides allowed (Desktop & Mobile)</span>
          </div>

          {/* Hidden file input for mobile banner */}
          <input
            ref={mobileFileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleMobileFileUpload}
            className="hidden"
            disabled={uploading}
          />

          {/* Add Slide or Max Limit Alert */}
          {images.length >= MAX_BANNER_IMAGES ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6 text-xs text-amber-800 flex items-center gap-2.5">
              <span className="text-base">⚠️</span>
              <span>
                Maximum limit of <strong>{MAX_BANNER_IMAGES} banner slides</strong> reached ({images.length}/{MAX_BANNER_IMAGES}). To add a new desktop or mobile banner slide, please delete an existing slide below.
              </span>
            </div>
          ) : (
            <div className="space-y-3 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  Add New Banner Slide ({images.length + 1} of {MAX_BANNER_IMAGES})
                </h3>
                <span className="text-xs text-gray-500">Select up to {MAX_BANNER_IMAGES - images.length} images at once</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileUpload}
                  className="admin-input flex-1 min-w-[200px]"
                  disabled={uploading}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()} 
                  className="admin-btn whitespace-nowrap"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Desktop Banner"}
                </button>
                <button 
                  type="button"
                  onClick={() => { setMediaTarget("banner"); setShowMediaLibrary(true); }} 
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-xs"
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
                  placeholder="Or enter desktop banner image URL"
                  className="admin-input flex-1"
                />
                <button type="button" onClick={handleAddImage} className="admin-btn whitespace-nowrap">
                  Add from URL
                </button>
              </div>
            </div>
          )}

          {/* Slides List */}
          <div className="space-y-4">
            {images.map((img, idx) => (
              <div key={img.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-800">Slide #{idx + 1}</span>
                    {img.isNew && (
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                        Unsaved New
                      </span>
                    )}
                    {img.isModified && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        Modified
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    Delete Slide
                  </button>
                </div>

                {/* Content Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Desktop Banner */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <span>🖥️ Desktop Banner</span>
                        <span className="text-[10px] font-normal text-gray-400">(Landscape)</span>
                      </span>
                      <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        Required
                      </span>
                    </div>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                      <img src={img.image_url} alt="Desktop banner" className="w-full h-full object-cover" />
                    </div>
                  </div>

                  {/* Mobile Banner */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <span>📱 Mobile Banner</span>
                        <span className="text-[10px] font-normal text-gray-400">(Mobile devices)</span>
                      </span>
                      {img.mobile_image_url ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✓ Custom Mobile Image
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Uses Desktop Image
                        </span>
                      )}
                    </div>

                    {img.mobile_image_url ? (
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-emerald-300 bg-gray-100 group">
                        <img src={img.mobile_image_url} alt="Mobile banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => triggerMobileUpload(img.id)}
                            className="px-2.5 py-1 text-xs bg-white text-gray-800 rounded font-semibold hover:bg-gray-100 shadow-sm"
                          >
                            Upload New
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerMobileMediaLibrary(img.id)}
                            className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded font-semibold hover:bg-teal-700 shadow-sm"
                          >
                            Library
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMobileImage(img.id)}
                            className="px-2.5 py-1 text-xs bg-red-600 text-white rounded font-semibold hover:bg-red-700 shadow-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/70 p-3 flex flex-col items-center justify-center text-center gap-1.5">
                        <span className="text-xl">📱</span>
                        <p className="text-xs font-medium text-gray-600">
                          No mobile-specific banner set
                        </p>
                        <p className="text-[11px] text-gray-400 max-w-xs">
                          Mobile devices will automatically display the desktop image. Upload a portrait image for better mobile look.
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => triggerMobileUpload(img.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors shadow-xs"
                          >
                            + Upload Mobile Image
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerMobileMediaLibrary(img.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-xs"
                          >
                            Choose from Uploaded
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {images.length === 0 && (
            <p className="text-gray-400 text-sm">No banner images added yet.</p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="admin-btn disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Banner Settings & Images"}
            </button>
          </div>
        </div>

        {/* Current Banner Preview */}
        <div className="admin-card">
          <h2 className="text-lg font-semibold mb-4">Text Preview</h2>
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
        onClose={() => {
          setShowMediaLibrary(false);
          setActiveSlideForMedia(null);
        }}
        onSelectImage={(url) => {
          if (mediaTarget === "banner_mobile" && activeSlideForMedia) {
            setImages((prev) =>
              prev.map((img) =>
                img.id === activeSlideForMedia
                  ? { ...img, mobile_image_url: url, isModified: true }
                  : img
              )
            );
            setMessage("Mobile image selected! Click 'Save Banner Settings & Images' below to save changes.");
          } else {
            if (images.length >= MAX_BANNER_IMAGES) {
              setMessage(`Maximum ${MAX_BANNER_IMAGES} banner images allowed! Please delete an existing slide first.`);
              setShowMediaLibrary(false);
              setTimeout(() => setMessage(""), 4000);
              return;
            }
            setImages((prev) => [
              ...prev,
              { id: "temp-" + Date.now(), image_url: url, mobile_image_url: "", isNew: true },
            ]);
            setMessage(`Desktop image selected! (${images.length + 1}/${MAX_BANNER_IMAGES}) Click 'Save Banner Settings & Images' below to save changes.`);
          }
          setShowMediaLibrary(false);
          setActiveSlideForMedia(null);
          setTimeout(() => setMessage(""), 4000);
        }}
      />
    </div>
  );
}
