/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  Grid,
  Video,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Palette,
  Split,
  Info,
  Film,
  Play,
  CheckCircle2,
  Sliders,
  Sun,
  Sunset,
  SunMedium,
  Moon,
  Layers,
  Copy,
  Check,
  Maximize2,
  Bookmark,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
  Paintbrush,
  Home,
  Bed,
  Briefcase,
  Utensils,
  Coffee,
  Bath,
  ArrowRight,
  Mic,
  MicOff,
  Tag,
  Pin,
  ShoppingBag,
  Ruler,
  CheckSquare,
  Square,
  Trash,
  MessageSquarePlus,
  Download,
  FileText,
  Scale,
  Share2,
  Armchair,
  Layout,
  Package,
  FolderArchive
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { ShareModal } from "./components/ShareModal";

type Screen = "welcome" | "countdown" | "loading" | "cards" | "favorites";

export type StylingMode =
  | "paint_only"
  | "architectural_restyle"
  | "declutter_polish"
  | "virtual_staging"
  | "custom";

export interface RoomAnnotation {
  id: string;
  styleId: string;
  viewKey: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  label: string;
  category: "furniture" | "wall_paint" | "lighting" | "decor" | "flooring";
  notes: string;
  shoppingItem?: {
    itemTitle: string;
    brandOrStore?: string;
    estimatedCost?: string;
    dimensions?: string;
    status: "wishlist" | "sourcing" | "purchased";
  };
  createdAt: number;
}

export interface RoomAnglePhoto {
  id: string;
  url: string; // base64 data url
  label: string; // e.g. "Angle 1"
  tag: string; // e.g. "Main View"
}

export interface ColorItem {
  name: string;
  code: string;
  hex: string;
  role: string;
}

export interface Rule60_30_10 {
  dominant60: {
    title: string;
    description: string;
    colors: ColorItem[];
    finishes: string;
  };
  secondary30: {
    title: string;
    description: string;
    colors: ColorItem[];
    materials: string[];
  };
  accent10: {
    title: string;
    description: string;
    colors: ColorItem[];
    details: string;
  };
  lightingSpecs: {
    kelvin: string;
    fixtureTypes: string;
    luxAdvice: string;
  };
  circulationAdvice: string;
}

export interface StyleConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  prompt: string;
  rule603010: Rule60_30_10;
}

const DEFAULT_ANGLE_TAGS = [
  "Main Living View",
  "Opposite Entry & Dining",
  "Window & Daylight Angle",
  "Corner & Seating Nook"
];

export interface RoomTypeOption {
  id: string;
  label: string;
  icon: string;
  category: "interior" | "exterior";
  description?: string;
}

const ROOM_TYPE_OPTIONS: RoomTypeOption[] = [
  // Interior Spaces
  { id: "living room", label: "Living Room", icon: "🛋️", category: "interior" },
  { id: "bedroom", label: "Bedroom", icon: "🛏️", category: "interior" },
  { id: "kitchen", label: "Kitchen", icon: "🍳", category: "interior" },
  { id: "dining room", label: "Dining Room", icon: "🍽️", category: "interior" },
  { id: "home office", label: "Home Office", icon: "💼", category: "interior" },
  { id: "bathroom", label: "Bathroom", icon: "🛁", category: "interior" },
  { id: "studio / open space", label: "Studio / Open", icon: "🏢", category: "interior" },

  // Exterior & Landscape Spaces (Requested by user)
  { id: "garden / landscape", label: "Garden & Landscape", icon: "🌳", category: "exterior", description: "Lawn, flowerbeds, stone pathways, pergola & outdoor living" },
  { id: "exterior facade", label: "House Exterior / Facade", icon: "🏡", category: "exterior", description: "Front elevation, boundary walls, architectural cladding & gates" },
  { id: "indian courtyard", label: "Indian Courtyard (Aangan)", icon: "🪔", category: "exterior", description: "Central open-to-sky courtyard, terracotta jali, stone floor & urli" },
  { id: "verandah / thinnai", label: "Verandah / Thinnai", icon: "🪴", category: "exterior", description: "Shaded traditional porch, carved teak pillars & outdoor seating" },
  { id: "terrace garden", label: "Rooftop Terrace Garden", icon: "🌺", category: "exterior", description: "Roof deck, planter boxes, artificial turf & cozy seating" },
  { id: "patio / balcony", label: "Balcony / Patio", icon: "🌿", category: "exterior", description: "Balcony railing, outdoor deck tiles, lounge chair & planters" }
];

const STYLING_MODES: {
  id: StylingMode;
  label: string;
  badge: string;
  description: string;
  detail: string;
}[] = [
  {
    id: "paint_only",
    label: "Paint & Colors Only",
    badge: "100% Furniture Kept",
    description: "Keeps your exact furniture, bed, sofa & layout identical — strictly repaints walls and adds matching textiles.",
    detail: "Zero furniture changes. Perfect when you want your exact house with a fresh 60-30-10 palette."
  },
  {
    id: "architectural_restyle",
    label: "Architectural Restyle",
    badge: "Walls & Windows Intact",
    description: "Preserves your exact room walls, windows, door frames, and dimensions; upgrades furnishings in the style.",
    detail: "Maintains room architecture and perspective with style-matched furniture and lighting."
  },
  {
    id: "declutter_polish",
    label: "Declutter & Polish",
    badge: "Keeps Core Pieces",
    description: "Cleans up loose clutter, straightens cushions, elevates lighting and color harmony while keeping your room.",
    detail: "Tidies and stages your actual space with warm natural lighting and balanced tones."
  },
  {
    id: "virtual_staging",
    label: "Virtual Staging",
    badge: "For Empty Spaces",
    description: "Stages empty or moving-in spaces with scaled furniture tailored to this room's exact shape.",
    detail: "Places appropriately proportioned furniture fitting the walls and walkways."
  },
  {
    id: "custom",
    label: "Custom Vision",
    badge: "Your Exact Prompt",
    description: "Type your own specific directives for what to keep or change in your room.",
    detail: "Tell the AI e.g. 'Keep my wooden bed, paint walls sage green, add linen curtains'."
  }
];

