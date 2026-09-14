"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import Pagination, { usePagination } from "@/components/Pagination";
import { pricingDisplay } from "@/lib/price";

export default function PackagesPage() {
  return <Suspense fallback={<LoadingSpinner text="Loading packages..." />}><PackagesPageContent /></Suspense>;
}

function PackagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDestinationId = searchParams.get("destination_id") || "";
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmSortOrder, setConfirmSortOrder] = useState("");
  const [activeFilter, setActiveFilter] = useState("published");

  const filters = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "unpublished", label: "Unpublished" },
    { id: "spiritual", label: "Spiritual" },
    { id: "trending", label: "Trending" },
  ];

  useEffect(() => {
    let active = true;
    const fetchPackages = async (retry = 0) => {
      try {
        const packagesResponse = await fetch(`/api/packages?all=true${selectedDestinationId ? `&destination_id=${selectedDestinationId}` : ""}`);
        const packagesData = await packagesResponse.json();
        if (!packagesResponse.ok) {
          if (retry < 1 && active) {
            await new Promise((r) => setTimeout(r, 1000));
            if (active) return fetchPackages(retry + 1);
          }
          throw new Error(packagesData.error || "Could not load packages");
        }
        if (active) {
          setPackages(packagesData.packages || []);
        }
      } catch (error) {
        console.error(error);
        if (active) toast.error(error.message || "Could not load packages");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPackages();
    return () => { active = false; };
  }, [selectedDestinationId]);

  const loadData = async () => {
    const response = await fetch(`/api/packages?all=true${selectedDestinationId ? `&destination_id=${selectedDestinationId}` : ""}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load packages");
    setPackages(data.packages || []);
  };

  const remove = async (item) => {
    try {
      const response = await fetch(`/api/packages?id=${item.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete package");
      toast.success(`Package "${item.title}" deleted.`);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Could not delete package");
    }
  };

  const toggleFlag = async (item, field) => {
    try {
      const response = await fetch("/api/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, destination_id: item.destination_id, title: item.title, [field]: item[field] ? 0 : 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update package");
      toast.success(`Package "${item.title}" updated.`);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Could not update package");
    }
  };

  const togglePublish = async (item, sortOrder) => {
    try {
      const response = await fetch("/api/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id, destination_id: item.destination_id, title: item.title,
          is_active: item.is_active ? 0 : 1,
          ...(item.is_active ? {} : { sort_order: Number(sortOrder) || 0 }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update package");
      toast.success(`Package "${item.title}" ${item.is_active ? "unpublished" : "published"}.`);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Could not update package");
    }
  };

  const confirmSelectedAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === "publish") await togglePublish(confirmAction.item, confirmSortOrder);
    if (confirmAction.type === "delete") await remove(confirmAction.item);
    setActionLoading(false);
    setConfirmAction(null);
    setConfirmSortOrder("");
  };

  const newUrl = selectedDestinationId ? `/packages/new?destination_id=${selectedDestinationId}` : "/packages/new";
  const filteredPackages = packages.filter((item) => {
    if (activeFilter === "published") return Boolean(item.is_active);
    if (activeFilter === "unpublished") return !item.is_active;
    if (activeFilter === "spiritual") return Boolean(item.is_spiritual);
    if (activeFilter === "trending") return Boolean(item.is_trending);
    return true;
  });

  const {
    currentItems: paginatedPackages,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(filteredPackages, 10);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Packages Management</h1>
            <p className="mt-1 text-sm text-gray-500">Each package is directly assigned to one destination, as in the website frontend.</p>
          </div>
          <button onClick={() => router.push(newUrl)} className="admin-btn">Add New Package</button>
        </div>
        <section className="admin-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{selectedDestinationId ? "Destination Packages" : "All Packages"} ({filteredPackages.length})</h2>
            <div className="flex flex-wrap gap-2" aria-label="Filter packages">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeFilter === filter.id
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <LoadingSpinner text="Loading packages..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3 font-semibold">Package</th>
                    <th className="px-3 py-3 font-semibold">Destination</th>
                    <th className="px-3 py-3 font-semibold">Price</th>
                    <th className="px-3 py-3 font-semibold">Days</th>
                    <th className="px-3 py-3 font-semibold">Sort</th>
                    <th className="px-3 py-3 font-semibold">Tags</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackages.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {item.image_url && <img src={item.image_url} alt={item.title} className="h-12 w-16 rounded object-cover" />}
                          <span className="font-medium text-gray-900">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{item.destination_name}</td>
                      <td className="px-3 py-3 font-semibold text-teal-700">{pricingDisplay(item)}</td>
                      <td className="px-3 py-3 text-gray-600">{item.days}</td>
                      <td className="px-3 py-3 text-gray-600">{item.sort_order || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.is_trending ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Trending</span> : null}
                          {item.is_spiritual ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Spiritual</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => router.push(`/packages/${item.id}`)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">Edit</button>
                          <button
                            onClick={() => setConfirmAction({ type: "publish", item })}
                            className={`rounded border px-2 py-1 text-xs ${item.is_active ? "bg-green-600 text-white border-green-600" : "bg-white text-green-600 border-green-300 hover:bg-green-50"}`}
                          >
                            {item.is_active ? "✓ Published" : "Unpublished"}
                          </button>
                          <button
                            onClick={() => toggleFlag(item, "is_trending")}
                            className={`rounded border px-2 py-1 text-xs ${item.is_trending ? "bg-purple-600 text-white border-purple-600" : "text-purple-600 border-purple-300 hover:bg-purple-50"}`}
                          >
                            {item.is_trending ? "✓ Trend" : "Trend"}
                          </button>
                          <button
                            onClick={() => toggleFlag(item, "is_spiritual")}
                            className={`rounded border px-2 py-1 text-xs ${item.is_spiritual ? "bg-amber-500 text-white border-amber-500" : "text-amber-600 border-amber-300 hover:bg-amber-50"}`}
                          >
                            {item.is_spiritual ? "✓ Spirit" : "Spirit"}
                          </button>
                          <button onClick={() => setConfirmAction({ type: "delete", item })} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
              {!filteredPackages.length && <p className="py-8 text-center text-sm text-gray-400">No {activeFilter === "all" ? "packages" : activeFilter} packages found.</p>}
            </div>
          )}
        </section>
      </main>
      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "delete" ? "Delete package?" : `${confirmAction?.item?.is_active ? "Unpublish" : "Publish"} package?`}
        description={confirmAction?.type === "delete"
          ? `"${confirmAction?.item?.title}" will be permanently deleted. This cannot be undone.`
          : confirmAction?.item?.is_active
            ? `"${confirmAction?.item?.title}" will be hidden from the public website but kept in admin.`
            : `"${confirmAction?.item?.title}" will become visible on the public website.`}
        confirmLabel={confirmAction?.type === "delete" ? "Delete permanently" : confirmAction?.item?.is_active ? "Unpublish" : "Publish"}
        danger={confirmAction?.type === "delete"}
        loading={actionLoading}
        showSortOrder={confirmAction?.type === "publish" && !confirmAction?.item?.is_active}
        sortOrder={confirmSortOrder}
        onSortOrderChange={setConfirmSortOrder}
        onConfirm={confirmSelectedAction}
        onCancel={() => { if (!actionLoading) { setConfirmAction(null); setConfirmSortOrder(""); } }}
      />
    </div>
  );
}
