"use client";

import { useRef, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import MediaLibraryModal from "@/components/MediaLibraryModal";

let blockSequence = 0;

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const createBlock = (type, values = {}) => ({
  id: `block-${Date.now()}-${blockSequence++}`,
  type,
  html: "",
  imageUrl: "",
  caption: "",
  ...values,
});

export const createInitialContentBlocks = () => [createBlock("text")];

export const contentBlocksToHtml = (blocks) => blocks.map((block) => {
  if (block.type === "image" && block.imageUrl) {
    const caption = block.caption?.trim();
    const safeCaption = escapeHtml(caption);
    return `<figure style="margin: 24px 0;"><img src="${block.imageUrl}" alt="${safeCaption || "Blog image"}" style="width: 100%; height: auto; border-radius: 8px;" />${safeCaption ? `<figcaption style="margin-top: 6px; font-size: 12px; color: #6b7280;">${safeCaption}</figcaption>` : ""}</figure>`;
  }
  return block.html || "";
}).join("");

// Existing articles are converted into editable blocks when an admin opens them.
export const htmlToContentBlocks = (html) => {
  if (!html || typeof window === "undefined") return createInitialContentBlocks();
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const blocks = [];
  let textHtml = "";

  Array.from(documentFragment.body.children).forEach((node) => {
    const image = node.tagName === "FIGURE" ? node.querySelector("img") : null;
    if (!image) {
      textHtml += node.outerHTML;
      return;
    }
    if (textHtml) {
      blocks.push(createBlock("text", { html: textHtml }));
      textHtml = "";
    }
    blocks.push(createBlock("image", {
      imageUrl: image.getAttribute("src") || "",
      caption: node.querySelector("figcaption")?.textContent || "",
    }));
  });

  if (textHtml) blocks.push(createBlock("text", { html: textHtml }));
  return blocks.length ? blocks : createInitialContentBlocks();
};

export default function BlogContentManager({ blocks, onChange }) {
  const imageInputRefs = useRef({});
  const [uploadingBlockId, setUploadingBlockId] = useState("");
  const [mediaModalBlockId, setMediaModalBlockId] = useState(null);
  const [error, setError] = useState("");

  const updateBlock = (id, changes) => onChange(blocks.map((block) => (
    block.id === id ? { ...block, ...changes } : block
  )));

  const addBlock = (type) => onChange([...blocks, createBlock(type)]);

  const removeBlock = (id) => {
    if (blocks.length === 1) {
      onChange(createInitialContentBlocks());
      return;
    }
    onChange(blocks.filter((block) => block.id !== id));
  };

  const moveBlock = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    [nextBlocks[index], nextBlocks[nextIndex]] = [nextBlocks[nextIndex], nextBlocks[index]];
    onChange(nextBlocks);
  };

  const uploadImage = async (event, blockId) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/webp") {
      setError("Only WebP images are allowed.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Each image must be 1 MB or smaller.");
      return;
    }

    setError("");
    setUploadingBlockId(blockId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.imageUrl) throw new Error(data.error || "Image upload failed");
      updateBlock(blockId, { imageUrl: data.imageUrl });
    } catch (uploadError) {
      setError(uploadError.message || "Image upload failed. Please try again.");
    } finally {
      setUploadingBlockId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-100 bg-teal-50 p-4">
        <div>
          <h3 className="font-semibold text-teal-900">Article content order</h3>
          <p className="text-xs text-teal-800">Add content and image blocks in order: content → image → content → image.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => addBlock("text")} className="admin-btn text-xs">+ Add Content</button>
          <button type="button" onClick={() => addBlock("image")} className="admin-btn-secondary text-xs">+ Add Image</button>
        </div>
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${block.type === "image" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
              {index + 1}. {block.type === "image" ? "Image Block" : "Content Block"}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="admin-btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">↑</button>
              <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="admin-btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">↓</button>
              <button type="button" onClick={() => removeBlock(block.id)} className="admin-btn-danger px-3 py-1.5 text-xs">Remove</button>
            </div>
          </div>

          {block.type === "text" ? (
            <RichTextEditor
              value={block.html}
              onChange={(html) => updateBlock(block.id, { html })}
              rows={7}
              placeholder="Write this section of the article..."
            />
          ) : (
            <div className="space-y-3">
              {block.imageUrl ? <img src={block.imageUrl} alt={block.caption || "Blog content"} className="max-h-80 w-full rounded-lg object-contain bg-gray-50" /> : null}
              <div className="flex flex-wrap gap-2">
                <input ref={(node) => { imageInputRefs.current[block.id] = node; }} type="file" accept="image/webp" className="hidden" onChange={(event) => uploadImage(event, block.id)} />
                <button type="button" onClick={() => imageInputRefs.current[block.id]?.click()} disabled={uploadingBlockId === block.id} className="admin-btn-secondary">
                  {uploadingBlockId === block.id ? "Uploading..." : block.imageUrl ? "Replace Image" : "Upload Image"}
                </button>
                <button
                  type="button"
                  onClick={() => setMediaModalBlockId(block.id)}
                  disabled={uploadingBlockId === block.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shadow-sm"
                  title="Choose an existing image from uploaded library"
                >
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Uploaded
                </button>
                {block.imageUrl && <button type="button" onClick={() => updateBlock(block.id, { imageUrl: "" })} className="admin-btn-danger">Remove Image</button>}
              </div>
              <div>
                <label className="admin-label">Image caption (optional)</label>
                <input value={block.caption} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} className="admin-input" placeholder="e.g., The Great Wall of China" />
              </div>
            </div>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <MediaLibraryModal
        isOpen={Boolean(mediaModalBlockId)}
        onClose={() => setMediaModalBlockId(null)}
        onSelectImage={(url) => {
          if (mediaModalBlockId) {
            updateBlock(mediaModalBlockId, { imageUrl: url });
            setMediaModalBlockId(null);
          }
        }}
        currentImageUrl={blocks.find((b) => b.id === mediaModalBlockId)?.imageUrl}
      />
    </div>
  );
}
