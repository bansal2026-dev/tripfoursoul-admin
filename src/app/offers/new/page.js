"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import useStatusToast from "@/hooks/useStatusToast";

const emptyOffer = { title: "", description: "", image_url: "", button_text: "View offer", button_link: "/contact", badge: "", coupon_code: "", travel_start_date: "", travel_end_date: "", duration_days: "", duration: "", publish_duration_days: "", sort_order: 0, is_active: false };

export default function NewOfferPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyOffer);
  const [publishDurationOption, setPublishDurationOption] = useState("");
  const [packages, setPackages] = useState([]);
  const [linkType, setLinkType] = useState("/contact");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [message, setMessage] = useStatusToast();
  const inputRef = useRef(null);

  useEffect(() => {
    // Only published packages should be linkable from an offer.
    fetch("/api/packages")
      .then((response) => response.json())
      .then((data) => setPackages(data.packages || []))
      .catch(() => setPackages([]));
  }, []);

  useEffect(() => {
    fetch("/api/sort-order?table=offers").then((response) => response.json()).then((result) => {
      if (result.nextSortOrder) setForm((previous) => ({ ...previous, sort_order: result.nextSortOrder }));
    }).catch(() => {});
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeLinkType = (value) => {
    setLinkType(value);
    if (value !== "package" && value !== "custom") update("button_link", value);
  };
  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(""), 3000); };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      notify("Please upload only WebP (.webp) images.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const data = new FormData(); data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const result = await res.json();
      if (!res.ok || !result.imageUrl) throw new Error(result.error || "Image upload failed");
      update("image_url", result.imageUrl); notify("Offer image uploaded.");
    } catch (error) { notify(error.message || "Image upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, publish_duration_days: publishDurationOption === "custom" ? form.custom_publish_duration_days : publishDurationOption }), });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save offer");
      router.replace(`/offers/${result.offer.id}`);
    } catch (error) { notify(error.message || "Could not save offer."); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Add New Offer</h1>
          <button onClick={() => router.push("/offers")} className="admin-btn-secondary">← Back to List</button>
        </div>

        {message && <div className="mb-5 rounded-lg bg-teal-50 p-3 text-sm text-teal-700">{message}</div>}

        <form onSubmit={save} className="admin-card space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="admin-label">Offer title *</span>
              <input required value={form.title} onChange={(e) => update("title", e.target.value)} className="admin-input" placeholder="e.g. Europe summer special" />
            </label>
            <label>
              <span className="admin-label">Badge</span>
              <input value={form.badge} onChange={(e) => update("badge", e.target.value)} className="admin-input" placeholder="e.g. Limited time" />
            </label>
            <label>
              <span className="admin-label">Coupon code</span>
              <input value={form.coupon_code} onChange={(e) => update("coupon_code", e.target.value.toUpperCase())} className="admin-input" placeholder="e.g. SUMMER20" />
            </label>
            <label>
              <span className="admin-label">Travel start date</span>
              <input type="date" value={form.travel_start_date} onChange={(e) => update("travel_start_date", e.target.value)} className="admin-input" />
            </label>
            <label>
              <span className="admin-label">Travel end date</span>
              <input type="date" value={form.travel_end_date} onChange={(e) => update("travel_end_date", e.target.value)} className="admin-input" />
            </label>
            <label>
              <span className="admin-label">Duration days</span>
              <input type="number" min="1" step="1" value={form.duration_days} onChange={(e) => update("duration_days", e.target.value)} className="admin-input" placeholder="e.g. 5" />
            </label>
            <label>
              <span className="admin-label">Display duration</span>
              <input value={form.duration} onChange={(e) => update("duration", e.target.value)} className="admin-input" placeholder="e.g. 5 Days / 4 Nights" />
            </label>
            <label>
              <span className="admin-label">Publish on website for</span>
              <select value={publishDurationOption} onChange={(e) => setPublishDurationOption(e.target.value)} className="admin-input">
                <option value="">Until manually unpublished</option>
                <option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option>
                <option value="custom">Custom number of days</option>
              </select>
              {publishDurationOption === "custom" && <input type="number" min="1" step="1" required value={form.custom_publish_duration_days || ""} onChange={(e) => update("custom_publish_duration_days", e.target.value)} className="admin-input mt-2" placeholder="Enter number of days" />}
            </label>
            <label className="md:col-span-2">
              <span className="admin-label">Description</span>
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="admin-input" rows={3} placeholder="Short offer description" />
            </label>
            <label>
              <span className="admin-label">Button text</span>
              <input value={form.button_text} onChange={(e) => update("button_text", e.target.value)} className="admin-input" />
            </label>
            <label>
              <span className="admin-label">Link page</span>
              <select
                value={linkType}
                onChange={(e) => changeLinkType(e.target.value)}
                className="admin-input"
              >
                <option value="/">Home</option>
                <option value="/destinations">Destinations</option>
                <option value="package">Packages</option>
                <option value="/other-services">Other Services</option>
                <option value="/trips">Trips</option>
                <option value="/gallery">Gallery</option>
                <option value="/blog">Blog</option>
                <option value="/enquire-now">Enquire Now</option>
                <option value="/contact">Contact</option>
                <option value="/about">About</option>
                <option value="custom">Custom URL</option>
              </select>
              {linkType === "package" && (
                <select
                  value={packages.find((item) => form.button_link === `/package/${item.slug || item.id}`)?.id || ""}
                  onChange={(e) => {
                    const item = packages.find((packageItem) => packageItem.id === Number(e.target.value));
                    if (item) update("button_link", `/package/${item.slug || item.id}`);
                  }}
                  className="admin-input mt-2"
                >
                  <option value="">Select a package</option>
                  {packages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              )}
            </label>
            {linkType === "custom" && <label>
              <span className="admin-label">Button link</span>
              <input value={form.button_link} onChange={(e) => update("button_link", e.target.value)} className="admin-input" placeholder="/contact or https://..." />
            </label>}
            <label>
              <span className="admin-label">Sort order</span>
              <input type="number" value={form.sort_order} onChange={(e) => update("sort_order", Number(e.target.value))} className="admin-input" />
            </label>
            <label className="flex items-center gap-3 pt-7">
              <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} className="h-4 w-4 accent-teal-600" />
              <span className="text-sm font-medium">Publish on frontend</span>
            </label>
          </div>
          <div>
            <span className="admin-label">Offer image</span>
            <div className="flex flex-wrap gap-3">
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="admin-input max-w-md" disabled={uploading} />
              <input ref={inputRef} type="file" accept="image/webp,.webp" onChange={uploadImage} className="admin-input max-w-md" disabled={uploading} />
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
              <input value={form.image_url} onChange={(e) => update("image_url", e.target.value)} className="admin-input max-w-md" placeholder="Or paste image URL" />
            </div>
            {form.image_url && <img src={form.image_url} alt="Offer preview" className="mt-3 h-28 w-44 rounded-lg object-cover" />}
          </div>
          <div className="flex gap-3 pt-2">
            <button disabled={saving || uploading} className="admin-btn">{saving ? "Saving..." : "Create Offer"}</button>
            <button type="button" onClick={() => router.push("/offers")} className="admin-btn-secondary">Cancel</button>
          </div>
        </form>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          update("image_url", url);
          notify("Offer image selected from library!");
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