const STYLE_CONFIGS: StyleConfig[] = [
  {
    id: "japandi",
    name: "Japandi",
    subtitle: "Wabi-Sabi Serenity & Nordic Function",
    description: "Japandi minimalism blends serene Scandinavian functionality with Japanese rustic warmth to create peace.",
    prompt: "Japandi style with earthy chalk neutrals, low-slung pale Nordic oak woodwork, organic linen textiles, minimalist ceramic decor, and warm muted chalk plaster walls",
    rule603010: {
      dominant60: {
        title: "60% Dominant Neutral Foundation",
        description: "Matte chalk plaster walls and pale oiled Nordic white oak flooring.",
        colors: [
          { name: "Pointing", code: "F&B No. 2003", hex: "#EBE6DC", role: "Walls & Ceiling" },
          { name: "Nordic White Oak", code: "NAT-OAK-01", hex: "#D6C7B2", role: "Hardwood Floor" }
        ],
        finishes: "Dead-flat mineral wall wash; ultra-matte polyurethane on wire-brushed oak"
      },
      secondary30: {
        title: "30% Structural Furnishings & Cabinetry",
        description: "Low-slung seating in unbleached linen and slatted oak screens.",
        colors: [
          { name: "Raw Oatmeal", code: "BM CC-20", hex: "#B8A792", role: "Sofa & Linen Drapes" },
          { name: "Bespoke Ash", code: "WOOD-ASH-04", hex: "#948473", role: "Low Platform Credenza" }
        ],
        materials: ["Natural White Oak", "Belgian Raw Linen", "Paper Shoji Cord", "Woven Bamboo Mat"]
      },
      accent10: {
        title: "10% Wabi-Sabi Accents & Hardware",
        description: "Stoneware ceramics, blackened sumi ink fixtures, and bonsai moss.",
        colors: [
          { name: "Sumi Ink Noir", code: "F&B No. 293", hex: "#262320", role: "Iron Hardware & Lamp Stems" },
          { name: "Bonsai Lichen", code: "BM HC-127", hex: "#5C6150", role: "Live Botanical Accents" }
        ],
        details: "Hand-thrown coarse stoneware bowls, matte black linear lighting, single sculptural branches"
      },
      lightingSpecs: {
        kelvin: "2700K Warm Ambient",
        fixtureTypes: "Diffused rice paper pendants (Noguchi style) & concealed indirect low floor coves",
        luxAdvice: "Keep ambient illumination soft (100–150 lux) with warm pooling lamps for evening calm"
      },
      circulationAdvice: "Maintain minimum 36-inch clear walkways and low furniture heights (<28 inches) to preserve unbroken horizontal sightlines."
    }
  },
  {
    id: "industrial",
    name: "Industrial Modern",
    subtitle: "Raw Architectural Edge & Urban Patina",
    description: "Industrial Modern embraces raw architectural elements with charcoal tones and exposed brick for an urban edge.",
    prompt: "Industrial Modern style with charcoal tones, weathered loam textures, distressed warm cognac leather, refined matte black steel accents, and warm filament lighting",
    rule603010: {
      dominant60: {
        title: "60% Dominant Raw Architectural Shell",
        description: "Polished poured concrete floors and weathered reclaimed brick walls.",
        colors: [
          { name: "Raw Concrete", code: "BM 1599", hex: "#9E9E9C", role: "Concrete Floor & Ceiling" },
          { name: "Weathered Loam", code: "BM 2112-20", hex: "#504E4D", role: "Shadow Walls" }
        ],
        finishes: "Polished matte microcement with exposed aggregate; unsealed matte historic brickwork"
      },
      secondary30: {
        title: "30% Industrial Furnishings & Timber",
        description: "Heavy saddle leather Chesterfield and salvaged timber slab coffee table.",
        colors: [
          { name: "Cognac Saddle", code: "LTHR-CGN-08", hex: "#8A5432", role: "Distressed Leather Seating" },
          { name: "Reclaimed Barnwood", code: "WOOD-BARN-12", hex: "#6E5B4B", role: "Dining & Shelving" }
        ],
        materials: ["Distressed Top-Grain Leather", "Salvaged Fir", "Wire Glass", "Cast Aluminum"]
      },
      accent10: {
        title: "10% Cast Iron & Industrial Hardware",
        description: "Matte black pipe fittings, exposed factory bolts, and brass valves.",
        colors: [
          { name: "Cast Iron Black", code: "BM 2126-20", hex: "#1F2226", role: "Mullions & Steel Beams" },
          { name: "Vintage Filament", code: "GLW-2200K", hex: "#C78D4E", role: "Amber Bulb Glow" }
        ],
        details: "Exposed black steel conduits, heavy flanged pipe shelving, blackened steel casement windows"
      },
      lightingSpecs: {
        kelvin: "2200K–2700K Amber Industrial",
        fixtureTypes: "Directional track spotlights, wire cage pendants, and articulated architect task lamps",
        luxAdvice: "High contrast lighting with deep motivated architectural shadows and highlighted brick textures"
      },
      circulationAdvice: "Allow generous open-plan loitering zones with 42-inch main pathways around heavy furniture masses."
    }
  },
  {
    id: "midcentury",
    name: "Mid-Century Modern",
    subtitle: "Iconic Warm Retro & Sleek Organic Silhouettes",
    description: "Mid-Century Modern pairs warm retro aesthetics with sleek lines, peg legs, and vibrant autumnal accent colors.",
    prompt: "Mid-Century Modern style with warm walnut timber finishes, tapered peg legs, warm oatmeal tweed upholstery, mustard yellow and olive green autumnal accents",
    rule603010: {
      dominant60: {
        title: "60% Warm Neutral Retro Field",
        description: "Warm butter-cream walls and rich continuous teak or walnut parquet.",
        colors: [
          { name: "Alabaster White", code: "SW 7008", hex: "#EDE8DF", role: "Main Field Walls" },
          { name: "Rich American Walnut", code: "WOOD-WLN-02", hex: "#543825", role: "Parquet Flooring" }
        ],
        finishes: "Eggshell wall sheen reflecting diffused daylight; satin tung-oil timber floor"
      },
      secondary30: {
        title: "30% Sculptural Tailored Furnishings",
        description: "Tapered-leg credenza, low walnut frame sofa in textured oatmeal tweed.",
        colors: [
          { name: "Dune Tweed", code: "BM 1052", hex: "#A89A84", role: "Sofa & Armchair Weave" },
          { name: "Warm Teak", code: "WOOD-TK-06", hex: "#7A5034", role: "Bookcase & Credenzas" }
        ],
        materials: ["Oiled American Walnut", "Wool Tweed", "Molded Plywood", "Ribbed Ceramics"]
      },
      accent10: {
        title: "10% Vibrant Autumnal Color Accents",
        description: "Burnt ochre cushions, olive green accents, and spun brass caps.",
        colors: [
          { name: "Tangerine Ochre", code: "BM 135", hex: "#D66E22", role: "Accent Pillow & Throw" },
          { name: "Moss Forest", code: "F&B No. 47", hex: "#3C5446", role: "Ceramic Planter & Art" },
          { name: "Spun Brass", code: "MET-BRS-03", hex: "#C29B47", role: "Sputnik Caps & Lamp Stems" }
        ],
        details: "Sputnik radial chandeliers, brass ferrule furniture feet, organic kidney-shaped tabletop decor"
      },
      lightingSpecs: {
        kelvin: "3000K Clean Warm White",
        fixtureTypes: "Arched floor lamp with spun brass counterweight & sculptural multi-arm chandelier",
        luxAdvice: "Even 200 lux wash across open floor with focused task lighting at seating reading nooks"
      },
      circulationAdvice: "Keep 18 inches between coffee table and sofa edge for relaxed leg clearance while maintaining close conversational groupings."
    }
  },
  {
    id: "biophilic",
    name: "Biophilic",
    subtitle: "Living Greenery, Natural Sunlight & Organic Textures",
    description: "Biophilic design brings the outdoors inside, layering abundant plant life with natural rattan and cream fabrics.",
    prompt: "Biophilic Urban style with abundant natural indoor plant life, hanging vines, woven rattan cane, breathable lime wash walls, jute textures, and sunny natural daylight",
    rule603010: {
      dominant60: {
        title: "60% Botanical Sunlit Canvas",
        description: "Soft lime-wash off-white walls that maximize light bounce, paired with pale clay tile.",
        colors: [
          { name: "Chalk Lime", code: "BM OC-130", hex: "#F3EFE7", role: "Airy Light-Reflecting Walls" },
          { name: "Terracotta Sand", code: "NAT-TCT-01", hex: "#CEB8A2", role: "Clay Stone Floor" }
        ],
        finishes: "Textured breathable lime wash; honed natural limestone or unsealed terracotta"
      },
      secondary30: {
        title: "30% Organic Fibers & Deep Seating",
        description: "Braided jute floor coverings, cane lounge chairs, and deep natural cotton seating.",
        colors: [
          { name: "Raw Jute", code: "BM 1095", hex: "#BAA287", role: "Rugs & Woven Shades" },
          { name: "Soft Alabaster", code: "F&B No. 201", hex: "#DDD6C7", role: "Cotton Slipcover Sectional" }
        ],
        materials: ["Hand-braided Jute", "Natural Rattan Cane", "FSC Certified Teak", "Unbleached Cotton Canvas"]
      },
      accent10: {
        title: "10% Living Foliage & Earth Minerals",
        description: "Vibrant botanical chlorophyll greens and fired clay pottery.",
        colors: [
          { name: "Monstera Emerald", code: "BM 2041-10", hex: "#2E5738", role: "Living Foliage Canopy" },
          { name: "Burnt Sienna Pot", code: "SW 6335", hex: "#A6553B", role: "Planters & Earth Ceramics" }
        ],
        details: "Hanging trailing pothos vines, floor-standing fiddle leaf figs, self-watering terracotta bowls"
      },
      lightingSpecs: {
        kelvin: "3000K–4000K Circadian Full Spectrum",
        fixtureTypes: "High CRI (95+) daylight-mimicking fixtures and hidden warm LED grow strips in planters",
        luxAdvice: "Maximized natural sunlight during daytime; 2700K low ambient lighting for evening winding down"
      },
      circulationAdvice: "Arrange furniture radially facing main window light sources, preserving clear 30-inch access paths to all plant stations for watering."
    }
  },
  {
    id: "luxury",
    name: "Luxury Contemporary",
    subtitle: "Architectural Opulence, Calacatta Marble & Boucle",
    description: "Luxury Contemporary exudes opulence through rich boucle textures, polished marble tables, and refined brass hardware.",
    prompt: "Luxury Contemporary style with plush ivory wool boucle upholstery, polished Calacatta gold marble surfaces, brushed champagne brass accents, and museum warm cove lighting",
    rule603010: {
      dominant60: {
        title: "60% Muted Alabaster & Herringbone Parquet",
        description: "Seamless micro-fluted ivory plaster walls with French oak herringbone floors.",
        colors: [
          { name: "Swiss Coffee", code: "BM OC-45", hex: "#F2EDE4", role: "Perimeter Millwork & Walls" },
          { name: "French Bleached Oak", code: "HRB-OAK-09", hex: "#D2C2B0", role: "Herringbone Parquet" }
        ],
        finishes: "Venetian satin plaster with fine marble dust; satin UV lacquer on French oak"
      },
      secondary30: {
        title: "30% Sculptural Boucle & Calacatta Marble",
        description: "Curved statement cloud sofa in heavy wool boucle and solid waterfall marble tables.",
        colors: [
          { name: "Wool Boucle", code: "TEX-BCL-01", hex: "#E7DFD4", role: "Curved Sectional" },
          { name: "Calacatta Gold Vein", code: "MRB-CAL-04", hex: "#B8ABA0", role: "Coffee & Console Tables" }
        ],
        materials: ["Heavy Wool Boucle", "Calacatta Gold Marble", "Brushed Champagne Brass", "Smoked Fluted Glass"]
      },
      accent10: {
        title: "10% Gilded Brass & Smoked Obsidian",
        description: "Precision-machined champagne brass and nero marquina accents.",
        colors: [
          { name: "Champagne Gold", code: "MET-GLD-02", hex: "#C7A661", role: "Chandelier & Inlay Hardware" },
          { name: "Nero Marquina", code: "MRB-NRO-01", hex: "#1C1D21", role: "Pedestal & Fireplace Hearth" }
        ],
        details: "Concealed 24V linear ceiling coves, solid unlacquered brass hardware, custom silk-wool area rugs"
      },
      lightingSpecs: {
        kelvin: "2700K Museum Warm",
        fixtureTypes: "Concealed cove ceiling wash, architectural flangeless downlights, and alabaster wall sconces",
        luxAdvice: "Layered lighting control with dimming to 10% for evening entertaining elegance"
      },
      circulationAdvice: "Provide generous 48-inch gallery walkways around focal sculptural seating islands."
    }
  },
  {
    id: "bohemian",
    name: "Bohemian Chic",
    subtitle: "Eclectic Global Textures, Vintage Kilim & Macrame",
    description: "Bohemian Chic layers eclectic patterns, vintage rugs, and macrame accents for a free-spirited, relaxed aesthetic.",
    prompt: "Bohemian Chic style with warm hand-troweled sand adobe plaster, layered vintage Moroccan wool kilim rugs, carved mango wood, embroidered terracotta cushions, and warm perforated lanterns",
    rule603010: {
      dominant60: {
        title: "60% Warm Adobe & Reclaimed Wood",
        description: "Warm sand adobe walls with aged reclaimed chestnut wood flooring.",
        colors: [
          { name: "Navajo White", code: "BM OC-95", hex: "#EFE5D4", role: "Warm Textured Walls" },
          { name: "Aged Chestnut", code: "WOOD-CHST-03", hex: "#7E5B42", role: "Wide Plank Flooring" }
        ],
        finishes: "Subtly hand-troweled plaster; oil-rubbed reclaimed timber with visible knotting"
      },
      secondary30: {
        title: "30% Layered Vintage Textiles & Low Seating",
        description: "Layered vintage Moroccan and Persian wool rugs under a deep low-profile modular lounge.",
        colors: [
          { name: "Clay Terracotta", code: "SW 6334", hex: "#BD6E52", role: "Low Sectional Cushioning" },
          { name: "Vintage Kilim Tan", code: "TEX-KLM-07", hex: "#C2A384", role: "Layered Rugs & Poufs" }
        ],
        materials: ["Hand-knotted Berber Wool", "Braided Macrame", "Carved Mango Wood", "Embroidered Velvet"]
      },
      accent10: {
        title: "10% Jewel Tone Embroidery & Perforated Brass",
        description: "Turquoise and marigold embroidered pillows with perforated Moroccan lanterns.",
        colors: [
          { name: "Marigold Sun", code: "BM 2154-30", hex: "#DE9F35", role: "Fringe Pillows & Throws" },
          { name: "Agave Turquoise", code: "SW 6479", hex: "#3B7A75", role: "Ceramic Glaze & Beads" }
        ],
        details: "Perforated pierced brass pendant lanterns casting lace-like shadow patterns on ceiling"
      },
      lightingSpecs: {
        kelvin: "2400K Low Candlelight Glow",
        fixtureTypes: "Pendant lanterns, rattan woven shades, and indirect warm floor lamps with dimmers",
        luxAdvice: "Low, cozy, intimate lighting with accent pin-spots highlighting wall art tapestries"
      },
      circulationAdvice: "Informal, cozy seating clusters with scattered leather floor poufs that can be shifted easily."
    }
  },
  {
    id: "minimalist",
    name: "Pure Minimalist",
    subtitle: "Monolithic Geometry, Concealed Storage & Pure Negative Space",
    description: "Pure Minimalist focuses on the essentials with clean white walls, hidden storage, and singular statement pieces.",
    prompt: "Pure Minimalist style with seamless matte chalk-white walls, continuous light microcement flooring, concealed flush cabinetry, a tailored low-slung sofa, and tranquil negative space",
    rule603010: {
      dominant60: {
        title: "60% Monotone Seamless Envelope",
        description: "Seamless matte microcement floor continuing directly into flush, baseboard-less chalk white walls.",
        colors: [
          { name: "All White", code: "F&B No. 2005", hex: "#F7F7F6", role: "Flush Walls & Ceilings" },
          { name: "Pale Microcement", code: "CEM-MCR-01", hex: "#E5E6E8", role: "Continuous Poured Floor" }
        ],
        finishes: "Zero-reflectance ultra-matte mineral finish; seamless polyurethane sealed microcement"
      },
      secondary30: {
        title: "30% Monolithic Floating Geometry",
        description: "Concealed push-to-open floor-to-ceiling cabinetry and a single tailored low-slung seating volume.",
        colors: [
          { name: "Cool Fog", code: "BM 2120-60", hex: "#C8CBD0", role: "Sofa Upholstery" },
          { name: "Charcoal Shadow", code: "BM 2120-20", hex: "#4B4E54", role: "Recessed Pocket Reveals" }
        ],
        materials: ["Continuous Microcement", "Flush Polymer Cabinetry", "Brushed Stainless Steel", "Smoked Glass"]
      },
      accent10: {
        title: "10% High-Precision Architectural Jet",
        description: "Ultra-thin architectural reveals, matte black downlights, and singular obsidian sculpture.",
        colors: [
          { name: "Architectural Noir", code: "RAL 9005", hex: "#121315", role: "Reveals & Flangeless Channels" }
        ],
        details: "Zero visible cables, flush shadowline wall bases, frameless doors with concealed hinges"
      },
      lightingSpecs: {
        kelvin: "3000K Pure Architectural Neutral",
        fixtureTypes: "Micro-aperture flangeless recessed downlights and concealed linear wall graze profiles",
        luxAdvice: "Precision 250 lux museum-grade uniform illumination accentuating pure planar geometry"
      },
      circulationAdvice: "Ample uninterrupted empty perimeter zones with at least 48 inches of open breathability around all furniture."
    }
  },
  {
    id: "warm_scandi",
    name: "Warm Scandinavian",
    subtitle: "Hygge Comfort, Blonde Pine & Light Oatmeal Wool",
    description: "Warm Scandinavian embraces soft hygge textiles, pale pine wood, warm vanilla tones, and diffused gentle lighting.",
    prompt: "Warm Scandinavian hygge style with pale pine woodwork, soft sheepskin throws, oatmeal wool upholstery, warm ivory walls, and soft diffused lighting",
    rule603010: {
      dominant60: {
        title: "60% Warm Vanilla Canvas",
        description: "Soft warm ivory eggshell walls and wide-plank oiled blonde pine flooring.",
        colors: [
          { name: "Vanilla Milkshake", code: "BM 2141-70", hex: "#F3EFE6", role: "Walls & Ceiling" },
          { name: "Pale Swedish Pine", code: "WOOD-PNE-01", hex: "#E2D3BE", role: "Floor Planks" }
        ],
        finishes: "Eggshell light-bouncing wash; satin natural Swedish lye-and-soap pine finish"
      },
      secondary30: {
        title: "30% Tactile Hygge Upholstery",
        description: "Plush curved sectional in oatmeal bouclé with light birch nesting coffee tables.",
        colors: [
          { name: "Oat Porridge", code: "BM 1528", hex: "#C9BEB0", role: "Sectional Fabric" },
          { name: "Blonde Birch", code: "WOOD-BRCH-03", hex: "#AFA08F", role: "Tables & Shelving" }
        ],
        materials: ["Swedish Pine", "Oatmeal Wool", "Icelandic Sheepskin", "Smoked Papercord"]
      },
      accent10: {
        title: "10% Hearth Amber & Sage Greens",
        description: "Amber ceramic candle holders and muted sage throw blankets.",
        colors: [
          { name: "Hygge Amber", code: "BM 110", hex: "#D89955", role: "Lighting Glass & Ceramics" },
          { name: "Muted Sage", code: "F&B No. 289", hex: "#7E8879", role: "Cushion & Botanical Accent" }
        ],
        details: "Hand-dipped taper candles, pleated paper lampshades, tactile ribbed knit blankets"
      },
      lightingSpecs: {
        kelvin: "2500K–2700K Ultra-Warm Hygge",
        fixtureTypes: "Pleated paper pendant shades, low floor paper globes, and soft warm table lamps",
        luxAdvice: "Multi-point warm pool lighting with zero glare for cozy evening relaxation"
      },
      circulationAdvice: "Cozy conversational furniture arrangement centered around a shared coffee table with 24-inch walkways."
    }
  },
  {
    id: "coastal",
    name: "Coastal Hampton",
    subtitle: "Breezy Whites, Driftwood & Nautical Calm",
    description: "Coastal Hampton pairs crisp whites with weathered driftwood and soft blue-greys for an airy, sunlit retreat.",
    prompt: "Coastal Hampton style with crisp white shiplap walls, bleached driftwood oak, soft blue-grey washed linen slipcovers, natural rattan, nautical navy accents, and breezy sheer drapes",
    rule603010: {
      dominant60: {
        title: "60% Airy White Shell",
        description: "Matte white shiplap walls and bleached driftwood oak floors.",
        colors: [
          { name: "Chalk White", code: "BM OC-17", hex: "#F4F1E9", role: "Walls & Shiplap" },
          { name: "Bleached Driftwood", code: "WOOD-DFT-02", hex: "#D8CDBC", role: "Floor" }
        ],
        finishes: "Matte shiplap paneling; wire-brushed whitewashed oak"
      },
      secondary30: {
        title: "30% Slipcovered Linen & Rattan",
        description: "Washed blue-grey linen slipcover sofas with natural rattan chairs.",
        colors: [
          { name: "Sea Salt Linen", code: "SW 6204", hex: "#C9CFC9", role: "Slipcover Sofa" },
          { name: "Natural Rattan", code: "NAT-RAT-01", hex: "#C2A579", role: "Accent Chairs" }
        ],
        materials: ["Washed Belgian Linen", "Natural Rattan", "Driftwood Oak", "Jute Sisal"]
      },
      accent10: {
        title: "10% Nautical Navy & Brass",
        description: "Hale navy textiles with aged brass lanterns.",
        colors: [
          { name: "Hale Navy", code: "BM HC-154", hex: "#30383F", role: "Cushions & Art" },
          { name: "Aged Brass", code: "MET-BRS-05", hex: "#B08D57", role: "Lantern Hardware" }
        ],
        details: "Woven jute rugs, glass hurricane lanterns, driftwood and coral objets"
      },
      lightingSpecs: {
        kelvin: "2700K–3000K Soft Warm Daylight",
        fixtureTypes: "Woven rattan pendants, oversized glass lanterns, linen drum shades",
        luxAdvice: "Maximize breezy daylight with soft warm lamp pools for evening"
      },
      circulationAdvice: "Keep open, airy 36-inch pathways with low breezy sightlines to the windows."
    }
  },
  {
    id: "modern_farmhouse",
    name: "Modern Farmhouse",
    subtitle: "Warm Whites, Black Steel & Reclaimed Wood",
    description: "Modern Farmhouse blends cozy warmth with crisp black-and-white contrast, reclaimed wood, and shaker simplicity.",
    prompt: "Modern Farmhouse style with warm whitewashed walls, black steel window frames, reclaimed oak beams, shaker cabinetry, waffle-weave textiles, and matte black fixtures",
    rule603010: {
      dominant60: {
        title: "60% Warm White & Wide Plank",
        description: "Warm white walls with wide-plank reclaimed oak floors and beams.",
        colors: [
          { name: "Simply White", code: "BM OC-117", hex: "#F3EFE6", role: "Walls" },
          { name: "Weathered Barn Oak", code: "WOOD-BRN-05", hex: "#9A7B5C", role: "Floor & Beams" }
        ],
        finishes: "Matte warm-white walls; matte-sealed reclaimed oak"
      },
      secondary30: {
        title: "30% Shaker & Linen",
        description: "Oat linen slipcovers with charcoal shaker cabinetry.",
        colors: [
          { name: "Oat Linen", code: "BM 1522", hex: "#CFC3B0", role: "Sofa" },
          { name: "Charcoal Shaker", code: "BM 2121-10", hex: "#3A3B3D", role: "Island & Cabinetry" }
        ],
        materials: ["Reclaimed Oak", "Waffle-weave Cotton", "Shaker Pine", "Matte Black Steel"]
      },
      accent10: {
        title: "10% Matte Black & Antique Brass",
        description: "Black fixtures and frames with antique brass hardware.",
        colors: [
          { name: "Matte Black", code: "BM 2118-10", hex: "#242526", role: "Fixtures & Frames" },
          { name: "Antique Brass", code: "MET-BRS-07", hex: "#AD8A52", role: "Hardware" }
        ],
        details: "Black gooseneck sconces, woven baskets, stoneware crocks, greenery sprigs"
      },
      lightingSpecs: {
        kelvin: "2700K Warm Cozy",
        fixtureTypes: "Black gooseneck barn sconces, linen pendants, iron lantern chandeliers",
        luxAdvice: "Warm cozy pools with brighter task light over islands"
      },
      circulationAdvice: "Generous 40-inch kitchen walkways and open communal gathering zones."
    }
  },
  {
    id: "art_deco",
    name: "Art Deco Glam",
    subtitle: "Jewel Tones, Brass Geometry & Velvet",
    description: "Art Deco Glam delivers opulence through jewel tones, bold geometry, polished brass, and sumptuous velvet.",
    prompt: "Art Deco Glam style with deep emerald and sapphire jewel tones, bold geometric patterns, polished brass inlays, velvet upholstery, fluted panels, and lacquered black accents",
    rule603010: {
      dominant60: {
        title: "60% Jewel Lacquer Shell",
        description: "High-gloss emerald walls over dark ebony herringbone floors.",
        colors: [
          { name: "Emerald Lacquer", code: "BM 2041-10", hex: "#0F3D34", role: "Feature Walls" },
          { name: "Ebony Herringbone", code: "WOOD-EBN-01", hex: "#2A2420", role: "Floor" }
        ],
        finishes: "High-gloss lacquer walls; polished dark herringbone parquet"
      },
      secondary30: {
        title: "30% Velvet & Fluted Walnut",
        description: "Sapphire velvet seating with fluted walnut detailing.",
        colors: [
          { name: "Sapphire Velvet", code: "TEX-VLV-02", hex: "#27415F", role: "Sofa" },
          { name: "Blush Mauve", code: "BM 2113-50", hex: "#B98E8A", role: "Lounge Chairs" }
        ],
        materials: ["Crushed Velvet", "Fluted Walnut", "Polished Brass", "Smoked Glass"]
      },
      accent10: {
        title: "10% Brass & Onyx Geometry",
        description: "Polished brass inlays with onyx black geometric trim.",
        colors: [
          { name: "Polished Brass", code: "MET-BRS-08", hex: "#C6A24A", role: "Inlays & Lighting" },
          { name: "Onyx Black", code: "RAL 9005", hex: "#0E0F11", role: "Geometric Trim" }
        ],
        details: "Sunburst mirrors, geometric brass inlay, fan-motif screens, crystal globe lighting"
      },
      lightingSpecs: {
        kelvin: "2700K Glamorous Warm",
        fixtureTypes: "Brass sunburst chandeliers, fluted glass sconces, globe pendants",
        luxAdvice: "Dramatic, dimmable, mirror-amplified sparkle for mood"
      },
      circulationAdvice: "Formal symmetrical seating islands with 42-inch gallery promenade clearances."
    }
  },
  {
    id: "transitional",
    name: "Transitional",
    subtitle: "Contemporary Lines Meet Classic Comfort",
    description: "Transitional balances clean contemporary lines with classic comfort in soft neutrals and timeless symmetry.",
    prompt: "Transitional style blending clean contemporary lines with classic comfort: soft greige walls, tailored neutral upholstery, mixed wood and metal, subtle textured fabrics, and balanced symmetry",
    rule603010: {
      dominant60: {
        title: "60% Greige & Warm Oak",
        description: "Soft greige walls with natural oak floors.",
        colors: [
          { name: "Agreeable Gray", code: "SW 7029", hex: "#D6CFC3", role: "Walls" },
          { name: "Natural Oak", code: "WOOD-OAK-07", hex: "#C3AD8E", role: "Floor" }
        ],
        finishes: "Eggshell greige walls; satin natural oak"
      },
      secondary30: {
        title: "30% Tailored Neutrals",
        description: "Mushroom taupe tailored sofa with walnut accents.",
        colors: [
          { name: "Mushroom Taupe", code: "BM 983", hex: "#B3A694", role: "Sofa & Drapes" },
          { name: "Walnut Tone", code: "WOOD-WLN-05", hex: "#6B5440", role: "Accent Furniture" }
        ],
        materials: ["Performance Linen-Weave", "Walnut", "Brushed Nickel", "Woven Wool"]
      },
      accent10: {
        title: "10% Celadon & Bronze",
        description: "Dusty celadon accents with oil-rubbed bronze.",
        colors: [
          { name: "Dusty Celadon", code: "BM 673", hex: "#8CA092", role: "Cushions & Ceramics" },
          { name: "Oil-Rubbed Bronze", code: "MET-BRZ-02", hex: "#4A3C30", role: "Hardware & Lamps" }
        ],
        details: "Textured ceramic lamps, framed botanical art, woven throws, symmetrical pairs"
      },
      lightingSpecs: {
        kelvin: "3000K Balanced Warm White",
        fixtureTypes: "Drum-shade chandeliers, brushed nickel sconces, ceramic table lamps",
        luxAdvice: "Even 200 lux ambient with symmetrical accent reading lamps"
      },
      circulationAdvice: "Balanced symmetrical layouts with 36-inch clear primary walkways."
    }
  },
  {
    id: "mediterranean",
    name: "Warm Mediterranean",
    subtitle: "Terracotta Plaster, Arches & Olive Wood",
    description: "Warm Mediterranean evokes sun-baked plaster, arched niches, handmade tile, and earthy ochre-and-sage calm.",
    prompt: "Warm Mediterranean style with sun-baked terracotta lime plaster, arched niches, carved olive wood, handmade zellige tile accents, wrought iron, and earthy ochre and sage tones",
    rule603010: {
      dominant60: {
        title: "60% Lime Plaster & Clay",
        description: "Hand-troweled warm plaster walls over terracotta clay floors.",
        colors: [
          { name: "Sunwashed Plaster", code: "BM 1113", hex: "#E6D6BE", role: "Lime Plaster Walls" },
          { name: "Terracotta Tile", code: "NAT-TER-02", hex: "#B5724B", role: "Clay Floor" }
        ],
        finishes: "Hand-troweled lime plaster; sealed handmade terracotta"
      },
      secondary30: {
        title: "30% Olive Wood & Linen",
        description: "Olive-toned upholstery with carved olive wood furniture.",
        colors: [
          { name: "Olive Grove", code: "BM 501", hex: "#8C8762", role: "Upholstery & Drapes" },
          { name: "Carved Olive Wood", code: "WOOD-OLV-01", hex: "#7C6244", role: "Furniture" }
        ],
        materials: ["Lime Plaster", "Olive Wood", "Handmade Zellige", "Wrought Iron"]
      },
      accent10: {
        title: "10% Zellige Teal & Saffron",
        description: "Glazed zellige teal with saffron ochre textiles.",
        colors: [
          { name: "Zellige Teal", code: "SW 6480", hex: "#2E6E6A", role: "Tile & Ceramics" },
          { name: "Saffron Ochre", code: "BM 163", hex: "#C9892F", role: "Textiles & Pottery" }
        ],
        details: "Glazed zellige tile insets, wrought-iron lanterns, olive branches, hand-thrown terracotta"
      },
      lightingSpecs: {
        kelvin: "2700K Golden Warm",
        fixtureTypes: "Wrought-iron lanterns, plaster-recessed coves, ceramic table lamps",
        luxAdvice: "Warm golden daylight with soft lantern pools at night"
      },
      circulationAdvice: "Relaxed arched sightlines with 36-inch passage around low communal seating."
    }
  },
  {
    id: "maximalist",
    name: "Vibrant Maximalist",
    subtitle: "Bold Colour, Layered Pattern & Curated Abundance",
    description: "Vibrant Maximalist celebrates saturated colour, mixed pattern, gallery walls, and curated collected abundance.",
    prompt: "Vibrant Maximalist style with bold saturated colour, layered patterns, gallery walls, eclectic collected furniture, rich jewel textiles, and curated abundant decor",
    rule603010: {
      dominant60: {
        title: "60% Saturated Statement Shell",
        description: "Rich peacock-teal walls over warm walnut floors.",
        colors: [
          { name: "Peacock Teal", code: "BM 2053-30", hex: "#1F6E72", role: "Statement Walls" },
          { name: "Warm Walnut", code: "WOOD-WLN-09", hex: "#5E4632", role: "Floor" }
        ],
        finishes: "Rich satin-saturated walls; warm oiled walnut"
      },
      secondary30: {
        title: "30% Pattern-Mixed Seating",
        description: "Fuchsia velvet sofa with mustard patterned armchairs.",
        colors: [
          { name: "Fuchsia Velvet", code: "TEX-VLV-05", hex: "#9B3B63", role: "Sofa" },
          { name: "Mustard Weave", code: "BM 2154-20", hex: "#C98A2B", role: "Armchairs" }
        ],
        materials: ["Mixed Velvets", "Patterned Ikat", "Lacquered Wood", "Aged Brass"]
      },
      accent10: {
        title: "10% Clashing Jewel Pops",
        description: "Cobalt and coral pops across decor and art.",
        colors: [
          { name: "Cobalt Pop", code: "BM 2066-30", hex: "#2D4EA0", role: "Decor & Art" },
          { name: "Coral Burst", code: "SW 6606", hex: "#D4573E", role: "Cushions & Ceramics" }
        ],
        details: "Floor-to-ceiling gallery walls, layered patterned rugs, brass bar carts, abundant botanicals"
      },
      lightingSpecs: {
        kelvin: "2700K–3000K Warm Layered",
        fixtureTypes: "Sculptural statement chandelier, art-glass lamps, picture lights",
        luxAdvice: "Layered warm accent lighting highlighting gallery walls and objets"
      },
      circulationAdvice: "Curated-but-clear 32-inch pathways weaving between statement pieces."
    }
  },
  {
    id: "parisian_haussmann",
    name: "Parisian Haussmann",
    subtitle: "Ornate Mouldings, Chevron Parquet & Gilded Warmth",
    description: "Parisian Haussmann merges 19th-century French architectural boiserie mouldings and marble mantels with tailored contemporary seating and antique gilded accents.",
    prompt: "Parisian Haussmann apartment style with classic French wall mouldings, bleached oak chevron parquet flooring, marble fireplace mantel, tailored neutral velvet seating, gilded Trumeau mirror, and refined modern lighting",
    rule603010: {
      dominant60: {
        title: "60% Soft Blanc Cassé Plaster & Chevron Oak",
        description: "Classic French boiserie wall paneling in soft off-white with French oak chevron parquet.",
        colors: [
          { name: "Blanc Cassé", code: "F&B No. 201", hex: "#EFECE6", role: "Moulded Walls & Ceilings" },
          { name: "Bleached Chevron Oak", code: "WOOD-OAK-CHV", hex: "#D4C5B0", role: "Chevron Parquet Floor" }
        ],
        finishes: "Eggshell architectural boiserie plaster; natural matte wire-brushed chevron oak"
      },
      secondary30: {
        title: "30% Sculptural Modern Velvet & Carrara Marble",
        description: "Curved charcoal or taupe velvet seating with carved Carrara marble fireplace mantel.",
        colors: [
          { name: "Graphite Charcoal", code: "BM 2125-20", hex: "#4A4B4F", role: "Tailored Velvet Sofa" },
          { name: "Carrara Marble Vein", code: "MRB-CAR-02", hex: "#C7C8C5", role: "Mantel & Coffee Table" }
        ],
        materials: ["Rich Cotton Velvet", "Carrara Marble", "French Oak", "Smoked Mirror Glass"]
      },
      accent10: {
        title: "10% Antique Gilt Brass & Deep Bordeaux",
        description: "Gilded Trumeau mirror frame, aged brass linear chandelier, and rich bordeaux accents.",
        colors: [
          { name: "French Gilt Gold", code: "MET-GLT-01", hex: "#D4AF37", role: "Trumeau Mirror & Chandelier" },
          { name: "Bordeaux Velvet", code: "BM 1372", hex: "#5E2235", role: "Cushions & Art Accent" }
        ],
        details: "Tall French casement windows, ornate ceiling medallion, antique Trumeau mirror, sculptural alabaster lamps"
      },
      lightingSpecs: {
        kelvin: "2700K Warm French Salon",
        fixtureTypes: "Aged brass branch chandelier, alabaster sconces, warm picture lights over art",
        luxAdvice: "Romantic, diffused 180 lux ambient wash with dramatic gilded mirror light reflection"
      },
      circulationAdvice: "High-ceiling promenade with generous 42-inch axial walkways between conversation groups."
    }
  },
  {
    id: "indian_haveli_courtyard",
    name: "Indian Courtyard & Haveli",
    subtitle: "Terracotta Jali, Honed Kota Stone & Teak Jhula Swing",
    description: "Rooted in traditional Indian haveli and contemporary courtyard architecture (Aangan/Thinnai). Features intricate terracotta or sandstone jali screens, natural Dholpur & Kota stone paving, a handcrafted teakwood swing (jhula) with brass chains, a brass urli with floating marigolds & lotus, and lush Champa (Frangipani) and Bougainvillea.",
    prompt: "Traditional-meets-contemporary Indian courtyard haveli exterior with hand-cut terracotta jali screens, natural Dholpur sandstone facade, honed Kota stone courtyard floor, carved teakwood verandah pillars, a suspended teakwood swing (jhula) with brass chains, brass urli water basin with floating fresh flowers, potted champa frangipani trees, and warm evening lighting",
    rule603010: {
      dominant60: {
        title: "60% Dholpur Sandstone & Terracotta Jali Facade",
        description: "Dholpur natural sandstone facade cladding with terracotta clay lattice jali screens and honed grey-green Kota stone outdoor flooring.",
        colors: [
          { name: "Dholpur Sandstone", code: "STN-DHP-01", hex: "#DEC49E", role: "Courtyard Walls & Pillars" },
          { name: "Terracotta Clay", code: "SW 6334", hex: "#BD6E52", role: "Jali Lattice & Bricks" }
        ],
        finishes: "Hand-chiseled natural Dholpur sandstone; wire-cut terracotta clay jali; honed non-slip Kota stone"
      },
      secondary30: {
        title: "30% Carved Teakwood Millwork & Outdoor Jhula",
        description: "Solid reclaimed teakwood verandah pillars, low stone benches, and a traditional suspended wooden swing (jhula).",
        colors: [
          { name: "Aged Indian Teak", code: "WOOD-TEAK-02", hex: "#6B472A", role: "Verandah Pillars & Jhula" },
          { name: "Raw Kora Cotton", code: "TEX-KOR-01", hex: "#E3DAC9", role: "Outdoor Bolsters & Gaddi" }
        ],
        materials: ["Solid Reclaimed Teakwood", "Honed Kota Stone", "Terracotta Clay Jali", "Cast Antique Brass"]
      },
      accent10: {
        title: "10% Antique Temple Brass & Tropical Florals",
        description: "Hand-hammered brass urli with floating water and marigolds, engraved brass lantern sconces, and vibrant bougainvillea creepers.",
        colors: [
          { name: "Temple Brass", code: "MET-BRS-04", hex: "#C8A248", role: "Urli Basin & Chains" },
          { name: "Marigold Gold", code: "BM 2154-30", hex: "#E89D2C", role: "Floating Florals & Accents" }
        ],
        details: "Hand-hammered brass urli water basin, cast brass bird hanging chains, lush Champa (Frangipani) planters, carved stone niches (diya almirah)"
      },
      lightingSpecs: {
        kelvin: "2400K Warm Golden Temple Glow",
        fixtureTypes: "Handcrafted pierced brass lanterns casting decorative shadows, low glare step riser lights, soft pillar uplights",
        luxAdvice: "Low ambient glow (80–120 lux) creating an intimate, tranquil courtyard sanctuary"
      },
      circulationAdvice: "Generous 4-ft open circulation around central open-to-sky water feature and shaded colonnade walkways."
    }
  },
  {
    id: "modern_indian_exterior",
    name: "Modern Indian Villa Exterior",
    subtitle: "Wire-Cut Brick, CNC Architectural Louvers & Water Wall",
    description: "Contemporary Indian tropical villa exterior harmonizing exposed wire-cut brick masonry, weatherproof exterior CNC jali panels and teak louvers for climate shading, smooth lime plaster, basalt stone garden pathways, and tropical palms.",
    prompt: "Modern Indian villa architecture and exterior facade with exposed wire-cut red brick accents, exterior weatherproof CNC-cut geometric jali panels, dark bronze metal pergolas, smooth warm off-white lime plaster, basalt stone garden stepping path, a cascading stone water wall, and tropical palm landscaping",
    rule603010: {
      dominant60: {
        title: "60% Exposed Wire-Cut Brick & Lime Plaster Facade",
        description: "Exposed architectural red brick masonry balanced with warm off-white exterior lime plaster and poured concrete soffits.",
        colors: [
          { name: "Exposed Wire Brick", code: "BRK-IND-01", hex: "#9E4732", role: "Feature Elevation Walls" },
          { name: "Warm Off-White Stucco", code: "F&B No. 201", hex: "#EDE9E1", role: "Plastered Facade & Boundary" }
        ],
        finishes: "Wire-cut unplastered brick with raked mortar; weatherproof matte silica exterior mineral paint"
      },
      secondary30: {
        title: "30% Exterior CNC Jali Panels & Teakwood Louvers",
        description: "Weather-resistant exterior composite/HDF CNC geometric jali screens for sun control, dark bronze pergola framework, and teak louvers.",
        colors: [
          { name: "Dark Bronze Framework", code: "MET-BRZ-02", hex: "#3D3935", role: "Pergolas & Window Frames" },
          { name: "Warm Burma Teak", code: "WOOD-TEAK-05", hex: "#7A5432", role: "Architectural Louvers & Deck" }
        ],
        materials: ["Exterior Grade CNC Jali", "Wire-Cut Red Clay Brick", "Treated Burma Teak", "Flamed Basalt Stone"]
      },
      accent10: {
        title: "10% Water Feature Cascade & Linear Brass Lighting",
        description: "Sheer cascading stone water wall, brushed brass exterior fixtures, and tropical landscape planters.",
        colors: [
          { name: "Wet Basalt Black", code: "NAT-BST-01", hex: "#2F3133", role: "Water Cascade Wall" },
          { name: "Brushed Architectural Brass", code: "MET-BRS-02", hex: "#C6A664", role: "Recessed Soffit Accents" }
        ],
        details: "Cascading water blade into reflecting pool, concealed 2700K LED grazing strips on textured brickwork, sculptural agave and areca palms"
      },
      lightingSpecs: {
        kelvin: "2700K Architectural Grazing",
        fixtureTypes: "Concealed wall grazing strip lights on brick facade, recessed ground uplights for palms, exterior step lights",
        luxAdvice: "Dramatic high-contrast architectural lighting highlighting textured masonry and water reflections"
      },
      circulationAdvice: "48-inch wide basalt stepping stone pathway across lawn connecting main entry gate, verandah, and garden terrace."
    }
  },
  {
    id: "tropical_garden_landscape",
    name: "Tropical Garden & Landscape",
    subtitle: "Lush Turf, Slate Stepping Paths, Pergola Lounge & Water Garden",
    description: "Tranquil outdoor living sanctuary immersed in lush tropical foliage. Features natural slate stepping stones across emerald turf, a modern timber pergola with ambient string lighting, weather-treated modular lounge seating, and an integrated water fountain or koi pond.",
    prompt: "Lush tropical garden and landscape design with deep emerald lawn grass, dark charcoal slate stepping stones, modern timber pergola with climbing bougainvillea, all-weather outdoor lounge sofa, trickling stone water fountain, bird of paradise plants, and warm evening landscape lighting",
    rule603010: {
      dominant60: {
        title: "60% Emerald Lawn & Natural Slate Hardscape",
        description: "Manicured zoysia grass lawn with charcoal slate stone walkways surrounded by river pebbles.",
        colors: [
          { name: "Emerald Lawn Grass", code: "NAT-GRS-01", hex: "#466D3E", role: "Lawn & Garden Ground" },
          { name: "Charcoal Slate", code: "STN-SLT-03", hex: "#4A4F54", role: "Stepping Stones & Patio" }
        ],
        finishes: "Natural cleft non-slip exterior slate tiles; smooth tumbled dark river pebbles"
      },
      secondary30: {
        title: "30% Treated Timber Pergola & Outdoor Lounge",
        description: "Solid cedar or teak open-air pergola providing filtered shade over an all-weather outdoor modular sofa.",
        colors: [
          { name: "Treated Timber Brown", code: "WOOD-CDR-02", hex: "#876E55", role: "Pergola Beams & Slats" },
          { name: "Sandstone Canvas", code: "TEX-CNV-01", hex: "#D4C7B5", role: "Outdoor Cushions" }
        ],
        materials: ["Weather-Treated Hardwood", "All-Weather Resin Wicker", "Sunbrella Solution-Dyed Fabric", "River Rocks"]
      },
      accent10: {
        title: "10% Stone Water Feature & Copper Landscape Lights",
        description: "Natural stone bowl fountain with recirculating water, copper path stakes, and vibrant flowering plants.",
        colors: [
          { name: "Dark Water Pond", code: "WAT-PND-01", hex: "#1F3842", role: "Water Basin Reflection" },
          { name: "Aged Patina Copper", code: "MET-CPR-03", hex: "#4E877C", role: "Path Lanterns & Stakes" }
        ],
        details: "Granite water spout, 2700K copper path bollards, flowering bird of paradise, monstera deliciosa, and bamboo screening"
      },
      lightingSpecs: {
        kelvin: "2700K Warm Landscape Glow",
        fixtureTypes: "Low-voltage pathway bollards, tree trunk up-lights, warm festoon bulbs woven through pergola",
        luxAdvice: "Soft, organic illumination (50–100 lux) highlighting garden textures without light pollution"
      },
      circulationAdvice: "Organic 36-inch wide winding stepping stone paths meandering between lawn, pergola lounge, and water feature."
    }
  },
  {
    id: "mediterranean_terrace",
    name: "Mediterranean Garden & Terrace",
    subtitle: "Sun-Bleached Stucco, Terracotta Urns, Travertine & Bougainvillea",
    description: "Sun-drenched outdoor terrace inspired by coastal Mediterranean and Iberian estates. Features whitewashed lime-plaster facade walls, ivory travertine stone paving, iron-framed pergola with flowering bougainvillea vines, large terracotta olive urns, and open-air dining.",
    prompt: "Mediterranean exterior terrace and villa garden with sun-bleached chalk white lime wash walls, ivory travertine outdoor stone pavers, black wrought iron pergola with vibrant magenta bougainvillea canopy, oversized handmade terracotta planter urns with olive trees, rustic wooden dining table, and warm golden hour light",
    rule603010: {
      dominant60: {
        title: "60% Whitewashed Lime Stucco & Travertine Paving",
        description: "Chalky sun-bleached lime wash exterior walls paired with tumbled ivory travertine flagstone paving.",
        colors: [
          { name: "Santorini Lime White", code: "F&B No. 2005", hex: "#F4F2EC", role: "Exterior Walls & Parapet" },
          { name: "Ivory Travertine", code: "STN-TRV-01", hex: "#E2D7C3", role: "Terrace Pavers" }
        ],
        finishes: "Natural textured lime wash; tumbled antique edge non-slip travertine stone"
      },
      secondary30: {
        title: "30% Wrought Iron Pergola & Weathered Timber Dining",
        description: "Forged wrought iron pergola structure supporting climbing grapevines and bougainvillea over a rustic solid wood outdoor dining table.",
        colors: [
          { name: "Weathered Olive Wood", code: "WOOD-OLV-01", hex: "#8D7B66", role: "Outdoor Table & Benches" },
          { name: "Charcoal Wrought Iron", code: "MET-IRN-01", hex: "#2B2D2F", role: "Pergola Frame & Railing" }
        ],
        materials: ["Tumbled Travertine Stone", "Hand-Forged Wrought Iron", "Aged Tuscan Terracotta", "Weathered Olive Wood"]
      },
      accent10: {
        title: "10% Cobalt Glazed Ceramics & Magenta Bougainvillea",
        description: "Handmade ceramic pottery in deep Aegean cobalt blue, oversized terracotta olive urns, and lush bougainvillea flowers.",
        colors: [
          { name: "Aegean Cobalt Blue", code: "BM 2066-20", hex: "#1E3F78", role: "Glazed Planters & Tile Accents" },
          { name: "Bougainvillea Magenta", code: "FLR-BOU-01", hex: "#C72C61", role: "Flowering Canopy & Vines" }
        ],
        details: "Handmade Cretan terracotta amphora urns with olive trees, hanging wrought iron candle lanterns, terracotta roof tile trim"
      },
      lightingSpecs: {
        kelvin: "2400K Warm Sunset Candlelight",
        fixtureTypes: "Suspended warm bistro festoon lights, wall-mounted coach lanterns, table hurricane lamps",
        luxAdvice: "Romantic, golden ambient glow simulating sunset dinner on a Mediterranean hillside"
      },
      circulationAdvice: "Generous 48-inch walkway between outdoor dining area, preparation counter, and open terrace viewpoint."
    }
  }
];

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<boolean | void>;
    };
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [hasLinkedKey, setHasLinkedKey] = useState(false);

  // Multi-photo room angles state
  const [photos, setPhotos] = useState<RoomAnglePhoto[]>([]);
  // Active view in cards: 'overview' | 'angle-0' | 'angle-1' | 'angle-2' | 'angle-3' | 'grid'
  const [activeView, setActiveView] = useState<string>("overview");

  // User Room Configuration (Directly prevents "trying to style only one way / doesn't look like my house")
  const [roomType, setRoomType] = useState<string>("living room");
  const [spaceCategoryFilter, setSpaceCategoryFilter] = useState<"all" | "interior" | "exterior">("all");
  const [stylingMode, setStylingMode] = useState<StylingMode>("architectural_restyle");
  const [customDirectives, setCustomDirectives] = useState<string>("");
  const [showModeDrawer, setShowModeDrawer] = useState<boolean>(false);
  const [layoutDirectivesDrawerOpen, setLayoutDirectivesDrawerOpen] = useState<boolean>(false);
  const [styleCatalogOpen, setStyleCatalogOpen] = useState<boolean>(false);
  const [catalogFilter, setCatalogFilter] = useState<"all" | "interior" | "exterior">("all");
  const [pdfExportModalOpen, setPdfExportModalOpen] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Helper to append furniture/appliance tags to directives
  const appendDirectiveTag = (tagText: string) => {
    setCustomDirectives((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      if (trimmed.toLowerCase().includes(tagText.toLowerCase())) return trimmed;
      return `${trimmed}, ${tagText}`;
    });
  };

  // Search Bar state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Style images dictionary: styleId -> viewKey -> imageUrl
  const [styleImages, setStyleImages] = useState<Record<string, Record<string, string>>>({});

  // Before / After slider state (0 to 100 percentage)
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // 60-30-10 Architectural Spec Drawer
  const [specDrawerOpen, setSpecDrawerOpen] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState<"60-30-10" | "lighting" | "spatial">("60-30-10");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Time of Day & Lighting Temperature Simulation (Golden Hour, Bright Noon, Blue Hour)
  const [lightingSliderValue, setLightingSliderValue] = useState<number>(50); // 0 = Golden Hour, 50 = Bright Noon, 100 = Blue Hour
  const [lightingSimEnabled, setLightingSimEnabled] = useState<boolean>(true);
  const [applyLightingToAI, setApplyLightingToAI] = useState<boolean>(true);

  // Compute real-time Lighting Temperature parameters based on slider value (0 to 100)
  const getLightingInfo = (val: number) => {
    if (val <= 25) {
      const p = val / 25;
      const inv = 1 - p;
      return {
        id: "golden_hour" as const,
        label: "Golden Hour",
        time: "Late Afternoon / Golden Hour",
        kelvin: Math.round(2700 + p * 600),
        description: "Warm honey rays, elongated soft shadows, golden radiant glow",
        icon: "🌅",
        accentColor: "#F59E0B",
        filter: `sepia(${0.15 + inv * 0.25}) saturate(${1.1 + inv * 0.25}) hue-rotate(-${inv * 10}deg) brightness(${1.02 + inv * 0.05}) contrast(${1.02 + inv * 0.04})`,
        overlayBg: `rgba(251, 191, 36, ${0.06 + inv * 0.14})`,
        blendMode: "multiply" as const,
        badgeBg: "bg-amber-500/15 text-amber-900 border-amber-500/30",
        sliderTick: "0%",
      };
    } else if (val >= 75) {
      const p = (val - 75) / 25;
      return {
        id: "blue_hour" as const,
        label: "Blue Hour",
        time: "Dusk / Twilight Blue Hour",
        kelvin: Math.round(7200 + p * 2300),
        description: "Cool indigo & deep cyan twilight, moody cinematic evening atmosphere",
        icon: "🌌",
        accentColor: "#3B82F6",
        filter: `hue-rotate(${p * 20}deg) saturate(${1.08 + p * 0.16}) brightness(${0.98 - p * 0.08}) contrast(${1.04 + p * 0.08})`,
        overlayBg: `rgba(37, 99, 235, ${0.08 + p * 0.16})`,
        blendMode: "soft-light" as const,
        badgeBg: "bg-indigo-500/15 text-indigo-900 border-indigo-500/30",
        sliderTick: "100%",
      };
    } else {
      if (val === 50) {
        return {
          id: "bright_noon" as const,
          label: "Bright Noon",
          time: "High Midday Sunlight",
          kelvin: 5500,
          description: "Pristine neutral daylight, true-to-life architectural surfaces, crisp high clarity",
          icon: "☀️",
          accentColor: "#10B981",
          filter: "brightness(1.05) contrast(1.03) saturate(1.02)",
          overlayBg: "transparent",
          blendMode: "normal" as const,
          badgeBg: "bg-emerald-500/15 text-emerald-900 border-emerald-500/30",
          sliderTick: "50%",
        };
      } else if (val < 50) {
        const p = (val - 25) / 25;
        const goldenFactor = 1 - p;
        return {
          id: "golden_hour" as const,
          label: "Warm Afternoon",
          time: "Midday to Golden Sunset",
          kelvin: Math.round(3300 + p * 2200),
          description: "Warm daylight gently inclining toward late afternoon sun",
          icon: "🌤️",
          accentColor: "#F59E0B",
          filter: `sepia(${goldenFactor * 0.15}) saturate(${1 + goldenFactor * 0.12}) brightness(${1 + goldenFactor * 0.03})`,
          overlayBg: `rgba(245, 158, 11, ${goldenFactor * 0.08})`,
          blendMode: "soft-light" as const,
          badgeBg: "bg-amber-400/15 text-amber-900 border-amber-400/30",
          sliderTick: `${val}%`,
        };
      } else {
        const p = (val - 50) / 25;
        return {
          id: "blue_hour" as const,
          label: "Cool Dusk",
          time: "Afternoon to Twilight",
          kelvin: Math.round(5500 + p * 1700),
          description: "Cooling daylight settling into dusk and evening shadow tones",
          icon: "🌆",
          accentColor: "#6366F1",
          filter: `hue-rotate(${p * 10}deg) saturate(${1 + p * 0.08}) brightness(${1 - p * 0.04})`,
          overlayBg: `rgba(59, 130, 246, ${p * 0.08})`,
          blendMode: "soft-light" as const,
          badgeBg: "bg-blue-500/15 text-blue-900 border-blue-500/30",
          sliderTick: `${val}%`,
        };
      }
    }
  };

  // Defer the heavy recompute (CSS filters + badges) so dragging the slider stays smooth.
  // The slider thumb itself still tracks lightingSliderValue immediately.
  const deferredLightingValue = useDeferredValue(lightingSliderValue);
  const currentLighting = getLightingInfo(deferredLightingValue);

  // Saved Favorites state (synced with localStorage)
  const [savedStyleIds, setSavedStyleIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("space_lift_saved_styles");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (styleId: string) => {
    setSavedStyleIds((prev) => {
      const next = prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId];
      try {
        localStorage.setItem("space_lift_saved_styles", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Share Modal & Snapshot State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharedBannerData, setSharedBannerData] = useState<any | null>(null);

  // Check for shared room style from URL (?share=... or ?style=...)
  useEffect(() => {
    const handleUrlShare = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const shareParam = urlParams.get("share");
        const styleParam = urlParams.get("style");
        const roomParam = urlParams.get("room");

        if (shareParam) {
          const res = await fetch(`/api/share/${shareParam}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setSharedBannerData(json.data);
              if (json.data.roomType) setRoomType(json.data.roomType);
              if (json.data.styleId) {
                const targetIdx = STYLE_CONFIGS.findIndex((s) => s.id === json.data.styleId);
                if (targetIdx >= 0) setCurrentIndex(targetIdx);
              }
              // If the share payload includes a rendered image and user has no photos yet
              if (json.data.renderedImage && photos.length === 0) {
                const sharedPhoto: RoomAnglePhoto = {
                  id: "shared-angle-1",
                  url: json.data.originalImage || json.data.renderedImage,
                  label: "Shared Room View",
                  tag: "Shared Room View"
                };
                setPhotos([sharedPhoto]);
                if (json.data.styleId) {
                  setStyleImages((prev) => ({
                    ...prev,
                    [json.data.styleId]: {
                      ...(prev[json.data.styleId] || {}),
                      overview: json.data.renderedImage,
                      "angle-0": json.data.renderedImage
                    }
                  }));
                }
                setScreen("cards");
              }
            }
          }
        } else if (styleParam) {
          const targetIdx = STYLE_CONFIGS.findIndex((s) => s.id === styleParam);
          if (targetIdx >= 0) {
            setCurrentIndex(targetIdx);
            if (roomParam) setRoomType(roomParam);
          }
        }
      } catch (err) {
        console.warn("Failed checking shared URL parameters:", err);
      }
    };

    handleUrlShare();
  }, []);

  // 3D Spatial Pan & Orbit Viewer state
  const [threeDViewerOpen, setThreeDViewerOpen] = useState(false);
  const [cameraYaw, setCameraYaw] = useState(0); // -180 to 180 degrees
  const [cameraPitch, setCameraPitch] = useState(0); // -35 to 35 degrees
  const [cameraFov, setCameraFov] = useState(75); // 50 to 95 degrees
  const isDragging3D = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Carousel Navigation
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(2);
  const fetchingRef = useRef<Set<string>>(new Set());
  // NEW — stores the first "master" render per style so other angles can reference it
  const masterRenderRef = useRef<Record<string, string>>({});

  // Video generation
  const [videoStatus, setVideoStatus] = useState<Record<string, "generating" | "polling" | "ready" | "failed">>({});
  const [videos, setVideos] = useState<Record<string, string>>({});

  // Camera & Multi-Snap HUD
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Video Pan Keyframe Extraction state
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");

  // Interactive Tap-to-Annotate & Shopping List State
  const [annotations, setAnnotations] = useState<RoomAnnotation[]>(() => {
    try {
      const stored = localStorage.getItem("space_lift_annotations");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveAnnotations = (newList: RoomAnnotation[]) => {
    setAnnotations(newList);
    try {
      localStorage.setItem("space_lift_annotations", JSON.stringify(newList));
    } catch {}
  };

  const [isAnnotatingMode, setIsAnnotatingMode] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [newPinDraft, setNewPinDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCategory, setDraftCategory] = useState<RoomAnnotation["category"]>("furniture");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftEstimatedCost, setDraftEstimatedCost] = useState("");
  const [draftDimensions, setDraftDimensions] = useState("");
  const [shoppingDrawerOpen, setShoppingDrawerOpen] = useState(false);

  // Gemini Tweak & Talk State
  const [tweakModalOpen, setTweakModalOpen] = useState(false);
  const [tweakPrompt, setTweakPrompt] = useState("");
  const [selectedBedSize, setSelectedBedSize] = useState<string>("Queen (~152 × 198 cm / 60\" × 78\")");
  const [lensIsUltraWide, setLensIsUltraWide] = useState(true);
  const [selectedTweakColor, setSelectedTweakColor] = useState("");
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<any>(null);

  // NEW — conversational Gemini memory: styleId-viewKey -> running list of chat turns
  const [chatThreads, setChatThreads] = useState<Record<string, { role: "user" | "ai"; text: string; img?: string }[]>>({});

  // Spatial Dimensions & Clearances Drawer State
  const [dimensionDrawerOpen, setDimensionDrawerOpen] = useState(false);
  const [spatialData, setSpatialData] = useState<any>(null);
  const [isAnalyzingDimensions, setIsAnalyzingDimensions] = useState(false);

  const toggleVoiceRecording = () => {
    if (isListeningVoice) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningVoice(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError("Voice dictation not supported in this browser. You can type in the prompt box!");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onstart = () => {
        setIsListeningVoice(true);
        setSpeechError("");
      };
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTweakPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListeningVoice(false);
      };
      rec.onerror = (e: any) => {
        console.error("Speech recognition error", e);
        setSpeechError("Speech recognition failed or permission denied.");
        setIsListeningVoice(false);
      };
      rec.onend = () => {
        setIsListeningVoice(false);
      };
      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setSpeechError("Could not start microphone.");
      setIsListeningVoice(false);
    }
  };

  // Filtered Styles based on search bar query
  const filteredStyles = useMemo(() => {
    if (!searchQuery.trim()) return STYLE_CONFIGS;
    const q = searchQuery.toLowerCase().trim();
    return STYLE_CONFIGS.filter((s) => {
      if (s.name.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q)) return true;
      if (s.description.toLowerCase().includes(q) || s.prompt.toLowerCase().includes(q)) return true;
      const allColors = [
        ...s.rule603010.dominant60.colors,
        ...s.rule603010.secondary30.colors,
        ...s.rule603010.accent10.colors
      ];
      if (
        allColors.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.role.toLowerCase().includes(q)
        )
      ) {
        return true;
      }
      if (s.rule603010.secondary30.materials.some((m) => m.toLowerCase().includes(q))) {
        return true;
      }
      if (
        s.rule603010.lightingSpecs.kelvin.toLowerCase().includes(q) ||
        s.rule603010.lightingSpecs.fixtureTypes.toLowerCase().includes(q) ||
        s.rule603010.dominant60.finishes.toLowerCase().includes(q) ||
        s.rule603010.accent10.details.toLowerCase().includes(q)
      ) {
        return true;
      }
      return false;
    });
  }, [searchQuery]);

  // Consolidated PDF Summary Exporter
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 16;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 16) {
          doc.addPage();
          y = 16;
          return true;
        }
        return false;
      };

      doc.setFillColor(34, 34, 34);
      doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("SPACE LIFT", margin + 8, y + 9);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(220, 220, 220);
      doc.text("Architectural Room Concept & Sourcing Dossier", margin + 8, y + 15);

      const dateStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Date: ${dateStr}`, pageWidth - margin - 8, y + 9, { align: "right" });
      doc.text(
        `Room: ${roomType.toUpperCase()} | Mode: ${STYLING_MODES.find(m => m.id === stylingMode)?.label || stylingMode}`,
        pageWidth - margin - 8,
        y + 15,
        { align: "right" }
      );

      y += 28;

      doc.setFillColor(245, 244, 240);
      doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(34, 34, 34);
      doc.text("ROOM DIMENSIONS & OPTICAL CALIBRATION", margin + 5, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const estSpan = spatialData?.estimatedDimensions?.widthFt
        ? `${spatialData.estimatedDimensions.widthFt} x ${spatialData.estimatedDimensions.lengthFt} (Est. ${spatialData.estimatedDimensions.areaSqFt})`
        : "Standard Residential (~11-13 ft x 14-16 ft / ~160 sq ft)";
      const ceilingH = spatialData?.estimatedDimensions?.ceilingHeight || "8.5 - 9.0 ft (~2.7m)";
      const opticsDesc = lensIsUltraWide
        ? "0.5x Ultra-wide lens calibration applied (compensates for ~13mm barrel perspective expansion)"
        : "Standard lens perspective";

      doc.text(`Estimated Dimensions: ${estSpan} | Ceiling: ${ceilingH}`, margin + 5, y + 11);
      doc.text(`Camera Optics: ${opticsDesc}`, margin + 5, y + 16);

      y += 26;

      const targetStyles =
        savedStyleIds.length > 0
          ? STYLE_CONFIGS.filter((s) => savedStyleIds.includes(s.id))
          : [filteredStyles[currentIndex] || STYLE_CONFIGS[0]];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(34, 34, 34);
      doc.text(`DESIGN CONCEPTS & 60-30-10 PALETTES (${targetStyles.length})`, margin, y);
      y += 5;

      for (const style of targetStyles) {
        checkPageBreak(75);

        doc.setFillColor(252, 252, 250);
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(margin, y, contentWidth, 68, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(34, 34, 34);
        doc.text(style.name, margin + 4, y + 6);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 90, 40);
        doc.text(style.subtitle, margin + 4, y + 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const splitDesc = doc.splitTextToSize(style.description, contentWidth - 62);
        doc.text(splitDesc.slice(0, 2), margin + 4, y + 16);

        let paletteY = y + 25;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(120, 60, 20);
        doc.text("60% Dominant:", margin + 4, paletteY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const d60 = style.rule603010.dominant60.colors[0];
        doc.text(
          `${d60?.name || ''} (${d60?.code || ''}) - Finish: ${style.rule603010.dominant60.finishes.slice(0, 45)}`,
          margin + 28,
          paletteY
        );

        paletteY += 5;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 80, 140);
        doc.text("30% Secondary:", margin + 4, paletteY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const s30 = style.rule603010.secondary30.colors[0];
        doc.text(
          `${s30?.name || ''} (${s30?.code || ''}) - Materials: ${style.rule603010.secondary30.materials.slice(0, 3).join(", ")}`,
          margin + 28,
          paletteY
        );

        paletteY += 5;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 120, 80);
        doc.text("10% Accent:", margin + 4, paletteY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const a10 = style.rule603010.accent10.colors[0];
        doc.text(
          `${a10?.name || ''} (${a10?.code || ''}) - Details: ${style.rule603010.accent10.details.slice(0, 40)}`,
          margin + 28,
          paletteY
        );

        paletteY += 5.5;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("Lighting Spec:", margin + 4, paletteY);
        doc.setFont("helvetica", "normal");
        doc.text(
          `${style.rule603010.lightingSpecs.kelvin} | ${style.rule603010.lightingSpecs.fixtureTypes.slice(0, 55)}`,
          margin + 28,
          paletteY
        );

        paletteY += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Circulation:", margin + 4, paletteY);
        doc.setFont("helvetica", "normal");
        doc.text(`${style.rule603010.circulationAdvice.slice(0, 80)}...`, margin + 28, paletteY);

        const renderedImg =
          styleImages[style.id]?.[activeView] ||
          styleImages[style.id]?.["overview"] ||
          styleImages[style.id]?.["angle-0"];

        if (renderedImg) {
          try {
            doc.addImage(renderedImg, "JPEG", pageWidth - margin - 54, y + 4, 50, 37.5);
          } catch (imgErr) {
            console.warn("Could not embed image in PDF:", imgErr);
          }
        } else {
          doc.setFillColor(235, 235, 230);
          doc.rect(pageWidth - margin - 54, y + 4, 50, 37.5, "F");
          doc.setFontSize(7.5);
          doc.setTextColor(140, 140, 140);
          doc.text("Photo Concept", pageWidth - margin - 29, y + 23, { align: "center" });
        }

        y += 72;
      }

      checkPageBreak(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(34, 34, 34);
      doc.text(`TAGGED FURNITURE & SOURCING INVENTORY (${annotations.length} ITEMS)`, margin, y);
      y += 5;

      if (annotations.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(120, 120, 120);
        doc.text(
          "No specific items tagged yet. Use 'Tag Items' on room concepts to pin furniture and wall specs.",
          margin,
          y + 4
        );
        y += 10;
      } else {
        doc.setFillColor(235, 235, 230);
        doc.rect(margin, y, contentWidth, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);
        doc.text("#", margin + 2, y + 4.8);
        doc.text("Category", margin + 8, y + 4.8);
        doc.text("Item / Description", margin + 30, y + 4.8);
        doc.text("Dimensions", margin + 95, y + 4.8);
        doc.text("Est. Cost", margin + 135, y + 4.8);
        doc.text("Status", margin + 162, y + 4.8);
        y += 8;

        annotations.forEach((ann, idx) => {
          checkPageBreak(12);
          doc.setFillColor(
            idx % 2 === 0 ? 255 : 250,
            idx % 2 === 0 ? 255 : 250,
            idx % 2 === 0 ? 255 : 248
          );
          doc.rect(margin, y, contentWidth, 9, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(60, 60, 60);

          doc.text(String(idx + 1), margin + 2, y + 5.5);
          doc.text(ann.category.slice(0, 10).toUpperCase(), margin + 8, y + 5.5);

          const itemTitle = ann.notes ? `${ann.label} (${ann.notes.slice(0, 32)})` : ann.label;
          doc.setFont("helvetica", "bold");
          doc.text(itemTitle.slice(0, 38), margin + 30, y + 5.5);

          doc.setFont("helvetica", "normal");
          doc.text(ann.shoppingItem?.dimensions?.slice(0, 20) || "-", margin + 95, y + 5.5);
          doc.text(ann.shoppingItem?.estimatedCost?.slice(0, 14) || "-", margin + 135, y + 5.5);

          const statusText = ann.shoppingItem?.status?.toUpperCase() || "WISHLIST";
          doc.text(statusText, margin + 162, y + 5.5);

          y += 9.5;
        });
      }

      checkPageBreak(40);
      y += 4;
      doc.setFillColor(248, 246, 240);
      doc.setDrawColor(210, 200, 180);
      doc.roundedRect(margin, y, contentWidth, 32, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 80, 20);
      doc.text("ARCHITECTURAL FIT & ERGONOMIC CLEARANCES CODE", margin + 4, y + 5.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      doc.text(
        "- Walkways: Main routes 75-90 cm (30-36\") clear width; Secondary routes 60 cm (24\") minimum.",
        margin + 4,
        y + 11
      );
      doc.text(
        "- Bed Access: Maintain >= 60 cm (24\") access clearance on each side + 60 cm at foot of bed.",
        margin + 4,
        y + 16
      );
      doc.text(
        "- Move-In Check: Ensure smallest piece cross-section passes through interior doors (75-90 cm wide).",
        margin + 4,
        y + 21
      );
      doc.text(
        "- Living Circulation: Coffee table 35-45 cm from sofa edge; TV seated eye level 100-115 cm from floor.",
        margin + 4,
        y + 26
      );

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Space Lift Architectural Summary | Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      doc.save("SpaceLift-Room-Design-Summary.pdf");
    } catch (err) {
      console.error("Failed to generate PDF summary", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Download Design Pack as ZIP containing all 4 room angles, 60-30-10 palette JSON, and shopping list
  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const targetStyle = filteredStyles[currentIndex] || currentStyle || STYLE_CONFIGS[0];
      const folderName = `SpaceLift_${targetStyle.name.replace(/[^a-zA-Z0-9]/g, "_")}_Design_Pack`;
      const rootFolder = zip.folder(folderName) || zip;
      const anglesFolder = rootFolder.folder("room-angles") || rootFolder;

      // 1. Collect all 4 generated room angles
      const angleDescriptors = [
        { key: "angle-0", fallbackIndex: 0, filename: "Angle_1_Primary_View" },
        { key: "angle-1", fallbackIndex: 1, filename: "Angle_2_Window_Daylight" },
        { key: "angle-2", fallbackIndex: 2, filename: "Angle_3_Seating_Corner" },
        { key: "angle-3", fallbackIndex: 3, filename: "Angle_4_Perspective_Walkway" }
      ];

      for (let i = 0; i < 4; i++) {
        const desc = angleDescriptors[i];
        const candidateImg =
          styleImages[targetStyle.id]?.[desc.key] ||
          (i === 0 ? styleImages[targetStyle.id]?.["overview"] : undefined) ||
          photos[desc.fallbackIndex]?.url ||
          styleImages[targetStyle.id]?.["overview"] ||
          styleImages[targetStyle.id]?.["angle-0"] ||
          photos[0]?.url;

        if (candidateImg) {
          if (candidateImg.startsWith("data:image/")) {
            const match = candidateImg.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (match) {
              let ext = match[1].toLowerCase();
              if (ext === "jpeg") ext = "jpg";
              anglesFolder.file(`${desc.filename}.${ext}`, match[2], { base64: true });
            }
          } else {
            try {
              const res = await fetch(candidateImg);
              if (res.ok) {
                const blob = await res.blob();
                const ext = candidateImg.endsWith(".png") ? "png" : "jpg";
                anglesFolder.file(`${desc.filename}.${ext}`, blob);
              }
            } catch (err) {
              console.warn(`Could not fetch angle image ${i + 1}:`, err);
            }
          }
        }
      }

      // Also include overview render if distinct and available
      const overviewImg = styleImages[targetStyle.id]?.["overview"];
      if (overviewImg && overviewImg.startsWith("data:image/")) {
        const match = overviewImg.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
          let ext = match[1].toLowerCase();
          if (ext === "jpeg") ext = "jpg";
          anglesFolder.file(`Master_Overview_Render.${ext}`, match[2], { base64: true });
        }
      }

      // 2. 60-30-10 palette JSON
      const paletteJson = {
        styleId: targetStyle.id,
        styleName: targetStyle.name,
        subtitle: targetStyle.subtitle,
        description: targetStyle.description,
        roomType,
        stylingMode: STYLING_MODES.find((m) => m.id === stylingMode)?.label || stylingMode,
        customDirectives: customDirectives.trim() || undefined,
        lightingSimulation: {
          timeOfDay: currentLighting.label,
          kelvin: currentLighting.kelvin,
          description: currentLighting.description
        },
        rule603010: {
          dominant60: {
            ratio: "60%",
            role: "Walls, Ceilings & Architectural Shell",
            title: targetStyle.rule603010.dominant60.title,
            description: targetStyle.rule603010.dominant60.description,
            finishes: targetStyle.rule603010.dominant60.finishes,
            colors: targetStyle.rule603010.dominant60.colors
          },
          secondary30: {
            ratio: "30%",
            role: "Furniture, Millwork & Large Textiles",
            title: targetStyle.rule603010.secondary30.title,
            description: targetStyle.rule603010.secondary30.description,
            materials: targetStyle.rule603010.secondary30.materials,
            colors: targetStyle.rule603010.secondary30.colors
          },
          accent10: {
            ratio: "10%",
            role: "Hardware, Ceramics, Cushions & Botanical Accents",
            title: targetStyle.rule603010.accent10.title,
            description: targetStyle.rule603010.accent10.description,
            details: targetStyle.rule603010.accent10.details,
            colors: targetStyle.rule603010.accent10.colors
          },
          lightingSpecs: targetStyle.rule603010.lightingSpecs,
          circulationAdvice: targetStyle.rule603010.circulationAdvice
        },
        exportedAt: new Date().toISOString()
      };
      rootFolder.file("palette-60-30-10.json", JSON.stringify(paletteJson, null, 2));

      // 3. Full Shopping List (JSON + formatted TXT)
      const shoppingListJson = {
        roomType,
        styleName: targetStyle.name,
        totalItemsTagged: annotations.length,
        items: annotations.map((ann, idx) => ({
          index: idx + 1,
          id: ann.id,
          label: ann.label,
          category: ann.category,
          roomAngle: ann.viewKey,
          coordinatesPercent: { x: ann.xPercent, y: ann.yPercent },
          notes: ann.notes || "",
          dimensions: ann.shoppingItem?.dimensions || "Not specified",
          estimatedCost: ann.shoppingItem?.estimatedCost || "TBD",
          sourcingStatus: ann.shoppingItem?.status || "wishlist"
        })),
        exportedAt: new Date().toISOString()
      };
      rootFolder.file("shopping-list.json", JSON.stringify(shoppingListJson, null, 2));

      // Human-readable formatted shopping list text
      let shoppingTxt = `=======================================================\n`;
      shoppingTxt += `SPACE LIFT — FURNITURE & SOURCING INVENTORY\n`;
      shoppingTxt += `Room: ${roomType.toUpperCase()} | Style: ${targetStyle.name.toUpperCase()}\n`;
      shoppingTxt += `Date: ${new Date().toLocaleDateString()}\n`;
      shoppingTxt += `Total Items Tagged: ${annotations.length}\n`;
      shoppingTxt += `=======================================================\n\n`;

      if (annotations.length === 0) {
        shoppingTxt += `No individual items tagged yet.\nUse "Tag Items" in the visualizer to pin furniture pieces and decor.\n\n`;
      } else {
        annotations.forEach((ann, idx) => {
          shoppingTxt += `${idx + 1}. [${ann.category.toUpperCase()}] ${ann.label}\n`;
          shoppingTxt += `   - Dimensions: ${ann.shoppingItem?.dimensions || "Standard"}\n`;
          shoppingTxt += `   - Est. Cost: ${ann.shoppingItem?.estimatedCost || "TBD"}\n`;
          shoppingTxt += `   - Status: ${(ann.shoppingItem?.status || "wishlist").toUpperCase()}\n`;
          if (ann.notes) shoppingTxt += `   - Notes: ${ann.notes}\n`;
          shoppingTxt += `   - Room Angle: ${ann.viewKey}\n\n`;
        });
      }

      shoppingTxt += `\n=======================================================\n`;
      shoppingTxt += `60-30-10 ARCHITECTURAL COLOR & MATERIAL SPECS\n`;
      shoppingTxt += `=======================================================\n`;
      shoppingTxt += `60% DOMINANT FOUNDATION: ${targetStyle.rule603010.dominant60.title}\n`;
      targetStyle.rule603010.dominant60.colors.forEach((c) => {
        shoppingTxt += `   * ${c.role}: ${c.name} (${c.code}) -> HEX ${c.hex}\n`;
      });
      shoppingTxt += `   Finishes: ${targetStyle.rule603010.dominant60.finishes}\n\n`;

      shoppingTxt += `30% STRUCTURAL FURNISHINGS: ${targetStyle.rule603010.secondary30.title}\n`;
      targetStyle.rule603010.secondary30.colors.forEach((c) => {
        shoppingTxt += `   * ${c.role}: ${c.name} (${c.code}) -> HEX ${c.hex}\n`;
      });
      shoppingTxt += `   Key Materials: ${targetStyle.rule603010.secondary30.materials.join(", ")}\n\n`;

      shoppingTxt += `10% ACCENTS & HARDWARE: ${targetStyle.rule603010.accent10.title}\n`;
      targetStyle.rule603010.accent10.colors.forEach((c) => {
        shoppingTxt += `   * ${c.role}: ${c.name} (${c.code}) -> HEX ${c.hex}\n`;
      });
      shoppingTxt += `   Details: ${targetStyle.rule603010.accent10.details}\n\n`;

      shoppingTxt += `LIGHTING SPECIFICATIONS:\n`;
      shoppingTxt += `   - Kelvin: ${targetStyle.rule603010.lightingSpecs.kelvin}\n`;
      shoppingTxt += `   - Fixtures: ${targetStyle.rule603010.lightingSpecs.fixtureTypes}\n`;
      shoppingTxt += `   - Advice: ${targetStyle.rule603010.lightingSpecs.luxAdvice}\n\n`;

      shoppingTxt += `CIRCULATION & CLEARANCES:\n`;
      shoppingTxt += `   ${targetStyle.rule603010.circulationAdvice}\n`;

      rootFolder.file("shopping-list.txt", shoppingTxt);

      // README file
      const readmeTxt = `SPACE LIFT ARCHITECTURAL DESIGN PACK
=======================================================
Style: ${targetStyle.name} (${targetStyle.subtitle})
Room: ${roomType}
Styling Mode: ${STYLING_MODES.find((m) => m.id === stylingMode)?.label || stylingMode}
Exported on: ${new Date().toLocaleString()}

CONTENTS OF THIS PACKAGE:
1. /room-angles/
   Contains all 4 rendered and captured room angles (Angle 1 Main, Angle 2 Daylight, Angle 3 Seating Nook, Angle 4 Perspective) at maximum resolution.
2. palette-60-30-10.json
   Complete machine-readable JSON specification containing paint codes (Farrow & Ball, Benjamin Moore, Sherwin-Williams), finishes, secondary materials, lighting Kelvin specs, and circulation clearance rules.
3. shopping-list.json & shopping-list.txt
   Full annotated furniture, lighting, and decor shopping items with dimensions, estimated costs, and sourcing statuses.

Space Lift Architectural Engine.
`;
      rootFolder.file("README-design-pack.txt", readmeTxt);

      // Generate the ZIP blob
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      // Trigger download
      const filename = `SpaceLift-${targetStyle.name.replace(/\s+/g, "_")}-Design-Pack.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate ZIP design pack:", err);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Synchronize camera stream
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access failed", err);
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = await shrinkImage(canvas.toDataURL("image/jpeg", 0.92));

        setPhotos((prev) => {
          if (prev.length >= 4) return prev;
          const newIdx = prev.length;
          const newPhoto: RoomAnglePhoto = {
            id: `snap-${Date.now()}-${newIdx}`,
            url: base64,
            label: `Angle ${newIdx + 1}`,
            tag: DEFAULT_ANGLE_TAGS[newIdx] || `Angle ${newIdx + 1}`
          };
          return [...prev, newPhoto];
        });
      }
    }
  };

  // Extract 3-4 keyframe angles from a video file pan
  const extractFramesFromVideo = async (file: File) => {
    setIsExtractingVideo(true);
    setExtractionProgress("Loading room video pan...");

    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Unable to load video"));
      });

      const duration = video.duration || 4;
      const targetFrames = 4;
      const timeStamps = [
        0.15 * duration,
        0.40 * duration,
        0.68 * duration,
        0.92 * duration
      ];

      const extracted: RoomAnglePhoto[] = [];

      for (let i = 0; i < targetFrames; i++) {
        setExtractionProgress(`Extracting key angle ${i + 1} of 4 (${Math.round((i / targetFrames) * 100)}%)...`);
        video.currentTime = timeStamps[i];

        await new Promise<void>((res) => {
          const handler = () => {
            video.removeEventListener("seeked", handler);
            res();
          };
          video.addEventListener("seeked", handler);
        });

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = await shrinkImage(canvas.toDataURL("image/jpeg", 0.9));
          extracted.push({
            id: `video-frame-${Date.now()}-${i}`,
            url: base64,
            label: `Angle ${i + 1}`,
            tag: DEFAULT_ANGLE_TAGS[i] || `Angle ${i + 1}`
          });
        }
      }

      URL.revokeObjectURL(url);
      setPhotos(extracted);
      setExtractionProgress("Extracted 4 room angles successfully!");
    } catch (e: any) {
      console.error("Video frame extraction failed", e);
      setExtractionProgress("Could not process video. Try still photos.");
    } finally {
      setTimeout(() => setIsExtractingVideo(false), 800);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      extractFramesFromVideo(file);
    }
    e.target.value = "";
  };

  // Downscale + compress an image data URL before it is ever uploaded. A phone
  // photo is ~2-4 MB of base64; at 1024px / JPEG 0.82 it is ~100-200 KB. Since the
  // server only uses one image per call, this is the single biggest latency win.
  const shrinkImage = (dataUrl: string, maxEdge = 1024, quality = 0.82): Promise<string> =>
    new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const longest = Math.max(img.width, img.height);
          const scale = Math.min(1, maxEdge / longest);
          if (scale >= 1) return resolve(dataUrl); // already small enough
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 4 - photos.length;
    const filesToRead = Array.from(files).slice(0, remainingSlots) as File[];

    const promises = filesToRead.map((file, idx) => {
      return new Promise<RoomAnglePhoto>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const photoIndex = photos.length + idx;
          const url = await shrinkImage(reader.result as string);
          resolve({
            id: `file-${Date.now()}-${photoIndex}`,
            url,
            label: `Angle ${photoIndex + 1}`,
            tag: DEFAULT_ANGLE_TAGS[photoIndex] || `Angle ${photoIndex + 1}`
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((newPhotos) => {
      setPhotos((prev) => [...prev, ...newPhotos]);
    });
    e.target.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.map((p, idx) => ({
        ...p,
        label: `Angle ${idx + 1}`,
        tag: DEFAULT_ANGLE_TAGS[idx] || `Angle ${idx + 1}`
      }));
    });
  };

  // 1-Click Demo Room with 3 distinct complementary room angles
  const handleDemoUpload = async () => {
    try {
      const response = await fetch("/test-image2.jpeg");
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const img = new Image();
      img.onload = async () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const c1 = document.createElement("canvas");
        c1.width = w;
        c1.height = h;
        const ctx1 = c1.getContext("2d")!;
        ctx1.drawImage(img, 0, 0);
        const a1 = c1.toDataURL("image/jpeg", 0.9);

        const c2 = document.createElement("canvas");
        c2.width = Math.floor(w * 0.78);
        c2.height = h;
        const ctx2 = c2.getContext("2d")!;
        ctx2.drawImage(img, 0, 0, Math.floor(w * 0.78), h, 0, 0, c2.width, c2.height);
        const a2 = c2.toDataURL("image/jpeg", 0.9);

        const c3 = document.createElement("canvas");
        c3.width = Math.floor(w * 0.78);
        c3.height = h;
        const ctx3 = c3.getContext("2d")!;
        ctx3.drawImage(img, Math.floor(w * 0.22), 0, Math.floor(w * 0.78), h, 0, 0, c3.width, c3.height);
        const a3 = c3.toDataURL("image/jpeg", 0.9);

        const [s1, s2, s3] = await Promise.all([shrinkImage(a1), shrinkImage(a2), shrinkImage(a3)]);
        setPhotos([
          { id: "demo-1", url: s1, label: "Angle 1", tag: "Main Living View" },
          { id: "demo-2", url: s2, label: "Angle 2", tag: "Window & Daylight Angle" },
          { id: "demo-3", url: s3, label: "Angle 3", tag: "Seating & Corner Nook" }
        ]);
      };
      img.src = base64;
    } catch (e) {
      console.error("Demo room load error", e);
    }
  };

  // Build targeted prompt based on user's styling mode & room type
  const buildPromptForTarget = (style: StyleConfig) => {
    const isExterior =
      /exterior|garden|landscape|courtyard|aangan|verandah|thinnai|terrace|patio|facade|elevation|backyard|outdoors/i.test(roomType) ||
      style.id.includes("exterior") || style.id.includes("landscape") || style.id.includes("courtyard") || style.id.includes("terrace");

    const furniturePlacementNotice = customDirectives.trim()
      ? ` Mandatory Additions & Layout Arrangement: "${customDirectives.trim()}". Explicitly place, arrange, and render these requested items (e.g. ${isExterior ? "teakwood swing/jhula, terracotta jali, brass urli, pergola, outdoor seating, planters" : "refrigerator/fridge, sofa, table, kitchen island, desk, layout"}) seamlessly in ${style.name} style.`
      : "";

    if (stylingMode === "custom" && customDirectives.trim()) {
      return `${customDirectives.trim()} in ${style.name} style aesthetics.`;
    }
    if (stylingMode === "paint_only") {
      const dom = style.rule603010.dominant60.colors[0];
      const sec = style.rule603010.secondary30.colors[0];
      const acc = style.rule603010.accent10.colors[0];
      return isExterior
        ? `Repaint exterior facade, boundary walls, and trims in ${dom.name} (${dom.hex}), secondary surfaces in ${sec.name} (${sec.hex}), and coordinate details in ${acc.name} (${acc.hex}). Keep existing building elevation and grounds intact.${furniturePlacementNotice}`
        : `Repaint walls in ${dom.name} (${dom.hex}), trim in ${sec.name} (${sec.hex}), and coordinate soft accents with ${acc.name} (${acc.hex}). Keep existing furniture and layout intact.${furniturePlacementNotice}`;
    }
    if (stylingMode === "declutter_polish") {
      return isExterior
        ? `Clean, groom and tidy this ${roomType}. Neaten garden pathways, manicured lawn/turf, and elevate exterior facade in ${style.name} style tones with warm natural ambient sunlight.${furniturePlacementNotice}`
        : `Clean, declutter and organize this ${roomType}. Harmonize the space in ${style.name} style tones, with neatened surfaces, organized decor, and warm ambient lighting.${furniturePlacementNotice}`;
    }
    if (stylingMode === "virtual_staging") {
      return isExterior
        ? `Landscape and furnish this ${roomType} in ${style.name} architectural style. Place appropriately scaled outdoor furniture, landscaping, pergola, and planters fitting the grounds, featuring ${style.prompt}.${furniturePlacementNotice}`
        : `Stage this empty ${roomType} in ${style.name} interior style. Place appropriately scaled ${roomType} furniture fitting the room dimensions, featuring ${style.prompt}.${furniturePlacementNotice}`;
    }
    return isExterior
      ? `${style.prompt}. Keep the exact building elevation massing, window/door placements, rooflines, and property boundaries intact.${furniturePlacementNotice}`
      : `${style.prompt}. Keep the exact room walls, windows, door frames, and floor boundaries intact.${furniturePlacementNotice}`;
  };

  // NEW — a locked "design manifest" so every angle renders the SAME identity.
  const buildDesignManifest = (style: StyleConfig) => {
    const d = style.rule603010.dominant60.colors[0];
    const s = style.rule603010.secondary30.colors[0];
    const a = style.rule603010.accent10.colors[0];
    return [
      `Walls: ${d?.name} (${d?.hex})`,
      `Flooring / secondary: ${s?.name} (${s?.hex})`,
      `Accent: ${a?.name} (${a?.hex})`,
      `Key materials: ${style.rule603010.secondary30.materials.join(", ")}`,
      `Lighting: ${style.rule603010.lightingSpecs.kelvin}; ${style.rule603010.lightingSpecs.fixtureTypes}`,
      `Core furniture & character: ${style.prompt}`
    ].map((x) => "- " + x).join("\n");
  };

  // Fetch image generation for a style and specific view
  const fetchStyleImage = async (
    styleIndex: number,
    viewKey: "overview" | `angle-${number}`,
    currentPhotos = photos,
    force = false
  ) => {
    const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
    if (styleIndex >= activeList.length || currentPhotos.length === 0) return;
    const style = activeList[styleIndex];
    const fetchKey = `${style.id}-${viewKey}-${stylingMode}-${roomType}`;

    if (!force && (styleImages[style.id]?.[viewKey] || fetchingRef.current.has(fetchKey))) return;

    fetchingRef.current.add(fetchKey);

    // The "master" view renders first and becomes the reference every other angle matches.
    const masterKey = currentPhotos.length > 1 ? "overview" : "angle-0";
    const isMaster = viewKey === masterKey;

    try {
      let mode: "overview" | "angle" | "single" = "overview";
      let targetAngleIndex = 0;

      if (viewKey === "overview") {
        mode = currentPhotos.length > 1 ? "overview" : "single";
      } else if (viewKey.startsWith("angle-")) {
        mode = currentPhotos.length > 1 ? "angle" : "single";
        targetAngleIndex = parseInt(viewKey.replace("angle-", ""), 10) || 0;
      }

      // Send ONLY the single photo this view needs (not all 3-4) — the server never
      // used the others. And shrink the reference render before sending it along.
      const targetUrl = currentPhotos[targetAngleIndex]?.url || currentPhotos[0]?.url;
      const refImg = (!isMaster && masterRenderRef.current[style.id])
        ? await shrinkImage(masterRenderRef.current[style.id], 896, 0.8)
        : undefined;
      const promptText = buildPromptForTarget(style);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          imageBase64: targetUrl,
          mode,
          targetAngleIndex,
          roomType,
          stylingMode,
          customDirectives,
          lightingTimeOfDay: applyLightingToAI ? currentLighting.id : undefined,
          // NEW — cross-angle consistency
          designManifest: buildDesignManifest(style),
          referenceRenderBase64: refImg,
          paletteSpecs: {
            dominant: style.rule603010.dominant60.colors[0],
            secondary: style.rule603010.secondary30.colors[0],
            accent: style.rule603010.accent10.colors[0]
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setStyleImages((prev) => ({
          ...prev,
          [style.id]: {
            ...(prev[style.id] || {}),
            [viewKey]: data.imageUrl
          }
        }));
        // Remember the master render so later angles can reference it.
        if (isMaster || !masterRenderRef.current[style.id]) {
          masterRenderRef.current[style.id] = data.imageUrl;
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${viewKey} for ${style.name}`, e);
    } finally {
      fetchingRef.current.delete(fetchKey);
      setIsRegenerating(false);
    }
  };

  // Re-generate current angle with updated styling mode, room type, or custom prompt
  const handleRegenerateCurrent = () => {
    setIsRegenerating(true);
    const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
    const style = activeList[currentIndex] || activeList[0];
    if (!style) return;

    setStyleImages((prev) => {
      const updated = { ...(prev[style.id] || {}) };
      delete updated[activeView];
      return { ...prev, [style.id]: updated };
    });

    fetchStyleImage(currentIndex, activeView as any, photos, true);
  };

  // Apply Gemini "Tweak & Talk" directives — now a running conversation with memory.
  const handleApplyGeminiTweak = async () => {
    setIsRegenerating(true);
    const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
    const style = activeList[currentIndex] || activeList[0];
    if (!style) return;

    const threadKey = `${style.id}-${activeView}`;
    const masterKey = photos.length > 1 ? "overview" : "angle-0";
    const isMasterView = activeView === masterKey;

    // Clear cached image for active view so loader appears
    setStyleImages((prev) => {
      const updated = { ...(prev[style.id] || {}) };
      delete updated[activeView];
      return { ...prev, [style.id]: updated };
    });

    try {
      let targetIndex = 0;
      if (activeView.startsWith("angle-")) {
        targetIndex = parseInt(activeView.replace("angle-", ""), 10) || 0;
      }
      const targetPhoto = photos[targetIndex] || photos[0];

      // This turn's new instructions
      const newDirectiveParts: string[] = [];
      if (tweakPrompt.trim()) newDirectiveParts.push(tweakPrompt.trim());
      if (selectedTweakColor) newDirectiveParts.push(`Apply ${selectedTweakColor} paint/color tone`);
      if (selectedBedSize && selectedBedSize !== "None") newDirectiveParts.push(`Scale bed exactly to ${selectedBedSize}`);
      const newDirectiveText = newDirectiveParts.join(". ");

      // Carry forward every earlier instruction so nothing gets lost ("add plant" + "sage walls").
      const prior = chatThreads[threadKey] || [];
      const priorDirectives = prior.filter((m) => m.role === "user").map((m) => m.text);
      const fullDirective = [...priorDirectives, newDirectiveText].filter(Boolean).join(". ");

      const refImg = (!isMasterView && masterRenderRef.current[style.id])
        ? await shrinkImage(masterRenderRef.current[style.id], 896, 0.8)
        : undefined;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: style.prompt,
          // Send only the target photo (not all angles) + re-apply the cumulative
          // directive to the ORIGINAL to avoid payload bloat and quality decay.
          imageBase64: targetPhoto?.url,
          mode: activeView === "overview" ? (photos.length > 1 ? "overview" : "single") : "angle",
          targetAngleIndex: targetIndex,
          roomType,
          stylingMode: "custom",
          customDirectives: fullDirective,
          bedSize: selectedBedSize,
          lensCalibration: lensIsUltraWide ? "0.5x" : "standard",
          tweakColor: selectedTweakColor,
          lightingTimeOfDay: applyLightingToAI ? currentLighting.id : undefined,
          designManifest: buildDesignManifest(style),
          referenceRenderBase64: refImg
        })
      });

      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setStyleImages((prev) => ({
          ...prev,
          [style.id]: {
            ...(prev[style.id] || {}),
            [activeView]: data.imageUrl
          }
        }));
        if (isMasterView || !masterRenderRef.current[style.id]) {
          masterRenderRef.current[style.id] = data.imageUrl;
        }
        // Log the conversation turn so the next tweak builds on this one.
        setChatThreads((prev) => ({
          ...prev,
          [threadKey]: [
            ...(prev[threadKey] || []),
            { role: "user", text: newDirectiveText || "Tweak" },
            { role: "ai", text: "Applied. Here's the updated room.", img: data.imageUrl }
          ]
        }));
        // Clear this turn's inputs; they now live in the thread history.
        setTweakPrompt("");
        setSelectedTweakColor("");
        setSelectedBedSize("None");
      }
    } catch (e) {
      console.error("Failed to apply Gemini tweak", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Spatial Dimensions & 0.5x Lens analysis
  const handleAnalyzeDimensions = async () => {
    setIsAnalyzingDimensions(true);
    setDimensionDrawerOpen(true);
    try {
      let targetIndex = 0;
      if (activeView.startsWith("angle-")) {
        targetIndex = parseInt(activeView.replace("angle-", ""), 10) || 0;
      }
      const targetPhoto = photos[targetIndex] || photos[0];
      if (!targetPhoto) return;

      const res = await fetch("/api/analyze-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: targetPhoto.url,
          isUltraWide: lensIsUltraWide
        })
      });
      const data = await res.json();
      setSpatialData(data);
    } catch (e) {
      console.error("Failed to analyze room dimensions", e);
    } finally {
      setIsAnalyzingDimensions(false);
    }
  };

  // Add new annotation / pin
  const handleSavePinDraft = () => {
    if (!newPinDraft) return;
    const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
    const style = activeList[currentIndex] || activeList[0];
    if (!style) return;

    const newAnnotation: RoomAnnotation = {
      id: "ann-" + Date.now(),
      styleId: style.id,
      viewKey: activeView,
      xPercent: Math.round(newPinDraft.x * 10) / 10,
      yPercent: Math.round(newPinDraft.y * 10) / 10,
      label: draftLabel.trim() || "Item",
      category: draftCategory,
      notes: draftNotes.trim(),
      shoppingItem: {
        itemTitle: draftLabel.trim() || "Item",
        estimatedCost: draftEstimatedCost.trim() || undefined,
        dimensions: draftDimensions.trim() || undefined,
        status: "wishlist"
      },
      createdAt: Date.now()
    };

    saveAnnotations([...annotations, newAnnotation]);
    setNewPinDraft(null);
    setDraftLabel("");
    setDraftNotes("");
    setDraftEstimatedCost("");
    setDraftDimensions("");
    setActiveAnnotationId(newAnnotation.id);
  };

  const handleDeleteAnnotation = (id: string) => {
    saveAnnotations(annotations.filter((a) => a.id !== id));
    if (activeAnnotationId === id) setActiveAnnotationId(null);
  };

  const handleToggleShoppingStatus = (id: string) => {
    saveAnnotations(
      annotations.map((a) => {
        if (a.id !== id || !a.shoppingItem) return a;
        const nextStatus =
          a.shoppingItem.status === "wishlist"
            ? "sourcing"
            : a.shoppingItem.status === "sourcing"
            ? "purchased"
            : "wishlist";
        return {
          ...a,
          shoppingItem: {
            ...a.shoppingItem,
            status: nextStatus
          }
        };
      })
    );
  };

  // When proceeding to countdown/cards, start pre-fetching initial view
  const startGenerating = () => {
    setScreen("countdown");
    setCountdown(2);
    setActiveView(photos.length > 1 ? "overview" : "angle-0");
    // Pre-fetch style 0 master first so angles have a reference to match.
    fetchStyleImage(0, photos.length > 1 ? "overview" : "angle-0");
    if (photos.length > 1) {
      fetchStyleImage(0, "angle-0");
    }
  };

  const handleStartGenerating = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          startGenerating();
        }
        return;
      }
    }

    startGenerating();
  };

  // Countdown timer
  useEffect(() => {
    let timer: any;
    if (screen === "countdown") {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      } else {
        const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
        const firstStyle = activeList[0] || STYLE_CONFIGS[0];
        const primaryViewKey = photos.length > 1 ? "overview" : "angle-0";
        if (styleImages[firstStyle.id]?.[primaryViewKey]) {
          setScreen("cards");
        } else {
          setScreen("loading");
        }
      }
    }
    return () => clearTimeout(timer);
  }, [screen, countdown, styleImages, photos, filteredStyles]);

  useEffect(() => {
    if (screen === "loading") {
      const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
      const firstStyle = activeList[0] || STYLE_CONFIGS[0];
      const primaryViewKey = photos.length > 1 ? "overview" : "angle-0";
      if (styleImages[firstStyle.id]?.[primaryViewKey]) {
        setScreen("cards");
      }
    }
  }, [screen, styleImages, photos, filteredStyles]);

  // Eagerly pre-fetch next style (master view) when index advances
  useEffect(() => {
    if (screen === "cards") {
      const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
      const nextIdx = currentIndex + 1;
      if (nextIdx < activeList.length) {
        fetchStyleImage(nextIdx, photos.length > 1 ? "overview" : "angle-0");
      }
    }
  }, [screen, currentIndex, photos, filteredStyles]);

  // When activeView changes on current card, fetch if missing.
  // Render the MASTER view first so non-master angles have a reference to match.
  useEffect(() => {
    if (screen === "cards" && activeView !== "grid") {
      const activeList = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
      const style = activeList[currentIndex];
      const masterKey = photos.length > 1 ? "overview" : "angle-0";
      if (style && activeView !== masterKey && !masterRenderRef.current[style.id]) {
        fetchStyleImage(currentIndex, masterKey as any);
      }
      fetchStyleImage(currentIndex, activeView as "overview" | `angle-${number}`);
    }
  }, [screen, currentIndex, activeView]);

  // Video generation — the cinematic room walkthrough (the genuinely "3D-feeling" output).
  const generateVideo = async (styleId: string, styleDesc: string) => {
    if (videoStatus[styleId]) return;

    setVideoStatus((prev) => ({ ...prev, [styleId]: "generating" }));

    try {
      const productImages = photos.map((p) => {
        const match = p.url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([^"]*)$/);
        return {
          data: match ? match[2] : "",
          mimeType: (match ? match[1] : "image/jpeg") as any
        };
      });

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Slow cinematic architectural camera pan through a redesigned ${roomType} in ${styleDesc}. Smooth dolly motion, photorealistic, consistent furniture, materials and lighting throughout; no morphing, no warping.`,
          productImages
        })
      });

      const data = await res.json();
      if (!res.ok || !data.fileId) throw new Error(data.error || "No video fileId returned");

      setVideoStatus((prev) => ({ ...prev, [styleId]: "polling" }));

      // Poll the generated file until it is ready to stream.
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts += 1;
        try {
          const statusRes = await fetch(`/api/file-status/${data.fileId}`);
          const statusData = await statusRes.json();
          const state = String(statusData.state || "").toUpperCase();
          if (state.includes("ACTIVE") || state.includes("SUCCEEDED") || state.includes("READY")) {
            clearInterval(interval);
            setVideos((prev) => ({ ...prev, [styleId]: data.fileId }));
            setVideoStatus((prev) => ({ ...prev, [styleId]: "ready" }));
          } else if (state.includes("FAILED") || attempts > 75) {
            clearInterval(interval);
            setVideoStatus((prev) => ({ ...prev, [styleId]: "failed" }));
          }
        } catch (e) {
          console.error("Video status poll error", e);
          if (attempts > 75) {
            clearInterval(interval);
            setVideoStatus((prev) => ({ ...prev, [styleId]: "failed" }));
          }
        }
      }, 4000);
    } catch (e: any) {
      console.error(e);
      setVideoStatus((prev) => ({ ...prev, [styleId]: "failed" }));
    }
  };

  const activeStyles = filteredStyles.length > 0 ? filteredStyles : STYLE_CONFIGS;
  const safeIndex = Math.min(currentIndex, activeStyles.length - 1);
  const currentStyle = activeStyles[safeIndex] || STYLE_CONFIGS[0];

  const handleDragEnd = (_e: any, { offset, velocity }: any) => {
    if (offset.y < -90 || velocity.y < -450) {
      if (currentIndex < activeStyles.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } else if (offset.y > 90 || velocity.y > 450) {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const activeAngleIdx = activeView.startsWith("angle-")
    ? parseInt(activeView.replace("angle-", ""), 10)
    : 0;
  const currentAngleOriginalPhoto = photos[activeAngleIdx] || photos[0];
  const currentRenderedImage = styleImages[currentStyle?.id]?.[activeView];
  const threadKey = `${currentStyle?.id}-${activeView}`;

  return (
    <div className="min-h-screen bg-[#EAE9E4] flex flex-col font-sans text-[#222222] overflow-x-hidden relative select-none">
      {/* Floating Shared Room Concept Notification Banner */}
      {sharedBannerData && (
        <div className="w-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white py-2 px-4 shadow-md flex items-center justify-between z-40 text-xs">
          <div className="flex items-center gap-2 max-w-2xl mx-auto flex-1">
            <Sparkles className="w-4 h-4 text-amber-200 shrink-0 animate-pulse" />
            <span className="truncate">
              Viewing shared room concept: <strong>{sharedBannerData.styleName}</strong> ({sharedBannerData.roomType || "Room"})
            </span>
            <button
              onClick={() => {
                setScreen("cards");
                setShareModalOpen(true);
              }}
              className="ml-auto underline font-semibold text-amber-100 hover:text-white shrink-0 cursor-pointer text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full hover:bg-white/20 transition-colors"
            >
              Export / Share
            </button>
            <button
              onClick={() => setSharedBannerData(null)}
              className="text-white/80 hover:text-white p-1 ml-1 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ===================== WELCOME / MULTI-PHOTO & VIDEO UPLOAD SCREEN ===================== */}
        {screen === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative z-10 w-full max-w-lg mx-auto py-8"
          >
            {photos.length === 0 ? (
              <>
                <div className="text-[64px] sm:text-[72px] leading-none mb-3">🛋️</div>
                <h1 className="text-[32px] sm:text-[38px] font-syncopate font-bold mb-2 tracking-tight text-center">
                  Space Lift
                </h1>
                <p className="text-[#222222]/70 text-xs sm:text-sm mb-4 text-center max-w-sm px-2 leading-relaxed">
                  Capture <strong>3 to 4 photos</strong> or upload a <strong>room video pan</strong>. Style your actual room while strictly preserving its walls, windows, and layout.
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setStyleCatalogOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-semibold text-amber-950 border border-amber-600/30 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                    <span>Explore All 15 Architectural Styles</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-mono px-1.5 py-0.2 rounded-full font-bold">15</span>
                    <ChevronRight className="w-3 h-3 text-amber-600" />
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full text-center mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#222222]/10 text-xs font-medium text-[#222222] mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  {photos.length === 1 ? "1 photo added" : `${photos.length} room angles captured`} · {photos.length > 1 ? "Whole Room Overview Ready" : "Add more angles for full 360° overview"}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Your Room Angles</h2>
                <p className="text-xs text-[#222222]/60">
                  {photos.length < 4
                    ? `You can add ${4 - photos.length} more angle${4 - photos.length > 1 ? "s" : ""} or configure styling now.`
                    : "Maximum 4 angles added. Ready to style!"}
                </p>
              </div>
            )}

            {/* Room Angles Grid / Slot Tray */}
            <div className="w-full grid grid-cols-2 gap-3 mb-4">
              {[0, 1, 2, 3].map((slotIdx) => {
                const photo = photos[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`relative aspect-[4/3] rounded-2xl border transition-all overflow-hidden flex flex-col items-center justify-center ${
                      photo
                        ? "border-[#222222]/20 bg-white shadow-xs"
                        : "border-dashed border-[#222222]/25 bg-white/40 hover:bg-white/70"
                    }`}
                  >
                    {photo ? (
                      <>
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                        <span className="absolute top-2 left-2 text-[10px] font-semibold bg-white/90 text-[#222222] px-2 py-0.5 rounded-full shadow-xs">
                          {photo.label}
                        </span>
                        <button
                          onClick={() => removePhoto(photo.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                          title="Remove angle"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-2 left-2 right-2 text-[10px] text-white/90 font-medium truncate">
                          {photo.tag}
                        </span>
                      </>
                    ) : (
                      <div
                        onClick={() => {
                          if (photos.length < 4) {
                            fileInputRef.current?.click();
                          }
                        }}
                        className="cursor-pointer flex flex-col items-center justify-center p-3 text-center w-full h-full"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#222222]/10 flex items-center justify-center text-[#222222]/70 mb-1">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-medium text-[#222222]/80">
                          {DEFAULT_ANGLE_TAGS[slotIdx]}
                        </span>
                        <span className="text-[9px] text-[#222222]/50">
                          {slotIdx === 0 ? "Primary Angle" : "Additional Angle"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Video extraction loading banner */}
            {isExtractingVideo && (
              <div className="w-full mb-4 p-4 rounded-2xl bg-white border border-[#222222]/15 shadow-xs flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-amber-600 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-[#222222]">Extracting Key Angles from Video</div>
                  <div className="text-[#222222]/60">{extractionProgress}</div>
                </div>
              </div>
            )}

            {/* Room Type & Styling Mode Configuration Box */}
            <div className="w-full mb-4 p-4 rounded-2xl bg-white border border-[#222222]/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#222222]/70 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                  Room Setup & Styling Method
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  Photo-Accurate
                </span>
              </div>

              {/* Room & Exterior Space Type Selector */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#222222]">
                    What kind of space is in your photo?
                  </label>
                  <span className="text-[10px] text-amber-900 font-bold bg-amber-100/80 px-2 py-0.5 rounded-full">
                    Includes Gardens & Exteriors
                  </span>
                </div>

                {/* Category Filter Tabs: All, Interiors, Exterior & Garden */}
                <div className="flex items-center gap-1 mb-2 p-0.5 bg-[#F6F5F2] rounded-xl border border-black/5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSpaceCategoryFilter("all")}
                    className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      spaceCategoryFilter === "all"
                        ? "bg-white text-[#222222] shadow-2xs"
                        : "text-[#222222]/60 hover:text-[#222222]"
                    }`}
                  >
                    All Spaces ({ROOM_TYPE_OPTIONS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpaceCategoryFilter("interior")}
                    className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      spaceCategoryFilter === "interior"
                        ? "bg-white text-[#222222] shadow-2xs"
                        : "text-[#222222]/60 hover:text-[#222222]"
                    }`}
                  >
                    🛋️ Interiors
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpaceCategoryFilter("exterior")}
                    className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                      spaceCategoryFilter === "exterior"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-amber-800 hover:text-amber-950"
                    }`}
                  >
                    🌳 Exterior & Garden
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {ROOM_TYPE_OPTIONS.filter((opt) =>
                    spaceCategoryFilter === "all" ? true : opt.category === spaceCategoryFilter
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setRoomType(opt.id)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border flex items-center justify-between gap-1 transition-all cursor-pointer ${
                        roomType === opt.id
                          ? "bg-[#222222] text-white border-[#222222] shadow-xs"
                          : "bg-[#FBFBFA] border-[#222222]/10 text-[#222222]/80 hover:bg-[#F0EFEA]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs shrink-0">{opt.icon}</span>
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.category === "exterior" && (
                        <span className={`text-[8px] font-bold px-1 rounded-sm shrink-0 ${
                          roomType === opt.id ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          Outdoor
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Styling Mode Selector */}
              <div>
                <label className="text-[11px] font-semibold text-[#222222] block mb-1.5">
                  How should we style your room or exterior?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {STYLING_MODES.map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => setStylingMode(mode.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        stylingMode === mode.id
                          ? "bg-amber-50/80 border-amber-600/50 shadow-2xs"
                          : "bg-[#FBFBFA] border-[#222222]/10 hover:border-[#222222]/25"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-[#222222]">{mode.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                            stylingMode === mode.id
                              ? "bg-amber-600 text-white"
                              : "bg-black/5 text-[#222222]/60"
                          }`}
                        >
                          {mode.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#222222]/70 leading-snug">
                        {mode.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dedicated Furniture, Appliances & Room Arrangement Card */}
            <div className="w-full mb-4 p-4 rounded-2xl bg-white border border-[#222222]/15 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#222222]/85 flex items-center gap-1.5">
                  <Armchair className="w-4 h-4 text-amber-600" />
                  Add Furniture, Appliances & Exterior Directives
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  Takes Layout & Landscape into Account
                </span>
              </div>
              <p className="text-[11px] text-[#222222]/70 leading-snug mb-2.5">
                Add an appliance (<strong>fridge</strong>), outdoor furniture (<strong>teak jhula</strong>), or architectural elements (<strong>terracotta jali</strong>, <strong>pergola</strong>):
              </p>

              {/* Quick 1-Click Appliance, Furniture & Exterior Presets */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {[
                  // Interior Presets
                  { label: "🧊 + Add Refrigerator", text: "Add a stainless steel double-door refrigerator in the left corner" },
                  { label: "🛋️ + L-Shaped Sectional", text: "Add an L-shaped sectional sofa facing the window" },
                  { label: "🍳 + Kitchen Island", text: "Add a central kitchen island with 3 barstools" },
                  { label: "🍽️ + Dining Table", text: "Add a solid wood dining table with 4 chairs" },
                  { label: "📺 + Wall-Mount TV", text: "Wall-mount a TV with a low-profile media console underneath" },
                  // Exterior & Indian Presets (Requested by user)
                  { label: "🪔 + Teak Jhula (Swing)", text: "Add a traditional carved teakwood swing (jhula) with brass hanging chains and comfortable bolsters" },
                  { label: "🧱 + Terracotta Jali", text: "Add intricate terracotta clay jali lattice privacy screens on boundary walls" },
                  { label: "⛲ + Brass Urli / Fountain", text: "Add a large hand-hammered brass urli with water, floating marigolds and lotus flowers" },
                  { label: "🌿 + Timber Pergola", text: "Add a modern treated timber pergola with climbing bougainvillea canopy" },
                  { label: "🪴 + Champa & Frangipani", text: "Add sculptural frangipani (champa) trees in handcrafted stone planter urns" },
                  { label: "💡 + Garden Path Lights", text: "Add warm 2700K low-voltage pathway bollard lights and stone uplights" },
                  { label: "🪵 + CNC Exterior Louvers", text: "Add architectural exterior weatherproof CNC panels and teak louvers for sun control" },
                  { label: "🔥 + Fire Pit & Seating", text: "Add a natural stone outdoor fire pit with weather-resistant curved bench seating" }
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => appendDirectiveTag(chip.text)}
                    className="text-[10px] bg-[#F6F5F2] hover:bg-amber-50 hover:border-amber-400 border border-[#222222]/10 px-2 py-1 rounded-lg text-[#222222] font-medium transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Textarea for Directives */}
              <div className="relative">
                <textarea
                  value={customDirectives}
                  onChange={(e) => setCustomDirectives(e.target.value)}
                  placeholder="e.g. Add a double-door stainless steel fridge in the left corner, place an L-shaped sofa facing the window, and put a dining table on the right..."
                  rows={2}
                  className="w-full text-xs bg-[#FBFBFA] border border-[#222222]/15 rounded-xl p-2.5 pr-14 outline-none focus:border-amber-600 focus:bg-white transition-all text-[#222222]"
                />
                {customDirectives && (
                  <button
                    type="button"
                    onClick={() => setCustomDirectives("")}
                    className="absolute top-2 right-2 text-[10px] text-red-500 hover:text-red-700 bg-white/90 px-1.5 py-0.5 rounded border border-red-200 cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#222222]/60">
                <span>✨ AI will generate your selected style while placing your requested furniture & layout.</span>
                {customDirectives && (
                  <span className="text-amber-800 font-semibold">Active: {customDirectives.length} chars</span>
                )}
              </div>
            </div>

            {/* Hidden inputs */}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <input
              type="file"
              accept="video/*"
              className="hidden"
              ref={videoFileInputRef}
              onChange={handleVideoUpload}
            />

            {/* Capture & Ingestion Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              {photos.length < 4 && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white border border-[#222222]/15 py-3 px-2 text-xs font-medium shadow-2xs hover:bg-[#F6F5F2] active:scale-[0.98] transition-all text-center"
                  >
                    <Camera className="w-4 h-4 text-[#222222]" />
                    <span>Snap Angles</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white border border-[#222222]/15 py-3 px-2 text-xs font-medium shadow-2xs hover:bg-[#F6F5F2] active:scale-[0.98] transition-all text-center"
                  >
                    <Upload className="w-4 h-4 text-[#222222]" />
                    <span>Upload Photos</span>
                  </button>

                  <button
                    onClick={() => videoFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white border border-[#222222]/15 py-3 px-2 text-xs font-medium shadow-2xs hover:bg-[#F6F5F2] active:scale-[0.98] transition-all text-center"
                  >
                    <Film className="w-4 h-4 text-amber-600" />
                    <span>Video Pan</span>
                  </button>
                </div>
              )}

              {/* Demo 3-angle Room Preset */}
              {photos.length === 0 && (
                <button
                  onClick={handleDemoUpload}
                  className="w-full rounded-2xl border border-amber-600/30 bg-amber-50/90 hover:bg-amber-100/90 text-amber-950 py-3 text-xs sm:text-sm font-medium shadow-2xs active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Try 3-Angle Demo Room (Instant 1-Click)
                </button>
              )}

              {/* Main Submit Button */}
              {photos.length > 0 && (
                <button
                  onClick={(e) => handleStartGenerating(e)}
                  className="w-full rounded-2xl bg-[#222222] text-white py-4 text-center text-sm font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1"
                >
                  <span>
                    {photos.length > 1
                      ? `Style Whole Room (${photos.length} Angles) in ${roomType}`
                      : `Style ${roomType} (${STYLING_MODES.find(m => m.id === stylingMode)?.label})`}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Architectural Engine Feature Callout */}
            <div className="w-full mt-5 p-3.5 rounded-2xl bg-white/70 border border-[#222222]/10 text-xs text-[#222222]/70 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-[#222222] mb-1">
                <Palette className="w-3.5 h-3.5 text-amber-600" />
                <span>60-30-10 Architectural Color & Material Engine</span>
              </div>
              <p className="text-[11px] text-[#222222]/60">
                Transforms your exact space with authentic paint codes (Farrow & Ball, Benjamin Moore, Sherwin-Williams), 2700K lighting, and circulation rules.
              </p>
            </div>
          </motion.div>
        )}

        {/* ===================== MULTI-SNAP CAMERA MODAL ===================== */}
        {cameraActive && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between p-4">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between text-white z-10 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                  Angle {photos.length + 1} of 4
                </span>
                <span className="text-xs text-white/80">
                  {DEFAULT_ANGLE_TAGS[photos.length] || "Room View"}
                </span>
              </div>
              <button
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewport with Architectural Grid Overlay */}
            <div className="relative w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden my-auto border border-white/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Rule of thirds grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="w-full max-w-md flex flex-col items-center gap-4 pb-4">
              <div className="text-xs text-white/70 text-center">
                Hold level with room corners for optimum depth perspective.
              </div>
              <div className="flex items-center justify-around w-full">
                <button
                  onClick={stopCamera}
                  className="text-xs text-white/80 font-medium px-4 py-2"
                >
                  Done ({photos.length})
                </button>

                <button
                  onClick={capturePhoto}
                  disabled={photos.length >= 4}
                  className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-full h-full bg-white rounded-full" />
                </button>

                <button
                  onClick={() => setPhotos([])}
                  className="text-xs text-white/50 hover:text-white px-4 py-2"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== COUNTDOWN SCREEN ===================== */}
        {screen === "countdown" && (
          <motion.div
            key="countdown"
            className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 min-h-screen absolute inset-0 w-full"
          >
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-widest text-[#222222]/50 font-bold">
                Synthesizing {photos.length} Room Angle{photos.length > 1 ? "s" : ""} · {roomType}
              </span>
              <p className="text-sm text-[#222222]/70 mt-1">
                Applying {STYLING_MODES.find(m => m.id === stylingMode)?.label} with 60-30-10 palette rules...
              </p>
            </div>
            <AnimatePresence mode="wait">
              {countdown > 0 && (
                <motion.div
                  key={countdown}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  transition={{ duration: 0.35 }}
                >
                  <h1 className="text-9xl font-semibold text-[#222222]">{countdown}</h1>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ===================== LOADING SKELETON ===================== */}
        {screen === "loading" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-4 flex flex-col relative overflow-hidden shadow-sm min-h-[520px]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="h-5 w-28 bg-[#EAE9E4]/80 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-[#EAE9E4]/80 rounded-full animate-pulse" />
              </div>
              <div className="w-full aspect-[4/3] rounded-2xl bg-[#EAE9E4]/60 animate-pulse flex-none" />
              <div className="mt-6 space-y-2.5 px-2 flex-1">
                <div className="h-6 w-3/4 bg-[#EAE9E4]/60 rounded-full animate-pulse" />
                <div className="h-5 w-5/6 bg-[#EAE9E4]/60 rounded-full animate-pulse" />
                <div className="h-5 w-1/2 bg-[#EAE9E4]/60 rounded-full animate-pulse" />
              </div>
              <div className="mt-auto flex items-center justify-between px-2 pt-4">
                <div className="h-8 w-24 bg-[#EAE9E4]/80 rounded-full animate-pulse" />
                <div className="h-8 w-24 bg-[#EAE9E4]/80 rounded-full animate-pulse" />
              </div>
            </motion.div>
          </div>
        )}

        {/* ===================== CARDS & VISUALIZER CAROUSEL ===================== */}
        {screen === "cards" && (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 relative min-h-screen py-6 sm:py-8">
            {/* Top Navigation Bar */}
            <div className="w-full max-w-md flex items-center justify-between mb-2.5 px-1">
              <button
                onClick={() => {
                  fetchingRef.current.clear();
                  setCurrentIndex(0);
                  setScreen("welcome");
                }}
                className="text-xs font-semibold text-[#222222]/70 hover:text-[#222222] transition-colors cursor-pointer flex items-center gap-1 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full shadow-2xs border border-[#222222]/10"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Photos ({photos.length})
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                <button
                  onClick={() => setScreen("favorites")}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1 transition-all shrink-0 ${
                    savedStyleIds.length > 0
                      ? "bg-amber-100/80 text-amber-900 border-amber-300"
                      : "bg-white text-[#222222] hover:bg-[#F6F5F2]"
                  }`}
                  title="View My Saved Styles"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      savedStyleIds.length > 0 ? "fill-amber-600 text-amber-600" : "text-[#222222]"
                    }`}
                  />
                  <span>Saved ({savedStyleIds.length})</span>
                </button>

                <button
                  onClick={() => setShoppingDrawerOpen(true)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1 transition-all shrink-0 ${
                    annotations.length > 0
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : "bg-white text-[#222222] hover:bg-[#F6F5F2]"
                  }`}
                  title="View Tagged Furniture & Shopping List"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tags ({annotations.length})</span>
                </button>

                <button
                  onClick={handleAnalyzeDimensions}
                  className="text-xs font-semibold text-[#222222] bg-white px-2.5 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1 hover:bg-[#F6F5F2] active:scale-95 transition-all shrink-0"
                  title="Room Dimensions & 0.5x Ultra-Wide Lens Analysis"
                >
                  <Ruler className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dimensions</span>
                </button>

                <button
                  onClick={() => setThreeDViewerOpen(true)}
                  className="text-xs font-semibold text-[#222222] bg-white px-2.5 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1 hover:bg-[#F6F5F2] active:scale-95 transition-all shrink-0"
                  title="Explore in 3D Spatial Pan View"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>3D</span>
                </button>

                <button
                  onClick={() => setSpecDrawerOpen(true)}
                  className="text-xs font-semibold text-[#222222] bg-white px-2.5 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1 hover:bg-[#F6F5F2] active:scale-95 transition-all shrink-0"
                  title="Open 60-30-10 Architectural Palette & Specs"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-600" />
                  <span>Specs</span>
                </button>

                <button
                  onClick={() => setPdfExportModalOpen(true)}
                  className="text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full shadow-2xs border border-rose-200/80 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
                  title="Export PDF Dossier or Complete ZIP Design Pack"
                >
                  <Download className="w-3.5 h-3.5 text-rose-600" />
                  <span>Export PDF & Pack</span>
                </button>

                <button
                  onClick={() => setShareModalOpen(true)}
                  className="text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-full shadow-2xs border border-amber-300 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
                  title="Share design snapshot or copy shareable link"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* SEARCH BAR & KEYWORD FILTER */}
            <div className="w-full max-w-md mb-2.5 px-1">
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xs border border-[#222222]/10 p-2 flex flex-col gap-2">
                <div className="relative flex items-center bg-[#F6F5F2] rounded-xl px-2.5 py-1.5 border border-black/5 focus-within:border-[#222222]/25 focus-within:bg-white transition-all">
                  <Search className="w-4 h-4 text-[#222222]/40 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentIndex(0);
                    }}
                    placeholder="Search styles (e.g. 'warm', 'coastal', 'deco', 'wood')..."
                    className="w-full text-xs bg-transparent outline-none text-[#222222] placeholder:text-[#222222]/40"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentIndex(0);
                      }}
                      className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[#222222]/70 hover:bg-black/20 shrink-0 ml-1 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ) : null}
                  <span className="text-[10px] text-[#222222]/50 font-mono shrink-0 ml-1.5 px-1.5 py-0.5 bg-white rounded-md border border-black/5">
                    {filteredStyles.length}/{STYLE_CONFIGS.length}
                  </span>
                </div>

                {/* Quick Keyword Filter Chips for Power Users */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {["All", "Exterior", "Indian Haveli", "Garden", "Villa", "Terrace", "Warm", "Modern", "Minimal", "Wood", "Japandi", "Luxury", "Boho", "Coastal", "Farmhouse", "Deco", "Mediterranean", "Parisian"].map((chip) => {
                    const isSelected = chip === "All" ? !searchQuery : searchQuery.toLowerCase() === chip.toLowerCase();
                    return (
                      <button
                        key={chip}
                        onClick={() => {
                          if (chip === "All") {
                            setSearchQuery("");
                          } else {
                            setSearchQuery(chip);
                          }
                          setCurrentIndex(0);
                        }}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#222222] text-white shadow-2xs"
                            : "bg-[#F6F5F2] text-[#222222]/70 hover:text-[#222222] hover:bg-[#EAE9E4] border border-black/5"
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Room Type & Styling Mode Toolbar Bar */}
            <div className="w-full max-w-md mb-2.5 px-1">
              <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2 shadow-2xs border border-[#222222]/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#222222] capitalize flex items-center gap-1">
                      <span>{ROOM_TYPE_OPTIONS.find(r => r.id === roomType)?.icon || "🛋️"}</span>
                      {roomType}
                    </span>
                    <span className="text-[#222222]/30">·</span>
                    <button
                      onClick={() => setStyleCatalogOpen(true)}
                      className="text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer border border-amber-300/50"
                      title="Open full catalog of all 20 architectural styles including Exteriors & Indian courtyards"
                    >
                      <Palette className="w-2.5 h-2.5 text-amber-700" />
                      <span>{STYLE_CONFIGS.length} Styles</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Add Furniture, Fridge & Layout Directives Button */}
                    <button
                      onClick={() => setLayoutDirectivesDrawerOpen(!layoutDirectivesDrawerOpen)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                        layoutDirectivesDrawerOpen || customDirectives
                          ? "bg-amber-100 text-amber-950 border-amber-400 shadow-2xs"
                          : "bg-[#F6F5F2] text-[#222222]/80 border-[#222222]/10 hover:bg-[#EAE9E4]"
                      }`}
                      title="Add furniture, appliances (fridge, sofa), or customize layout"
                    >
                      <Armchair className="w-3 h-3 text-amber-700" />
                      <span>{customDirectives ? "Furniture Active" : "Add Furniture / Fridge"}</span>
                      {customDirectives && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      )}
                    </button>

                    <button
                      onClick={() => setShowModeDrawer(!showModeDrawer)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                        showModeDrawer || lightingSliderValue !== 50
                          ? "text-amber-800 bg-amber-50 border-amber-300 shadow-2xs"
                          : "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200/60"
                      }`}
                      title="Adjust Room Type, Styling Mode, and Time of Day Lighting"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Lighting</span>
                      {lightingSliderValue !== 50 && (
                        <span className="text-[9px] px-1 bg-amber-200/80 rounded-full font-mono font-bold">
                          {currentLighting.icon}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={handleRegenerateCurrent}
                      disabled={isRegenerating}
                      className="text-[11px] font-semibold text-[#222222] bg-[#F6F5F2] hover:bg-[#EAE9E4] px-2.5 py-1 rounded-lg border border-[#222222]/10 flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      title="Re-generate this angle with current mode settings"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin text-amber-600" : ""}`} />
                      <span>{isRegenerating ? "..." : "Regen"}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Furniture & Layout Directive Active Notice */}
                {!layoutDirectivesDrawerOpen && customDirectives && (
                  <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1 text-[10px] text-amber-950">
                    <div className="flex items-center gap-1 truncate max-w-[280px]">
                      <span className="font-bold text-amber-900 shrink-0">🛋️ Layout:</span>
                      <span className="truncate">{customDirectives}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <button
                        onClick={() => setLayoutDirectivesDrawerOpen(true)}
                        className="text-amber-800 font-bold hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <span>·</span>
                      <button
                        onClick={() => setCustomDirectives("")}
                        className="text-red-500 font-bold hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Dedicated Furniture, Appliances & Room Arrangement Drawer */}
                {layoutDirectivesDrawerOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-[#222222]/10 flex flex-col gap-2 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 p-3 rounded-2xl border border-amber-200/80 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                        <Armchair className="w-3.5 h-3.5 text-amber-600" />
                        <span>Add Furniture, Fridge & Arrange Layout</span>
                      </div>
                      <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                        Honored by AI
                      </span>
                    </div>
                    <p className="text-[10px] text-[#222222]/70 leading-snug">
                      Specify what furniture/appliances to add (e.g. <strong>fridge</strong>, <strong>sectional</strong>, <strong>kitchen island</strong>) or how to arrange them:
                    </p>

                    {/* Quick 1-click Preset Chips */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "🧊 + Fridge", text: "Add a stainless steel double-door refrigerator in the corner" },
                        { label: "🛋️ + L-Sofa", text: "Add an L-shaped sectional sofa facing the window" },
                        { label: "🍳 + Island", text: "Add a kitchen island with 3 modern barstools" },
                        { label: "🍽️ + Dining Table", text: "Add a solid wood dining table with 4 chairs" },
                        { label: "🖥️ + Desk", text: "Place a desk and ergonomic chair by the window" },
                        { label: "📺 + Wall TV", text: "Wall-mount a TV with a floating media console" },
                        // Exterior & Indian presets
                        { label: "🪔 + Teak Jhula", text: "Add a traditional carved teakwood swing (jhula) with brass chains" },
                        { label: "🧱 + Terracotta Jali", text: "Add intricate terracotta clay jali lattice privacy screens" },
                        { label: "⛲ + Brass Urli", text: "Add a hand-hammered brass urli with floating marigolds and lotus" },
                        { label: "🌿 + Timber Pergola", text: "Add a modern treated timber pergola with climbing bougainvillea" },
                        { label: "🪴 + Champa Trees", text: "Add sculptural frangipani (champa) trees in terracotta stone urns" },
                        { label: "🪵 + CNC Louvers", text: "Add exterior grade architectural CNC panels and teak louvers" },
                        { label: "🔥 + Fire Pit", text: "Add a natural stone fire pit with curved outdoor bench seating" }
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => appendDirectiveTag(chip.text)}
                          className="text-[9px] bg-white hover:bg-amber-100 hover:border-amber-400 border border-[#222222]/10 px-2 py-0.5 rounded-md text-[#222222] font-semibold transition-all cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Textarea */}
                    <div className="relative">
                      <textarea
                        value={customDirectives}
                        onChange={(e) => setCustomDirectives(e.target.value)}
                        placeholder="e.g. Add a double-door stainless steel fridge in the left corner, place an L-shaped sofa facing the patio window..."
                        rows={2}
                        className="w-full text-xs bg-white border border-amber-300 rounded-xl p-2.5 pr-14 outline-none focus:border-amber-600 transition-all text-[#222222]"
                      />
                      {customDirectives && (
                        <button
                          type="button"
                          onClick={() => setCustomDirectives("")}
                          className="absolute top-2 right-2 text-[9px] text-red-500 hover:text-red-700 bg-white/90 px-1.5 py-0.5 rounded border border-red-200 cursor-pointer font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-[#222222]/60">
                        Applies directly to your {currentStyle.name} render.
                      </span>
                      <button
                        type="button"
                        onClick={handleRegenerateCurrent}
                        disabled={isRegenerating}
                        className="px-3 py-1.5 bg-[#222222] hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin text-amber-400" : ""}`} />
                        <span>{isRegenerating ? "Rendering..." : "Re-render with Layout"}</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Expanded Inline Mode & Style Adjuster Drawer */}
                {showModeDrawer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-[#222222]/10 flex flex-col gap-2.5"
                  >
                    {/* Time of Day Lighting Temperature Simulator */}
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-indigo-50/70 border border-[#222222]/10 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-white shadow-xs border border-black/5 flex items-center justify-center text-base">
                            {currentLighting.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#222222]">
                                Time of Day: {currentLighting.label}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shadow-2xs ${currentLighting.badgeBg}`}>
                                {currentLighting.kelvin.toLocaleString()}K
                              </span>
                            </div>
                            <p className="text-[10px] text-[#222222]/65 leading-tight">
                              {currentLighting.description}
                            </p>
                          </div>
                        </div>
                        {lightingSliderValue !== 50 && (
                          <button
                            type="button"
                            onClick={() => setLightingSliderValue(50)}
                            className="text-[10px] font-medium text-[#222222]/60 hover:text-[#222222] px-2 py-1 rounded-lg bg-white border border-[#222222]/10 hover:bg-[#F6F5F2] transition-all"
                            title="Reset to 5500K Neutral Noon"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Time of Day Lighting Slider */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="relative flex items-center px-0.5">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={lightingSliderValue}
                            onChange={(e) => setLightingSliderValue(Number(e.target.value))}
                            className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-amber-600 bg-gradient-to-r from-amber-400 via-amber-100 via-50% to-indigo-600 shadow-inner"
                          />
                        </div>

                        {/* Milestone Tick Marks & Quick Preset Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setLightingSliderValue(0)}
                            className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                              lightingSliderValue <= 20
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-white/80 border-[#222222]/10 text-amber-900 hover:bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-[11px] font-bold">
                              <span>🌅</span> Golden Hour
                            </div>
                            <div className={`text-[9px] ${lightingSliderValue <= 20 ? "text-amber-100" : "text-[#222222]/55"}`}>
                              Warm Amber (~2800K)
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLightingSliderValue(50)}
                            className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                              lightingSliderValue >= 40 && lightingSliderValue <= 60
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                : "bg-white/80 border-[#222222]/10 text-[#222222] hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-[11px] font-bold">
                              <span>☀️</span> Bright Noon
                            </div>
                            <div className={`text-[9px] ${lightingSliderValue >= 40 && lightingSliderValue <= 60 ? "text-emerald-100" : "text-[#222222]/55"}`}>
                              Crisp Sun (5500K)
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLightingSliderValue(100)}
                            className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                              lightingSliderValue >= 80
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                : "bg-white/80 border-[#222222]/10 text-indigo-900 hover:bg-indigo-50"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-[11px] font-bold">
                              <span>🌌</span> Blue Hour
                            </div>
                            <div className={`text-[9px] ${lightingSliderValue >= 80 ? "text-indigo-100" : "text-[#222222]/55"}`}>
                              Twilight Indigo (~8500K)
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#222222]/5 text-[10px]">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#222222]/70 hover:text-[#222222]">
                          <input
                            type="checkbox"
                            checked={lightingSimEnabled}
                            onChange={(e) => setLightingSimEnabled(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-0 w-3 h-3"
                          />
                          <span>Live image temperature simulation</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#222222]/70 hover:text-[#222222]">
                          <input
                            type="checkbox"
                            checked={applyLightingToAI}
                            onChange={(e) => setApplyLightingToAI(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-0 w-3 h-3"
                          />
                          <span>Include in AI re-renders</span>
                        </label>
                      </div>
                    </div>

                    {/* Room Type Switcher */}
                    <div>
                      <span className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider block mb-1">
                        Room Type (Preserves appropriate layout)
                      </span>
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
                        {ROOM_TYPE_OPTIONS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setRoomType(r.id);
                              setStyleImages({});
                              masterRenderRef.current = {};
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap border transition-all ${
                              roomType === r.id
                                ? "bg-[#222222] text-white border-[#222222]"
                                : "bg-white border-[#222222]/10 text-[#222222]/70 hover:bg-[#F6F5F2]"
                            }`}
                          >
                            {r.icon} {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Styling Mode Switcher */}
                    <div>
                      <span className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider block mb-1">
                        Makeover Method
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {STYLING_MODES.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setStylingMode(m.id);
                              setStyleImages({});
                              masterRenderRef.current = {};
                            }}
                            className={`p-2 rounded-xl text-left border transition-all ${
                              stylingMode === m.id
                                ? "bg-amber-50/90 border-amber-600/60 shadow-2xs"
                                : "bg-white border-[#222222]/10 text-[#222222]/80 hover:bg-[#F6F5F2]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-bold text-[#222222]">{m.label}</span>
                              <span className="text-[8px] bg-black/5 px-1 py-0.2 rounded font-mono">
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-[9px] text-[#222222]/60 line-clamp-1">
                              {m.detail}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Prompt Directives Input */}
                    {stylingMode === "custom" && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customDirectives}
                          onChange={(e) => setCustomDirectives(e.target.value)}
                          placeholder="e.g. Keep my bed, paint walls sage green, add linen curtains..."
                          className="flex-1 text-xs bg-[#F6F5F2] border border-[#222222]/15 rounded-xl px-2.5 py-1.5 outline-none"
                        />
                        <button
                          onClick={handleRegenerateCurrent}
                          className="text-xs bg-[#222222] text-white px-3 py-1.5 rounded-xl font-medium shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Room Angles / Views Switcher Bar */}
            {photos.length > 1 && (
              <div className="w-full max-w-md mb-2.5 px-1">
                <div className="bg-white/90 backdrop-blur-md rounded-2xl p-1 shadow-2xs border border-[#222222]/10 flex items-center gap-1 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setActiveView("overview")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      activeView === "overview"
                        ? "bg-[#222222] text-white shadow-xs"
                        : "text-[#222222]/70 hover:bg-[#222222]/5"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Master Overview</span>
                  </button>

                  {photos.map((photo, pIdx) => {
                    const key = `angle-${pIdx}` as const;
                    return (
                      <button
                        key={photo.id}
                        onClick={() => setActiveView(key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                          activeView === key
                            ? "bg-[#222222] text-white shadow-xs"
                            : "text-[#222222]/70 hover:bg-[#222222]/5"
                        }`}
                      >
                        <span>{photo.label}</span>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setActiveView("grid")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      activeView === "grid"
                        ? "bg-[#222222] text-white shadow-xs"
                        : "text-[#222222]/70 hover:bg-[#222222]/5"
                    }`}
                    title="View 4-Angle Grid"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Grid</span>
                  </button>
                </div>
              </div>
            )}

            {/* Card Container */}
            <div className="w-full max-w-md relative grid">
              <AnimatePresence initial={false} mode="wait">
                {activeStyles.length > 0 && safeIndex < activeStyles.length ? (
                  <motion.div
                    key={currentStyle.id}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    onDragEnd={handleDragEnd}
                    initial={{ y: 50, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1, zIndex: 10 }}
                    exit={{ y: -300, opacity: 0, scale: 0.9, zIndex: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="[grid-area:1/1] w-full bg-white rounded-[32px] flex flex-col shadow-sm cursor-grab active:cursor-grabbing pb-5 relative overflow-hidden"
                    style={{ touchAction: "none" }}
                  >
                    {/* Visualizer Area */}
                    <div className="p-3.5 sm:p-4 relative flex-none">
                      {activeView === "grid" ? (
                        /* Multi-Angle Matrix View */
                        <div className="w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[#EAE9E4]/60 p-2 grid grid-cols-2 gap-2">
                          {photos.map((p, idx) => {
                            const angleKey = `angle-${idx}`;
                            const angleImg = styleImages[currentStyle.id]?.[angleKey];
                            return (
                              <div
                                key={p.id}
                                onClick={() => setActiveView(angleKey)}
                                className="relative rounded-xl overflow-hidden bg-black/10 cursor-pointer group"
                              >
                                {angleImg ? (
                                  <img
                                    src={angleImg}
                                    alt={p.label}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-white/60">
                                    <Loader2 className="w-4 h-4 animate-spin text-[#222222]/40 mb-1" />
                                    <span className="text-[9px] text-[#222222]/60">Generating {p.label}...</span>
                                  </div>
                                )}
                                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-xs backdrop-blur-xs">
                                  {p.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Single View / Overview with Split Compare option */
                        <div className="w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[#EAE9E4]/60 flex items-center justify-center relative select-none">
                          {videos[currentStyle.id] ? (
                            <video
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                              src={`/api/video/${videos[currentStyle.id]}`}
                            />
                          ) : currentRenderedImage ? (
                            <div
                              onClick={(e) => {
                                if (!isAnnotatingMode) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                setNewPinDraft({ x, y });
                                setDraftLabel("");
                                setDraftNotes("");
                                setDraftEstimatedCost("");
                                setDraftDimensions("");
                              }}
                              className={`relative w-full h-full overflow-hidden ${
                                isAnnotatingMode ? "cursor-crosshair ring-2 ring-amber-500" : ""
                              }`}
                            >
                              {/* If Comparing with original photo (Uses CSS clipPath so neither photo squishes!) */}
                              {isComparing && currentAngleOriginalPhoto ? (
                                <div className="relative w-full h-full">
                                  {/* Redesigned Image (Base layer) */}
                                  <img
                                    src={currentRenderedImage}
                                    style={{
                                      filter: lightingSimEnabled ? currentLighting.filter : undefined,
                                      transition: "filter 0.3s ease"
                                    }}
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                    alt={currentStyle.name}
                                  />
                                  {/* Simulated Lighting Atmosphere Overlay on Redesigned half */}
                                  {lightingSimEnabled && currentLighting.overlayBg !== "transparent" && (
                                    <div
                                      className="absolute inset-0 pointer-events-none transition-all duration-300"
                                      style={{
                                        backgroundColor: currentLighting.overlayBg,
                                        mixBlendMode: currentLighting.blendMode,
                                        clipPath: `inset(0 0 0 ${sliderPosition}%)`
                                      }}
                                    />
                                  )}
                                  {/* Original Photo layer clipped from left */}
                                  <img
                                    src={currentAngleOriginalPhoto.url}
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                                    alt="Original room"
                                  />

                                  {/* Badges */}
                                  <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-xs">
                                    Before (Original)
                                  </div>
                                  <div className="absolute top-2 right-2 bg-white/90 text-[#222222] text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                                    After ({currentStyle.name})
                                  </div>

                                  {/* Slider Divider Line */}
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 cursor-ew-resize flex items-center justify-center pointer-events-none"
                                    style={{ left: `${sliderPosition}%` }}
                                  >
                                    <div className="w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center text-[#222222]">
                                      <Split className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                  {/* Hidden Range Input for dragging */}
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={sliderPosition}
                                    onChange={(e) => setSliderPosition(Number(e.target.value))}
                                    className="absolute inset-0 opacity-0 cursor-ew-resize z-30 w-full h-full"
                                  />
                                </div>
                              ) : (
                                <div className="relative w-full h-full">
                                  <motion.img
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.35 }}
                                    src={currentRenderedImage}
                                    alt={currentStyle.name}
                                    style={{
                                      filter: lightingSimEnabled ? currentLighting.filter : undefined,
                                      transition: "filter 0.3s ease"
                                    }}
                                    className="w-full h-full object-cover pointer-events-none"
                                  />
                                  {lightingSimEnabled && currentLighting.overlayBg !== "transparent" && (
                                    <div
                                      className="absolute inset-0 pointer-events-none transition-all duration-300"
                                      style={{
                                        backgroundColor: currentLighting.overlayBg,
                                        mixBlendMode: currentLighting.blendMode
                                      }}
                                    />
                                  )}
                                </div>
                              )}

                              {/* Floating Time of Day & Lighting Temperature Badge */}
                              {lightingSimEnabled && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowModeDrawer(true);
                                  }}
                                  className={`absolute bottom-3 left-3 z-20 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 ${currentLighting.badgeBg}`}
                                  title="Click to adjust Time of Day lighting slider in style drawer"
                                >
                                  <span>{currentLighting.icon}</span>
                                  <span>{currentLighting.label}</span>
                                  <span className="opacity-80 font-mono">({currentLighting.kelvin.toLocaleString()}K)</span>
                                </button>
                              )}

                              {/* Interactive Pinned Annotations */}
                              {annotations
                                .filter((ann) => ann.styleId === currentStyle.id && ann.viewKey === activeView)
                                .map((ann) => (
                                  <div
                                    key={ann.id}
                                    style={{ left: `${ann.xPercent}%`, top: `${ann.yPercent}%` }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveAnnotationId(activeAnnotationId === ann.id ? null : ann.id);
                                    }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer group pointer-events-auto"
                                  >
                                    <div className="relative flex items-center justify-center">
                                      <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-amber-400 opacity-75"></span>
                                      <div className="relative w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-bold">
                                        📍
                                      </div>
                                    </div>

                                    {/* Active Annotation Popover */}
                                    {activeAnnotationId === ann.id && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-black/10 p-3 z-40 text-left pointer-events-auto"
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                            {ann.category}
                                          </span>
                                          <button
                                            onClick={() => handleDeleteAnnotation(ann.id)}
                                            className="text-red-500 hover:text-red-700 text-xs p-1"
                                            title="Delete tag"
                                          >
                                            <Trash className="w-3 h-3" />
                                          </button>
                                        </div>
                                        <h4 className="font-bold text-xs text-[#222222]">{ann.label}</h4>
                                        {ann.notes && (
                                          <p className="text-[11px] text-[#222222]/70 mt-1 leading-snug">
                                            {ann.notes}
                                          </p>
                                        )}
                                        {ann.shoppingItem?.dimensions && (
                                          <div className="text-[10px] text-[#222222]/60 mt-1">
                                            📐 Size: {ann.shoppingItem.dimensions}
                                          </div>
                                        )}
                                        {ann.shoppingItem?.estimatedCost && (
                                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                            💰 Est: {ann.shoppingItem.estimatedCost}
                                          </div>
                                        )}
                                        <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
                                          <button
                                            onClick={() => handleToggleShoppingStatus(ann.id)}
                                            className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                          >
                                            {ann.shoppingItem?.status === "purchased" ? (
                                              <>
                                                <CheckSquare className="w-3 h-3 text-emerald-600" />
                                                <span className="text-emerald-700">Purchased</span>
                                              </>
                                            ) : ann.shoppingItem?.status === "sourcing" ? (
                                              <>
                                                <Square className="w-3 h-3 text-amber-600" />
                                                <span className="text-amber-700">Sourcing</span>
                                              </>
                                            ) : (
                                              <>
                                                <ShoppingBag className="w-3 h-3 text-blue-600" />
                                                <span>On Wishlist</span>
                                              </>
                                            )}
                                          </button>
                                          <span className="text-[9px] text-[#222222]/40">Tap status to toggle</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}

                              {/* New Pin Draft Modal dialog */}
                              {newPinDraft && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute inset-x-3 bottom-3 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-black/10 z-50 pointer-events-auto"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                                        📍
                                      </span>
                                      <h4 className="font-bold text-xs text-[#222222]">
                                        Annotate Furniture or Area
                                      </h4>
                                    </div>
                                    <button
                                      onClick={() => setNewPinDraft(null)}
                                      className="text-xs text-[#222222]/50 hover:text-[#222222]"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={draftLabel}
                                        onChange={(e) => setDraftLabel(e.target.value)}
                                        placeholder="Item name (e.g. Queen Oak Bed, Terracotta Wall)..."
                                        className="flex-1 text-xs bg-[#F6F5F2] border border-black/10 rounded-xl px-2.5 py-1.5 outline-none"
                                        autoFocus
                                      />
                                      <select
                                        value={draftCategory}
                                        onChange={(e: any) => setDraftCategory(e.target.value)}
                                        className="text-xs bg-[#F6F5F2] border border-black/10 rounded-xl px-2 py-1.5 outline-none"
                                      >
                                        <option value="furniture">Furniture</option>
                                        <option value="wall_paint">Wall / Paint</option>
                                        <option value="lighting">Lighting</option>
                                        <option value="decor">Decor / Rug</option>
                                        <option value="flooring">Flooring</option>
                                      </select>
                                    </div>

                                    {/* Quick Suggestions */}
                                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                                      {[
                                        "Queen Bed (60×80\")",
                                        "Single Bed (38×75\")",
                                        "Accent Wall Paint",
                                        "Oak Nightstand",
                                        "Linen Curtains",
                                        "Ceiling Pendant",
                                        "Wool Area Rug"
                                      ].map((preset) => (
                                        <button
                                          key={preset}
                                          type="button"
                                          onClick={() => setDraftLabel(preset)}
                                          className="text-[9px] bg-black/5 hover:bg-black/10 px-2 py-0.5 rounded-md whitespace-nowrap text-[#222222]"
                                        >
                                          {preset}
                                        </button>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={draftDimensions}
                                        onChange={(e) => setDraftDimensions(e.target.value)}
                                        placeholder="Dimensions (e.g. 152 × 198 cm)"
                                        className="text-xs bg-[#F6F5F2] border border-black/10 rounded-xl px-2.5 py-1 outline-none"
                                      />
                                      <input
                                        type="text"
                                        value={draftEstimatedCost}
                                        onChange={(e) => setDraftEstimatedCost(e.target.value)}
                                        placeholder="Est. Cost (e.g. ₹28,000 / $350)"
                                        className="text-xs bg-[#F6F5F2] border border-black/10 rounded-xl px-2.5 py-1 outline-none"
                                      />
                                    </div>

                                    <input
                                      type="text"
                                      value={draftNotes}
                                      onChange={(e) => setDraftNotes(e.target.value)}
                                      placeholder="Notes / shopping link reference..."
                                      className="w-full text-xs bg-[#F6F5F2] border border-black/10 rounded-xl px-2.5 py-1.5 outline-none"
                                    />

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setNewPinDraft(null)}
                                        className="text-xs text-[#222222]/60 px-3 py-1"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSavePinDraft}
                                        disabled={!draftLabel.trim()}
                                        className="text-xs bg-[#222222] text-white px-3.5 py-1.5 rounded-xl font-semibold shadow-xs hover:bg-black disabled:opacity-40"
                                      >
                                        Save Pin to Shopping List
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Annotating Banner Mode Indicator */}
                              {isAnnotatingMode && (
                                <div className="absolute top-2 left-2 right-2 bg-amber-500/95 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md flex items-center justify-between z-30 pointer-events-auto">
                                  <div className="flex items-center gap-1.5">
                                    <Pin className="w-3.5 h-3.5 animate-bounce" />
                                    <span>Tap on any furniture item or wall area to drop a pin!</span>
                                  </div>
                                  <button
                                    onClick={() => setIsAnnotatingMode(false)}
                                    className="text-[10px] bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded-md"
                                  >
                                    Done
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                              <Loader2 className="w-6 h-6 animate-spin text-[#222222]/60" />
                              <span className="text-xs font-medium text-[#222222]/80">
                                Restyling {activeView === "overview" ? "Whole Room Overview" : activeView} in {currentStyle.name}...
                              </span>
                              <span className="text-[10px] text-[#222222]/50">
                                {STYLING_MODES.find(m => m.id === stylingMode)?.badge} · Preserving room shell · Matching other angles
                              </span>
                            </div>
                          )}

                          {/* Floating Comparison & View Badge */}
                          {currentRenderedImage && (
                            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                              <div className="flex items-center gap-1.5">
                                {currentAngleOriginalPhoto && (
                                  <button
                                    onClick={() => setIsComparing(!isComparing)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md transition-all flex items-center gap-1 shadow-xs ${
                                      isComparing
                                        ? "bg-[#222222] text-white"
                                        : "bg-white/90 text-[#222222] hover:bg-white"
                                    }`}
                                  >
                                    <Split className="w-3 h-3" />
                                    <span>{isComparing ? "Exit Split" : "Before/After"}</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => setIsAnnotatingMode(!isAnnotatingMode)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md transition-all flex items-center gap-1 shadow-xs ${
                                    isAnnotatingMode
                                      ? "bg-amber-600 text-white"
                                      : "bg-white/90 text-[#222222] hover:bg-white"
                                  }`}
                                  title="Tap on image to pin furniture or wall items"
                                >
                                  <Pin className="w-3 h-3" />
                                  <span>{isAnnotatingMode ? "Annotating..." : "Tag Items"}</span>
                                </button>
                              </div>

                              <span className="text-[10px] font-semibold bg-black/60 text-white backdrop-blur-md px-2 py-0.5 rounded-full">
                                {activeView === "overview"
                                  ? "Master Overview"
                                  : `Angle ${activeAngleIdx + 1}`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Style Details Body */}
                    <div className="px-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                              {currentStyle.name}
                            </h2>
                            <button
                              type="button"
                              onClick={() => setStyleCatalogOpen(true)}
                              className="text-[10px] font-semibold bg-[#222222]/10 hover:bg-amber-100 text-[#222222] hover:text-amber-950 px-2.5 py-0.5 rounded-full border border-black/5 transition-colors cursor-pointer flex items-center gap-1"
                              title="Browse all 15 architectural styles"
                            >
                              <span>Style {safeIndex + 1} of {activeStyles.length} ({STYLE_CONFIGS.length} Styles)</span>
                              <ChevronRight className="w-2.5 h-2.5 text-amber-600" />
                            </button>
                          </div>
                          <p className="text-xs text-amber-900/80 font-medium mt-0.5">
                            {currentStyle.subtitle}
                          </p>
                        </div>

                        {/* Save to Favorites Bookmark Button */}
                        <button
                          onClick={() => toggleFavorite(currentStyle.id)}
                          className={`p-2 rounded-full border transition-all ${
                            savedStyleIds.includes(currentStyle.id)
                              ? "bg-amber-100 border-amber-300 text-amber-800"
                              : "bg-white border-[#222222]/10 text-[#222222]/60 hover:text-[#222222]"
                          }`}
                          title="Save to My Favorites"
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              savedStyleIds.includes(currentStyle.id) ? "fill-amber-600 text-amber-600" : ""
                            }`}
                          />
                        </button>
                      </div>

                      <p className="text-xs text-[#222222]/70 leading-relaxed mb-3">
                        {currentStyle.description}
                      </p>

                      {/* 60-30-10 Swatch Pill Matrix */}
                      <div className="p-2.5 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10 flex flex-col gap-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#222222]/60 uppercase tracking-wider">
                            60-30-10 Color Formula
                          </span>
                          <button
                            onClick={() => setSpecDrawerOpen(true)}
                            className="text-[10px] font-semibold text-amber-800 hover:underline flex items-center gap-0.5"
                          >
                            <span>View All Specs</span>
                            <ChevronRight className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {/* 60% Swatch */}
                          <div
                            onClick={() => copyToClipboard(currentStyle.rule603010.dominant60.colors[0]?.code)}
                            className="p-1.5 rounded-xl bg-white border border-[#222222]/5 flex items-center gap-1.5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                          >
                            <div
                              className="w-4 h-4 rounded-md border border-black/10 shrink-0"
                              style={{ backgroundColor: currentStyle.rule603010.dominant60.colors[0]?.hex }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold truncate">60% Wall</div>
                              <div className="text-[8px] text-[#222222]/60 truncate font-mono">
                                {currentStyle.rule603010.dominant60.colors[0]?.code}
                              </div>
                            </div>
                          </div>

                          {/* 30% Swatch */}
                          <div
                            onClick={() => copyToClipboard(currentStyle.rule603010.secondary30.colors[0]?.code)}
                            className="p-1.5 rounded-xl bg-white border border-[#222222]/5 flex items-center gap-1.5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                          >
                            <div
                              className="w-4 h-4 rounded-md border border-black/10 shrink-0"
                              style={{ backgroundColor: currentStyle.rule603010.secondary30.colors[0]?.hex }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold truncate">30% Trim</div>
                              <div className="text-[8px] text-[#222222]/60 truncate font-mono">
                                {currentStyle.rule603010.secondary30.colors[0]?.code}
                              </div>
                            </div>
                          </div>

                          {/* 10% Swatch */}
                          <div
                            onClick={() => copyToClipboard(currentStyle.rule603010.accent10.colors[0]?.code)}
                            className="p-1.5 rounded-xl bg-white border border-[#222222]/5 flex items-center gap-1.5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                          >
                            <div
                              className="w-4 h-4 rounded-md border border-black/10 shrink-0"
                              style={{ backgroundColor: currentStyle.rule603010.accent10.colors[0]?.hex }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold truncate">10% Accent</div>
                              <div className="text-[8px] text-[#222222]/60 truncate font-mono">
                                {currentStyle.rule603010.accent10.colors[0]?.code}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Carousel Stepper & Quick Nav for Power Users */}
                      <div className="flex items-center justify-between text-xs mb-2 pt-1.5 border-t border-[#222222]/10">
                        <button
                          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                          disabled={safeIndex <= 0}
                          className="px-2.5 py-1 rounded-lg border border-[#222222]/10 bg-white text-[#222222] font-medium flex items-center gap-1 hover:bg-[#F6F5F2] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                          title="Previous style card"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono font-semibold text-[#222222]/60">
                            {safeIndex + 1} of {activeStyles.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setStyleCatalogOpen(true)}
                            className="text-[10px] text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md font-semibold cursor-pointer border border-amber-300/50 transition-colors"
                            title={`Browse all ${STYLE_CONFIGS.length} architectural styles including exteriors & Indian havelis`}
                          >
                            All {STYLE_CONFIGS.length} Styles
                          </button>
                        </div>

                        <button
                          onClick={() => setCurrentIndex((prev) => Math.min(activeStyles.length - 1, prev + 1))}
                          disabled={safeIndex >= activeStyles.length - 1}
                          className="px-2.5 py-1 rounded-lg border border-[#222222]/10 bg-white text-[#222222] font-medium flex items-center gap-1 hover:bg-[#F6F5F2] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                          title="Next style card"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Action Dock */}
                      <div className="flex items-center gap-2 pt-1 mt-auto">
                        <button
                          onClick={() => setTweakModalOpen(true)}
                          className="flex-1 py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          title="Tweak colors, bed size, or tell Gemini what to change"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          <span>✨ Tweak with Gemini</span>
                        </button>

                        <button
                          onClick={() => generateVideo(currentStyle.id, currentStyle.description)}
                          disabled={videoStatus[currentStyle.id] === "generating" || videoStatus[currentStyle.id] === "polling"}
                          className="py-2.5 px-2.5 rounded-2xl bg-[#F6F5F2] hover:bg-[#EAE9E4] text-[#222222] text-xs font-semibold flex items-center justify-center gap-1 border border-[#222222]/10 transition-colors disabled:opacity-50 shrink-0"
                          title="Generate or replay 3D-style cinematic walkthrough"
                        >
                          <Video className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {videoStatus[currentStyle.id] === "generating" || videoStatus[currentStyle.id] === "polling"
                              ? "Rendering..."
                              : videos[currentStyle.id]
                              ? "Replay Tour"
                              : "Video Tour"}
                          </span>
                        </button>

                        <button
                          onClick={() => setThreeDViewerOpen(true)}
                          className="py-2.5 px-3 rounded-2xl bg-[#222222] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-black transition-colors shrink-0"
                          title="3D Pan & Orbit Viewfinder"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>3D Orbit</span>
                        </button>

                        <button
                          onClick={() => setShareModalOpen(true)}
                          className="py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
                          title="Share this room style snapshot to social media or copy link"
                        >
                          <Share2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Empty state when search returns zero results */
                  <div className="[grid-area:1/1] w-full bg-white rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm min-h-[350px]">
                    <Search className="w-8 h-8 text-[#222222]/30 mb-2" />
                    <h3 className="font-bold text-base text-[#222222] mb-1">No matching styles found</h3>
                    <p className="text-xs text-[#222222]/60 max-w-xs mb-4">
                      No styles matched "{searchQuery}". Try searching for keywords like "oak", "minimalist", "warm", or "brick".
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentIndex(0);
                      }}
                      className="px-4 py-2 bg-[#222222] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-black"
                    >
                      Show All {STYLE_CONFIGS.length} Styles
                    </button>
                  </div>
                )}
              </AnimatePresence>

              {/* Swipe Guide Pill */}
              <AnimatePresence>
                {activeStyles.length > 0 && safeIndex < activeStyles.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-[calc(100%+8px)] text-[10px] text-[#222222]/50 tracking-widest font-semibold uppercase text-center w-full flex items-center justify-center gap-1.5"
                  >
                    <span>SWIPE UP FOR NEXT STYLE ({safeIndex + 1}/{activeStyles.length})</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ===================== FAVORITES / MY SAVED STYLES VIEW ===================== */}
        {screen === "favorites" && (
          <div className="flex-1 flex flex-col items-center p-4 sm:p-6 relative min-h-screen py-8 max-w-lg mx-auto w-full">
            <div className="w-full flex items-center justify-between mb-4">
              <button
                onClick={() => setScreen("cards")}
                className="text-xs font-semibold text-[#222222] bg-white px-3 py-1.5 rounded-full shadow-2xs border border-[#222222]/10 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to Carousel</span>
              </button>
              <h2 className="text-base font-bold text-[#222222]">My Saved Styles</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-amber-100 text-amber-900 font-semibold px-2.5 py-0.5 rounded-full">
                  {savedStyleIds.length} Saved
                </span>
                <button
                  onClick={() => setPdfExportModalOpen(true)}
                  className="text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-full shadow-2xs border border-rose-200/80 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  title="Export PDF Dossier or Complete ZIP Design Pack"
                >
                  <Download className="w-3.5 h-3.5 text-rose-600" />
                  <span>Export PDF & Pack</span>
                </button>
                <button
                  onClick={() => setShareModalOpen(true)}
                  className="text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full shadow-2xs border border-amber-300 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="Share design snapshot or link"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {savedStyleIds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-[32px] border border-[#222222]/10 shadow-xs w-full">
                <Bookmark className="w-12 h-12 text-[#222222]/20 mb-3" />
                <h3 className="font-bold text-base text-[#222222] mb-1">No Saved Styles Yet</h3>
                <p className="text-xs text-[#222222]/60 max-w-xs mb-4">
                  Tap the bookmark icon on any style card in the carousel to save your favorite room concepts here.
                </p>
                <button
                  onClick={() => setScreen("cards")}
                  className="px-4 py-2 bg-[#222222] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-black"
                >
                  Explore Styles
                </button>
              </div>
            ) : (
              <div className="w-full space-y-3 overflow-y-auto">
                {STYLE_CONFIGS.filter((s) => savedStyleIds.includes(s.id)).map((style) => {
                  const renderedImg = styleImages[style.id]?.[activeView] || styleImages[style.id]?.["overview"] || styleImages[style.id]?.["angle-0"];
                  return (
                    <div
                      key={style.id}
                      className="p-3 bg-white rounded-2xl border border-[#222222]/10 shadow-2xs flex items-center gap-3"
                    >
                      <div className="w-20 h-16 rounded-xl overflow-hidden bg-black/10 shrink-0">
                        {renderedImg ? (
                          <img src={renderedImg} alt={style.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-[#222222]/40">
                            Saved
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[#222222] truncate">{style.name}</h4>
                        <p className="text-[11px] text-[#222222]/60 truncate">{style.subtitle}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {style.rule603010.dominant60.colors.map((c, i) => (
                            <div
                              key={i}
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: style.rule603010.secondary30.colors[0]?.hex }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: style.rule603010.accent10.colors[0]?.hex }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const idx = activeStyles.findIndex((s) => s.id === style.id);
                            if (idx >= 0) setCurrentIndex(idx);
                            setScreen("cards");
                          }}
                          className="px-2.5 py-1 bg-[#222222] text-white text-[11px] font-semibold rounded-lg"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            const idx = activeStyles.findIndex((s) => s.id === style.id);
                            if (idx >= 0) setCurrentIndex(idx);
                            setShareModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-0.5 border border-amber-200"
                          title="Share snapshot or link for this style"
                        >
                          <Share2 className="w-3 h-3 text-amber-600" />
                          <span>Share</span>
                        </button>
                        <button
                          onClick={() => toggleFavorite(style.id)}
                          className="text-[10px] text-red-600 hover:underline px-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* ===================== WHOLE-ROOM ARCHITECTURAL 60-30-10 SPECS DRAWER ===================== */}
      <AnimatePresence>
        {specDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-2xs"
              onClick={() => setSpecDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[32px] p-6 z-50 flex flex-col gap-4 shadow-xl max-h-[88vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]/10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-lg text-[#222222]">
                      {currentStyle?.name} Architectural Blueprint
                    </h3>
                  </div>
                  <p className="text-xs text-[#222222]/60">
                    {currentStyle?.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => setSpecDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Sub-Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#F6F5F2] rounded-xl border border-black/5">
                <button
                  onClick={() => setActiveSpecTab("60-30-10")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeSpecTab === "60-30-10"
                      ? "bg-white text-[#222222] shadow-xs"
                      : "text-[#222222]/60 hover:text-[#222222]"
                  }`}
                >
                  60-30-10 Palette
                </button>
                <button
                  onClick={() => setActiveSpecTab("lighting")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeSpecTab === "lighting"
                      ? "bg-white text-[#222222] shadow-xs"
                      : "text-[#222222]/60 hover:text-[#222222]"
                  }`}
                >
                  Lighting & Kelvin
                </button>
                <button
                  onClick={() => setActiveSpecTab("spatial")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeSpecTab === "spatial"
                      ? "bg-white text-[#222222] shadow-xs"
                      : "text-[#222222]/60 hover:text-[#222222]"
                  }`}
                >
                  Layout Spacing
                </button>
              </div>

              {/* TAB 1: 60-30-10 PALETTE */}
              {activeSpecTab === "60-30-10" && (
                <div className="space-y-4">
                  {/* 60% Dominant Foundation */}
                  <div className="p-3.5 rounded-2xl bg-[#FBFBFA] border border-[#222222]/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                        {currentStyle.rule603010.dominant60.title}
                      </span>
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                        60% Ratio
                      </span>
                    </div>
                    <p className="text-xs text-[#222222]/70 mb-2.5">
                      {currentStyle.rule603010.dominant60.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {currentStyle.rule603010.dominant60.colors.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => copyToClipboard(c.code)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#222222]/5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                        >
                          <div
                            className="w-6 h-6 rounded-md border border-black/10 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-[#222222] truncate">{c.name}</div>
                            <div className="text-[9px] font-mono text-[#222222]/60 truncate">{c.code} · {c.hex}</div>
                          </div>
                          {copiedCode === c.code ? (
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#222222]/30 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#222222]/50 italic">
                      Recommended finish: {currentStyle.rule603010.dominant60.finishes}
                    </div>
                  </div>

                  {/* 30% Secondary Elements */}
                  <div className="p-3.5 rounded-2xl bg-[#FBFBFA] border border-[#222222]/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                        {currentStyle.rule603010.secondary30.title}
                      </span>
                      <span className="text-[10px] font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-semibold">
                        30% Ratio
                      </span>
                    </div>
                    <p className="text-xs text-[#222222]/70 mb-2.5">
                      {currentStyle.rule603010.secondary30.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {currentStyle.rule603010.secondary30.colors.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => copyToClipboard(c.code)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#222222]/5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                        >
                          <div
                            className="w-6 h-6 rounded-md border border-black/10 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-[#222222] truncate">{c.name}</div>
                            <div className="text-[9px] font-mono text-[#222222]/60 truncate">{c.code} · {c.hex}</div>
                          </div>
                          {copiedCode === c.code ? (
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#222222]/30 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {currentStyle.rule603010.secondary30.materials.map((m, i) => (
                        <span key={i} className="text-[10px] bg-white border border-[#222222]/10 text-[#222222]/80 px-2 py-0.5 rounded-md">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 10% Accent Details */}
                  <div className="p-3.5 rounded-2xl bg-[#FBFBFA] border border-[#222222]/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        {currentStyle.rule603010.accent10.title}
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                        10% Ratio
                      </span>
                    </div>
                    <p className="text-xs text-[#222222]/70 mb-2.5">
                      {currentStyle.rule603010.accent10.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {currentStyle.rule603010.accent10.colors.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => copyToClipboard(c.code)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#222222]/5 cursor-pointer hover:border-[#222222]/20 transition-all shadow-2xs"
                        >
                          <div
                            className="w-6 h-6 rounded-md border border-black/10 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-[#222222] truncate">{c.name}</div>
                            <div className="text-[9px] font-mono text-[#222222]/60 truncate">{c.code} · {c.hex}</div>
                          </div>
                          {copiedCode === c.code ? (
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#222222]/30 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#222222]/50 italic">
                      Hardware & Accents: {currentStyle.rule603010.accent10.details}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LIGHTING & KELVIN */}
              {activeSpecTab === "lighting" && (
                <div className="space-y-3">
                  {/* Interactive Time of Day Lighting Simulator */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-indigo-50/70 border border-[#222222]/10 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white shadow-xs border border-black/5 flex items-center justify-center text-lg">
                          {currentLighting.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-[#222222]">
                              Time of Day Simulator: {currentLighting.label}
                            </h4>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shadow-2xs ${currentLighting.badgeBg}`}>
                              {currentLighting.kelvin.toLocaleString()}K
                            </span>
                          </div>
                          <p className="text-[10px] text-[#222222]/65 leading-tight">
                            {currentLighting.description}
                          </p>
                        </div>
                      </div>
                      {lightingSliderValue !== 50 && (
                        <button
                          type="button"
                          onClick={() => setLightingSliderValue(50)}
                          className="text-[10px] font-medium text-[#222222]/60 hover:text-[#222222] px-2 py-1 rounded-lg bg-white border border-[#222222]/10 hover:bg-[#F6F5F2] transition-all"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Time of Day Lighting Slider */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="relative flex items-center px-0.5">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={lightingSliderValue}
                          onChange={(e) => setLightingSliderValue(Number(e.target.value))}
                          className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-amber-600 bg-gradient-to-r from-amber-400 via-amber-100 via-50% to-indigo-600 shadow-inner"
                        />
                      </div>

                      {/* Milestone Quick Preset Buttons */}
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setLightingSliderValue(0)}
                          className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                            lightingSliderValue <= 20
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-white/80 border-[#222222]/10 text-amber-900 hover:bg-amber-50"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <span>🌅</span> Golden Hour
                          </div>
                          <div className={`text-[9px] ${lightingSliderValue <= 20 ? "text-amber-100" : "text-[#222222]/55"}`}>
                            Warm Amber (~2800K)
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLightingSliderValue(50)}
                          className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                            lightingSliderValue >= 40 && lightingSliderValue <= 60
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                              : "bg-white/80 border-[#222222]/10 text-[#222222] hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <span>☀️</span> Bright Noon
                          </div>
                          <div className={`text-[9px] ${lightingSliderValue >= 40 && lightingSliderValue <= 60 ? "text-emerald-100" : "text-[#222222]/55"}`}>
                            Crisp Sun (5500K)
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLightingSliderValue(100)}
                          className={`px-2 py-1.5 rounded-xl text-left border transition-all ${
                            lightingSliderValue >= 80
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                              : "bg-white/80 border-[#222222]/10 text-indigo-900 hover:bg-indigo-50"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <span>🌌</span> Blue Hour
                          </div>
                          <div className={`text-[9px] ${lightingSliderValue >= 80 ? "text-indigo-100" : "text-[#222222]/55"}`}>
                            Twilight Indigo (~8500K)
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="w-4 h-4 text-amber-600" />
                      <h4 className="font-semibold text-xs text-[#222222]">
                        Color Temperature Target
                      </h4>
                    </div>
                    <div className="text-base font-bold text-[#222222] font-mono mb-1">
                      {currentStyle.rule603010.lightingSpecs.kelvin}
                    </div>
                    <p className="text-xs text-[#222222]/70 leading-relaxed">
                      Recommended color rendering index: <strong>CRI ≥ 92</strong> for accurate textile and timber rendition.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10">
                    <h4 className="font-semibold text-xs text-[#222222] mb-1.5">
                      Recommended Fixture Topology
                    </h4>
                    <p className="text-xs text-[#222222]/70 leading-relaxed">
                      {currentStyle.rule603010.lightingSpecs.fixtureTypes}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10">
                    <h4 className="font-semibold text-xs text-[#222222] mb-1.5">
                      Illumination & Contrast Strategy
                    </h4>
                    <p className="text-xs text-[#222222]/70 leading-relaxed">
                      {currentStyle.rule603010.lightingSpecs.luxAdvice}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: SPATIAL CLEARANCES */}
              {activeSpecTab === "spatial" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10">
                    <h4 className="font-semibold text-xs text-[#222222] mb-2 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Circulation & Clearance Code
                    </h4>
                    <p className="text-xs text-[#222222]/70 leading-relaxed">
                      {currentStyle.rule603010.circulationAdvice}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-3 bg-white rounded-xl border border-[#222222]/10">
                      <div className="font-bold text-[#222222]">Primary Path</div>
                      <div className="text-[#222222]/60">36" to 42" clear width</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-[#222222]/10">
                      <div className="font-bold text-[#222222]">Coffee Table Gap</div>
                      <div className="text-[#222222]/60">14" to 18" from sofa</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-[#222222]/10">
                      <div className="font-bold text-[#222222]">Rug Perimeter</div>
                      <div className="text-[#222222]/60">Front legs of seating on rug</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-[#222222]/10">
                      <div className="font-bold text-[#222222]">Pendant Height</div>
                      <div className="text-[#222222]/60">30" to 36" above surface</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===================== 3D SPATIAL ORBIT VIEWER MODAL ===================== */}
      <AnimatePresence>
        {threeDViewerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 flex flex-col justify-between"
          >
            {/* Top 3D HUD Navigation */}
            <div className="p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white bg-blue-600/90 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  3D Spatial Pan
                </span>
                <span className="text-xs text-white/80 font-medium">
                  {currentStyle.name} · {activeView === "overview" ? "Overview" : activeView}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCameraYaw(0);
                    setCameraPitch(0);
                    setCameraFov(75);
                  }}
                  className="text-[11px] text-white/70 hover:text-white px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md"
                >
                  Reset Angles
                </button>
                <button
                  onClick={() => setThreeDViewerOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Interactive 3D Canvas / Viewport */}
            <div
              className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                isDragging3D.current = true;
                lastMousePos.current = { x: e.clientX, y: e.clientY };
              }}
              onMouseMove={(e) => {
                if (!isDragging3D.current) return;
                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;
                lastMousePos.current = { x: e.clientX, y: e.clientY };

                setCameraYaw((y) => {
                  const next = y + dx * 0.4;
                  return next > 180 ? next - 360 : next < -180 ? next + 360 : next;
                });
                setCameraPitch((p) => Math.max(-30, Math.min(30, p - dy * 0.3)));
              }}
              onMouseUp={() => {
                isDragging3D.current = false;
              }}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  isDragging3D.current = true;
                  lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
              }}
              onTouchMove={(e) => {
                if (!isDragging3D.current || !e.touches[0]) return;
                const dx = e.touches[0].clientX - lastMousePos.current.x;
                const dy = e.touches[0].clientY - lastMousePos.current.y;
                lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

                setCameraYaw((y) => {
                  const next = y + dx * 0.45;
                  return next > 180 ? next - 360 : next < -180 ? next + 360 : next;
                });
                setCameraPitch((p) => Math.max(-30, Math.min(30, p - dy * 0.35)));
              }}
              onTouchEnd={() => {
                isDragging3D.current = false;
              }}
            >
              {/* Perspective 3D Room Box Container */}
              <div
                className="relative w-full max-w-4xl aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center transition-transform duration-75 ease-out"
                style={{
                  perspective: `${1400 - (cameraFov - 60) * 15}px`,
                  perspectiveOrigin: "50% 50%"
                }}
              >
                {currentRenderedImage ? (
                  <div
                    className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl transition-transform duration-75 ease-out"
                    style={{
                      // Contained parallax tilt: multiplied down so it reads as an intentional
                      // 3D-feel card rather than a flat photo flipping to show its edge.
                      transform: `rotateY(${cameraYaw * 0.15}deg) rotateX(${cameraPitch * 0.15}deg) scale(${1.08 + (95 - cameraFov) * 0.004})`,
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden"
                    }}
                  >
                    <img
                      src={currentRenderedImage}
                      alt="3D Restyled Room"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/60 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                    <span>Rendering room perspective...</span>
                  </div>
                )}

                {/* Subtle 3D Ambient Room Lighting Vignette */}
                <div className="absolute inset-0 bg-radial from-transparent via-black/10 to-black/40 pointer-events-none rounded-2xl" />

                {/* 3D Spatial Center Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  <div className="w-6 h-6 border border-white/50 rounded-full" />
                </div>
              </div>

              {/* Interaction Hint */}
              <div className="absolute bottom-6 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white/80 text-[11px] font-medium pointer-events-none border border-white/10">
                Drag to tilt the view · For a true walkthrough, use the Video Tour
              </div>
            </div>

            {/* Bottom 3D Angle Teleport Dock & FOV Controls */}
            <div className="p-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-3 z-20">
              {/* Angle Teleport Quick-Pills */}
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => {
                    setActiveView("overview");
                    setCameraYaw(0);
                    setCameraPitch(0);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                    activeView === "overview"
                      ? "bg-white text-black shadow-md"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  Overview
                </button>

                {photos.map((p, idx) => {
                  const key = `angle-${idx}`;
                  const cardinalYaw = idx === 0 ? 0 : idx === 1 ? 180 : idx === 2 ? 90 : -90;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveView(key);
                        setCameraYaw(cardinalYaw);
                        setCameraPitch(0);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-md transition-all ${
                        activeView === key
                          ? "bg-white text-black shadow-md"
                          : "bg-white/15 text-white hover:bg-white/25"
                      }`}
                    >
                      <span>{p.label}</span>
                      <span className="text-[10px] opacity-60">
                        {idx === 0 ? "0°" : idx === 1 ? "180°" : idx === 2 ? "90°" : "270°"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* FOV Zoom Slider */}
              <div className="max-w-xs mx-auto w-full flex items-center justify-between text-white/70 text-xs px-2">
                <span>Standard (60°)</span>
                <input
                  type="range"
                  min="55"
                  max="95"
                  value={cameraFov}
                  onChange={(e) => setCameraFov(Number(e.target.value))}
                  className="w-32 accent-blue-500 cursor-pointer"
                />
                <span>Wide Angle (95°)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== SHOPPING & TAGGED ITEMS DRAWER ===================== */}
      <AnimatePresence>
        {shoppingDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-2xs"
              onClick={() => setShoppingDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[32px] p-6 z-50 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#222222]">
                      Furniture & Shopping List
                    </h3>
                    <p className="text-xs text-[#222222]/60">
                      {annotations.length} item{annotations.length === 1 ? "" : "s"} tagged across your room concepts
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShoppingDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {annotations.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-4">
                  <Pin className="w-10 h-10 text-amber-500/40 mb-2" />
                  <h4 className="font-bold text-sm text-[#222222]">No tagged items yet</h4>
                  <p className="text-xs text-[#222222]/60 max-w-xs mt-1 mb-4">
                    In the room view, tap "Tag Items" and click directly on furniture, walls, or lighting to pin them here!
                  </p>
                  <button
                    onClick={() => {
                      setShoppingDrawerOpen(false);
                      setIsAnnotatingMode(true);
                    }}
                    className="px-4 py-2 bg-[#222222] text-white text-xs font-semibold rounded-full shadow-xs"
                  >
                    Start Tagging Room Items
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Action row */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-[#222222]/60">
                      Track sourcing status & clearances
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const textList = annotations
                            .map(
                              (a, idx) =>
                                `${idx + 1}. [${a.category.toUpperCase()}] ${a.label} ${
                                  a.shoppingItem?.dimensions ? `(Dimensions: ${a.shoppingItem.dimensions})` : ""
                                } ${a.shoppingItem?.estimatedCost ? `- Est: ${a.shoppingItem.estimatedCost}` : ""}${
                                  a.notes ? ` - Notes: ${a.notes}` : ""
                                }`
                            )
                            .join("\n");
                          navigator.clipboard.writeText(textList);
                          setCopiedCode("shopping-list");
                          setTimeout(() => setCopiedCode(null), 2000);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/50 flex items-center gap-1 hover:bg-emerald-100"
                      >
                        {copiedCode === "shopping-list" ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setPdfExportModalOpen(true)}
                        className="text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/80 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="Export PDF Dossier or Complete ZIP Design Pack"
                      >
                        <Download className="w-3 h-3 text-rose-600" />
                        <span>Export PDF & Pack</span>
                      </button>
                    </div>
                  </div>

                  {/* List of tagged items */}
                  <div className="space-y-2">
                    {annotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 bg-[#FBFBFA] border border-[#222222]/10 rounded-2xl flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded">
                              {ann.category}
                            </span>
                            <span className="text-[10px] text-[#222222]/50 font-mono">
                              {ann.viewKey}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-[#222222]">{ann.label}</h4>
                          {ann.notes && (
                            <p className="text-[11px] text-[#222222]/70 mt-0.5">{ann.notes}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px]">
                            {ann.shoppingItem?.dimensions && (
                              <span className="text-[#222222]/70">
                                📐 <strong>{ann.shoppingItem.dimensions}</strong>
                              </span>
                            )}
                            {ann.shoppingItem?.estimatedCost && (
                              <span className="text-emerald-700 font-semibold">
                                💰 {ann.shoppingItem.estimatedCost}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            onClick={() => handleToggleShoppingStatus(ann.id)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                              ann.shoppingItem?.status === "purchased"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : ann.shoppingItem?.status === "sourcing"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-white text-[#222222]/70 border-black/10"
                            }`}
                          >
                            {ann.shoppingItem?.status === "purchased"
                              ? "✓ Purchased"
                              : ann.shoppingItem?.status === "sourcing"
                              ? "⏳ Sourcing"
                              : "+ Wishlist"}
                          </button>
                          <button
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="text-[10px] text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===================== GEMINI TWEAK & TALK CONVERSATIONAL DIRECTIVES MODAL ===================== */}
      <AnimatePresence>
        {tweakModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-2xs"
              onClick={() => setTweakModalOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[32px] p-6 z-50 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#222222]">
                      Tweak this Room with Gemini
                    </h3>
                    <p className="text-xs text-[#222222]/60">
                      A running conversation — each request builds on the last
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTweakModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Conversation Thread (memory of everything asked so far for this view) */}
              {(chatThreads[threadKey]?.length ?? 0) > 0 && (
                <div className="max-h-44 overflow-y-auto space-y-2 p-3 bg-[#F6F5F2] rounded-2xl border border-black/5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#222222]/50 mb-1">
                    Conversation so far
                  </div>
                  {chatThreads[threadKey].map((m, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {m.role === "user" ? (
                        <>
                          <span className="text-xs shrink-0">🗣️</span>
                          <span className="text-[11px] text-[#222222] font-semibold leading-snug">{m.text}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs shrink-0">✨</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-[#222222]/60 leading-snug">{m.text}</span>
                            {m.img && (
                              <img src={m.img} alt="result" className="w-10 h-8 object-cover rounded-md border border-black/10 shrink-0" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <p className="text-[9px] text-[#222222]/40 pt-1">
                    Each new instruction is layered on top of the ones above and re-applied to your original photo (so quality never degrades).
                  </p>
                </div>
              )}

              {/* Speech-to-Text / Voice Dictation Button */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={toggleVoiceRecording}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isListeningVoice
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                    title={isListeningVoice ? "Stop recording" : "Speak your directives to Gemini"}
                  >
                    {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#222222]">
                      {isListeningVoice ? "Listening to your voice..." : "Voice Dictation"}
                    </div>
                    <div className="text-[10px] text-[#222222]/60 truncate">
                      {isListeningVoice
                        ? "Speak clearly (e.g. 'Paint wall terracotta and add queen bed')"
                        : "Tap microphone to speak your styling directives"}
                    </div>
                  </div>
                </div>
                {speechError && (
                  <span className="text-[10px] text-red-600 max-w-[120px] text-right truncate">
                    {speechError}
                  </span>
                )}
              </div>

              {/* Quick Furniture & Appliance Directives Chips */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider">
                    Add Furniture, Appliances & Room Arrangement
                  </label>
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-semibold px-2 py-0.2 rounded-full">
                    Takes Fridge & Layout into Account
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    { label: "🧊 + Add Refrigerator", text: "Add a modern stainless steel double-door refrigerator in the corner" },
                    { label: "🛋️ + Add L-Sectional", text: "Add an L-shaped sectional sofa facing the window" },
                    { label: "🍳 + Add Kitchen Island", text: "Add a central kitchen island with 3 modern barstools" },
                    { label: "🍽️ + Add Dining Table", text: "Add a solid wood dining table with 4 chairs" },
                    { label: "🖥️ + Add Desk", text: "Place a minimalist work desk and ergonomic chair under the window" },
                    { label: "📺 + Wall-mount TV", text: "Wall-mount a large TV with a low-profile credenza" }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setTweakPrompt((prev) => (prev ? `${prev}, ${chip.text}` : chip.text));
                      }}
                      className="text-[10px] bg-white border border-[#222222]/15 hover:border-amber-500 hover:bg-amber-50 px-2 py-0.5 rounded-lg text-[#222222] font-semibold transition-all cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area for Directives */}
              <div>
                <label className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider block mb-1">
                  {(chatThreads[threadKey]?.length ?? 0) > 0 ? "Add another change" : "Specific Instructions for Gemini"}
                </label>
                <textarea
                  value={tweakPrompt}
                  onChange={(e) => setTweakPrompt(e.target.value)}
                  placeholder="e.g. Change the main wall behind the bed to warm terracotta. Keep my wooden wardrobe, add warm 2700K sconces and linen pillows..."
                  rows={3}
                  className="w-full text-xs bg-[#F6F5F2] border border-black/10 rounded-xl p-3 outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* One-Tap Color Swatches */}
              <div>
                <label className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider block mb-1">
                  Quick Wall & Accent Color Tweak
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { name: "Sage Green", hex: "#8A9A86" },
                    { name: "Terracotta", hex: "#C16A54" },
                    { name: "Chalk Cream", hex: "#EDE8DC" },
                    { name: "Moody Charcoal", hex: "#363636" },
                    { name: "Navy Indigo", hex: "#2B3A4A" },
                    { name: "Warm Ochre", hex: "#C29B38" }
                  ].map((color) => {
                    const isSelected = selectedTweakColor === color.name;
                    return (
                      <button
                        key={color.name}
                        onClick={() => setSelectedTweakColor(isSelected ? "" : color.name)}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition-all text-left ${
                          isSelected
                            ? "bg-amber-50 border-amber-500 shadow-2xs"
                            : "bg-white border-black/10 hover:bg-[#F6F5F2]"
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-md border border-black/10 shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-[10px] font-semibold text-[#222222] truncate">
                          {color.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bed Size & Ergonomic Dimension Selector (Skill Part C2) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-[#222222]/70 uppercase tracking-wider">
                    Bed Scale & Clearance Spec
                  </label>
                  <span className="text-[10px] text-amber-800 font-medium">
                    ≥ 60 cm side clearance rule
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[
                    {
                      id: "Single (~90 × 190 cm / 36 × 75\")",
                      label: "Single / Twin Bed",
                      dims: "90 × 190 cm (36 × 75\")",
                      bestFor: "Best for rooms < 8 ft (2.4m) or compact multi-use spaces"
                    },
                    {
                      id: "Double (~120 × 190 cm / 48 × 72\")",
                      label: "Double Bed",
                      dims: "120 × 190 cm (48 × 72\")",
                      bestFor: "Fits 8–9 ft (2.4–2.7m) rooms with walk-around access"
                    },
                    {
                      id: "Queen (~152 × 198 cm / 60 × 78\")",
                      label: "Queen Bed (Popular Couple Default)",
                      dims: "152 × 198 cm (60 × 78\")",
                      bestFor: "Ideal for 10 × 10 ft rooms, allows 28\" side nightstand clearance"
                    },
                    {
                      id: "King (~183 × 198 cm / 72 × 78\")",
                      label: "King Bed",
                      dims: "183 × 198 cm (72 × 78\")",
                      bestFor: "Requires 11–12 ft+ room width for proper walkway circulation"
                    }
                  ].map((bed) => {
                    const isSelected = selectedBedSize === bed.id;
                    return (
                      <button
                        key={bed.id}
                        onClick={() => setSelectedBedSize(isSelected ? "None" : bed.id)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                          isSelected
                            ? "bg-amber-50/90 border-amber-600 shadow-2xs"
                            : "bg-[#FBFBFA] border-black/10 hover:bg-[#F6F5F2]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-[#222222]">{bed.label}</div>
                          <div className="text-[10px] text-[#222222]/60 font-mono">{bed.dims}</div>
                          <div className="text-[9px] text-amber-900/70 mt-0.5">{bed.bestFor}</div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? "border-amber-600 bg-amber-600 text-white" : "border-black/20"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 0.5x Ultra-wide Camera Lens Calibration Toggle */}
              <div className="p-3 bg-[#F6F5F2] rounded-2xl border border-black/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                    <span>0.5x Ultra-Wide Lens Calibration</span>
                    <span className="text-[9px] bg-blue-100 text-blue-800 font-mono px-1.5 py-0.2 rounded">
                      Active
                    </span>
                  </div>
                  <p className="text-[10px] text-[#222222]/60 mt-0.5">
                    Compensates for ultra-wide ~13mm barrel perspective expansion so furniture is proportioned to real room depth.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={lensIsUltraWide}
                  onChange={(e) => setLensIsUltraWide(e.target.checked)}
                  className="w-4 h-4 accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Submit Tweak */}
              <button
                onClick={handleApplyGeminiTweak}
                disabled={isRegenerating}
                className="w-full py-3 bg-[#222222] text-white rounded-2xl font-semibold text-xs shadow-md hover:bg-black active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {isRegenerating
                    ? "Applying to your room..."
                    : (chatThreads[threadKey]?.length ?? 0) > 0
                    ? "Apply & Add to Conversation"
                    : "Generate Custom Tweak"}
                </span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===================== SPATIAL DIMENSIONS & 0.5X LENS ANALYSIS DRAWER ===================== */}
      <AnimatePresence>
        {dimensionDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-2xs"
              onClick={() => setDimensionDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[32px] p-6 z-50 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Ruler className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#222222]">
                      Room Dimensions & 0.5x Lens Breakdown
                    </h3>
                    <p className="text-xs text-[#222222]/60">
                      Estimated from door anchors (2.1m), ceiling height & vanishing geometry
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDimensionDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isAnalyzingDimensions ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold text-[#222222]">
                    Gemini Spatial Vision analyzing vanishing lines & door reference anchors...
                  </span>
                  <span className="text-[10px] text-[#222222]/50">
                    Calibrating 0.5x ultra-wide optical barrel distortion
                  </span>
                </div>
              ) : spatialData ? (
                <div className="space-y-4">
                  {/* Honest estimate disclaimer */}
                  <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900 leading-relaxed">
                    <strong>Estimate only.</strong> A single photo has no true scale, so these are best-guess figures from visible reference objects. For an exact layout, measure with a tape (or a LiDAR scan app) and treat the numbers below as a starting point.
                  </div>

                  {/* Estimated Room Area Card */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                        Estimated Physical Room Envelope
                      </span>
                      <span className="text-[10px] font-mono bg-indigo-200/60 text-indigo-900 px-2 py-0.5 rounded-full font-semibold">
                        Floor Area: {spatialData.estimatedDimensions?.areaSqFt || "160 sq ft"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                        <div className="text-[10px] text-[#222222]/60">Room Span (W × L)</div>
                        <div className="font-bold text-indigo-900 text-sm">
                          {spatialData.estimatedDimensions?.widthFt || "11 - 12 ft"} ×{" "}
                          {spatialData.estimatedDimensions?.lengthFt || "14 - 15 ft"}
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                        <div className="text-[10px] text-[#222222]/60">Ceiling Height</div>
                        <div className="font-bold text-indigo-900 text-sm">
                          {spatialData.estimatedDimensions?.ceilingHeight || "8.5 - 9.0 ft (~2.7m)"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 0.5x Camera Lens Optics Explanation */}
                  <div className="p-3.5 rounded-2xl bg-[#F6F5F2] border border-[#222222]/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#222222]">
                      <Scale className="w-3.5 h-3.5 text-amber-600" />
                      <span>How Distance is Estimated on 0.5x Ultra-Wide Lens</span>
                    </div>
                    <p className="text-[11px] text-[#222222]/70 leading-relaxed">
                      {spatialData.cameraOptics?.depthDistortionNote ||
                        "0.5x ultra-wide lenses (~13mm focal length, ~120° FOV) stretch peripheral corners and make room centers appear farther away than they actually are."}
                    </p>
                    <div className="text-[10px] text-[#222222]/60 font-mono pt-1 border-t border-black/5">
                      Fixed Architectural Anchors Used: Door frame height (~2.05m / 80"), Floor baseboards (4"), Switch plates (~1.2m).
                    </div>
                  </div>

                  {/* Bed Sizing & Walkway Clearance Arithmetic (Skill Part C2) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#222222]">
                        Bed Sizing & Clearance Breakdown
                      </span>
                      <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                        Recommended: {spatialData.bedFitAssessment?.recommendedSize || "Queen Bed"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="p-2.5 bg-white border border-[#222222]/10 rounded-xl">
                        <div className="font-bold text-[#222222] flex items-center justify-between">
                          <span>Single / Twin Bed (36 × 75")</span>
                          <span className="text-[10px] text-[#222222]/50 font-normal">~90 × 190 cm</span>
                        </div>
                        <p className="text-[11px] text-[#222222]/70 mt-0.5">
                          {spatialData.bedFitAssessment?.singleTwin ||
                            "Ample clearance (~4.5-5.5 ft open floor), leaves room for study desk & wardrobe."}
                        </p>
                      </div>

                      <div className="p-2.5 bg-white border border-[#222222]/10 rounded-xl">
                        <div className="font-bold text-[#222222] flex items-center justify-between">
                          <span>Double Bed (48 × 72")</span>
                          <span className="text-[10px] text-[#222222]/50 font-normal">~120 × 190 cm</span>
                        </div>
                        <p className="text-[11px] text-[#222222]/70 mt-0.5">
                          {spatialData.bedFitAssessment?.fullDouble ||
                            "Comfortable fit with 32\" walking clearance on both sides."}
                        </p>
                      </div>

                      <div className="p-2.5 bg-amber-50/70 border border-amber-300/80 rounded-xl">
                        <div className="font-bold text-amber-900 flex items-center justify-between">
                          <span>Queen Bed (60 × 78") ★ Recommended</span>
                          <span className="text-[10px] text-amber-800 font-normal">~152 × 198 cm</span>
                        </div>
                        <p className="text-[11px] text-[#222222]/80 mt-0.5">
                          {spatialData.bedFitAssessment?.queen ||
                            "Optimal fit: room width allows ~28\" on either side for nightstands and comfortable circulation paths."}
                        </p>
                      </div>

                      <div className="p-2.5 bg-white border border-[#222222]/10 rounded-xl">
                        <div className="font-bold text-[#222222] flex items-center justify-between">
                          <span>King Bed (72 × 78")</span>
                          <span className="text-[10px] text-[#222222]/50 font-normal">~183 × 198 cm</span>
                        </div>
                        <p className="text-[11px] text-[#222222]/70 mt-0.5">
                          {spatialData.bedFitAssessment?.king ||
                            "Tight fit. May leave tight 18\" walkways near doorways or push nightstands flush against walls."}
                        </p>
                      </div>
                    </div>

                    {spatialData.bedFitAssessment?.recommendedPlacement && (
                      <div className="p-3 bg-[#F6F5F2] rounded-xl text-xs text-[#222222]/80">
                        <strong>Placement Recommendation:</strong>{" "}
                        {spatialData.bedFitAssessment.recommendedPlacement}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===================== 15 ARCHITECTURAL STYLES CATALOG MODAL ===================== */}
      <AnimatePresence>
        {styleCatalogOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs"
              onClick={() => setStyleCatalogOpen(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 sm:inset-y-6 sm:max-w-2xl sm:mx-auto bg-white rounded-t-[32px] sm:rounded-[32px] z-50 flex flex-col shadow-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 pb-3 border-b border-[#222222]/10 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shadow-xs">
                    <Palette className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base sm:text-lg text-[#222222]">
                        {STYLE_CONFIGS.length} Curated Architectural Styles
                      </h3>
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full font-mono">
                        {STYLE_CONFIGS.length} Styles
                      </span>
                    </div>
                    <p className="text-xs text-[#222222]/60">
                      Explore authentic 60-30-10 color rules, material specs & lighting for interiors & exteriors
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStyleCatalogOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80 cursor-pointer"
                  title="Close catalog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Category Filter Tabs for Styles: All, Interior, Exterior */}
              <div className="px-5 pt-3 pb-1 bg-white border-b border-[#222222]/10 flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setCatalogFilter("all")}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    catalogFilter === "all"
                      ? "bg-[#222222] text-white border-[#222222]"
                      : "bg-[#F6F5F2] text-[#222222]/70 border-black/5 hover:bg-[#EAE9E4]"
                  }`}
                >
                  All Styles ({STYLE_CONFIGS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogFilter("exterior")}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                    catalogFilter === "exterior"
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                  }`}
                >
                  <span>🌳 Exterior & Indian Landscape</span>
                  <span className="text-[10px] bg-white/30 px-1.5 py-0.2 rounded-full font-mono">4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogFilter("interior")}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    catalogFilter === "interior"
                      ? "bg-[#222222] text-white border-[#222222]"
                      : "bg-[#F6F5F2] text-[#222222]/70 border-black/5 hover:bg-[#EAE9E4]"
                  }`}
                >
                  🛋️ Interior Styles (16)
                </button>
              </div>

              {/* Scrollable Styles Grid */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-[#FBFBFA]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STYLE_CONFIGS.filter((style) => {
                    const isExt = style.id.includes("exterior") || style.id.includes("landscape") || style.id.includes("courtyard") || style.id.includes("terrace");
                    if (catalogFilter === "exterior") return isExt;
                    if (catalogFilter === "interior") return !isExt;
                    return true;
                  }).map((style) => {
                    const idx = STYLE_CONFIGS.findIndex((s) => s.id === style.id);
                    const isCurrent = currentStyle?.id === style.id;
                    const isExteriorStyle = style.id.includes("exterior") || style.id.includes("landscape") || style.id.includes("courtyard") || style.id.includes("terrace");
                    const d60 = style.rule603010.dominant60.colors[0];
                    const s30 = style.rule603010.secondary30.colors[0];
                    const a10 = style.rule603010.accent10.colors[0];

                    return (
                      <div
                        key={style.id}
                        onClick={() => {
                          const targetIdx = STYLE_CONFIGS.findIndex((s) => s.id === style.id);
                          if (targetIdx >= 0) {
                            setCurrentIndex(targetIdx);
                          }
                          setStyleCatalogOpen(false);
                          if (screen === "welcome" && photos.length > 0) {
                            setScreen("cards");
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isCurrent
                            ? "bg-amber-50/90 border-amber-500 shadow-sm ring-2 ring-amber-400/40"
                            : "bg-white border-[#222222]/10 hover:border-amber-300 hover:shadow-2xs"
                        }`}
                      >
                        <div>
                          {/* Top Row: Index Badge & Status */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                                #{idx + 1}
                              </span>
                              {isExteriorStyle && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                  <span>🌳 Exterior</span>
                                </span>
                              )}
                            </div>
                            {isCurrent ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Current Active
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#222222]/50 font-medium">
                                Tap to select
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-[#222222]">{style.name}</h4>
                          <p className="text-[11px] text-amber-900/80 font-medium line-clamp-1 mb-1.5">
                            {style.subtitle}
                          </p>
                          <p className="text-[10px] text-[#222222]/70 leading-relaxed line-clamp-2 mb-2.5">
                            {style.description}
                          </p>
                        </div>

                        {/* 60-30-10 Palette Mini-Bar */}
                        <div className="pt-2 border-t border-[#222222]/10">
                          <div className="flex items-center justify-between text-[9px] text-[#222222]/60 mb-1">
                            <span className="font-semibold">60-30-10 Palette:</span>
                            <span className="font-mono">{style.rule603010.lightingSpecs.kelvin}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <div className="flex items-center gap-1 bg-[#F6F5F2] p-1 rounded-lg">
                              <div
                                className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                                style={{ backgroundColor: d60?.hex }}
                              />
                              <div className="min-w-0">
                                <div className="text-[8px] font-bold truncate">60% Wall</div>
                                <div className="text-[7px] text-[#222222]/60 truncate font-mono">{d60?.name}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 bg-[#F6F5F2] p-1 rounded-lg">
                              <div
                                className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                                style={{ backgroundColor: s30?.hex }}
                              />
                              <div className="min-w-0">
                                <div className="text-[8px] font-bold truncate">30% Trim</div>
                                <div className="text-[7px] text-[#222222]/60 truncate font-mono">{s30?.name}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 bg-[#F6F5F2] p-1 rounded-lg">
                              <div
                                className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                                style={{ backgroundColor: a10?.hex }}
                              />
                              <div className="min-w-0">
                                <div className="text-[8px] font-bold truncate">10% Accent</div>
                                <div className="text-[7px] text-[#222222]/60 truncate font-mono">{a10?.name}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 border-t border-[#222222]/10 bg-white flex items-center justify-between text-xs text-[#222222]/70 shrink-0">
                <span>Select any of the 15 styles above to view and render your room.</span>
                <button
                  onClick={() => setStyleCatalogOpen(false)}
                  className="px-4 py-1.5 bg-[#222222] text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===================== PDF & DESIGN PACK EXPORT MODAL ===================== */}
      <AnimatePresence>
        {pdfExportModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs"
              onClick={() => setPdfExportModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:max-w-md sm:mx-auto bg-white rounded-[28px] z-50 p-5 sm:p-6 shadow-2xl border border-[#222222]/10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#222222]/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-800 shadow-2xs shrink-0">
                    <FolderArchive className="w-5 h-5 text-rose-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#222222]">
                      Export Architectural Dossier & Pack
                    </h3>
                    <p className="text-xs text-[#222222]/60">
                      Download complete digital production assets or print-ready PDF
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPdfExportModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EAE9E4] flex items-center justify-center text-[#222222]/80 hover:bg-[#EAE9E4]/80 cursor-pointer"
                  title="Close export dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scope Info Pill */}
              <div className="bg-[#F6F5F2] rounded-2xl p-3 border border-[#222222]/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-[#222222] capitalize">
                    {ROOM_TYPE_OPTIONS.find((r) => r.id === roomType)?.icon || "🛋️"} {roomType}
                  </span>
                  <span className="text-[#222222]/30">·</span>
                  <span className="text-amber-900 font-medium truncate">{currentStyle?.name}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold bg-white px-2 py-0.5 rounded-full border border-black/5 text-[#222222]/70 shrink-0">
                  {annotations.length} Tagged Items
                </span>
              </div>

              {/* Option 1: Complete ZIP Design Pack (PRIMARY) */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-400/80 hover:border-amber-500 transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-800" />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Complete Digital Design Pack (.ZIP)
                    </span>
                  </div>
                  <span className="text-[9px] bg-amber-200/80 text-amber-950 font-bold px-2 py-0.5 rounded-full font-mono">
                    ZIP ARCHIVE
                  </span>
                </div>

                <p className="text-xs text-amber-950/80 leading-relaxed">
                  Includes <strong>all 4 room angles</strong> (high-res renders), <strong>palette-60-30-10.json</strong> with authentic paint codes & lighting specs, and <strong>full shopping list</strong> (JSON + formatted TXT) with dimensions & costs.
                </p>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] text-amber-950/90 font-medium pt-1">
                  <div className="bg-white/80 rounded-lg p-1.5 border border-amber-200 text-center">
                    📸 4 Room Angles
                  </div>
                  <div className="bg-white/80 rounded-lg p-1.5 border border-amber-200 text-center">
                    🎨 60-30-10 JSON
                  </div>
                  <div className="bg-white/80 rounded-lg p-1.5 border border-amber-200 text-center">
                    🛋️ Shopping List
                  </div>
                </div>

                <button
                  onClick={handleDownloadZip}
                  disabled={isExportingZip}
                  className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer mt-1"
                >
                  {isExportingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Packaging ZIP with 4 Angles & JSON...</span>
                    </>
                  ) : (
                    <>
                      <FolderArchive className="w-4 h-4" />
                      <span>Download Design Pack as ZIP</span>
                    </>
                  )}
                </button>
              </div>

              {/* Option 2: Print-Ready PDF Dossier */}
              <div className="p-4 rounded-2xl bg-[#FBFBFA] border border-[#222222]/10 hover:border-[#222222]/20 transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-rose-700" />
                    <span className="text-xs font-bold text-[#222222] uppercase tracking-wide">
                      Architectural PDF Dossier (.PDF)
                    </span>
                  </div>
                  <span className="text-[9px] bg-rose-100 text-rose-900 font-bold px-2 py-0.5 rounded-full font-mono">
                    MULTI-PAGE PDF
                  </span>
                </div>

                <p className="text-xs text-[#222222]/70 leading-relaxed">
                  Consolidated multi-page presentation document with 60-30-10 paint swatches, daylight Kelvin simulation, clearance rules, and annotated furniture shopping table.
                </p>

                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#F6F5F2] active:scale-[0.98] text-[#222222] font-semibold text-xs flex items-center justify-center gap-2 border border-[#222222]/15 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isExportingPDF ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      <span>Generating PDF Document...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-rose-600" />
                      <span>Download PDF Dossier (.pdf)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Footer Note */}
              <div className="pt-2 border-t border-[#222222]/10 text-center">
                <p className="text-[11px] text-[#222222]/50">
                  Both formats export to your computer instantly. No sign-up required.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share & Snapshot Export Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        currentStyle={currentStyle}
        renderedImage={currentRenderedImage || null}
        originalImage={currentAngleOriginalPhoto?.url || null}
        roomType={roomType}
        stylingModeLabel={STYLING_MODES.find((m) => m.id === stylingMode)?.label || stylingMode}
        lightingInfo={currentLighting}
        lightingSimEnabled={lightingSimEnabled}
      />
    </div>
  );
}
