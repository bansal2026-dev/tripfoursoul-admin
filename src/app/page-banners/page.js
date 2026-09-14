"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import Pagination, { usePagination } from "@/components/Pagination";
import { PAGE_KEYS, getPageConfig } from "@/lib/pageBanners";

export default function PageBannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filters = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "unpublished", label: "Unpublished" },
    { id: "customized", label: "Configured" },
    { id: "empty", label: "No Image" },
  ];

  const fetchBanners = async () => {
    try {
      const res = await fetch("/api/page-banners");
      const data = await res.json();
      const bannerMap = {};
      if (data.banners) {
        data.banners.forEach((b) => {
          if (b.page_key) bannerMap[b.page_key] = b;
        });
      }
      setBanners(bannerMap);
    } catch (error) {
      console.error("Error fetching banners:", error);
      toast.error("Could not load page banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/page-banners");
        const data = await res.json();
        const bannerMap = {};
        if (data.banners) {
          data.banners.forEach((b) => {
            if (b.page_key) bannerMap[b.page_key] = b;
          });
        }
        if (active) setBanners(bannerMap);
      } catch (error) {
        console.error("Error fetching banners:", error);
        if (active) toast.error("Could not load page banners");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const togglePublish = async (pageKey) => {
    const banner = banners[pageKey];
    const page = getPageConfig(pageKey);
    const newActive = banner ? (banner.is_active ? 0 : 1) : 1;

    setActionLoading(pageKey);
    try {
      const res = await fetch("/api/page-banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: pageKey,
          heading: "",
          subheading: "",
          background_image: banner?.background_image || banner?.image_url || "",
          is_active: newActive,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setBanners((prev) => ({
        ...prev,
        [pageKey]: {
          ...(prev[pageKey] || {
            page_key: pageKey,
            heading: "",
            subheading: "",
            background_image: "",
          }),
          is_active: newActive,
        },
      }));
      toast.success(newActive ? `Banner for "${page.label}" published!` : `Banner for "${page.label}" unpublished!`);
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Error updating banner status");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/page-banners?page_key=${encodeURIComponent(deleteTarget)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset banner");

      setBanners((prev) => {
        const copy = { ...prev };
        delete copy[deleteTarget];
        return copy;
      });
      toast.success("Banner image removed!");
    } catch (error) {
      console.error("Error deleting banner:", error);
      toast.error("Could not reset banner");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const seenKeys = new Set();
  const allPageKeys = [];
  [...PAGE_KEYS, ...Object.keys(banners).map((k) => getPageConfig(k))].forEach((page) => {
    if (page && page.key && !seenKeys.has(page.key.toLowerCase())) {
      seenKeys.add(page.key.toLowerCase());
      allPageKeys.push(page);
    }
  });

  const filteredItems = allPageKeys.filter((page) => {
    const banner = banners[page.key];
    const hasImage = Boolean(banner?.background_image || banner?.image_url);
    const isActive = banner ? Boolean(banner.is_active) : true;

    if (activeFilter === "published" && (!hasImage || !isActive)) return false;
    if (activeFilter === "unpublished" && (!hasImage || isActive)) return false;
    if (activeFilter === "customized" && !hasImage) return false;
    if (activeFilter === "empty" && hasImage) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = page.label.toLowerCase().includes(q);
      const matchKey = page.key.toLowerCase().includes(q);
      if (!matchName && !matchKey) return false;
    }

    return true;
  });

  const {
    currentItems: paginatedItems,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(filteredItems, 10);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Page Banners Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage banner images for each page across the website.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/page-banners/new")}
            className="admin-btn"
          >
            + Add New Banner
          </button>
        </div>

        <section className="admin-card">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                All Page Banners ({filteredItems.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search by page name or key..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="admin-input py-1.5 px-3 text-xs w-56"
              />

              <div className="flex flex-wrap gap-1.5" aria-label="Filter page banners">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFilter(f.id);
                      setCurrentPage(1);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activeFilter === f.id
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner text="Loading page banners..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3 font-semibold">Page Banner</th>
                    <th className="px-3 py-3 font-semibold">Page Key</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((page) => {
                    const banner = banners[page.key];
                    const hasImage = Boolean(banner?.background_image || banner?.image_url);
                    const isActive = banner ? Boolean(banner.is_active) : true;
                    const imageSrc = banner?.background_image || banner?.image_url;

                    return (
                      <tr key={page.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-4">
                            {imageSrc ? (
                              <img
                                src={imageSrc}
                                alt={page.label}
                                className="h-14 w-28 rounded-md object-cover flex-shrink-0 border border-gray-200 shadow-sm"
                              />
                            ) : (
                              <div className="h-14 w-28 rounded-md bg-gray-100 flex flex-col items-center justify-center text-[10px] text-gray-400 flex-shrink-0 border border-dashed border-gray-300">
                                <span>No Image</span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 text-base">{page.label}</span>
                                {page.isCustom && (
                                  <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700">
                                    Custom
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 mt-0.5 block">
                                {hasImage ? "Banner image active" : "No banner image set"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded border border-gray-200 font-medium">
                            {page.key}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          {hasImage ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isActive
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : "bg-gray-100 text-gray-600 border border-gray-200"
                              }`}
                            >
                              {isActive ? "Published" : "Unpublished"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                              No Image
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/page-banners/${encodeURIComponent(page.key)}`)}
                              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 font-medium"
                            >
                              {hasImage ? "Edit Image" : "Upload Image"}
                            </button>

                            {hasImage && (
                              <button
                                type="button"
                                onClick={() => togglePublish(page.key)}
                                disabled={actionLoading === page.key}
                                className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  isActive
                                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                                    : "bg-white text-green-600 border-green-300 hover:bg-green-50"
                                }`}
                              >
                                {actionLoading === page.key
                                  ? "..."
                                  : isActive
                                  ? "✓ Published"
                                  : "Unpublished"}
                              </button>
                            )}

                            {hasImage && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(page.key)}
                                className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 hover:border-red-300"
                                title="Remove banner image"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filteredItems.length && (
                <div className="py-12 text-center text-sm text-gray-400">
                  No page banners found matching your criteria.
                </div>
              )}

              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </section>
      </main>

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Reset Page Banner Image?"
        description={`The banner image for "${getPageConfig(deleteTarget)?.label || deleteTarget}" will be removed.`}
        confirmLabel="Remove Image"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
