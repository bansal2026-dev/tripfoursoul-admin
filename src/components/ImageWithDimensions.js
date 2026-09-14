"use client";

import { useState } from "react";

export default function ImageWithDimensions({
  src,
  alt = "Image preview",
  className = "w-full h-44 object-cover rounded-lg border border-gray-200",
  onRemove,
  removeLabel = "Remove image",
}) {
  const [dimensions, setDimensions] = useState(null);

  if (!src) return null;

  return (
    <div className="relative inline-block overflow-hidden rounded-lg group">
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={(e) => {
          const w = e.currentTarget.naturalWidth;
          const h = e.currentTarget.naturalHeight;
          if (w && h) {
            setDimensions(`${w} × ${h} px`);
          }
        }}
      />
      {dimensions && (
        <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] font-mono font-medium px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs pointer-events-none">
          {dimensions}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 rounded-full bg-red-600/90 text-white p-1 hover:bg-red-700 shadow transition-colors"
          title={removeLabel}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

