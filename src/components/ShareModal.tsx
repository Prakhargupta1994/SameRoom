/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Split,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,
  QrCode,
  Smartphone,
  Eye
} from "lucide-react";
import { StyleConfig } from "../App";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle: StyleConfig;
  renderedImage: string | null;
  originalImage: string | null;
  roomType: string;
  stylingModeLabel: string;
  lightingInfo: {
    label: string;
    kelvin: number;
    icon: string;
    description: string;
    badgeBg: string;
    filter?: string;
    overlayBg?: string;
    blendMode?: string;
  };
  lightingSimEnabled: boolean;
}

type AspectRatioType = "1:1" | "4:5" | "16:9";
type SnapshotLayout = "hero" | "split" | "side_by_side";

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  currentStyle,
  renderedImage,
  originalImage,
  roomType,
  stylingModeLabel,
  lightingInfo,
  lightingSimEnabled
}) => {
  const [layout, setLayout] = useState<SnapshotLayout>("hero");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("1:1");
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [includePalette, setIncludePalette] = useState(true);
  const [includeLighting, setIncludeLighting] = useState(true);

  // Link Sharing state
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"snapshot" | "links">("snapshot");

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-generate or compute share URL when modal opens or style changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const generateServerShareLink = async () => {
      setIsGeneratingLink(true);
      try {
        const payload = {
          styleId: currentStyle.id,
          styleName: currentStyle.name,
          subtitle: currentStyle.subtitle,
          description: currentStyle.description,
          roomType,
          stylingMode: stylingModeLabel,
          lighting: {
            label: lightingInfo.label,
            kelvin: lightingInfo.kelvin,
            icon: lightingInfo.icon
          },
          palette: {
            dominant60: currentStyle.rule603010.dominant60.colors[0],
            secondary30: currentStyle.rule603010.secondary30.colors[0],
            accent10: currentStyle.rule603010.accent10.colors[0]
          },
          // Send image if available (truncated/compressed or full)
          hasImage: !!renderedImage,
          renderedImage: renderedImage || undefined,
          originalImage: originalImage || undefined
        };

        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.shareId) {
            setShareId(json.shareId);
            const fullUrl = `${window.location.origin}${window.location.pathname}?share=${json.shareId}`;
            setShareUrl(fullUrl);
          }
        } else {
          // Fallback to URL query parameter representation
          if (isMounted) {
            const fallbackUrl = `${window.location.origin}${window.location.pathname}?style=${encodeURIComponent(
              currentStyle.id
            )}&room=${encodeURIComponent(roomType)}`;
            setShareUrl(fallbackUrl);
          }
        }
      } catch (err) {
        console.warn("Could not save to /api/share, using URL params fallback:", err);
        if (isMounted) {
          const fallbackUrl = `${window.location.origin}${window.location.pathname}?style=${encodeURIComponent(
            currentStyle.id
          )}&room=${encodeURIComponent(roomType)}`;
          setShareUrl(fallbackUrl);
        }
      } finally {
        if (isMounted) setIsGeneratingLink(false);
      }
    };

    generateServerShareLink();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentStyle.id, roomType, stylingModeLabel]);

  // Helper to load an image element
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  // Render high-res snapshot on HTML5 Canvas
  const drawCardToCanvas = async (
    targetCanvas: HTMLCanvasElement,
    scaleFactor: number = 2
  ): Promise<boolean> => {
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return false;

    // Dimensions based on aspect ratio
    let baseW = 1080;
    let baseH = 1080;
    if (aspectRatio === "4:5") {
      baseW = 1080;
      baseH = 1350;
    } else if (aspectRatio === "16:9") {
      baseW = 1280;
      baseH = 720;
    }

    const width = baseW * scaleFactor;
    const height = baseH * scaleFactor;
    targetCanvas.width = width;
    targetCanvas.height = height;

    const s = scaleFactor;

    // Background - subtle warm architectural off-white
    ctx.fillStyle = "#F8F7F4";
    ctx.fillRect(0, 0, width, height);

    // Inner card bounds with padding
    const pad = 44 * s;
    const cardX = pad;
    const cardY = pad;
    const cardW = width - pad * 2;
    const cardH = height - pad * 2;
    const cardRadius = 28 * s;

    // Draw main card shadow and container
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 35 * s;
    ctx.shadowOffsetY = 16 * s;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    // Top Header: Room Category & Badges
    const headerY = cardY + 36 * s;
    ctx.fillStyle = "#8C6D46";
    ctx.font = `bold ${13 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(`${roomType.toUpperCase()} · ${stylingModeLabel.toUpperCase()}`, cardX + 32 * s, headerY);

    if (includeLighting) {
      // Lighting badge
      const lightText = `${lightingInfo.icon} ${lightingInfo.label} (${lightingInfo.kelvin.toLocaleString()}K)`;
      ctx.font = `600 ${12 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const badgeW = ctx.measureText(lightText).width + 24 * s;
      const badgeH = 26 * s;
      const badgeX = cardX + cardW - badgeW - 32 * s;
      const badgeY = headerY - 18 * s;

      ctx.fillStyle = "#FEF3C7";
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 13 * s);
      ctx.fill();

      ctx.strokeStyle = "#FDE68A";
      ctx.lineWidth = 1 * s;
      ctx.stroke();

      ctx.fillStyle = "#92400E";
      ctx.fillText(lightText, badgeX + 12 * s, badgeY + 17 * s);
    }

    // Title & Subtitle
    const titleY = headerY + 28 * s;
    ctx.fillStyle = "#18181B";
    ctx.font = `bold ${26 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(currentStyle.name, cardX + 32 * s, titleY);

    ctx.fillStyle = "#71717A";
    ctx.font = `normal ${13 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(currentStyle.subtitle, cardX + 32 * s, titleY + 20 * s);

    // Calculate Image Area
    const imgAreaX = cardX + 32 * s;
    const imgAreaY = titleY + 36 * s;
    const imgAreaW = cardW - 64 * s;

    // Reserve space at bottom for Color Swatches and Watermark
    const bottomReservedH = (includePalette ? 130 * s : 65 * s) + (includeWatermark ? 40 * s : 10 * s);
    const imgAreaH = cardY + cardH - imgAreaY - bottomReservedH;
    const imgRadius = 20 * s;

    // Draw images inside rounded clipping rect
    ctx.save();
    roundRect(ctx, imgAreaX, imgAreaY, imgAreaW, imgAreaH, imgRadius);
    ctx.clip();

    try {
      if (layout === "split" && originalImage && renderedImage) {
        // Before/After Split
        const [imgOrig, imgRender] = await Promise.all([
          loadImage(originalImage),
          loadImage(renderedImage)
        ]);

        const splitX = imgAreaX + imgAreaW * 0.5;

        // Draw left half (Before - Original)
        ctx.save();
        ctx.rect(imgAreaX, imgAreaY, imgAreaW * 0.5, imgAreaH);
        ctx.clip();
        drawCoverImage(ctx, imgOrig, imgAreaX, imgAreaY, imgAreaW, imgAreaH);
        ctx.restore();

        // Draw right half (After - Rendered)
        ctx.save();
        ctx.rect(splitX, imgAreaY, imgAreaW * 0.5, imgAreaH);
        ctx.clip();
        drawCoverImage(ctx, imgRender, imgAreaX, imgAreaY, imgAreaW, imgAreaH);

        // Apply lighting overlay if enabled
        if (lightingSimEnabled && lightingInfo.overlayBg && lightingInfo.overlayBg !== "transparent") {
          ctx.fillStyle = lightingInfo.overlayBg;
          ctx.fillRect(splitX, imgAreaY, imgAreaW * 0.5, imgAreaH);
        }
        ctx.restore();

        // Draw vertical divider
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(splitX, imgAreaY);
        ctx.lineTo(splitX, imgAreaY + imgAreaH);
        ctx.stroke();

        // Divider Badge in center
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(splitX, imgAreaY + imgAreaH * 0.5, 16 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#18181B";
        ctx.font = `bold ${10 * s}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⇄", splitX, imgAreaY + imgAreaH * 0.5);

        // "BEFORE" Badge
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        drawPillBadge(ctx, "BEFORE", imgAreaX + 16 * s, imgAreaY + 24 * s, s, "rgba(0,0,0,0.7)", "#FFFFFF");
        // "AFTER" Badge
        drawPillBadge(ctx, "AFTER", imgAreaX + imgAreaW - 74 * s, imgAreaY + 24 * s, s, "rgba(255,255,255,0.9)", "#18181B");
      } else if (layout === "side_by_side" && originalImage && renderedImage) {
        // Two columns side-by-side
        const [imgOrig, imgRender] = await Promise.all([
          loadImage(originalImage),
          loadImage(renderedImage)
        ]);

        const gap = 12 * s;
        const colW = (imgAreaW - gap) / 2;

        // Left Col: Original
        ctx.save();
        ctx.rect(imgAreaX, imgAreaY, colW, imgAreaH);
        ctx.clip();
        drawCoverImage(ctx, imgOrig, imgAreaX, imgAreaY, colW, imgAreaH);
        ctx.restore();
        drawPillBadge(ctx, "BEFORE", imgAreaX + 12 * s, imgAreaY + 20 * s, s, "rgba(0,0,0,0.7)", "#FFFFFF");

        // Right Col: Redesign
        const col2X = imgAreaX + colW + gap;
        ctx.save();
        ctx.rect(col2X, imgAreaY, colW, imgAreaH);
        ctx.clip();
        drawCoverImage(ctx, imgRender, col2X, imgAreaY, colW, imgAreaH);
        if (lightingSimEnabled && lightingInfo.overlayBg && lightingInfo.overlayBg !== "transparent") {
          ctx.fillStyle = lightingInfo.overlayBg;
          ctx.fillRect(col2X, imgAreaY, colW, imgAreaH);
        }
        ctx.restore();
        drawPillBadge(ctx, "AFTER", col2X + 12 * s, imgAreaY + 20 * s, s, "rgba(255,255,255,0.95)", "#18181B");
      } else {
        // Hero Rendered Image
        const srcToUse = renderedImage || originalImage;
        if (srcToUse) {
          const img = await loadImage(srcToUse);
          drawCoverImage(ctx, img, imgAreaX, imgAreaY, imgAreaW, imgAreaH);

          if (lightingSimEnabled && lightingInfo.overlayBg && lightingInfo.overlayBg !== "transparent") {
            ctx.fillStyle = lightingInfo.overlayBg;
            ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
          }
        } else {
          // Placeholder gradient
          const grad = ctx.createLinearGradient(imgAreaX, imgAreaY, imgAreaX + imgAreaW, imgAreaY + imgAreaH);
          grad.addColorStop(0, "#E4E4E7");
          grad.addColorStop(1, "#D4D4D8");
          ctx.fillStyle = grad;
          ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
        }

        // Style concept watermark in image corner
        drawPillBadge(
          ctx,
          `✨ ${currentStyle.name}`,
          imgAreaX + 16 * s,
          imgAreaY + imgAreaH - 18 * s,
          s,
          "rgba(0,0,0,0.65)",
          "#FFFFFF"
        );
      }
    } catch (err) {
      console.warn("Failed drawing image on canvas:", err);
    }
    ctx.restore();

    // Bottom Area: 60-30-10 Color Formula Swatches
    if (includePalette) {
      const swatchesY = imgAreaY + imgAreaH + 26 * s;

      ctx.fillStyle = "#71717A";
      ctx.font = `bold ${10 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("60-30-10 ARCHITECTURAL PALETTE", cardX + 32 * s, swatchesY);

      const d60 = currentStyle.rule603010.dominant60.colors[0] || { name: "Wall", hex: "#EAE9E4", code: "60%" };
      const s30 = currentStyle.rule603010.secondary30.colors[0] || { name: "Trim", hex: "#AFA08F", code: "30%" };
      const a10 = currentStyle.rule603010.accent10.colors[0] || { name: "Accent", hex: "#D89955", code: "10%" };

      const swatches = [
        { label: "60% Base / Wall", item: d60 },
        { label: "30% Trim / Wood", item: s30 },
        { label: "10% Focal Accent", item: a10 }
      ];

      const gap = 14 * s;
      const colW = (cardW - 64 * s - gap * 2) / 3;

      swatches.forEach((sw, i) => {
        const swX = cardX + 32 * s + i * (colW + gap);
        const swY = swatchesY + 10 * s;
        const boxH = 46 * s;

        // Swatch card box
        ctx.fillStyle = "#F4F4F5";
        roundRect(ctx, swX, swY, colW, boxH, 12 * s);
        ctx.fill();

        // Color dot
        ctx.fillStyle = sw.item.hex;
        ctx.beginPath();
        ctx.arc(swX + 18 * s, swY + boxH * 0.5, 11 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1 * s;
        ctx.stroke();

        // Swatch texts
        ctx.fillStyle = "#18181B";
        ctx.font = `bold ${11 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillText(sw.label, swX + 36 * s, swY + 18 * s);

        ctx.fillStyle = "#71717A";
        ctx.font = `500 ${10 * s}px monospace`;
        const codeText = `${sw.item.hex} · ${sw.item.code || sw.item.name}`;
        ctx.fillText(truncateText(ctx, codeText, colW - 42 * s), swX + 36 * s, swY + 34 * s);
      });
    }

    // Footer Watermark & Branding
    if (includeWatermark) {
      const footerY = cardY + cardH - 20 * s;
      ctx.fillStyle = "#A1A1AA";
      ctx.font = `500 ${11 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("Space Lift AI • Multi-Angle Room Studio & Gemini Architecture", cardX + 32 * s, footerY);

      // App URL or Badge on right
      ctx.textAlign = "right";
      ctx.fillText("spacelift.studio", cardX + cardW - 32 * s, footerY);
      ctx.textAlign = "left";
    }

    return true;
  };

  // Helper function: draw image in object-fit: cover mode
  const drawCoverImage = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sW = img.width;
    let sH = img.height;
    let sX = 0;
    let sY = 0;

    if (imgRatio > boxRatio) {
      // Source image is wider than target box
      sW = img.height * boxRatio;
      sX = (img.width - sW) / 2;
    } else {
      // Source image is taller than target box
      sH = img.width / boxRatio;
      sY = (img.height - sH) / 2;
    }

    ctx.drawImage(img, sX, sY, sW, sH, x, y, w, h);
  };

  // Helper function: round rectangle
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Helper function: draw pill badge
  const drawPillBadge = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    s: number,
    bgColor: string,
    textColor: string
  ) => {
    ctx.font = `bold ${10 * s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textW = ctx.measureText(text).width;
    const badgeW = textW + 16 * s;
    const badgeH = 22 * s;
    const badgeY = y - 14 * s;

    ctx.fillStyle = bgColor;
    roundRect(ctx, x, badgeY, badgeW, badgeH, 11 * s);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.fillText(text, x + 8 * s, y);
  };

  // Helper function: truncate text
  const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let truncated = text;
    while (truncated.length > 4 && ctx.measureText(truncated + "...").width > maxW) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
  };

  // Update preview canvas whenever options change
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;
    drawCardToCanvas(previewCanvasRef.current, 1);
  }, [
    isOpen,
    layout,
    aspectRatio,
    includeWatermark,
    includePalette,
    includeLighting,
    renderedImage,
    originalImage,
    currentStyle.id
  ]);

  // Download high-resolution PNG snapshot
  const handleDownloadSnapshot = async () => {
    setIsDownloading(true);
    try {
      const offscreenCanvas = document.createElement("canvas");
      await drawCardToCanvas(offscreenCanvas, 2); // 2x high-resolution retina rendering

      offscreenCanvas.toBlob((blob) => {
        if (!blob) {
          setIsDownloading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeStyleName = currentStyle.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        a.download = `room-style-${safeStyleName}-snapshot.png`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsDownloading(false);
      }, "image/png");
    } catch (err) {
      console.error("Failed to download snapshot:", err);
      setIsDownloading(false);
    }
  };

  // Copy snapshot image to clipboard
  const handleCopyImageToClipboard = async () => {
    try {
      const offscreenCanvas = document.createElement("canvas");
      await drawCardToCanvas(offscreenCanvas, 1.5);

      offscreenCanvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ "image/png": blob })
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        } else {
          // Fallback to downloading
          handleDownloadSnapshot();
        }
      }, "image/png");
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      // Fallback
      handleDownloadSnapshot();
    }
  };

  // Copy share URL to clipboard
  const handleCopyLink = async () => {
    const linkToCopy = shareUrl || window.location.href;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(linkToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = linkToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Could not copy link:", err);
    }
  };

  // Native Web Share API (supports sharing snapshot file or link directly on mobile)
  const handleNativeShare = async () => {
    const linkToShare = shareUrl || window.location.href;
    const shareData: ShareData = {
      title: `${currentStyle.name} Interior Design Concept`,
      text: `Check out my new room makeover concept in ${currentStyle.name} style for our ${roomType}!`,
      url: linkToShare
    };

    if (navigator.share) {
      try {
        // Try sharing with file if supported
        const offscreenCanvas = document.createElement("canvas");
        await drawCardToCanvas(offscreenCanvas, 1.5);
        offscreenCanvas.toBlob(async (blob) => {
          if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], "room-design.png", { type: "image/png" })] })) {
            const file = new File([blob], `${currentStyle.id}-design.png`, { type: "image/png" });
            await navigator.share({
              ...shareData,
              files: [file]
            });
          } else {
            await navigator.share(shareData);
          }
        }, "image/png");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Native share error:", err);
        }
      }
    } else {
      // Fallback to link copying
      handleCopyLink();
    }
  };

  // Social share intent links
  const targetUrl = shareUrl || window.location.href;
  const shareText = `Check out this ${currentStyle.name} interior makeover concept for our ${roomType} using Space Lift AI! 🎨`;
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedText = encodeURIComponent(shareText);

  const socialLinks = [
    {
      name: "Pinterest",
      icon: "📌",
      color: "hover:bg-red-50 text-red-700 border-red-200",
      url: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}${
        renderedImage ? `&media=${encodeURIComponent(renderedImage.slice(0, 1000))}` : ""
      }`
    },
    {
      name: "X (Twitter)",
      icon: "𝕏",
      color: "hover:bg-zinc-100 text-zinc-900 border-zinc-300",
      url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=interiordesign,roommakeover,homedecor,SpaceLiftAI`
    },
    {
      name: "WhatsApp",
      icon: "💬",
      color: "hover:bg-emerald-50 text-emerald-700 border-emerald-200",
      url: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`
    },
    {
      name: "Facebook",
      icon: "👥",
      color: "hover:bg-blue-50 text-blue-700 border-blue-200",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    },
    {
      name: "LinkedIn",
      icon: "💼",
      color: "hover:bg-sky-50 text-sky-700 border-sky-200",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    {
      name: "Reddit",
      icon: "🔥",
      color: "hover:bg-orange-50 text-orange-700 border-orange-200",
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#222222]">
                Share & Export Snapshot
              </h3>
              <p className="text-xs text-[#222222]/60">
                {currentStyle.name} · {roomType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center bg-zinc-200/60 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab("snapshot")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "snapshot"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Snapshot Card
              </button>
              <button
                onClick={() => setActiveTab("links")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === "links"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <span>Shareable Link</span>
                {isGeneratingLink && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {activeTab === "snapshot" ? (
            <>
              {/* Snapshot Layout & Aspect Ratio Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 p-3 rounded-2xl border border-black/5">
                {/* Layout Type */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500 mr-1">Layout:</span>
                  <button
                    onClick={() => setLayout("hero")}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      layout === "hero"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Hero Style
                  </button>
                  {originalImage && (
                    <>
                      <button
                        onClick={() => setLayout("split")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 ${
                          layout === "split"
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        <Split className="w-3 h-3" />
                        <span>Before & After Split</span>
                      </button>
                      <button
                        onClick={() => setLayout("side_by_side")}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          layout === "side_by_side"
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        Side-by-Side
                      </button>
                    </>
                  )}
                </div>

                {/* Aspect Ratio */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500 mr-1">Aspect:</span>
                  {(["1:1", "4:5", "16:9"] as AspectRatioType[]).map((ar) => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`text-xs px-2 py-1 rounded-lg border font-mono font-medium transition-all ${
                        aspectRatio === ar
                          ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Canvas Preview */}
              <div className="flex flex-col items-center justify-center p-3 bg-zinc-100 rounded-2xl border border-zinc-200/80">
                <div className="max-w-full max-h-[380px] overflow-hidden rounded-xl shadow-lg border border-black/10 flex items-center justify-center bg-white">
                  <canvas
                    ref={previewCanvasRef}
                    className="max-h-[360px] max-w-full w-auto object-contain"
                  />
                </div>
                <span className="text-[11px] text-zinc-500 mt-2 font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3 text-zinc-400" />
                  Live Snapshot Preview · High-DPI 2x retina output ready for social posts
                </span>
              </div>

              {/* Content Inclusions Toggles */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600 px-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePalette}
                    onChange={(e) => setIncludePalette(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>60-30-10 Color Swatches</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLighting}
                    onChange={(e) => setIncludeLighting(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Lighting Specs Badge</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWatermark}
                    onChange={(e) => setIncludeWatermark(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Architectural Watermark</span>
                </label>
              </div>

              {/* Action Buttons for Snapshot */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={handleDownloadSnapshot}
                  disabled={isDownloading}
                  className="flex-1 min-w-[170px] py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download className={`w-4 h-4 ${isDownloading ? "animate-bounce" : ""}`} />
                  <span>{isDownloading ? "Rendering Image..." : "Download High-Res Snapshot (PNG)"}</span>
                </button>

                <button
                  onClick={handleCopyImageToClipboard}
                  className="py-2.5 px-3.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Copy snapshot directly to clipboard (for pasting into Discord, Slack, etc.)"
                >
                  {copiedImage ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied Image!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-zinc-600" />
                      <span>Copy Image</span>
                    </>
                  )}
                </button>

                {"share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Open device native share sheet (AirDrop, Messages, Instagram, etc.)"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Device Share</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Tab: Shareable Link & Social Media Intents */
            <div className="space-y-5">
              {/* Shareable Link Box */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-black/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Shareable Web Link
                  </span>
                  {shareId && (
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-200/60 px-2 py-0.5 rounded-full">
                      ID: {shareId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl || "Generating share link..."}
                    className="flex-1 text-xs bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-800 font-mono outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-zinc-500 leading-normal">
                  Anyone opening this link will see your customized {currentStyle.name} room concept, 60-30-10 color codes, and simulated lighting conditions!
                </p>
              </div>

              {/* Direct 1-Click Social Media Platforms */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Post Directly to Social Media
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-2.5 rounded-xl border bg-white flex items-center justify-between text-xs font-semibold transition-all shadow-2xs hover:shadow-xs hover:scale-[1.02] cursor-pointer ${social.color}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{social.icon}</span>
                        <span>{social.name}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-zinc-500" />
                  <span>{showQrCode ? "Hide QR Code" : "Show Mobile QR Code"}</span>
                </button>

                {"share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Open Phone Share Sheet</span>
                  </button>
                )}
              </div>

              {/* QR Code Container */}
              {showQrCode && (
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 flex flex-col items-center justify-center text-center space-y-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      shareUrl || window.location.href
                    )}`}
                    alt="Scan QR code to view room design"
                    className="w-36 h-36 rounded-xl shadow-xs border border-white"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Scan with your phone camera to view this room style on mobile
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 border-t border-black/5 bg-zinc-50/70 flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            Concept: <strong className="text-zinc-800 font-semibold">{currentStyle.name}</strong> · {roomType}
          </span>
          <button
            onClick={onClose}
            className="font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
