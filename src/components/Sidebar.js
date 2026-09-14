"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Image,
  TrendingUp,
  DollarSign,
  MapPin,
  Layers,
  Info,
  Star,
  Tag,
  Users,
  Settings,
  LogOut,
  Share2,
  UserCircle,
  Inbox,
  Menu,
  X,
} from "lucide-react";

const allMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/homepage", label: "Homepage Settings", icon: Settings, permission: "homepage" },
  { href: "/offers", label: "Offers", icon: Tag, permission: "offers" },
  { href: "/leads", label: "Leads", icon: Inbox, permission: "leads" },
  { href: "/destinations", label: "Destinations", icon: MapPin, permission: "destinations" },
  { href: "/packages", label: "Packages", icon: Layers, permission: "packages" },
  // { href: "/spiritual", label: "Spiritual Escape", icon: MapPin, permission: "spiritual" },
  // { href: "/trending", label: "Trending Now", icon: TrendingUp, permission: "trending" },
  { href: "/pricing", label: "Region Pricing", icon: DollarSign, permission: "pricing" },
  { href: "/about", label: "About Us", icon: Info, permission: "about" },
  { href: "/services", label: "Services", icon: Layers, permission: "services" },
  { href: "/page-banners", label: "Page Banners", icon: Image, permission: "page-banners" },
  { href: "/gallery", label: "Gallery", icon: Image, permission: "gallery" },
  { href: "/media", label: "Media Library", icon: Image, permission: null },
  // { href: "/team-members", label: "Team Members", icon: Star, permission: "team-members" },
  { href: "/blog", label: "Blog", icon: Layers, permission: "blog" },
  { href: "/blog-categories", label: "Blog Categories", icon: Tag, permission: "blog" },
  { href: "/staff", label: "Staff", icon: Users, permission: "staff" },
  { href: "/social-media", label: "Social Media", icon: Share2, permission: "social-media" },
  { href: "/profile", label: "My Profile", icon: UserCircle, permission: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState(allMenuItems);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          setMenuItems(allMenuItems);
          return;
        }
        const role = data.user.role || "admin";
        if (role === "admin" || role === "super_admin") {
          setMenuItems(allMenuItems);
          return;
        }
        const perms = data.user.permissions || [];
        setMenuItems(allMenuItems.filter((item) => !item.permission || perms.includes(item.permission)));
      })
      .catch(() => {
        setMenuItems(allMenuItems);
      });
  }, []);

  const handleLogout = () => {
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#173F38] text-white shadow-lg lg:hidden"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <Menu className="h-5 w-5" />
      </button>
      {isOpen && <button type="button" className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-label="Close navigation menu" onClick={() => setIsOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-[#24564C] bg-[#173F38] shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="p-6 border-b border-[#24564C]">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-xl font-bold text-[#FCF8F1]">TripForSoul</h1><p className="mt-1 text-xs text-[#DCE8DF]">Admin Panel</p></div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-[#DCE8DF] hover:bg-[#24564C] lg:hidden" aria-label="Close navigation menu"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#DCE8DF] text-[#24564C] border-r-4 border-[#C8755A]"
                  : "text-[#DCE8DF] hover:bg-[#24564C] hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#24564C]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#D9826B] hover:bg-[#24564C] hover:text-white w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
      </aside>
    </>
  );
}
