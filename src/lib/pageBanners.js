export const PAGE_KEYS = [
  { key: "about", label: "About Us" },
  { key: "contact", label: "Contact Us" },
  { key: "destinations", label: "Destinations" },
  { key: "packages", label: "Packages" },
  { key: "trips", label: "Trips / Journeys" },
  { key: "other-services", label: "Other Services" },
  { key: "gallery", label: "Gallery" },
];

export const getPageConfig = (key) => {
  if (!key) return null;
  const normalized = String(key).trim().toLowerCase();
  const found = PAGE_KEYS.find((p) => p.key.toLowerCase() === normalized);
  if (found) return found;

  const label = normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    key: normalized,
    label: label || key,
    isCustom: true,
  };
};

