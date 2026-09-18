export const PERMISSION_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "analytics", label: "Analytics" },
  { value: "homepage", label: "Homepage Settings" },
  { value: "offers", label: "Offers" },
  { value: "leads", label: "Leads" },
  { value: "destinations", label: "Destinations" },
  { value: "packages", label: "Packages" },
  { value: "page-banners", label: "Page Banners" },
  { value: "gallery", label: "Gallery" },
  { value: "media", label: "Media Library" },
  { value: "blog", label: "Blog" },
  { value: "blog-categories", label: "Blog Categories" },
  { value: "staff", label: "Staff" },
  { value: "social-media", label: "Social Media" },
  { value: "profile", label: "My Profile" },
];

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_OPTIONS.map((item) => [item.value, item.label])
);

