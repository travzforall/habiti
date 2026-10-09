import { ToolStatus } from './tool-cost';

/**
 * A list of the things building work actually needs, to pick from.
 *
 * ── WHY A CATALOGUE AT ALL ────────────────────────────────────────────────
 *
 * Typing "mitre saw" into an empty box works once. Kitting out a job means
 * forty of those, and the ones you forget are the ones that stop the work on
 * the morning — nobody forgets the saw, everybody forgets the blade, the
 * extension lead and the dust sheets. A list you filter beats a box you fill.
 *
 * ── WHY IT IS NOT A TABLE ─────────────────────────────────────────────────
 *
 * This is reference data, the same as the habit library: it ships with the app,
 * it is the same for everybody, and it changes when the app changes. Putting it
 * in Baserow would mean every user carrying their own copy of a list nobody
 * edits, and a migration every time a size is added.
 *
 * ── AND WHY IT IS LAZY ────────────────────────────────────────────────────
 *
 * It is only ever needed at the moment someone opens the picker. Imported from
 * a lazily-routed component and behind a @defer, it never reaches a first page
 * load — the same reasoning as config/media-links.ts, and the initial bundle
 * has under seven kilobytes of headroom to spare.
 */

export type SupplyKind = 'tool' | 'material';

export interface SupplyEntry {
  id: string;
  name: string;
  kind: SupplyKind;
  /** The heading it files under in the picker. */
  category: string;
  /** What it is counted in. */
  unit?: string;
  /**
   * The sizes worth choosing between, when the size is the decision.
   *
   * Plywood is not "plywood": it is 1/4", 1/2" or 3/4", and picking the wrong
   * one is a second trip. Where sizes exist the picker offers them; where they
   * do not it does not clutter the row with an empty menu.
   */
  sizes?: string[];
  /** How you would normally get it — the picker's starting guess, not a rule. */
  typical?: ToolStatus;
  /** Words people search by that are not in the name. */
  also?: string[];
  /**
   * Shown without asking.
   *
   * The picker opens on these — the things most jobs actually touch. Everything
   * else is hidden until someone says otherwise, because a list of 140 rows is
   * one you scroll past rather than read. Hidden, never removed: "I will never
   * need a core drill" is wrong about twice a year.
   */
  common?: boolean;
}

/**
 * Spelling note: "mitre" and "miter" are the same saw either side of the
 * Atlantic, and a search for one must find the other. Rather than duplicate
 * entries, both spellings live in `also`.
 */
