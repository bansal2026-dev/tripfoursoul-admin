"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";

const PERMISSION_OPTIONS = [
  { value: "banner", label: "Banner" },
  { value: "offers", label: "Offers" },
  { value: "trending", label: "Trending" },
  { value: "pricing", label: "Region Pricing" },
  { value: "destinations", label: "Popular Destinations" },
  { value: "packages", label: "Packages" },
  { value: "spiritual", label: "Spiritual Escape" },
  { value: "about", label: "About Us" },
  { value: "features", label: "Features" },
  { value: "services", label: "Services" },
  { value: "testimonials", label: "Testimonials" },
  { value: "page-banners", label: "Page Banners" },
  { value: "gallery", label: "Gallery" },
  { value: "team-members", label: "Team Members" },
  { value: "deals", label: "Deals" },
  { value: "sections", label: "Homepage Sections" },
  { value: "blog", label: "Blog" },
  { value: "staff", label: "Staff Management" },
];

export { PERMISSION_OPTIONS };

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [message, setMessage] = useStatusToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const {
    currentItems: paginatedStaff,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(staff, 10);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user && (data.user.role === "admin" || data.user.role === "super_admin")) {
          setIsAdmin(true);
        }
        if (data.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/auth/staff");
      const data = await res.json();
      if (data.staff) setStaff(data.staff);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
      const res = await fetch(`/api/auth/staff?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete staff member");
      }
      setMessage("Staff member deleted successfully!");
      fetchStaff();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Staff Management</h1>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        {!isAdmin && (
          <div className="p-4 rounded-lg mb-6 bg-amber-50 text-amber-700 border border-amber-200">
            You have read-only access to this page. Only super admins can create or delete staff accounts.
          </div>
        )}

        {isAdmin && !isSuperAdmin && (
          <div className="p-4 rounded-lg mb-6 bg-amber-50 text-amber-700 border border-amber-200">
            You can edit staff details, but only super admins can create or delete staff accounts.
          </div>
        )}

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Staff Members</h2>
            {isSuperAdmin && (
              <button
                onClick={() => router.push("/staff/create")}
                className="admin-btn"
              >
                + Add New Staff
              </button>
            )}
          </div>

          {/* Staff List */}
          <div className="space-y-3">
            {paginatedStaff.map((item) => (
              <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{item.username}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      item.role === "admin" || item.role === "super_admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-teal-100 text-teal-700"
                    }`}>
                      {item.role === "super_admin" ? "Super Admin" : item.role === "admin" ? "Admin" : "Staff"}
                    </span>
                    {item.username === "admin" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">Primary</span>
                    )}
                  </div>
                  {item.email && <p className="text-sm text-gray-500 mb-1">{item.email}</p>}
                  {item.role === "staff" && Array.isArray(item.permissions) && item.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.permissions.map((perm) => (
                        <span key={perm} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                          {PERMISSION_OPTIONS.find((p) => p.value === perm)?.label || perm}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.role === "staff" && (!item.permissions || item.permissions.length === 0) && (
                    <p className="text-xs text-gray-400 mt-1">No specific permissions set</p>
                  )}
                  {(item.role === "admin" || item.role === "super_admin") && (
                    <p className="text-xs text-purple-400 mt-1">Has access to all sections</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/staff/edit/${item.id}`)}
                      className="admin-btn-secondary text-xs px-3 py-1.5"
                    >
                      Edit
                    </button>
                    {isSuperAdmin && item.username !== "admin" && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="admin-btn-danger text-xs px-3 py-1.5"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
            {staff.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center">No staff members found.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
