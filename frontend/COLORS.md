# BEACON Color Palette

## 🎨 Design Philosophy

The BEACON color palette uses **warm, earthy, sandpaper-brown tones** to create a **grounding, natural, and calming** experience during emergency situations. These colors evoke stability, trust, and safety through natural earth tones.

---

## 🌈 The 4 Core Colors

### 1. **Primary - Warm Caramel Brown** 🟤
**Purpose:** Trust, Warmth, Grounding

- **Default:** `#A67C52` - Main brand color, primary actions
- **Light:** `#C4A078` - Hover states, accents
- **Dark:** `#8B5E34` - Pressed states, emphasis

**Use Cases:**
- Primary buttons and CTAs
- Links and interactive elements
- Helper/responder indicators
- Important notifications
- Trust badges

**Tailwind Classes:**
```tsx
bg-primary          // #A67C52
bg-primary-light    // #C4A078
bg-primary-dark     // #8B5E34
text-primary
border-primary
```

---

### 2. **Secondary - Soft Sage Green** 🌿
**Purpose:** Growth, Calm, Natural Balance

- **Default:** `#8B9B7A` - Secondary actions, positive states
- **Light:** `#A8B599` - Success messages, completion
- **Dark:** `#6D7D5C` - Active states

**Use Cases:**
- Secondary buttons
- Success messages
- "Help on the way" indicators
- Progress bars (positive)
- Resolved status badges

**Tailwind Classes:**
```tsx
bg-secondary
bg-secondary-light
bg-secondary-dark
text-secondary
border-secondary
```

---

### 3. **Alert - Terracotta Clay** 🧱
**Purpose:** Warm Warning, Earthy Attention

- **Default:** `#C17A5B` - Medium urgency, needs attention
- **Light:** `#D99B82` - Low urgency, informational
- **Dark:** `#A25C41` - High urgency (NOT critical)

**Use Cases:**
- Medium/high urgency help requests
- Warning messages (non-critical)
- Pending actions
- Time-sensitive information
- Victim markers (non-critical)

**Tailwind Classes:**
```tsx
bg-alert
bg-alert-light
bg-alert-dark
text-alert
border-alert
```

**⚠️ IMPORTANT:** For **critical life-threatening situations**, use `alert-dark` sparingly and with clear context. Natural terracotta tone prevents panic.

---

### 4. **Neutral - Sandpaper Beige to Espresso** 🟫
**Purpose:** Natural, Grounding, Earthy

A complete 10-step warm brown scale for backgrounds, text, and UI elements - like layers of sandpaper from light to dark.

| Shade | Hex | Use Case | Tailwind |
|-------|-----|----------|----------|
| 50 | `#F5F1EB` | Lightest sand - card backgrounds | `bg-neutral-50` |
| 100 | `#EBE4D9` | Very light sand - hover states | `bg-neutral-100` |
| 200 | `#D9CFC0` | Light taupe - borders | `border-neutral-200` |
| 300 | `#C4B5A3` | Medium sand - disabled states | `text-neutral-300` |
| 400 | `#A69583` | Warm gray-brown - secondary text | `text-neutral-400` |
| 500 | `#8A7866` | Medium brown - body text | `text-neutral-500` |
| 600 | `#6E5F4E` | Dark brown - headings | `text-neutral-600` |
| 700 | `#544639` | Deep brown - emphasized text | `text-neutral-700` |
| 800 | `#3D3128` | Very dark brown - backgrounds | `bg-neutral-800` |
| 900 | `#2A2019` | Darkest espresso - deep backgrounds | `bg-neutral-900` |

**Use Cases:**
- Backgrounds (800-900 for dark mode)
- Text (400-700 depending on hierarchy)
- Borders and dividers (200-300)
- Disabled states (300)

---

## 🛠️ Usage Guidelines

### DO ✅

- **Use `primary` for main actions** - "Submit", "Get Help", primary navigation
- **Use `secondary` for positive feedback** - Success, completion, resolved
- **Use `alert` for warnings** - Urgent but not life-threatening
- **Use `neutral` for structure** - Backgrounds, text, containers
- **Maintain contrast ratios** - WCAG AA minimum (4.5:1 for text)
- **Use light/dark variants for states** - Hover (light), pressed (dark)

### DON'T ❌

- **Don't use pure red** - Too aggressive, causes panic
- **Don't mix palettes arbitrarily** - Stick to these 4 colors
- **Don't use bright, saturated colors** - Maintain the calm aesthetic
- **Don't use too many colors at once** - Keep it simple
- **Don't ignore accessibility** - Always check contrast

---

## 📐 Color Combinations

### Safe Combinations (High Contrast)

| Foreground | Background | Use Case | Contrast Ratio |
|------------|------------|----------|----------------|
| `text-neutral-900` | `bg-neutral-50` | Dark text on light (light mode) | 16.2:1 ✅ |
| `text-neutral-100` | `bg-neutral-900` | Light text on dark (dark mode) | 15.8:1 ✅ |
| `text-primary` | `bg-neutral-900` | Blue text on dark | 7.1:1 ✅ |
| `text-secondary` | `bg-neutral-900` | Teal text on dark | 6.8:1 ✅ |
| `text-white` | `bg-primary` | White on blue button | 6.5:1 ✅ |
| `text-white` | `bg-alert` | White on coral button | 4.8:1 ✅ |

