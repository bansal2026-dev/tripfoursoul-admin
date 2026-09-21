"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import DayWiseItineraryEditor from "@/components/DayWiseItineraryEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";
import { CURRENCIES, buildPricePayload, priceFromRecord } from "@/lib/price";
import useStatusToast from "@/hooks/useStatusToast";
import useDirtyForm from "@/hooks/useDirtyForm";

export default function EditPackagePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [destinations, setDestinations] = useState([]);
  const MAX_PACKAGE_IMAGES = 8;
  const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1 MB

  const [form, setForm] = useState({
    destination_id: "", title: "", days: "", meals: "", short_description: "",
    long_description: "", sub_heading: "", itinerary: "", additional_info: "", image_url: "",
    gallery_images: [], inclusives: "", exclusives: "", price_currency: "USD", price_value: "",
    sort_order: 0, is_trending: false, is_spiritual: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();
  const [messageType, setMessageType] = useState("error");
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const fileInputRef = useRef(null);

  // Destination modal state
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [destinationForm, setDestinationForm] = useState({
    name: "", image_url: "", region: "", price_currency: "USD", price_value: "", description: "", is_trending: 0, is_spiritual: 0,
  });
  const [destinationSaving, setDestinationSaving] = useState(false);
  const [destinationUploading, setDestinationUploading] = useState(false);
  const destinationFileInputRef = useRef(null);
  const { isDirty, markSaved } = useDirtyForm(form);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [pkgRes, destRes] = await Promise.all([
          // ?all=true so unpublished packages (drafts) can also be edited —
          // otherwise the form would stay empty for them.
          fetch(`/api/packages?all=true`),
          fetch("/api/destinations?all=true"),
        ]);
        const pkgData = await pkgRes.json();
        const destData = await destRes.json();
        const pkg = (pkgData.packages || []).find((p) => p.id === Number(id));
        if (active) {
          if (destData.destinations) setDestinations(destData.destinations);
          if (pkg) {
            const { currency, value } = priceFromRecord(pkg);
            let gallery = pkg.gallery_images;
            if (!Array.isArray(gallery)) {
              try { gallery = JSON.parse(pkg.gallery_images || '[]'); } catch { gallery = []; }
            }
            if (!gallery.length && pkg.image_url) {
              gallery = [pkg.image_url];
            }
            const normalizedGallery = gallery.slice(0, MAX_PACKAGE_IMAGES);
            const coverImage = (pkg.image_url && normalizedGallery.includes(pkg.image_url))
              ? pkg.image_url
              : (normalizedGallery[0] || pkg.image_url || "");

            setForm({
              destination_id: String(pkg.destination_id || ""),
              title: pkg.title || "",
              days: pkg.days || "",
              meals: pkg.meals || "",
              short_description: pkg.short_description || "",
              long_description: pkg.long_description || "",
              sub_heading: pkg.sub_heading || "",
              itinerary: pkg.itinerary || "",
              additional_info: pkg.additional_info || "",
              image_url: coverImage,
              gallery_images: normalizedGallery,
              inclusives: pkg.inclusives || "",
              exclusives: pkg.exclusives || "",
              price_currency: currency,
              price_value: value,
              sort_order: pkg.sort_order || 0,
              is_trending: !!pkg.is_trending,
              is_spiritual: !!pkg.is_spiritual,
            });
            markSaved({
              destination_id: String(pkg.destination_id || ""),
              title: pkg.title || "",
              days: pkg.days || "",
              meals: pkg.meals || "",
              short_description: pkg.short_description || "",
              long_description: pkg.long_description || "",
              sub_heading: pkg.sub_heading || "",
              itinerary: pkg.itinerary || "",
              additional_info: pkg.additional_info || "",
              image_url: coverImage,
              gallery_images: normalizedGallery,
              inclusives: pkg.inclusives || "",
              exclusives: pkg.exclusives || "",
              price_currency: currency,
              price_value: value,
              sort_order: pkg.sort_order || 0,
              is_trending: !!pkg.is_trending,
              is_spiritual: !!pkg.is_spiritual,
            });
          }
        }
      } catch (error) { console.error(error); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  const notify = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
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
      const payload = {
        ...form,
        image_url: coverImage,
        gallery_images: form.gallery_images,
        ...priceFields,
        id: Number(id),
      };
      const response = await fetch("/api/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        if (response.status === 413) throw new Error("Request payload is too large for the server (Nginx client_max_body_size limit exceeded). Try uploading smaller images or contact admin.");
        if (response.status === 401) throw new Error("Session expired or unauthorized. Please refresh and log in again.");
        if (response.status === 502 || response.status === 504) throw new Error("Server temporary gateway error (502/504). Please try again in a few moments.");
        throw new Error(`Server returned HTML response instead of JSON (Status ${response.status}).`);
      }
      if (!response.ok) throw new Error(data.error || "Unable to save package");
      notify("Package updated successfully.", "success");
      markSaved(payload);
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
        return { ...current, gallery_images, image_url: current.image_url || gallery_images[0] };
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

  // ---- Destination modal handlers ----
  const openAddDestination = () => {
    setEditingDestination(null);
    setDestinationForm({ name: "", image_url: "", region: "", price_currency: "USD", price_value: "", description: "", is_trending: 0, is_spiritual: 0 });
    setShowDestinationModal(true);
  };

  const openEditDestination = (dest) => {
    const { currency, value } = priceFromRecord(dest);
    setEditingDestination(dest);
    setDestinationForm({
      name: dest.name || "",
      image_url: dest.image_url || "",
      region: dest.region || "",
      price_currency: currency,
      price_value: value,
      description: dest.description || "",
      is_trending: dest.is_trending ? 1 : 0,
      is_spiritual: dest.is_spiritual ? 1 : 0,
    });
    setShowDestinationModal(true);
  };

  const saveDestination = async () => {
    if (!destinationForm.name || !destinationForm.region) {
      notify("Please fill destination name and region");
      return;
    }
    if (!destinationForm.image_url) {
      notify("Destination image is required");
      return;
    }
    const priceFields = buildPricePayload(destinationForm.price_currency, destinationForm.price_value);
    setDestinationSaving(true);
    try {
      const method = editingDestination ? "PUT" : "POST";
      const body = editingDestination
        ? { ...destinationForm, ...priceFields, id: editingDestination.id, is_active: 1 }
        : { ...destinationForm, ...priceFields, is_active: 1 };
      const res = await fetch("/api/destinations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save destination");

      // Refresh destinations list
      const destRes = await fetch("/api/destinations?all=true");
      const destData = await destRes.json();
      setDestinations(destData.destinations || []);

      // Auto-select the saved/edited destination
      if (editingDestination) {
        setForm((current) => ({ ...current, destination_id: String(editingDestination.id) }));
      } else if (data.id) {
        setForm((current) => ({ ...current, destination_id: String(data.id) }));
      }

      setShowDestinationModal(false);
      notify(editingDestination ? "Destination updated successfully!" : "Destination added successfully!", "success");
    } catch (error) { notify(error.message); }
    finally { setDestinationSaving(false); }
  };

  const uploadDestinationImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      notify("Upload failed: only WebP (.webp) images are accepted");
      if (destinationFileInputRef.current) destinationFileInputRef.current.value = "";
      return;
    }
    setMessage("");
    setDestinationUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Image upload failed");
      setDestinationForm((current) => ({ ...current, image_url: data.imageUrl }));
    } catch (error) { notify(error.message); }
    finally {
      setDestinationUploading(false);
      if (destinationFileInputRef.current) destinationFileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <LoadingSpinner text="Loading package..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Edit Package</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/packages")} className="admin-btn-secondary">← Back to List</button>
            <button onClick={save} disabled={saving || uploading || !isDirty} className="admin-btn disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving..." : isDirty ? "Update Package" : "No Changes to Save"}
            </button>
          </div>
        </div>
        {message && (
          <div className={`mb-6 rounded-lg p-4 ${messageType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message}
          </div>
        )}

        {/* ===== Destination Management Section ===== */}
        <div className="admin-card mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Destination Management</h2>
            <div className="flex gap-2">
              <button onClick={openAddDestination} className="admin-btn text-xs">+ Add New Destination</button>
              {form.destination_id && (
                <button
                  onClick={() => {
                    const dest = destinations.find((d) => d.id === Number(form.destination_id));
                    if (dest) openEditDestination(dest);
                  }}
                  className="admin-btn-secondary text-xs"
                >
                  Edit Selected
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="admin-label">Destination *</label>
              <select
                value={form.destination_id}
                onChange={(e) => setForm({ ...form, destination_id: e.target.value })}
                className="admin-input"
              >
                <option value="">Select destination</option>
                {destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">Select a destination or add/edit one using the buttons above.</p>
            </div>
            {form.destination_id && (() => {
              const dest = destinations.find((d) => d.id === Number(form.destination_id));
              if (!dest) return null;
              return (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  {dest.image_url && (
                    <img src={dest.image_url} alt={dest.name} className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{dest.name}</p>
                    <p className="text-xs text-gray-500">{dest.region}{dest.price ? ` · ${dest.price}` : ""}</p>
                    {dest.is_trending && (
                      <span className="mt-1 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">Trending</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ===== Package Details Section ===== */}
        <div className="admin-card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Package Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  accept="image/webp,.webp"
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
            <button onClick={save} disabled={saving || uploading || !isDirty} className="admin-btn disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : isDirty ? "Update Package" : "No Changes to Save"}</button>
            <button onClick={() => router.push("/packages")} className="admin-btn-secondary">Cancel</button>
          </div>
        </div>
      </main>

      {/* ===== Destination Modal ===== */}
      {showDestinationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingDestination ? "Edit Destination" : "Add New Destination"}
              </h3>
              <button onClick={() => setShowDestinationModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="admin-label">Destination Name *</label>
                <input
                  type="text"
                  value={destinationForm.name}
                  onChange={(e) => setDestinationForm({ ...destinationForm, name: e.target.value })}
                  className="admin-input"
                  placeholder="e.g., Europe, Bali, Switzerland"
                />
              </div>
              <div>
                <label className="admin-label">Region *</label>
                <input
                  type="text"
                  value={destinationForm.region}
                  onChange={(e) => setDestinationForm({ ...destinationForm, region: e.target.value })}
                  className="admin-input"
                  placeholder="e.g., Europe, Asia, Africa"
                />
              </div>
              <div>
                <label className="admin-label">Starting Price</label>
                <div className="flex gap-2">
                  <select
                    value={destinationForm.price_currency}
                    onChange={(e) => setDestinationForm({ ...destinationForm, price_currency: e.target.value })}
                    className="admin-input admin-price-currency"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={destinationForm.price_value}
                    onChange={(e) => setDestinationForm({ ...destinationForm, price_value: e.target.value })}
                    className="admin-input admin-price-amount"
                    placeholder="e.g., 1299"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Select currency and enter price number. The website shows the same currency.</p>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
                <input
                  type="checkbox"
                  checked={Boolean(destinationForm.is_trending)}
                  onChange={(e) => setDestinationForm({ ...destinationForm, is_trending: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 accent-teal-600"
                />
                Show in Trending Now section
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                <input
                  type="checkbox"
                  checked={Boolean(destinationForm.is_spiritual)}
                  onChange={(e) => setDestinationForm({ ...destinationForm, is_spiritual: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 accent-amber-500"
                />
                Show in Spiritual Escape section
              </label>
              <div className="md:col-span-2">
                <label className="admin-label">Destination Image</label>
                <div className="flex gap-2">
                  <input
                    ref={destinationFileInputRef}
                    type="file"
                    accept="image/webp,.webp"
                    onChange={uploadDestinationImage}
                    className="admin-input flex-1"
                    disabled={destinationUploading}
                  />
                  <button
                    type="button"
                    onClick={() => destinationFileInputRef.current?.click()}
                    className="admin-btn-secondary text-xs whitespace-nowrap"
                    disabled={destinationUploading}
                  >
                    {destinationUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">WebP only, up to 1 MB. An image is required.</p>
                {destinationForm.image_url && (
                  <div className="mt-2 flex items-start gap-3">
                    <img src={destinationForm.image_url} alt="Preview" className="h-32 w-48 rounded-lg border border-gray-200 object-cover" />
                    <button type="button" onClick={() => setDestinationForm((current) => ({ ...current, image_url: "" }))} className="admin-btn-danger text-xs whitespace-nowrap">Remove Image</button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="admin-label">Description</label>
                <RichTextEditor
                  value={destinationForm.description}
                  onChange={(html) => setDestinationForm({ ...destinationForm, description: html })}
                  rows={3}
                  placeholder="Brief description of the destination..."
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={saveDestination} disabled={destinationSaving} className="admin-btn">
                {destinationSaving ? "Saving..." : editingDestination ? "Update Destination" : "Add Destination"}
              </button>
              <button onClick={() => setShowDestinationModal(false)} className="admin-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={(url) => {
          if (form.gallery_images.includes(url)) {
            notify("Image is already added to package gallery", "error");
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