export const SUPPLY_CATALOGUE: readonly SupplyEntry[] = [
  // --- Cutting ---------------------------------------------------------------
  { id: 'mitre-saw', name: 'Mitre saw', kind: 'tool', category: 'Cutting', typical: 'hire', also: ['miter', 'chop saw', 'crosscut'], common: true },
  { id: 'sliding-mitre-saw', name: 'Sliding mitre saw', kind: 'tool', category: 'Cutting', typical: 'hire', also: ['miter', 'slide compound'] },
  { id: 'table-saw', name: 'Table saw', kind: 'tool', category: 'Cutting', typical: 'hire', also: ['rip'] },
  { id: 'circular-saw', name: 'Circular saw', kind: 'tool', category: 'Cutting', typical: 'buy', also: ['skil saw'], common: true },
  { id: 'track-saw', name: 'Track saw', kind: 'tool', category: 'Cutting', typical: 'hire', also: ['plunge saw'] },
  { id: 'jigsaw', name: 'Jigsaw', kind: 'tool', category: 'Cutting', typical: 'buy', also: ['sabre'], common: true },
  { id: 'reciprocating-saw', name: 'Reciprocating saw', kind: 'tool', category: 'Cutting', typical: 'buy', also: ['sawzall', 'recip'] },
  { id: 'hand-saw', name: 'Hand saw', kind: 'tool', category: 'Cutting', typical: 'own' },
  { id: 'hacksaw', name: 'Hacksaw', kind: 'tool', category: 'Cutting', typical: 'own', also: ['metal'] },
  { id: 'multi-tool', name: 'Oscillating multi-tool', kind: 'tool', category: 'Cutting', typical: 'buy', also: ['fein'], common: true },
  { id: 'angle-grinder', name: 'Angle grinder', kind: 'tool', category: 'Cutting', typical: 'buy', also: ['cutting disc'] },
  { id: 'tile-cutter', name: 'Tile cutter', kind: 'tool', category: 'Cutting', typical: 'hire', also: ['wet saw'] },
  { id: 'utility-knife', name: 'Utility knife', kind: 'tool', category: 'Cutting', typical: 'own', also: ['stanley', 'box cutter'], common: true },
  { id: 'saw-blade', name: 'Saw blade', kind: 'material', category: 'Cutting', unit: 'each', sizes: ['24T rip', '40T general', '60T fine', '80T trim'], also: ['tct'], common: true },
  { id: 'cutting-disc', name: 'Cutting disc', kind: 'material', category: 'Cutting', unit: 'each', sizes: ['115mm', '230mm'] },

  // --- Drilling and fixing ---------------------------------------------------
  { id: 'drill-driver', name: 'Drill driver', kind: 'tool', category: 'Drilling', typical: 'own', also: ['cordless drill'], common: true },
  { id: 'impact-driver', name: 'Impact driver', kind: 'tool', category: 'Drilling', typical: 'buy', common: true },
  { id: 'sds-drill', name: 'SDS hammer drill', kind: 'tool', category: 'Drilling', typical: 'hire', also: ['rotary hammer', 'masonry'], common: true },
  { id: 'breaker', name: 'Breaker / demolition hammer', kind: 'tool', category: 'Drilling', typical: 'hire', also: ['jackhammer', 'kango'] },
  { id: 'core-drill', name: 'Core drill', kind: 'tool', category: 'Drilling', typical: 'hire', also: ['vent hole'] },
  { id: 'drill-bits-wood', name: 'Wood drill bits', kind: 'material', category: 'Drilling', unit: 'set', sizes: ['3–10mm', 'spade set', 'auger set'], common: true },
  { id: 'drill-bits-masonry', name: 'Masonry drill bits', kind: 'material', category: 'Drilling', unit: 'set', sizes: ['5.5mm', '6mm', '7mm', '10mm'], common: true },
  { id: 'hole-saw', name: 'Hole saw', kind: 'material', category: 'Drilling', unit: 'each', sizes: ['32mm', '68mm', '100mm', '127mm'] },
  { id: 'screwdriver-bits', name: 'Screwdriver bits', kind: 'material', category: 'Drilling', unit: 'set', sizes: ['PZ2', 'PH2', 'T25', 'mixed'], common: true },

  // --- Fixings ---------------------------------------------------------------
  { id: 'wood-screws', name: 'Wood screws', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['4x30mm', '4x40mm', '5x50mm', '5x70mm', '6x100mm'], also: ['countersunk'], common: true },
  { id: 'decking-screws', name: 'Decking screws', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['4.5x65mm', '5x80mm'] },
  { id: 'drywall-screws', name: 'Drywall screws', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['25mm', '32mm', '38mm', '50mm'], also: ['plasterboard'], common: true },
  { id: 'masonry-screws', name: 'Masonry screws', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['60mm', '80mm', '100mm'], also: ['concrete screw', 'tapcon'] },
  { id: 'wall-plugs', name: 'Wall plugs', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['brown 7mm', 'red 6mm', 'heavy duty'], also: ['rawlplug', 'anchor'], common: true },
  { id: 'nails', name: 'Nails', kind: 'material', category: 'Fixings', unit: 'box', sizes: ['round wire 65mm', 'oval 50mm', 'lost head 40mm', 'clout'], common: true },
  { id: 'brackets', name: 'Angle brackets', kind: 'material', category: 'Fixings', unit: 'each', sizes: ['50mm', '75mm', '100mm'] },
  { id: 'joist-hangers', name: 'Joist hangers', kind: 'material', category: 'Fixings', unit: 'each', sizes: ['47x100', '47x150', '47x200'] },
  { id: 'bolts', name: 'Bolts and washers', kind: 'material', category: 'Fixings', unit: 'each', sizes: ['M8', 'M10', 'M12'], also: ['coach'] },

  // --- Timber and boards -----------------------------------------------------
  { id: 'plywood', name: 'Plywood sheet', kind: 'material', category: 'Timber & boards', unit: 'sheet', sizes: ['1/4 in (6mm)', '1/2 in (12mm)', '3/4 in (18mm)'], also: ['ply', 'wbp'], common: true },
  { id: 'mdf', name: 'MDF sheet', kind: 'material', category: 'Timber & boards', unit: 'sheet', sizes: ['6mm', '12mm', '18mm', 'moisture resistant'] },
  { id: 'osb', name: 'OSB board', kind: 'material', category: 'Timber & boards', unit: 'sheet', sizes: ['11mm', '18mm'], also: ['sterling board'] },
  { id: 'plasterboard', name: 'Plasterboard', kind: 'material', category: 'Timber & boards', unit: 'sheet', sizes: ['9.5mm', '12.5mm', 'moisture', 'fire'], also: ['drywall', 'sheetrock'], common: true },
  { id: 'cls-timber', name: 'CLS stud timber', kind: 'material', category: 'Timber & boards', unit: 'length', sizes: ['38x63mm', '38x89mm', '38x140mm'], also: ['studwork', '2x4'], common: true },
  { id: 'sawn-timber', name: 'Sawn timber', kind: 'material', category: 'Timber & boards', unit: 'length', sizes: ['47x100mm', '47x150mm', '47x200mm'], also: ['joist', 'c16', 'c24'], common: true },
  { id: 'batten', name: 'Roofing batten', kind: 'material', category: 'Timber & boards', unit: 'length', sizes: ['25x38mm', '25x50mm'] },
  { id: 'skirting', name: 'Skirting board', kind: 'material', category: 'Timber & boards', unit: 'length', sizes: ['torus 119mm', 'ogee 145mm', 'square 95mm'], common: true },
  { id: 'architrave', name: 'Architrave', kind: 'material', category: 'Timber & boards', unit: 'length' },
  { id: 'dowel', name: 'Dowel', kind: 'material', category: 'Timber & boards', unit: 'length', sizes: ['6mm', '8mm', '12mm'] },

  // --- Concrete, cement and levelling ----------------------------------------
  { id: 'concrete-mix', name: 'Concrete mix', kind: 'material', category: 'Concrete & screed', unit: 'bag', sizes: ['20kg', '25kg'], also: ['quikrete', 'postcrete', 'ready mix'], common: true },
  { id: 'cement', name: 'Cement', kind: 'material', category: 'Concrete & screed', unit: 'bag', sizes: ['25kg'], also: ['portland'], common: true },
  { id: 'sand', name: 'Sand', kind: 'material', category: 'Concrete & screed', unit: 'bag', sizes: ['sharp', 'building', 'plastering'], common: true },
  { id: 'ballast', name: 'Ballast', kind: 'material', category: 'Concrete & screed', unit: 'bag' },
  { id: 'self-levelling', name: 'Self-levelling compound', kind: 'material', category: 'Concrete & screed', unit: 'bag', sizes: ['20kg'], also: ['latex', 'floor level'], common: true },
  { id: 'screed', name: 'Floor screed', kind: 'material', category: 'Concrete & screed', unit: 'bag' },
  { id: 'mixer', name: 'Cement mixer', kind: 'tool', category: 'Concrete & screed', typical: 'hire' },
  { id: 'mixing-paddle', name: 'Mixing paddle', kind: 'tool', category: 'Concrete & screed', typical: 'buy', also: ['whisk'] },
  { id: 'wheelbarrow', name: 'Wheelbarrow', kind: 'tool', category: 'Concrete & screed', typical: 'own' },
  { id: 'float', name: 'Finishing float', kind: 'tool', category: 'Concrete & screed', typical: 'buy', also: ['trowel'] },

  // --- Walls and finishing ---------------------------------------------------
  { id: 'plaster', name: 'Plaster', kind: 'material', category: 'Walls & finishing', unit: 'bag', sizes: ['multi finish 25kg', 'bonding 25kg'], also: ['skim'], common: true },
  { id: 'jointing-compound', name: 'Jointing compound', kind: 'material', category: 'Walls & finishing', unit: 'tub', also: ['mud', 'filler'] },
  { id: 'scrim-tape', name: 'Scrim tape', kind: 'material', category: 'Walls & finishing', unit: 'roll', also: ['joint tape'] },
  { id: 'plastering-trowel', name: 'Plastering trowel', kind: 'tool', category: 'Walls & finishing', typical: 'buy' },
  { id: 'hawk', name: 'Plasterer’s hawk', kind: 'tool', category: 'Walls & finishing', typical: 'buy' },
  { id: 'sanding-pole', name: 'Pole sander', kind: 'tool', category: 'Walls & finishing', typical: 'buy', also: ['giraffe'] },
  { id: 'orbital-sander', name: 'Orbital sander', kind: 'tool', category: 'Walls & finishing', typical: 'buy', common: true },
  { id: 'sandpaper', name: 'Sandpaper', kind: 'material', category: 'Walls & finishing', unit: 'pack', sizes: ['80 grit', '120 grit', '180 grit', '240 grit'], common: true },
  { id: 'caulk', name: 'Decorator’s caulk', kind: 'material', category: 'Walls & finishing', unit: 'tube', common: true },
  { id: 'filler', name: 'Wall filler', kind: 'material', category: 'Walls & finishing', unit: 'tub', also: ['polyfilla', 'spackle'], common: true },

  // --- Paint -----------------------------------------------------------------
  { id: 'emulsion', name: 'Emulsion paint', kind: 'material', category: 'Paint', unit: 'tin', sizes: ['2.5L', '5L', '10L'], also: ['wall paint'], common: true },
  { id: 'undercoat', name: 'Undercoat / primer', kind: 'material', category: 'Paint', unit: 'tin', sizes: ['750ml', '2.5L'], common: true },
  { id: 'gloss', name: 'Gloss / satinwood', kind: 'material', category: 'Paint', unit: 'tin', sizes: ['750ml', '2.5L'], also: ['trim paint'], common: true },
  { id: 'masonry-paint', name: 'Masonry paint', kind: 'material', category: 'Paint', unit: 'tin', sizes: ['5L', '10L'] },
  { id: 'rollers', name: 'Roller and sleeves', kind: 'material', category: 'Paint', unit: 'each', sizes: ['9 in', '4 in'], common: true },
  { id: 'brushes', name: 'Paint brushes', kind: 'material', category: 'Paint', unit: 'set', sizes: ['1 in', '2 in', 'cutting in'], common: true },
  { id: 'dust-sheets', name: 'Dust sheets', kind: 'material', category: 'Paint', unit: 'each', also: ['drop cloth'], common: true },
  { id: 'masking-tape', name: 'Masking tape', kind: 'material', category: 'Paint', unit: 'roll', sizes: ['25mm', '50mm'], also: ['frog tape'], common: true },
  { id: 'paint-sprayer', name: 'Paint sprayer', kind: 'tool', category: 'Paint', typical: 'hire' },

  // --- Flooring --------------------------------------------------------------
  { id: 'vinyl-flooring', name: 'Vinyl flooring', kind: 'material', category: 'Flooring', unit: 'm²', sizes: ['sheet', 'LVT plank', 'click'], also: ['lino'], common: true },
  { id: 'laminate', name: 'Laminate flooring', kind: 'material', category: 'Flooring', unit: 'm²', sizes: ['7mm', '8mm', '12mm'], common: true },
  { id: 'underlay', name: 'Underlay', kind: 'material', category: 'Flooring', unit: 'roll', sizes: ['3mm', '5mm', 'acoustic'], common: true },
  { id: 'floor-adhesive', name: 'Floor adhesive', kind: 'material', category: 'Flooring', unit: 'tub' },
  { id: 'floor-sander', name: 'Floor sander', kind: 'tool', category: 'Flooring', typical: 'hire', also: ['drum sander', 'edger'] },
  { id: 'flooring-spacers', name: 'Flooring spacers', kind: 'material', category: 'Flooring', unit: 'pack' },
  { id: 'tapping-block', name: 'Tapping block and pull bar', kind: 'tool', category: 'Flooring', typical: 'buy' },
  { id: 'knee-pads', name: 'Knee pads', kind: 'tool', category: 'Flooring', typical: 'buy' },
  { id: 'tile-adhesive', name: 'Tile adhesive', kind: 'material', category: 'Flooring', unit: 'bag', common: true },
  { id: 'grout', name: 'Grout', kind: 'material', category: 'Flooring', unit: 'bag', sizes: ['wall', 'floor', 'flexible'], common: true },
  { id: 'tile-spacers', name: 'Tile spacers', kind: 'material', category: 'Flooring', unit: 'pack', sizes: ['2mm', '3mm', '5mm'] },

  // --- Plumbing --------------------------------------------------------------
  { id: 'copper-pipe', name: 'Copper pipe', kind: 'material', category: 'Plumbing', unit: 'length', sizes: ['15mm', '22mm', '28mm'] },
  { id: 'push-fit', name: 'Push-fit fittings', kind: 'material', category: 'Plumbing', unit: 'each', sizes: ['15mm', '22mm'], also: ['speedfit', 'sharkbite'] },
  { id: 'waste-pipe', name: 'Waste pipe', kind: 'material', category: 'Plumbing', unit: 'length', sizes: ['32mm', '40mm', '110mm soil'] },
  { id: 'ptfe', name: 'PTFE tape', kind: 'material', category: 'Plumbing', unit: 'roll', also: ['thread tape'] },
  { id: 'pipe-cutter', name: 'Pipe cutter', kind: 'tool', category: 'Plumbing', typical: 'buy' },
  { id: 'blowtorch', name: 'Blowtorch', kind: 'tool', category: 'Plumbing', typical: 'buy', also: ['solder'] },
  { id: 'basin-wrench', name: 'Basin wrench', kind: 'tool', category: 'Plumbing', typical: 'buy' },
  { id: 'silicone', name: 'Silicone sealant', kind: 'material', category: 'Plumbing', unit: 'tube', sizes: ['sanitary', 'frame'], common: true },
  { id: 'sealant-gun', name: 'Sealant gun', kind: 'tool', category: 'Plumbing', typical: 'own', also: ['caulking gun'], common: true },

  // --- Electrical ------------------------------------------------------------
  { id: 'twin-earth', name: 'Twin and earth cable', kind: 'material', category: 'Electrical', unit: 'm', sizes: ['1.0mm²', '1.5mm²', '2.5mm²', '6mm²'], also: ['romex', 't&e'] },
  { id: 'back-boxes', name: 'Back boxes', kind: 'material', category: 'Electrical', unit: 'each', sizes: ['25mm', '35mm', 'dry lining'] },
  { id: 'sockets', name: 'Sockets and switches', kind: 'material', category: 'Electrical', unit: 'each', sizes: ['single', 'double', 'USB'] },
  { id: 'junction-box', name: 'Junction box', kind: 'material', category: 'Electrical', unit: 'each' },
  { id: 'conduit', name: 'Conduit / capping', kind: 'material', category: 'Electrical', unit: 'length' },
  { id: 'voltage-tester', name: 'Voltage tester', kind: 'tool', category: 'Electrical', typical: 'buy', also: ['multimeter'] },
  { id: 'wire-strippers', name: 'Wire strippers', kind: 'tool', category: 'Electrical', typical: 'own' },
  { id: 'extension-lead', name: 'Extension lead', kind: 'tool', category: 'Electrical', typical: 'own', also: ['power lead'], common: true },
  { id: 'site-light', name: 'Site light', kind: 'tool', category: 'Electrical', typical: 'buy', also: ['work light', 'halogen'], common: true },

  // --- Heating and ventilation ----------------------------------------------
  { id: 'extractor-fan', name: 'Extractor fan', kind: 'material', category: 'Heating & vent', unit: 'each', sizes: ['4 in', '6 in'], also: ['bathroom vent'], common: true },
  { id: 'ducting', name: 'Ducting', kind: 'material', category: 'Heating & vent', unit: 'length', sizes: ['100mm', '150mm'] },
  { id: 'vent-grille', name: 'Vent grille', kind: 'material', category: 'Heating & vent', unit: 'each' },
  { id: 'insulation', name: 'Insulation', kind: 'material', category: 'Heating & vent', unit: 'roll', sizes: ['100mm', '150mm', 'PIR board'], also: ['rockwool', 'celotex'], common: true },
  { id: 'radiator', name: 'Radiator', kind: 'material', category: 'Heating & vent', unit: 'each' },

  // --- Access and site -------------------------------------------------------
  { id: 'step-ladder', name: 'Step ladder', kind: 'tool', category: 'Access & site', typical: 'own', common: true },
  { id: 'extension-ladder', name: 'Extension ladder', kind: 'tool', category: 'Access & site', typical: 'borrow' },
  { id: 'tower-scaffold', name: 'Tower scaffold', kind: 'tool', category: 'Access & site', typical: 'hire' },
  { id: 'trestles', name: 'Trestles and boards', kind: 'tool', category: 'Access & site', typical: 'hire' },
  { id: 'skip', name: 'Skip', kind: 'tool', category: 'Access & site', typical: 'hire', also: ['dumpster', 'waste'], common: true },
  { id: 'rubble-sacks', name: 'Rubble sacks', kind: 'material', category: 'Access & site', unit: 'pack', common: true },
  { id: 'site-vacuum', name: 'Site vacuum', kind: 'tool', category: 'Access & site', typical: 'buy', also: ['shop vac', 'henry'], common: true },
  { id: 'work-bench', name: 'Portable workbench', kind: 'tool', category: 'Access & site', typical: 'own', also: ['workmate'] },

  // --- Measuring and marking -------------------------------------------------
  { id: 'tape-measure', name: 'Tape measure', kind: 'tool', category: 'Measuring', typical: 'own', sizes: ['5m', '8m'], common: true },
  { id: 'spirit-level', name: 'Spirit level', kind: 'tool', category: 'Measuring', typical: 'own', sizes: ['600mm', '1200mm', '1800mm'], common: true },
  { id: 'laser-level', name: 'Laser level', kind: 'tool', category: 'Measuring', typical: 'hire' },
  { id: 'chalk-line', name: 'Chalk line', kind: 'tool', category: 'Measuring', typical: 'buy' },
  { id: 'square', name: 'Combination square', kind: 'tool', category: 'Measuring', typical: 'own', also: ['speed square'], common: true },
  { id: 'stud-detector', name: 'Stud and cable detector', kind: 'tool', category: 'Measuring', typical: 'buy', also: ['stud finder'], common: true },
  { id: 'moisture-meter', name: 'Moisture meter', kind: 'tool', category: 'Measuring', typical: 'buy' },

  // --- Safety ----------------------------------------------------------------
  { id: 'safety-glasses', name: 'Safety glasses', kind: 'material', category: 'Safety', unit: 'each', common: true },
  { id: 'ear-defenders', name: 'Ear defenders', kind: 'material', category: 'Safety', unit: 'each', common: true },
  { id: 'dust-masks', name: 'Dust masks', kind: 'material', category: 'Safety', unit: 'pack', sizes: ['FFP2', 'FFP3'], also: ['respirator', 'n95'], common: true },
  { id: 'gloves', name: 'Work gloves', kind: 'material', category: 'Safety', unit: 'pair', common: true },
  { id: 'knee-protection', name: 'Knee pads', kind: 'material', category: 'Safety', unit: 'pair' },
  { id: 'first-aid', name: 'First aid kit', kind: 'material', category: 'Safety', unit: 'each' },
  { id: 'fire-extinguisher', name: 'Fire extinguisher', kind: 'material', category: 'Safety', unit: 'each' },

  // --- Adhesives and consumables ---------------------------------------------
  { id: 'wood-glue', name: 'Wood glue', kind: 'material', category: 'Adhesives', unit: 'bottle', also: ['pva'], common: true },
  { id: 'grab-adhesive', name: 'Grab adhesive', kind: 'material', category: 'Adhesives', unit: 'tube', also: ['no more nails', 'liquid nails'], common: true },
  { id: 'expanding-foam', name: 'Expanding foam', kind: 'material', category: 'Adhesives', unit: 'can', common: true },
  { id: 'duct-tape', name: 'Duct tape', kind: 'material', category: 'Adhesives', unit: 'roll', also: ['gaffer'], common: true },
  { id: 'wd40', name: 'Penetrating oil', kind: 'material', category: 'Adhesives', unit: 'can', also: ['wd40'] },
  { id: 'pencils', name: 'Carpenter’s pencils', kind: 'material', category: 'Adhesives', unit: 'pack', common: true }
];

/** The headings, in the order the picker shows them. */
export const SUPPLY_CATEGORIES: readonly string[] = [...new Set(SUPPLY_CATALOGUE.map(e => e.category))];