### Avoid These Combinations ⚠️

- `text-primary-light` on `bg-neutral-100` - Too low contrast
- `text-secondary-light` on `bg-primary-light` - Poor readability
- `text-alert-light` on `bg-neutral-200` - Insufficient contrast

---

## 🎯 Component-Specific Usage

### Buttons

```tsx
// Primary action (most important)
<Button className="bg-primary hover:bg-primary-dark text-white">
  Submit Help Request
</Button>

// Secondary action
<Button className="bg-secondary hover:bg-secondary-dark text-white">
  Mark as Resolved
</Button>

// Warning/Alert action
<Button className="bg-alert hover:bg-alert-dark text-white">
  Urgent: Respond Now
</Button>

// Neutral/Cancel
<Button className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700">
  Cancel
</Button>
```

### Markers on Map

```tsx
// Helper marker
<Marker color="primary" /> // Blue

// Victim marker (low urgency)
<Marker color="alert-light" /> // Light coral

// Victim marker (medium urgency)
<Marker color="alert" /> // Coral

// Victim marker (high urgency)
<Marker color="alert-dark" /> // Dark coral

// User location
<Marker color="secondary" /> // Teal
```

### Status Badges

```tsx
// Pending
<Badge className="bg-neutral-300 text-neutral-700">Pending</Badge>

// In Progress
<Badge className="bg-primary text-white">In Progress</Badge>

// Resolved
<Badge className="bg-secondary text-white">Resolved</Badge>

// Needs Attention
<Badge className="bg-alert text-white">Needs Attention</Badge>
```

---

## 🔄 Migration from Old Colors

If you're updating existing code, here's the mapping:

| Old Color | New Color | Notes |
|-----------|-----------|-------|
| `accent-blue` | `primary` | Main blue unchanged |
| `accent-green` | `secondary` | Now teal instead of bright green |
| `accent-orange` | `alert` | Now coral instead of orange |
| `accent-red` | `alert-dark` | Use sparingly, only for critical |
| `background-primary` | `neutral-900` | Dark background |
| `background-elevated` | `neutral-700` | Elevated surfaces |

---

## 📱 Accessibility

All color combinations meet **WCAG AA standards** for contrast:

- **Normal text (16px+):** 4.5:1 minimum
- **Large text (18px+ or 14px+ bold):** 3:1 minimum
- **UI components:** 3:1 minimum

**Testing Tools:**
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 🎨 Visual Reference

```
PRIMARY (Warm Caramel Brown)
████████████████████ #A67C52 (Default)
████████████████████ #C4A078 (Light)
████████████████████ #8B5E34 (Dark)

SECONDARY (Soft Sage Green)
████████████████████ #8B9B7A (Default)
████████████████████ #A8B599 (Light)
████████████████████ #6D7D5C (Dark)

ALERT (Terracotta Clay)
████████████████████ #C17A5B (Default)
████████████████████ #D99B82 (Light)
████████████████████ #A25C41 (Dark)

NEUTRAL (Sandpaper to Espresso)
████████████████████ #F5F1EB (50 - Lightest sand)
████████████████████ #EBE4D9 (100 - Very light sand)
████████████████████ #D9CFC0 (200 - Light taupe)
████████████████████ #C4B5A3 (300 - Medium sand)
████████████████████ #A69583 (400 - Warm gray-brown)
████████████████████ #8A7866 (500 - Medium brown)
████████████████████ #6E5F4E (600 - Dark brown)
████████████████████ #544639 (700 - Deep brown)
████████████████████ #3D3128 (800 - Very dark brown)
████████████████████ #2A2019 (900 - Darkest espresso)
```

---

## 📝 Notes for Developers

1. **Always use Tailwind classes** - Don't use hex codes directly in components
2. **Check COLORS.md before adding new colors** - Stick to the palette
3. **Use semantic naming** - `bg-primary` not `bg-blue-500`
4. **Test in dark mode** - Ensure colors work on dark backgrounds
5. **Consider color blindness** - Don't rely solely on color to convey information

---

## 🔗 Quick Reference

**File Location:** `/frontend/tailwind.config.js`

**Import in components:**
```tsx
// Automatically available via Tailwind
<div className="bg-primary text-white">
  Using the palette!
</div>
```

**Programmatic access (if needed):**
```tsx
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../tailwind.config.js';

const fullConfig = resolveConfig(tailwindConfig);
const colors = fullConfig.theme.colors;

console.log(colors.primary); // { DEFAULT: '#4A90E2', light: '#7AB3F5', dark: '#2E6CB8' }
```

---

**Last Updated:** 2025-11-16
**Version:** 1.0.0
**Maintained By:** BEACON Design System
