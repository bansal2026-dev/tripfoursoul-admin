"use client";

import { useRef, useState, useEffect } from "react";
import MediaLibraryModal from "@/components/MediaLibraryModal";

const ToolbarButton = ({ onClick, active, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className={`px-2.5 py-1.5 rounded text-sm font-medium border transition-colors ${
      active ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`}
    title={title}
  >
    {children}
  </button>
);

// contentEditable browsers (Chrome in particular) drop a stray <br> — or an
// empty <p>/<div> — into a field the moment it is clicked, and create an empty
// <li> when Enter is pressed at the end of a bullet/numbered list. That
// scaffold makes typed text start on the second line / leaves a blank line at
// the end of a list, and because it lives in innerHTML, gets stored as an extra
// empty line (e.g. in Additional Info / Inclusions / Exclusions). These
// helpers strip leading/trailing blank blocks, stray <br>s and empty list
// items so fields never begin or end with an unwanted empty line.
const trimEmptyEdges = (html) => {
  if (typeof html !== "string") return "";
  let out = html;

  // An empty block is a <br>, an empty <p>/<div>, an empty <li> (optionally
  // wrapping an empty <p>/<div>), or a fully empty <ul>/<ol>.
  const emptyBr = `(?:<br\\s*\\/?>)`;
  const emptyDivP = `(?:<(?:div|p)(?:\\s[^>]*)?>\\s*(?:<br\\s*\\/?>|&nbsp;)?\\s*<\\/(?:div|p)>)`;
  const emptyLi = `(?:<li(?:\\s[^>]*)?>\\s*(?:(?:<br\\s*\\/?>)|(?:&nbsp;)|(?:<(?:div|p)(?:\\s[^>]*)?>\\s*(?:<br\\s*\\/?>|&nbsp;)?\\s*<\\/(?:div|p)>))?\\s*<\\/li>)`;
  const emptyList = `(?:<(?:ul|ol)(?:\\s[^>]*)?>\\s*<\\/(?:ul|ol)>)`;

  // Chrome leaves an empty <li> behind when Enter is pressed at the end of a
  // bullet/numbered list (that line is where a new point would be typed).
  // Remove those empty items from the edges of lists so they can't persist.
  out = out.replace(new RegExp(`(?:${emptyLi}\\s*)+(?=</(?:ul|ol)>)`, "gi"), "");
  out = out.replace(new RegExp(`(<(?:ul|ol)(?:\\s[^>]*)?>\\s*)(?:${emptyLi}\\s*)+`, "gi"), "$1");

  // Remove leading empty blocks / <br>s / list items (and whitespace before).
  let changed = true;
  while (changed) {
    changed = false;
    const leading = out.match(new RegExp(`^\\s*(?:(?:${emptyBr})|(?:${emptyDivP})|(?:${emptyLi})|(?:${emptyList}))`, "i"));
    if (leading) {
      out = out.slice(leading[0].length);
      changed = true;
    }
  }

  // Remove trailing empty blocks / <br>s / list items — but keep the anchor
  // block directly after a table/figure: the browser needs it to keep editing
  // after the media.
  changed = true;
  while (changed) {
    changed = false;
    const trailing = out.match(new RegExp(`(\\s*(?:(?:${emptyBr})|(?:${emptyDivP})|(?:${emptyLi})|(?:${emptyList}))\\s*)$`, "i"));
    if (trailing) {
      const without = out.slice(0, trailing.index);
      if (/(?:table|figure)>$/i.test(without)) break;
      out = without;
      changed = true;
    }
  }

  // Drop any remaining leading/trailing whitespace-only text nodes.
  out = out.replace(/^\s+/, "").replace(/\s+$/, "");

  // If only blank markup/whitespace remains, collapse to "" so the placeholder
  // shows again instead of a blank line. Real content (text, images, tables,
  // non-empty lists…) is preserved. List tags only become "removable" here when
  // the edge trimming above has already emptied the items they wrap.
  const residue = out
    .replace(/<br\s*\/?>|&nbsp;|&#160;|&#xA0;/gi, "")
    .replace(/<\/?(?:div|p|li|ul|ol)(?:\s[^>]*)?>/gi, "")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  return residue ? out : "";
};

// Google Docs / Word leave inline vertical margins on list markup — e.g.
// `<li style="...margin-bottom: 12pt...">`, or a `<p style="line-height:1.38;
// margin-top:12pt;margin-bottom:0pt">`, or a shorthand `margin: 12pt 0px 0pt;`
// inside an item. Those margins create unwanted gaps between bullet points.
// Rewrite `margin-top`/`margin-bottom` (and the `margin` shorthand) to 0 on
// <li> tags and on any <p> that lives inside a <ul>/<ol>, so bulleted content
// stays tight and the saved HTML no longer carries the stray 12pt gap.
const normalizeListMargins = (html) => {
  if (typeof html !== "string" || !/<li[\s>]/i.test(html)) return html;

  const rewriteOpeningTag = (tag) => {
    const styleMatch = tag.match(/(style\s*=\s*["'])([^"']*)(["'])/i);
    if (!styleMatch) return tag;
    const pre = styleMatch[1];
    const style = styleMatch[2];
    const post = styleMatch[3];
    const full = styleMatch[0];

    // Match `margin`, `margin-top` or `margin-bottom` declarations (but not
    // `margin-left`/`margin-right`, which are untouched for list indentation).
    if (!/(?:^|;)\s*margin(?:-(?:top|bottom))?\s*:/i.test(style)) return tag;

    const parts = style.split(";");
    const fixed = parts.map((part) => {
      const idx = part.indexOf(":");
      if (idx === -1) return part;
      // Keep any whitespace that preceded the property so the rewritten style
      // stays formatted exactly like the original (only the value changes).
      const leadingWs = (part.match(/^\s*/) || [""])[0];
      const prop = part.slice(0, idx).trim().toLowerCase();
      if (prop === "margin-top" || prop === "margin-bottom") return `${leadingWs}${prop}: 0`;
      if (prop === "margin") return `${leadingWs}margin: 0`; // shorthand — zero all sides
      return part;
    });

    // Rebuild the opening tag: everything before `style="` stays untouched,
    // only the style value is rewritten.
    const before = tag.slice(0, styleMatch.index);
    const after = tag.slice(styleMatch.index + full.length);
    return before + pre + fixed.join(";") + post + after;
  };

  // Walk the markup and zero inline top/bottom margins on <li>/<p> opening tags
  // that sit inside a <ul>/<ol> (nested lists included). Everything else is
  // left byte-for-byte identical.
  const parts = [];
  let cursor = 0;
  let depth = 0;
  const tagPattern = /<(?:ul|ol|li|p)\b[^>]*>|<\/(?:ul|ol|li|p)>/gi;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const text = html.slice(cursor, match.index);
    if (text) parts.push(text);
    const tag = match[0];
    if (/^<\/(?:ul|ol)>/i.test(tag)) {
      depth = Math.max(0, depth - 1);
      parts.push(tag);
    } else if (/^<(?:ul|ol)\b/i.test(tag)) {
      depth += 1;
      parts.push(tag);
    } else if (depth > 0 && /^<(?:li|p)\b/i.test(tag)) {
      parts.push(rewriteOpeningTag(tag));
    } else {
      parts.push(tag);
    }
    cursor = tagPattern.lastIndex;
  }
  if (cursor < html.length) parts.push(html.slice(cursor));
  return parts.join("");
};

export default function RichTextEditor({ value, onChange, placeholder, rows = 6, allowImageUpload = false, uniformTextSize = false }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const selectionRef = useRef(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [activeFormats, setActiveFormats] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  const handleSelectMediaImage = (url) => {
    editorRef.current?.focus();
    restoreSelection();
    const safeAlt = url.split("/").pop().replace(/\.[^/.]+$/, "").replace(/"/g, "") || "Image";
    document.execCommand(
      "insertHTML",
      false,
      `<figure style="margin: 20px 0;"><img src="${url}" alt="${safeAlt}" style="width: 100%; height: auto; border-radius: 8px;" /><figcaption style="margin-top: 6px; font-size: 12px; color: #6b7280;">Add image caption</figcaption></figure><p><br></p>`
    );
    handleInput();
    setShowMediaLibrary(false);
  };

  // Sync external value changes (e.g., when switching between edit/add modes).
  // Inline list margins from pasted (Google Docs) content are normalized so old
  // 12pt gaps disappear as soon as the value is loaded into the editor.
  useEffect(() => {
    if (editorRef.current) {
      const normalized = trimEmptyEdges(normalizeListMargins(value || ""));
      if (editorRef.current.innerHTML !== normalized) {
        editorRef.current.innerHTML = normalized;
      }
    }
  }, [value]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const range = selectionRef.current;
    if (!range || !editorRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const updateActiveFormats = () => {
    if (!editorRef.current?.contains(window.getSelection()?.anchorNode)) return;
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unordered: document.queryCommandState("insertUnorderedList"),
      ordered: document.queryCommandState("insertOrderedList"),
      left: document.queryCommandState("justifyLeft"),
      center: document.queryCommandState("justifyCenter"),
      right: document.queryCommandState("justifyRight"),
    });
    saveSelection();
  };

  const exec = (command, arg = null) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, arg);
    handleInput();
    updateActiveFormats();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Chrome inserts a stray <br> (or an empty list block) into an empty editor
  // when it is clicked. Clear that scaffold as soon as the editor gains focus
  // so the placeholder shows again and the first keystroke lands on the first
  // line (no blank line).
  const clearAutoScaffold = () => {
    const el = editorRef.current;
    if (!el) return;
    if (trimEmptyEdges(el.innerHTML) === "") el.innerHTML = "";
  };

  // On blur, strip edge blank lines and normalize list margins before reporting
  // the value so the form (and the database) never keeps an extra empty line or
  // the 12pt gap the browser/paste left behind.
  const handleBlur = () => {
    const el = editorRef.current;
    if (!el) return;
    const clean = trimEmptyEdges(normalizeListMargins(el.innerHTML));
    if (clean !== el.innerHTML) el.innerHTML = clean;
    onChange(clean);
  };

  const insertTable = () => {
    const rows = Math.max(1, Math.min(10, tableRows));
    const cols = Math.max(1, Math.min(10, tableCols));
    let html = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 12px 0;">';
    html += "<tbody>";
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border: 1px solid #d1d5db; padding: 8px;">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    handleInput();
    setShowTableModal(false);
  };

  const insertLink = () => {
    const url = prompt("Enter URL (e.g., https://example.com):");
    if (url && url.trim()) {
      const normalizedUrl = /^(https?:|mailto:|tel:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      exec("createLink", normalizedUrl);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      setImageError("Only WebP images can be inserted.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setImageError("Image must be 1 MB or smaller.");
      return;
    }

    setImageError("");
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.imageUrl) throw new Error(data.error || "Image upload failed");

      editorRef.current?.focus();
      restoreSelection();
      const safeAlt = file.name.replace(/\.[^/.]+$/, "").replace(/"/g, "");
      document.execCommand(
        "insertHTML",
        false,
        `<figure style="margin: 20px 0;"><img src="${data.imageUrl}" alt="${safeAlt}" style="width: 100%; height: auto; border-radius: 8px;" /><figcaption style="margin-top: 6px; font-size: 12px; color: #6b7280;">Add image caption</figcaption></figure><p><br></p>`
      );
      handleInput();
    } catch (error) {
      setImageError(error.message || "Image upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2">
        <ToolbarButton onClick={() => exec("bold")} active={activeFormats.bold} title="Bold (Ctrl+B)"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} active={activeFormats.italic} title="Italic (Ctrl+I)"><i>I</i></ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} active={activeFormats.underline} title="Underline (Ctrl+U)"><u>U</u></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} active={activeFormats.unordered} title="Bullet List">• List</ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} active={activeFormats.ordered} title="Numbered List">1. List</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={() => exec("justifyLeft")} active={activeFormats.left} title="Align left">≡ Left</ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyCenter")} active={activeFormats.center} title="Align center">≡ Center</ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyRight")} active={activeFormats.right} title="Align right">≡ Right</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={() => exec("formatBlock", "<h2>")} title="Heading">H</ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<p>")} title="Paragraph">¶</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={insertLink} title="Insert Link">🔗 Link</ToolbarButton>
        <ToolbarButton onClick={() => setShowTableModal(true)} title="Insert Table">⊞ Table</ToolbarButton>
        {allowImageUpload && (
          <>
            <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Insert Image">
              {uploadingImage ? "Uploading…" : "▧ Image"}
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowMediaLibrary(true)} title="Choose Image from Uploaded Library">
              🖼 Library
            </ToolbarButton>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/webp,.webp"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
          </>
        )}
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={() => { exec("removeFormat"); exec("unlink"); exec("formatBlock", "<p>"); }} title="Clear Formatting">⌫ Clear</ToolbarButton>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onFocus={() => { clearAutoScaffold(); updateActiveFormats(); }}
        className={`rich-text-editor min-h-[120px] w-full bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none ${uniformTextSize ? "rich-text-editor--uniform-size" : ""}`}
        style={{ minHeight: `${rows * 28}px` }}
        data-placeholder={placeholder}
      />
      {allowImageUpload && (
        <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          Use “Image” to place photos anywhere in the article. WebP only, max 1 MB per image.
          {imageError && <span className="ml-2 text-red-600">{imageError}</span>}
        </p>
      )}

      {/* Table size modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Insert Table</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="admin-label">Rows</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value) || 1)}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="admin-label">Columns</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value) || 1)}
                  className="admin-input"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={insertTable} className="admin-btn">Insert</button>
              <button onClick={() => setShowTableModal(false)} className="admin-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectImage={handleSelectMediaImage}
      />
    </div>
  );
}
