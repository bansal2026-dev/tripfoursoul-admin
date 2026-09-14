"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import useStatusToast from "@/hooks/useStatusToast";
import RichTextEditor from "@/components/RichTextEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";

const TABS = [
  { id: "banner", label: "Banner" },
  { id: "about", label: "About Us" },
  { id: "trending", label: "Trending" },
  { id: "features", label: "Features" },
  { id: "testimonials", label: "Testimonials" },
  { id: "deals", label: "Deals" },
  { id: "sections", label: "Sections" },
];

const emptyFeature = { icon: "", title: "", description: "", sort_order: 0 };
const emptyTestimonial = { name: "", image_url: "", rating: 5, review: "", sort_order: 0, video_url: "", influencer_video_url: "" };

function HomepageSettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [selectedTab, setSelectedTab] = useState(null);
  const activeTab = selectedTab || (TABS.some((tab) => tab.id === requestedTab) ? requestedTab : "banner");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useStatusToast();
  const [messageType, setMessageType] = useState("success");
  const [savedSections, setSavedSections] = useState("");
  const [savingSections, setSavingSections] = useState(false);

  // Features state
  const [features, setFeatures] = useState([]);
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [featureForm, setFeatureForm] = useState(emptyFeature);
  const [savingFeature, setSavingFeature] = useState(false);

  // Testimonials state
  const [testimonials, setTestimonials] = useState([]);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState(emptyTestimonial);
  const [savingTestimonial, setSavingTestimonial] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Banner images state
  const [bannerImages, setBannerImages] = useState([]);
  const [deletedBannerImageIds, setDeletedBannerImageIds] = useState([]);
  const [newBannerImageUrl, setNewBannerImageUrl] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerFileInputRef = useRef(null);

  // About section image state
  const [aboutUploading, setAboutUploading] = useState(false);
  const aboutFileInputRef = useRef(null);

  // Media Library Modal state
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaTarget, setMediaTarget] = useState(null); // 'banner' | 'about' | 'testimonial'

  const handleSelectMediaImage = (url) => {
    if (mediaTarget === "banner") {
      setBannerImages((prev) => [
        ...prev,
        { id: "temp-" + Date.now(), image_url: url, isNew: true },
      ]);
      showMessage("Image selected! Click 'Save Banner Images' to save to database.", "success");
    } else if (mediaTarget === "about") {
      updateAboutField("image_url", url);
      showMessage("About image selected! Click 'Save About Settings' below to save to database.", "success");
    } else if (mediaTarget === "testimonial") {
      setTestimonialForm((prev) => ({ ...prev, image_url: url }));
      showMessage("Image selected from library!", "success");
    }
    setShowMediaLibrary(false);
  };

  const showMessage = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/banner").then(r => r.json()).catch(() => ({ settings: null, images: [] })),
        fetch("/api/about").then(r => r.json()).catch(() => ({})),
        fetch("/api/trending").then(r => r.json()).catch(() => ({ settings: null, items: [] })),
        fetch("/api/features?all=true").then(r => r.json()).catch(() => ({ features: [] })),
        fetch("/api/testimonials?all=true").then(r => r.json()).catch(() => ({ testimonials: [] })),
        fetch("/api/deals").then(r => r.json()).catch(() => ({})),
        fetch("/api/sections").then(r => r.json()).catch(() => ({ sections: [] })),
      ]);
      setData({
        banner: responses[0],
        about: { about: responses[1] },
        trending: responses[2],
        features: responses[3],
        testimonials: responses[4],
        deals: { settings: responses[5] },
        sections: responses[6],
      });
      if (responses[6].sections) setSavedSections(JSON.stringify(responses[6].sections));
      if (responses[0].images) setBannerImages(responses[0].images);
      if (responses[3].features) setFeatures(responses[3].features);
      if (responses[4].testimonials) setTestimonials(responses[4].testimonials);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchAllData();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showMessage("Saved successfully!");
      } else {
        const result = await res.json().catch(() => ({}));
        showMessage(result.error || "Error saving", "error");
      }
      await fetchAllData();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Network error while saving", "error");
    }
  };

  const toggleSection = (section) => {
    setData((previous) => ({
      ...previous,
      sections: {
        ...previous.sections,
        sections: previous.sections.sections.map((item) => item.id === section.id
          ? { ...item, is_visible: item.is_visible ? 0 : 1 }
          : item),
      },
    }));
  };

  const moveSection = (section, direction) => {
    const sections = [...(data.sections?.sections || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const index = sections.findIndex((item) => item.id === section.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
    [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
    setData((previous) => ({
      ...previous,
      sections: {
        ...previous.sections,
        sections: sections.map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 })),
      },
    }));
  };

  const saveSections = async () => {
    setSavingSections(true);
    try {
      const sections = [...(data.sections?.sections || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      const response = await fetch("/api/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: sections.map((item, itemIndex) => ({ id: item.id, sort_order: itemIndex + 1, is_visible: item.is_visible })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save section changes");
      showMessage("Section changes saved successfully!");
      await fetchAllData();
    } catch (error) {
      showMessage(error.message || "Could not save section changes", "error");
    } finally {
      setSavingSections(false);
    }
  };

  // Banner field updates
  const updateBannerField = (field, value) => {
    setData(prev => ({
      ...prev,
      banner: {
        ...prev.banner,
        settings: { ...prev.banner?.settings, [field]: value }
      }
    }));
  };

  // About field updates
  const updateAboutField = (field, value) => {
    setData(prev => ({
      ...prev,
      about: {
        ...prev.about,
        about: { ...prev.about?.about, [field]: value }
      }
    }));
  };

  // Trending field updates
  const updateTrendingField = (field, value) => {
    setData(prev => ({
      ...prev,
      trending: {
        ...prev.trending,
        settings: { ...prev.trending?.settings, [field]: value }
      }
    }));
  };

  // Deals field updates
  const updateDealsField = (field, value) => {
    setData(prev => ({
      ...prev,
      deals: {
        ...prev.deals,
        settings: { ...prev.deals?.settings, [field]: value }
      }
    }));
  };

  // ============ FEATURES CRUD ============
  const toggleFeaturePublish = async (feature) => {
    try {
      await fetch("/api/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: feature.id, is_active: feature.is_active ? 0 : 1 }),
      });
      showMessage(`Feature "${feature.title}" ${feature.is_active ? 'unpublished' : 'published'}!`);
      fetchAllData();
    } catch (error) {
      showMessage("Error updating feature", "error");
    }
  };

  const handleFeatureSave = async () => {
    setSavingFeature(true);
    try {
      if (editingFeature) {
        await fetch("/api/features", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...featureForm, id: editingFeature.id, is_active: 1 }),
        });
        showMessage("Feature updated successfully!");
      } else {
        await fetch("/api/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...featureForm, is_active: 1 }),
        });
        showMessage("Feature added successfully!");
      }
      setFeatureForm(emptyFeature);
      setShowFeatureForm(false);
      setEditingFeature(null);
      fetchAllData();
    } catch (error) {
      showMessage("Error saving feature", "error");
    } finally {
      setSavingFeature(false);
    }
  };

  const handleFeatureDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this feature?")) return;
    try {
      await fetch(`/api/features?id=${id}`, { method: "DELETE" });
      showMessage("Feature deleted successfully!");
      fetchAllData();
    } catch (error) {
      showMessage("Error deleting feature", "error");
    }
  };

  const startFeatureEdit = (feature) => {
    setEditingFeature(feature);
    setFeatureForm({
      icon: feature.icon,
      title: feature.title,
      description: feature.description,
      sort_order: feature.sort_order || 0,
    });
    setShowFeatureForm(true);
  };

  // ============ TESTIMONIALS CRUD ============
  const toggleTestimonialPublish = async (item) => {
    try {
      await fetch("/api/testimonials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: item.is_active ? 0 : 1 }),
      });
      showMessage(`Testimonial "${item.name}" ${item.is_active ? 'unpublished' : 'published'}!`);
      fetchAllData();
    } catch (error) {
      showMessage("Error updating testimonial", "error");
    }
  };

  const handleTestimonialSave = async () => {
    setSavingTestimonial(true);
    try {
      if (editingTestimonial) {
        await fetch("/api/testimonials", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...testimonialForm, id: editingTestimonial.id, is_active: 1 }),
        });
        showMessage("Testimonial updated successfully!");
      } else {
        await fetch("/api/testimonials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...testimonialForm, is_active: 1 }),
        });
        showMessage("Testimonial added successfully!");
      }
      setTestimonialForm(emptyTestimonial);
      setShowTestimonialForm(false);
      setEditingTestimonial(null);
      fetchAllData();
    } catch (error) {
      showMessage("Error saving testimonial", "error");
    } finally {
      setSavingTestimonial(false);
    }
  };

  const handleTestimonialDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await fetch(`/api/testimonials?id=${id}`, { method: "DELETE" });
      showMessage("Testimonial deleted successfully!");
      fetchAllData();
    } catch (error) {
      showMessage("Error deleting testimonial", "error");
    }
  };

  const startTestimonialEdit = (item) => {
    setEditingTestimonial(item);
    setTestimonialForm({
      name: item.name,
      image_url: item.image_url,
      rating: item.rating || 5,
      review: item.review,
      sort_order: item.sort_order || 0,
      video_url: item.video_url || "",
      influencer_video_url: item.influencer_video_url || "",
    });
    setShowTestimonialForm(true);
  };

  const handleTestimonialImageUpload = async (e) => {
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
        setTestimonialForm(prev => ({ ...prev, image_url: data.imageUrl }));
        showMessage("Image uploaded successfully!");
      } else {
        showMessage(data.error || "Failed to upload image", "error");
      }
    } catch (error) {
      showMessage("Error uploading image", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============ BANNER IMAGES ============
  const handleBannerImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.imageUrl) {
        setBannerImages((prev) => [
          ...prev,
          { id: "temp-" + Date.now(), image_url: data.imageUrl, isNew: true },
        ]);
        showMessage("Image uploaded! Click 'Save Banner Images' to save to database.", "success");
      } else {
        showMessage(data.error || "Failed to upload image", "error");
      }
    } catch (error) {
      showMessage("Error uploading image", "error");
    } finally {
      setBannerUploading(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  // ============ ABOUT SECTION IMAGE ============
  const handleAboutImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAboutUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok && result.imageUrl) {
        updateAboutField("image_url", result.imageUrl);
        showMessage("About image uploaded! Click 'Save About Settings' below to save to database.", "success");
      } else {
        showMessage(result.error || "Failed to upload image", "error");
      }
    } catch (error) {
      showMessage("Error uploading image", "error");
    } finally {
      setAboutUploading(false);
      if (aboutFileInputRef.current) aboutFileInputRef.current.value = '';
    }
  };

  const handleAddBannerImageUrl = () => {
    if (!newBannerImageUrl.trim()) return;
    setBannerImages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), image_url: newBannerImageUrl.trim(), isNew: true },
    ]);
    setNewBannerImageUrl("");
    showMessage("Image added! Click 'Save Banner Images' to save to database.", "success");
  };

  const handleDeleteBannerImage = (id) => {
    setBannerImages((prev) => prev.filter((img) => img.id !== id));
    if (typeof id === "number" || (typeof id === "string" && !id.startsWith("temp-"))) {
      setDeletedBannerImageIds((prev) => [...prev, id]);
    }
  };

  const handleSaveBannerImages = async () => {
    try {
      if (deletedBannerImageIds.length > 0) {
        await Promise.all(
          deletedBannerImageIds.map((id) => fetch(`/api/banner/images?id=${id}`, { method: "DELETE" }))
        );
        setDeletedBannerImageIds([]);
      }
      const newImages = bannerImages.filter((img) => img.isNew);
      if (newImages.length > 0) {
        await Promise.all(
          newImages.map((img, idx) =>
            fetch("/api/banner/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: img.image_url, sort_order: bannerImages.length + idx }),
            })
          )
        );
      }
      showMessage("Banner images saved successfully!");
      fetchAllData();
    } catch (error) {
      showMessage("Error saving banner images", "error");
    }
  };

  const handleSaveBanner = async (e) => {
    if (e) e.preventDefault();
    await save("/api/banner", { ...data.banner?.settings });
    await handleSaveBannerImages();
  };

  if (loading) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8">Loading...</main></div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Homepage Settings</h1>
        <p className="text-gray-500 mb-6">Manage all homepage sections and settings in one place.</p>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${messageType === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            {message}
          </div>
        )}

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "banner" && (
          <>
            <div className="admin-card mb-8">
              <h2 className="text-lg font-semibold mb-4">Banner Settings</h2>
              {data.banner?.settings && (
                <form onSubmit={handleSaveBanner} className="space-y-4">
                  <div>
                    <label className="admin-label">Heading</label>
                    <input type="text" value={data.banner.settings.heading || ""} onChange={(e) => updateBannerField("heading", e.target.value)} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">Subtitle</label>
                    <textarea value={data.banner.settings.subtitle || ""} onChange={(e) => updateBannerField("subtitle", e.target.value)} className="admin-input" rows={2} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="admin-label">Button 1 Text</label>
                      <input type="text" value={data.banner.settings.button1_text || ""} onChange={(e) => updateBannerField("button1_text", e.target.value)} className="admin-input" />
                    </div>
                    <div>
                      <label className="admin-label">Button 2 Text</label>
                      <input type="text" value={data.banner.settings.button2_text || ""} onChange={(e) => updateBannerField("button2_text", e.target.value)} className="admin-input" />
                    </div>
                    <div>
                      <label className="admin-label">Button 2 Link</label>
                      <input type="text" value={data.banner.settings.button2_link || ""} onChange={(e) => updateBannerField("button2_link", e.target.value)} className="admin-input" />
                    </div>
                  </div>
                  <button type="submit" className="admin-btn">Save Banner Settings</button>
                </form>
              )}
            </div>

            {/* Banner Images */}
            <div className="admin-card">
              <h2 className="text-lg font-semibold mb-4">Banner Images</h2>

              {/* Add Image */}
              <div className="space-y-3 mb-6">
                <div className="flex gap-3">
                  <input
                    ref={bannerFileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleBannerImageUpload}
                    className="admin-input flex-1"
                    disabled={bannerUploading}
                  />
                  <button
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="admin-btn whitespace-nowrap"
                    disabled={bannerUploading}
                  >
                    {bannerUploading ? "Uploading..." : "Upload from System"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMediaTarget("banner"); setShowMediaLibrary(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                    disabled={bannerUploading}
                    title="Choose an existing image from uploaded library"
                  >
                    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Choose from Uploaded
                  </button>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newBannerImageUrl}
                    onChange={(e) => setNewBannerImageUrl(e.target.value)}
                    placeholder="Or enter image URL"
                    className="admin-input flex-1"
                  />
                  <button onClick={handleAddBannerImageUrl} className="admin-btn whitespace-nowrap">
                    Add from URL
                  </button>
                </div>
              </div>

              {/* Image List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bannerImages.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.image_url} alt="" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteBannerImage(img.id)}
                        className="admin-btn-danger text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {bannerImages.length === 0 && (
                <p className="text-gray-400 text-sm">No banner images added yet.</p>
              )}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={handleSaveBannerImages} className="admin-btn">
                  Save Banner Images
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "about" && (
          <div className="admin-card">
            <h2 className="text-lg font-semibold mb-4">About Us Settings</h2>
            {data.about?.about && (
              <form onSubmit={(e) => { e.preventDefault(); save("/api/about", { ...data.about.about }); }} className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.about.about.heading || ""} onChange={(e) => updateAboutField("heading", e.target.value)} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Subheading</label>
                  <input type="text" value={data.about.about.subheading || ""} onChange={(e) => updateAboutField("subheading", e.target.value)} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <RichTextEditor value={data.about.about.description || ""} onChange={(html) => updateAboutField("description", html)} rows={5} placeholder="Tell visitors about TripForSoul..." allowImageUpload />
                  <p className="mt-1 text-xs text-gray-500">Rich text, lists and inline images are supported.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">CTA Text</label>
                    <input type="text" value={data.about.about.cta_text || ""} onChange={(e) => updateAboutField("cta_text", e.target.value)} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">CTA Link</label>
                    <input type="text" value={data.about.about.cta_link || ""} onChange={(e) => updateAboutField("cta_link", e.target.value)} className="admin-input" />
                  </div>
                </div>
                <div>
                  <label className="admin-label">About Section Image</label>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => aboutFileInputRef.current?.click()}
                      className="admin-btn-secondary text-xs whitespace-nowrap"
                      disabled={aboutUploading}
                    >
                      {aboutUploading ? "Uploading..." : "Upload Image"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMediaTarget("about"); setShowMediaLibrary(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                      disabled={aboutUploading}
                      title="Choose an existing image from uploaded library"
                    >
                      <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose from Uploaded
                    </button>
                    <input
                      ref={aboutFileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAboutImageUpload}
                      className="hidden"
                      disabled={aboutUploading}
                    />
                    <input
                      type="text"
                      value={data.about.about.image_url || ""}
                      onChange={(e) => updateAboutField("image_url", e.target.value)}
                      className="admin-input flex-1"
                      placeholder="Image URL..."
                    />
                  </div>
                  {data.about.about.image_url ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={data.about.about.image_url} alt="About section" className="w-48 h-32 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => updateAboutField("image_url", "")}
                        className="admin-btn-danger text-xs whitespace-nowrap"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Upload an image to show on the homepage About Us section.</p>
                  )}
                </div>
                <button type="submit" className="admin-btn">Save About Settings</button>
              </form>
            )}
          </div>
        )}

        {activeTab === "trending" && (
          <div className="admin-card">
            <h2 className="text-lg font-semibold mb-4">Trending Settings</h2>
            {data.trending?.settings && (
              <form onSubmit={(e) => { e.preventDefault(); save("/api/trending", { ...data.trending.settings }); }} className="space-y-4">
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.trending.settings.heading || ""} onChange={(e) => updateTrendingField("heading", e.target.value)} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Subtitle</label>
                  <input type="text" value={data.trending.settings.subtitle || ""} onChange={(e) => updateTrendingField("subtitle", e.target.value)} className="admin-input" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={data.trending.settings.is_enabled} onChange={(e) => updateTrendingField("is_enabled", e.target.checked)} id="trending-enabled" />
                  <label htmlFor="trending-enabled" className="admin-label mb-0">Enable Trending Section</label>
                </div>
                <button type="submit" className="admin-btn">Save Trending Settings</button>
              </form>
            )}
          </div>
        )}

        {activeTab === "features" && (
          <div className="admin-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Features Management</h2>
              <button
                onClick={() => router.push("/features/new")}
                className="admin-btn"
              >
                Add New Feature
              </button>
            </div>

            {/* Feature Add/Edit Form */}
            {(showFeatureForm || editingFeature) && (
              <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
                <h3 className="text-lg font-semibold mb-4">{editingFeature ? "Edit Feature" : "Add New Feature"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">Icon Name *</label>
                    <input
                      type="text"
                      value={featureForm.icon}
                      onChange={(e) => setFeatureForm({ ...featureForm, icon: e.target.value })}
                      className="admin-input"
                      placeholder="e.g., best-price, easy-booking, support"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use icon names like: best-price, easy-booking, support</p>
                  </div>
                  <div>
                    <label className="admin-label">Sort Order</label>
                    <input
                      type="number"
                      value={featureForm.sort_order}
                      onChange={(e) => setFeatureForm({ ...featureForm, sort_order: parseInt(e.target.value) || 0 })}
                      className="admin-input"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">Title *</label>
                    <input
                      type="text"
                      value={featureForm.title}
                      onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })}
                      className="admin-input"
                      placeholder="e.g., Best Price Guarantee"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">Description *</label>
                    <textarea
                      value={featureForm.description}
                      onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                      className="admin-input"
                      rows={3}
                      placeholder="Feature description..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleFeatureSave} disabled={savingFeature} className="admin-btn">
                    {savingFeature ? "Saving..." : editingFeature ? "Update Feature" : "Add Feature"}
                  </button>
                  <button
                    onClick={() => { setShowFeatureForm(false); setEditingFeature(null); }}
                    className="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Features List */}
            <div className="space-y-3">
              {features.slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((feature) => (
                <div key={feature.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                      onClick={() => toggleFeaturePublish(feature)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        feature.is_active
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {feature.is_active ? 'Published' : 'Unpublished'}
                    </button>
                    <button onClick={() => router.push(`/features/${feature.id}`)} className="admin-btn-secondary text-xs px-3 py-1.5">
                      Edit
                    </button>
                    <button onClick={() => handleFeatureDelete(feature.id)} className="admin-btn-danger text-xs px-3 py-1.5">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {features.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">No features added yet. Click Add New Feature to create your first feature.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "testimonials" && (
          <div className="admin-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Testimonials Management</h2>
              <button
                onClick={() => router.push("/testimonials/new")}
                className="admin-btn"
              >
                Add New Testimonial
              </button>
            </div>

            {/* Testimonial Add/Edit Form */}
            {(showTestimonialForm || editingTestimonial) && (
              <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
                <h3 className="text-lg font-semibold mb-4">{editingTestimonial ? "Edit Testimonial" : "Add New Testimonial"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">Customer Name *</label>
                    <input
                      type="text"
                      value={testimonialForm.name}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                      className="admin-input"
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div>
                    <label className="admin-label">Rating</label>
                    <select
                      value={testimonialForm.rating}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, rating: parseInt(e.target.value) })}
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
                        onChange={handleTestimonialImageUpload}
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
                        onClick={() => { setMediaTarget("testimonial"); setShowMediaLibrary(true); }}
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
                    {testimonialForm.image_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={testimonialForm.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-full border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => setTestimonialForm((prev) => ({ ...prev, image_url: "" }))}
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
                      value={testimonialForm.sort_order}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, sort_order: parseInt(e.target.value) || 0 })}
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="admin-label">Customer Video URL</label>
                    <input
                      type="text"
                      value={testimonialForm.video_url}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, video_url: e.target.value })}
                      className="admin-input"
                      placeholder="e.g., https://youtube.com/watch?v=... or /uploads/video.mp4"
                    />
                    <p className="text-xs text-gray-500 mt-1">YouTube/Vimeo link or uploaded video file</p>
                  </div>
                  <div>
                    <label className="admin-label">Influencer Video URL</label>
                    <input
                      type="text"
                      value={testimonialForm.influencer_video_url}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, influencer_video_url: e.target.value })}
                      className="admin-input"
                      placeholder="e.g., https://instagram.com/reel/... or /uploads/video.mp4"
                    />
                    <p className="text-xs text-gray-500 mt-1">Influencer testimonial video link</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">Review *</label>
                    <textarea
                      value={testimonialForm.review}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, review: e.target.value })}
                      className="admin-input"
                      rows={4}
                      placeholder="Customer review..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleTestimonialSave} disabled={savingTestimonial} className="admin-btn">
                    {savingTestimonial ? "Saving..." : editingTestimonial ? "Update Testimonial" : "Add Testimonial"}
                  </button>
                  <button
                    onClick={() => { setShowTestimonialForm(false); setEditingTestimonial(null); }}
                    className="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Testimonials List */}
            <div className="space-y-3">
              {testimonials.slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((item) => (
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
                      onClick={() => toggleTestimonialPublish(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        item.is_active
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {item.is_active ? 'Published' : 'Unpublished'}
                    </button>
                    <button onClick={() => router.push(`/testimonials/${item.id}`)} className="admin-btn-secondary text-xs px-3 py-1.5">
                      Edit
                    </button>
                    <button onClick={() => handleTestimonialDelete(item.id)} className="admin-btn-danger text-xs px-3 py-1.5">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {testimonials.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">No testimonials added yet. Click Add New Testimonial to create your first testimonial.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "deals" && (
          <div className="admin-card">
            <h2 className="text-lg font-semibold mb-4">Deals Settings</h2>
            {data.deals?.settings && (
              <form onSubmit={(e) => { e.preventDefault(); save("/api/deals", { ...data.deals.settings }); }} className="space-y-4">
                <div>
                  <label className="admin-label">Tagline</label>
                  <input type="text" value={data.deals.settings.tagline || ""} onChange={(e) => updateDealsField("tagline", e.target.value)} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Heading</label>
                  <input type="text" value={data.deals.settings.heading || ""} onChange={(e) => updateDealsField("heading", e.target.value)} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Description</label>
                  <textarea value={data.deals.settings.description || ""} onChange={(e) => updateDealsField("description", e.target.value)} className="admin-input" rows={2} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">Button Text</label>
                    <input type="text" value={data.deals.settings.button_text || ""} onChange={(e) => updateDealsField("button_text", e.target.value)} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">Button Behavior</label>
                    <p className="admin-input bg-gray-50 text-gray-600 text-sm cursor-not-allowed">Opens the offers popup</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <h3 className="text-base font-semibold text-gray-900">Right Card</h3>
                  <div>
                    <label className="admin-label">Card Tagline</label>
                    <input type="text" value={data.deals.settings.card_tagline || ""} onChange={(e) => updateDealsField("card_tagline", e.target.value)} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">Card Heading</label>
                    <textarea value={data.deals.settings.card_heading || ""} onChange={(e) => updateDealsField("card_heading", e.target.value)} className="admin-input" rows={3} />
                  </div>
                  <div>
                    <label className="admin-label">Card Description</label>
                    <textarea value={data.deals.settings.card_description || ""} onChange={(e) => updateDealsField("card_description", e.target.value)} className="admin-input" rows={2} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">The Deals button always opens a popup showing your published offers — it does not link anywhere.</p>
                <button type="submit" className="admin-btn">Save Deals Settings</button>
              </form>
            )}
          </div>
        )}

        {activeTab === "sections" && (
          <div className="admin-card">
            <h2 className="text-lg font-semibold mb-4">Homepage Sections Visibility</h2>
            <p className="text-sm text-gray-500 mb-4">Toggle visibility and use the arrows to change the section order.</p>
            <div className="space-y-3">
              {[...(data.sections?.sections || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((section, index, orderedSections) => (
                <div key={section.id} className={`flex items-center justify-between p-3 border rounded-lg ${section.is_visible ? "border-gray-200" : "border-gray-300 bg-gray-50 opacity-75"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveSection(section, -1)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${section.section_name} up`}>▲</button>
                      <button type="button" disabled={index === orderedSections.length - 1} onClick={() => moveSection(section, 1)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${section.section_name} down`}>▼</button>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">{index + 1}</span>
                  <div className="min-w-0">
                    <span className="font-medium">{section.section_name}</span>
                    <span className="text-xs text-gray-500 ml-2">({section.section_key})</span>
                    {section.is_visible ? (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Visible</span>
                    ) : (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Hidden</span>
                    )}
                  </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Visible</span>
                      <button
                        onClick={() => toggleSection(section)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${section.is_visible ? "bg-teal-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${section.is_visible ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={saveSections}
                disabled={savingSections || savedSections === JSON.stringify(data.sections?.sections || [])}
                className="admin-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSections ? "Saving..." : savedSections === JSON.stringify(data.sections?.sections || []) ? "No Changes to Save" : "Save Section Changes"}
              </button>
            </div>
          </div>
        )}
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => {
          setShowMediaLibrary(false);
          setMediaTarget(null);
        }}
        onSelectImage={handleSelectMediaImage}
      />
    </div>
  );
}

export default function HomepageSettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <HomepageSettingsPageContent />
    </Suspense>
  );
}
