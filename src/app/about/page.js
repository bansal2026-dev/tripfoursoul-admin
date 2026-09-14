"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import useStatusToast from "@/hooks/useStatusToast";
import MediaLibraryModal from "@/components/MediaLibraryModal";

export default function AboutPage() {
  const [data, setData] = useState({
    heading: "",
    subheading: "",
    description: "",
    features: "",
    cta_text: "",
    cta_link: "",
    image_url: "",
    premium_heading: "",
    premium_description: "",
    premium_button_text: "",
    premium_button_link: "",
    experience_heading: "",
    experience_description_title: "",
    experience_description: "",
    experience_subheading: "",
    experience_list: "[]",
    experience_image: "",
    why_heading: "",
    why_description: "",
    why_image: "",
    promise_heading: "",
    promise_subheading: "",
    promise_description: "",
    promise_list: "[]",
    promise_image: "",
    difference_heading: "",
    difference_description: "",
    difference_subheading: "",
    difference_list: "[]",
    difference_image: "",
    cta_heading: "",
    cta_description: "",
    cta_button_text: "",
    cta_button_link: ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");
  const fileInputRef = useRef(null);
  const [uploadField, setUploadField] = useState("image_url");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/about");
      if (res.ok) {
        const result = await res.json();
        setData(prev => ({ ...prev, ...result }));
      }
    } catch (error) { console.error(error); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setMessage("About Us updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) { 
      setMessage("Error updating About Us");
      console.error(error); 
    }
    finally { setSaving(false); }
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

      const result = await res.json();

      if (res.ok && result.imageUrl) {
        setData(prev => ({ ...prev, [uploadField]: result.imageUrl }));
        setMessage("Image uploaded successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(result.error || "Failed to upload image");
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

  const tabs = [
    { id: "hero", label: "Hero Section" },
    { id: "premium", label: "Premium Travel" },
    { id: "experience", label: "Curated Travel" },
    { id: "why", label: "Service Beyond" },
    { id: "promise", label: "Our Commitment" },
    { id: "difference", label: "Difference" },
    { id: "cta", label: "CTA Section" },
  ];

  const renderImageUpload = (field, label) => (
    <div>
      <label className="admin-label">{label}</label>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => { setUploadField(field); fileInputRef.current?.click(); }}
          className="admin-btn-secondary text-xs whitespace-nowrap"
          disabled={uploading}
        >
          {uploading && uploadField === field ? "Uploading..." : "Upload Image"}
        </button>
        <button
          type="button"
          onClick={() => { setUploadField(field); setShowMediaLibrary(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
          disabled={uploading}
          title="Choose an existing image from uploaded library"
        >
          <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Choose from Uploaded
        </button>
        <input
          type="text"
          value={data[field] || ""}
          onChange={(e) => setData({ ...data, [field]: e.target.value })}
          className="admin-input flex-1"
          placeholder="Image URL..."
        />
      </div>
      {data[field] && (
        <div className="mt-2">
        <div className="mt-2 flex items-center gap-3">
          <img src={data[field]} alt={label} className="w-48 h-32 object-cover rounded-lg border border-gray-200" />
          <button
            type="button"
            onClick={() => setData({ ...data, [field]: "" })}
            className="admin-btn-danger text-xs whitespace-nowrap"
          >
            Remove Image
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">About Us Management</h1>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
          disabled={uploading}
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-card">
          {/* === HERO SECTION TAB === */}
          {activeTab === "hero" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">Hero Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.heading} onChange={(e) => setData({ ...data, heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Subheading</label>
                  <input type="text" value={data.subheading} onChange={(e) => setData({ ...data, subheading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} className="admin-input" rows={4} />
                </div>
                <div>
                  <label className="admin-label">Features (JSON array)</label>
                  <textarea value={data.features} onChange={(e) => setData({ ...data, features: e.target.value })} className="admin-input font-mono text-sm" rows={3} placeholder='["Feature 1", "Feature 2"]' />
                  <p className="text-xs text-gray-500 mt-1">JSON array format</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">CTA Button Text</label>
                    <input type="text" value={data.cta_text} onChange={(e) => setData({ ...data, cta_text: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">CTA Button Link</label>
                    <input type="text" value={data.cta_link} onChange={(e) => setData({ ...data, cta_link: e.target.value })} className="admin-input" />
                  </div>
                </div>
                {renderImageUpload("image_url", "Hero Image")}
              </div>
            </div>
          )}

          {/* === PREMIUM TRAVEL TAB === */}
          {activeTab === "premium" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">Premium Travel Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.premium_heading} onChange={(e) => setData({ ...data, premium_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.premium_description} onChange={(e) => setData({ ...data, premium_description: e.target.value })} className="admin-input" rows={5} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">Button Text</label>
                    <input type="text" value={data.premium_button_text} onChange={(e) => setData({ ...data, premium_button_text: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">Button Link</label>
                    <input type="text" value={data.premium_button_link} onChange={(e) => setData({ ...data, premium_button_link: e.target.value })} className="admin-input" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === CURATED TRAVEL (EXPERIENCE) TAB === */}
          {activeTab === "experience" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">Curated Travel Moments Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.experience_heading} onChange={(e) => setData({ ...data, experience_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description Title (bold text)</label>
                  <textarea value={data.experience_description_title} onChange={(e) => setData({ ...data, experience_description_title: e.target.value })} className="admin-input" rows={2} />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.experience_description} onChange={(e) => setData({ ...data, experience_description: e.target.value })} className="admin-input" rows={6} />
                </div>
                <div>
                  <label className="admin-label">Subheading (e.g. "What We Do Best")</label>
                  <input type="text" value={data.experience_subheading} onChange={(e) => setData({ ...data, experience_subheading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">List Items (JSON array)</label>
                  <textarea value={data.experience_list} onChange={(e) => setData({ ...data, experience_list: e.target.value })} className="admin-input font-mono text-sm" rows={5} placeholder='["Item 1", "Item 2"]' />
                </div>
                {renderImageUpload("experience_image", "Experience Image")}
              </div>
            </div>
          )}

          {/* === WHY / SERVICE BEYOND TAB === */}
          {activeTab === "why" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">Service Beyond Expectations Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.why_heading} onChange={(e) => setData({ ...data, why_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.why_description} onChange={(e) => setData({ ...data, why_description: e.target.value })} className="admin-input" rows={8} />
                </div>
                {renderImageUpload("why_image", "Why Section Image")}
              </div>
            </div>
          )}

          {/* === OUR COMMITMENT TAB === */}
          {activeTab === "promise" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">Our Commitment Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.promise_heading} onChange={(e) => setData({ ...data, promise_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Subheading</label>
                  <textarea value={data.promise_subheading} onChange={(e) => setData({ ...data, promise_subheading: e.target.value })} className="admin-input" rows={2} />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.promise_description} onChange={(e) => setData({ ...data, promise_description: e.target.value })} className="admin-input" rows={5} />
                </div>
                <div>
                  <label className="admin-label">List Items (JSON array)</label>
                  <textarea value={data.promise_list} onChange={(e) => setData({ ...data, promise_list: e.target.value })} className="admin-input font-mono text-sm" rows={5} placeholder='["Item 1", "Item 2"]' />
                </div>
                {renderImageUpload("promise_image", "Promise Section Image")}
              </div>
            </div>
          )}

          {/* === WHAT MAKES US DIFFERENT TAB === */}
          {activeTab === "difference" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">What Makes Us Different Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.difference_heading} onChange={(e) => setData({ ...data, difference_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.difference_description} onChange={(e) => setData({ ...data, difference_description: e.target.value })} className="admin-input" rows={5} />
                </div>
                <div>
                  <label className="admin-label">Subheading (e.g. "What Sets Us Apart")</label>
                  <input type="text" value={data.difference_subheading} onChange={(e) => setData({ ...data, difference_subheading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">List Items (JSON array)</label>
                  <textarea value={data.difference_list} onChange={(e) => setData({ ...data, difference_list: e.target.value })} className="admin-input font-mono text-sm" rows={6} placeholder='["Item 1", "Item 2"]' />
                </div>
                {renderImageUpload("difference_image", "Difference Section Image")}
              </div>
            </div>
          )}

          {/* === CTA TAB === */}
          {activeTab === "cta" && (
            <div>
              <h2 className="text-lg font-semibold mb-6">CTA (Call to Action) Section</h2>
              <div className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.cta_heading} onChange={(e) => setData({ ...data, cta_heading: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.cta_description} onChange={(e) => setData({ ...data, cta_description: e.target.value })} className="admin-input" rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">Button Text</label>
                    <input type="text" value={data.cta_button_text} onChange={(e) => setData({ ...data, cta_button_text: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">Button Link</label>
                    <input type="text" value={data.cta_button_link} onChange={(e) => setData({ ...data, cta_button_link: e.target.value })} className="admin-input" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving} className="admin-btn">
              {saving ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          setData((prev) => ({ ...prev, [uploadField]: url }));
          setMessage("Image selected from library!");
          setTimeout(() => setMessage(""), 3000);
        }}
        currentImageUrl={data[uploadField]}
      />
    </div>
  );
}
