"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import { CURRENCIES, buildPricePayload, priceFromRecord } from "@/lib/price";
import useStatusToast from "@/hooks/useStatusToast";
import useDirtyForm from "@/hooks/useDirtyForm";

const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_DESTINATION_IMAGES = 10;

export default function EditDestinationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [form, setForm] = useState({ name: "", image_url: "", gallery_images: [], region: "", price_currency: "USD", price_value: "", description: "", sort_order: 0, is_trending: 0, is_spiritual: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [messageType, setMessageType] = useState("error");
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);
  const { isDirty, markSaved } = useDirtyForm(form);

  const notify = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/destinations?all=true`);
        const data = await res.json();
        const dest = (data.destinations || []).find((d) => d.id === Number(id));
        if (active && dest) {
          const { currency, value } = priceFromRecord(dest);
          let gallery = dest.gallery_images;
          if (!Array.isArray(gallery)) { try { gallery = JSON.parse(dest.gallery_images || '[]'); } catch { gallery = []; } }
          if (!Array.isArray(gallery)) gallery = [];
          if (!gallery.length && dest.image_url) gallery = [dest.image_url];
          setForm({
            name: dest.name,
            image_url: dest.image_url,
            gallery_images: gallery.slice(0, MAX_DESTINATION_IMAGES),
            region: dest.region,
            price_currency: currency,
            price_value: value,
            description: dest.description || "",
            sort_order: dest.sort_order || 0,
            is_trending: dest.is_trending ? 1 : 0,
            is_spiritual: dest.is_spiritual ? 1 : 0,
          });
          markSaved({
            name: dest.name,
            image_url: dest.image_url,
            gallery_images: gallery.slice(0, MAX_DESTINATION_IMAGES),
            region: dest.region,
            price_currency: currency,
            price_value: value,
            description: dest.description || "",
            sort_order: dest.sort_order || 0,
            is_trending: dest.is_trending ? 1 : 0,
            is_spiritual: dest.is_spiritual ? 1 : 0,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const setCoverImage = (url) => {
    setForm((current) => ({
      ...current,
      image_url: url,
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.region) {
      notify("Destination name and region are required");
      return;
    }
    if (!form.gallery_images.length) {
      notify("At least one destination image is required");
      return;
    }
    setSaving(true);
    try {
      const coverImage = (form.image_url && form.gallery_images.includes(form.image_url))
        ? form.image_url
        : (form.gallery_images[0] || "");
      const priceFields = buildPricePayload(form.price_currency, form.price_value);
      const res = await fetch("/api/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image_url: coverImage, gallery_images: form.gallery_images, ...priceFields, id: Number(id), is_active: 1 }),
      });
      if (res.ok) {
        notify("Destination updated successfully.", "success");
        markSaved(form);
      } else {
        const data = await res.json();
        notify(data.error || "Error saving destination");
      }
    } catch (error) {
      notify("Error saving destination");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const remainingSlots = MAX_DESTINATION_IMAGES - form.gallery_images.length;
    const files = Array.from(e.target.files || []);
    const clearSelectedFiles = () => { if (fileInputRef.current) fileInputRef.current.value = ''; };
    if (!files.length || remainingSlots <= 0) {
      notify(`A destination can have a maximum of ${MAX_DESTINATION_IMAGES} images`);
      clearSelectedFiles();
      return;
    }
    if (files.length > remainingSlots) {
      notify(`You can upload only ${remainingSlots} more image${remainingSlots > 1 ? "s" : ""} for this destination`);
      clearSelectedFiles();
      return;
    }
    if (files.some((file) => file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp"))) {
      notify("Upload failed: only WebP (.webp) images are accepted");
      clearSelectedFiles();
      return;
    }
    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      notify("Upload failed: each image must be 1 MB or smaller");
      clearSelectedFiles();
      return;
    }
    setMessage("");
    setUploading(true);
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok || !data.imageUrl) throw new Error(data.error || "Image upload failed");
        return data.imageUrl;
      }));
      setForm((current) => {
        const gallery_images = [...current.gallery_images, ...uploads];
        return { ...current, gallery_images, image_url: current.image_url || gallery_images[0] || "" };
      });
      notify("Image(s) uploaded successfully!", "success");
    } catch (error) {
      notify(error.message || "Error uploading image");
    } finally {
      setUploading(false);
      clearSelectedFiles();
    }
  };

  const removeImage = (index) => {
    setForm((current) => {
      const removedUrl = current.gallery_images[index];
      const gallery_images = current.gallery_images.filter((_, i) => i !== index);
      const isCoverRemoved = current.image_url === removedUrl;
      const image_url = isCoverRemoved ? (gallery_images[0] || "") : current.image_url;
      return { ...current, gallery_images, image_url };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <LoadingSpinner text="Loading destination..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Destination</h1>
          <button onClick={() => router.push("/destinations")} className="admin-btn-secondary">← Back to List</button>
        </div>

        {message && <div role="alert" className={`p-4 rounded-lg mb-6 ${messageType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message}</div>}

        <div className="admin-card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Destination Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="e.g., Europe, Bali, Switzerland" />
            </div>
            <div>
              <label className="admin-label">Region *</label>
              <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="admin-input" placeholder="e.g., Europe, Asia, Africa" />
            </div>
            <div>
              <label className="admin-label">Starting Price</label>
              <div className="flex gap-2">
                <select value={form.price_currency} onChange={(e) => setForm({ ...form, price_currency: e.target.value })} className="admin-input admin-price-currency">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" inputMode="numeric" value={form.price_value} onChange={(e) => setForm({ ...form, price_value: e.target.value })} className="admin-input admin-price-amount" placeholder="e.g., 1299" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Select currency (USD/INR/EUR) and enter the price number. The website shows the same currency.</p>
            </div>
            <div>
              <label className="admin-label">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="admin-input" />
            </div>
            <label className="md:col-span-2 flex items-center gap-3 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
              <input type="checkbox" checked={Boolean(form.is_trending)} onChange={(e) => setForm({ ...form, is_trending: e.target.checked ? 1 : 0 })} className="h-4 w-4 accent-teal-600" />
              Show this destination in the Trending Now section
            </label>
            <label className="md:col-span-2 flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              <input type="checkbox" checked={Boolean(form.is_spiritual)} onChange={(e) => setForm({ ...form, is_spiritual: e.target.checked ? 1 : 0 })} className="h-4 w-4 accent-amber-500" />
              Show this destination in the Spiritual Escape section
            </label>
            <div className="md:col-span-2">
              <label className="admin-label">Destination Images *</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" multiple accept="image/webp,.webp" onChange={handleImageUpload} className="admin-input flex-1" disabled={uploading || form.gallery_images.length >= MAX_DESTINATION_IMAGES} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary text-xs whitespace-nowrap" disabled={uploading || form.gallery_images.length >= MAX_DESTINATION_IMAGES}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={form.gallery_images.length >= MAX_DESTINATION_IMAGES}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Upload up to {MAX_DESTINATION_IMAGES} WebP images, max 1 MB each. Click &quot;Set as Cover&quot; on any image to choose your cover photo. Cover photo will only show on cards; other images will show inside the destination page. ({form.gallery_images.length}/{MAX_DESTINATION_IMAGES})
              </p>
              {form.gallery_images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {form.gallery_images.map((url, index) => {
                    const isCover = form.image_url ? url === form.image_url : index === 0;
                    return (
                      <div
                        key={`${url}-${index}`}
                        className={`relative rounded-lg overflow-hidden border transition-all ${
                          isCover ? "ring-2 ring-emerald-500 border-emerald-500 shadow-sm" : "border-gray-200"
                        }`}
                      >
                        <img src={url} alt="Destination image" className="w-full h-24 object-cover" />
                        {isCover ? (
                          <span className="absolute top-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm flex items-center gap-1">
                            ✓ Cover
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCoverImage(url)}
                            className="absolute top-1 left-1 rounded bg-black/60 hover:bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors shadow-sm"
                          >
                            Set as Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors shadow-sm"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Description</label>
              <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} rows={3} placeholder="Brief description of the destination..." allowImageUpload />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || uploading || !isDirty} className="admin-btn disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : isDirty ? "Update Destination" : "No Changes to Save"}</button>
            <button onClick={() => router.push("/destinations")} className="admin-btn-secondary">Cancel</button>
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          if (form.gallery_images.includes(url)) {
            notify("Image is already added to gallery", "error");
            return;
          }
          setForm((c) => ({
            ...c,
            image_url: c.image_url || url,
            gallery_images: [...c.gallery_images, url],
          }));
          notify("Image selected from library!", "success");
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
