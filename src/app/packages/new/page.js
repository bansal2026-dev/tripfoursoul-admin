"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RichTextEditor from "@/components/RichTextEditor";
import DayWiseItineraryEditor from "@/components/DayWiseItineraryEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import { CURRENCIES, buildPricePayload } from "@/lib/price";
import useStatusToast from "@/hooks/useStatusToast";

export default function NewPackagePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}><NewPackageContent /></Suspense>;
}

function NewPackageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destParam = searchParams.get("destination_id") || "";
  const [destinations, setDestinations] = useState([]);
  const MAX_PACKAGE_IMAGES = 8;
  const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1 MB

  const [form, setForm] = useState({
    destination_id: destParam, title: "", days: "", meals: "", short_description: "",
    long_description: "", sub_heading: "", itinerary: "", additional_info: "", image_url: "",
    gallery_images: [], inclusives: "", exclusives: "", price_currency: "USD", price_value: "",
    sort_order: 0, is_trending: false, is_spiritual: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/destinations");
        const data = await res.json();
        if (active) setDestinations(data.destinations || []);
      } catch (error) { console.error(error); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch("/api/sort-order?table=packages").then((response) => response.json()).then((result) => {
      if (result.nextSortOrder) setForm((previous) => ({ ...previous, sort_order: result.nextSortOrder }));
    }).catch(() => {});
  }, []);

  const notify = (text) => {
    setMessage(text);
  };

  const save = async () => {
    if (!form.gallery_images.length && !form.image_url) {
      notify("Package image is required");
      return;
    }
    const coverImage = (form.image_url && form.gallery_images.includes(form.image_url))
      ? form.image_url
      : (form.gallery_images[0] || form.image_url);

    setSaving(true);
    try {
      const priceFields = buildPricePayload(form.price_currency, form.price_value);
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image_url: coverImage, gallery_images: form.gallery_images, ...priceFields }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save package");
      router.replace(`/packages/${data.id}`);
    } catch (error) { notify(error.message); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e) => {
    const remainingSlots = MAX_PACKAGE_IMAGES - form.gallery_images.length;
    const files = Array.from(e.target.files || []);
    const clearSelectedFiles = () => { if (fileInputRef.current) fileInputRef.current.value = ''; };
    if (!files.length || remainingSlots <= 0) {
      notify(`A package can have a maximum of ${MAX_PACKAGE_IMAGES} images`);
      clearSelectedFiles();
      return;
    }
    if (files.length > remainingSlots) {
      notify(`You can upload only ${remainingSlots} more image${remainingSlots > 1 ? "s" : ""} for this package`);
      clearSelectedFiles();
      return;
    }
    if (files.some((file) => file.type !== "image/webp")) {
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
        return { ...current, gallery_images, image_url: current.image_url || gallery_images[0] };
      });
      notify("Image(s) uploaded successfully!");
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Add New Package</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/packages")} className="admin-btn-secondary">← Back to List</button>
            <button onClick={save} disabled={saving} className="admin-btn">
              {saving ? "Saving..." : "Save Package"}
            </button>
          </div>
        </div>
        {message && <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{message}</div>}

        <div className="admin-card space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="admin-label">Destination *</label>
              <select value={form.destination_id} onChange={(e) => setForm({ ...form, destination_id: e.target.value })} className="admin-input">
                <option value="">Select destination</option>
                {destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="admin-label">Package Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-input" placeholder="e.g., Europe Highlights Getaway" />
            </div>
            <div>
              <label className="admin-label">Starting Price</label>
              <div className="flex gap-2">
                <select value={form.price_currency} onChange={(e) => setForm({ ...form, price_currency: e.target.value })} className="admin-input admin-price-currency">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={form.price_value} onChange={(e) => setForm({ ...form, price_value: e.target.value })} className="admin-input admin-price-amount" placeholder="e.g., 1299" inputMode="numeric" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Select currency (USD/INR/EUR) and enter the price number. The website shows the same currency.</p>
            </div>
            <div>
              <label className="admin-label">Days</label>
              <input value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="admin-input" placeholder="e.g., 12 Days / 11 Nights" />
            </div>
            <div>
              <label className="admin-label">Meals</label>
              <input value={form.meals} onChange={(e) => setForm({ ...form, meals: e.target.value })} className="admin-input" placeholder="e.g., Breakfast & Dinner" />
            </div>
            <div>
              <label className="admin-label">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} className="admin-input" />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Sub-heading</label>
              <input value={form.sub_heading} onChange={(e) => setForm({ ...form, sub_heading: e.target.value })} className="admin-input" placeholder="Short highlight below the title" />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Short Description</label>
              <RichTextEditor value={form.short_description} onChange={(html) => setForm({ ...form, short_description: html })} rows={3} placeholder="Short description..." allowImageUpload />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Package Overview</label>
              <RichTextEditor value={form.long_description} onChange={(html) => setForm({ ...form, long_description: html })} rows={4} placeholder="Package overview..." allowImageUpload />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Day-wise Itinerary</label>
              <p className="mb-2 text-xs text-gray-500">Add each day separately with its title, location, and detailed plan.</p>
              <DayWiseItineraryEditor value={form.itinerary} onChange={(itinerary) => setForm({ ...form, itinerary })} />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Additional Info</label>
              <RichTextEditor value={form.additional_info} onChange={(html) => setForm({ ...form, additional_info: html })} rows={3} placeholder="Extra package notes, customization details, or special instructions." allowImageUpload />
            </div>
            <div>
              <label className="admin-label">Inclusions</label>
              <RichTextEditor value={form.inclusives} onChange={(html) => setForm({ ...form, inclusives: html })} rows={3} placeholder="One per line" uniformTextSize allowImageUpload />
              <p className="mt-1 text-xs text-gray-500">Leave blank to hide this section on the website.</p>
            </div>
            <div>
              <label className="admin-label">Exclusions</label>
              <RichTextEditor value={form.exclusives} onChange={(html) => setForm({ ...form, exclusives: html })} rows={3} placeholder="One per line" uniformTextSize allowImageUpload />
              <p className="mt-1 text-xs text-gray-500">Leave blank to hide this section on the website.</p>
            </div>
            <div className="md:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={!!form.is_trending}
                  onChange={(e) => setForm({ ...form, is_trending: e.target.checked })}
                  className="h-4 w-4"
                />
                Trending Now
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={!!form.is_spiritual}
                  onChange={(e) => setForm({ ...form, is_spiritual: e.target.checked })}
                  className="h-4 w-4"
                />
                Spiritual Escape
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Package Images *</label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/webp"
                  onChange={handleImageUpload}
                  className="admin-input flex-1"
                  disabled={uploading || form.gallery_images.length >= MAX_PACKAGE_IMAGES}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="admin-btn-secondary text-xs whitespace-nowrap"
                  disabled={uploading || form.gallery_images.length >= MAX_PACKAGE_IMAGES}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  disabled={form.gallery_images.length >= MAX_PACKAGE_IMAGES}
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Upload up to {MAX_PACKAGE_IMAGES} WebP images, max 1 MB each. Click &quot;Set as Cover&quot; on any image to choose your cover photo. Cover photo will only show on cards; other images will show inside the package page. ({form.gallery_images.length}/{MAX_PACKAGE_IMAGES})
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
                        <img src={url} alt="Package preview" className="w-full h-24 object-cover" />
                        {isCover ? (
                          <span className="absolute top-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm flex items-center gap-1">
                            ✓ Cover
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setForm((c) => ({ ...c, image_url: url }))}
                            className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                          >
                            Set as Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 rounded-full bg-red-600 text-white w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 shadow-sm"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving} className="admin-btn">{saving ? "Saving..." : "Save Package"}</button>
            <button onClick={() => router.push("/packages")} className="admin-btn-secondary">Cancel</button>
          </div>
        </div>
      </main>

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          if (form.gallery_images.includes(url)) {
            setMessage("Image is already added to package gallery");
            return;
          }
          setForm((c) => ({
            ...c,
            image_url: c.image_url || url,
            gallery_images: [...c.gallery_images, url],
          }));
          setMessage("Image selected from library!");
        }}
        currentImageUrl={form.image_url}
      />
    </div>
  );
}
