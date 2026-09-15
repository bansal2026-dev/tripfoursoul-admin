"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { PERMISSION_OPTIONS } from "@/lib/permissions";

export default function EditStaffPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff",
    permissions: [],
  });
  const [originalUsername, setOriginalUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch("/api/auth/staff")
      .then((res) => res.json())
      .then((data) => {
        const member = data.staff?.find((s) => String(s.id) === String(id));
        if (member) {
          setOriginalUsername(member.username);
          let perms = Array.isArray(member.permissions) ? member.permissions : [];
          if ((member.role === "staff" || !member.role) && !perms.includes("dashboard")) {
            perms = ["dashboard", ...perms];
          }
          setForm({
            username: member.username,
            email: member.email || "",
            password: "",
            role: member.role || "staff",
            permissions: perms,
          });
        } else {
          setError("Staff member not found");
        }
      })
      .catch(() => setError("Failed to load staff member"))
      .finally(() => setLoading(false));
  }, [id]);

  const visiblePermissions = form.role === "staff" ? PERMISSION_OPTIONS : [];

  const togglePermission = (perm) => {
    if (perm === "dashboard") return; // Dashboard is always assigned
    setForm((prev) => {
      const perms = prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setForm((prev) => ({
      ...prev,
      role: newRole,
      // Clear permissions when switching to admin/super_admin
      permissions: newRole === "admin" || newRole === "super_admin" ? [] : prev.permissions,
      // Clear permissions when switching to admin/super_admin, keep dashboard for staff
      permissions:
        newRole === "admin" || newRole === "super_admin"
          ? []
          : prev.permissions.includes("dashboard")
          ? prev.permissions
          : ["dashboard", ...prev.permissions],
    }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.username.trim()) return setError("Username is required");

    setSaving(true);
    try {
      const body = {
        id,
        username: form.username,
        email: form.email,
        role: form.role,
        permissions: form.permissions,
        ...(form.password ? { password: form.password } : {}),
      };

      const res = await fetch("/api/auth/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff member");
      router.push("/staff");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/staff")}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Staff — <span className="text-teal-700">{originalUsername}</span>
          </h1>
        </div>

        <div className="max-w-2xl">
          <div className="admin-card space-y-6">

            {error && (
              <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}

            {/* Username */}
            <div>
              <label className="admin-label">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="admin-input"
                disabled={originalUsername === "admin"}
              />
            </div>

            {/* Email */}
            <div>
              <label className="admin-label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="admin-input"
                placeholder="e.g., staff@tripforsoul.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="admin-label">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="admin-input"
                placeholder="Enter new password"
              />
            </div>

            {/* Role */}
            <div>
              <label className="admin-label">Role</label>
              <select
                value={form.role}
                onChange={handleRoleChange}
                className="admin-input"
                disabled={originalUsername === "admin"}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {/* Permissions — only shown for "staff" role */}
            {form.role === "staff" ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="admin-label mb-0">Permissions</label>
                    <p className="text-xs text-gray-500">Select which sections this staff member can access.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={originalUsername === "admin"}
                      onClick={() => setForm((prev) => ({ ...prev, permissions: PERMISSION_OPTIONS.map((p) => p.value) }))}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200 transition-colors disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      disabled={originalUsername === "admin"}
                      onClick={() => setForm((prev) => ({ ...prev, permissions: ["dashboard"] }))}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md border border-gray-200 transition-colors disabled:opacity-50"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {visiblePermissions.map((perm) => (
                    <label
                      key={perm.value}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        form.permissions.includes(perm.value)
                          ? "bg-teal-50 border-teal-300 text-teal-900"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm.value)}
                        onChange={() => togglePermission(perm.value)}
                        className="h-4 w-4 accent-teal-600"
                        disabled={originalUsername === "admin"}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-700">
                ✓ <strong>{form.role === "super_admin" ? "Super Admin" : "Admin"}</strong> has access to all sections automatically. No specific permissions needed.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="admin-btn disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update Staff Member"}
              </button>
              <button
                onClick={() => router.push("/staff")}
                className="admin-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

