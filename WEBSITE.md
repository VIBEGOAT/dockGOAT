# dockGOAT - Professional Minimalist Website

## Design Philosophy

**Clean. Fast. Professional.**

- Minimalist white/gray color scheme
- Maximum legibility and usability
- Mobile-first responsive design
- Zero bloat, zero animation fluff
- Focus on content and function

## Pages

### 1. Landing Page (Home)
- Hero section with value proposition
- Feature highlights (4 columns)
- Pricing section (Free forever)
- Tech stack showcase
- Call-to-action sections
- Footer with resources

**Key Elements:**
- Large headline: "Molecular Docking Made Simple"
- Sub: "Professional molecular docking simulations powered by AutoDock Vina"
- CTA button: "Start Docking"

### 2. Application (Dashboard)
- Header with navigation
- Hero section (Docking Dashboard)
- Two-column layout:
  - Left: Job submission form
  - Right: Job list/tracking
- Footer with resources

**Key Elements:**
- Job form with file uploads
- Advanced parameters (collapsible)
- Real-time job polling
- Status indicators
- Download results button

## Design System

### Colors

| Color | Usage | Hex |
|-------|-------|-----|
| White | Background | #ffffff |
| Gray 50 | Sections | #f9fafb |
| Gray 100 | Cards | #f3f4f6 |
| Gray 200 | Borders | #e5e7eb |
| Gray 600 | Text (secondary) | #4b5563 |
| Gray 900 | Text (primary) | #111827 |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Geist Sans | 48px | 700 |
| H2 | Geist Sans | 36px | 700 |
| H3 | Geist Sans | 24px | 700 |
| H4 | Geist Sans | 20px | 600 |
| Body | Geist Sans | 16px | 400 |
| Small | Geist Sans | 14px | 400 |

### Spacing

- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px
- 2XL: 48px

### Borders

- Color: Gray 200
- Radius: 8px
- Width: 1px

### Shadows

- None (minimalist approach)
- Use borders for definition

## Components

### Header

```
┌────────────────────────────────────────────┐
│ 🧪 dockGOAT    Features  Pricing  [Launch] │
└────────────────────────────────────────────┘
```

- Sticky positioning
- White background
- Light gray bottom border
- Navigation links
- CTA button in top right

### Hero Section

```
      Molecular Docking Made Simple
      
Professional molecular docking simulations
powered by AutoDock Vina. Free. No credit card.

         [Start Docking →]
```

- Centered text
- Large headline
- Supporting text
- Primary CTA button

### Feature Cards

```
┌─────────────────────────────┐
│ ⚡ Lightning Fast            │
│ Results in minutes, not hrs │
└─────────────────────────────┘
```

- 4 cards in grid (responsive)
- Icon + Title + Description
- White background, gray border
- No shadows

### Job Form

```
┌─────────────────────────────┐
│ New Job                     │
├─────────────────────────────┤
│ Job Name: [_____________]   │
│ Ligand:   [Choose File]     │
│ Target:   [Choose File]     │
│ ▼ Advanced Parameters       │
│           [Submit Job]      │
└─────────────────────────────┘
```

- Clean form layout
- File inputs with labels
- Collapsible advanced section
- Primary action button

### Job List

```
┌──────────────────────────────────┐
│ Jobs        🔄 Auto-refresh      │
├──────────────────────────────────┤
│ ✓ Test Docking                   │
│   Status: COMPLETED              │
│   Created: 2026-08-25 10:30      │
│   Affinity: -7.80 kcal/mol       │
│                           [↓]    │
└──────────────────────────────────┘
```

- Job cards with status
- Color-coded status (green, blue, etc)
- Metadata grid
- Download button

### Button Styles

| Style | Usage | Colors |
|-------|-------|--------|
| Primary | Main action | Gray 900 bg, white text |
| Secondary | Links | Gray 600 text |
| Disabled | Inactive | Gray 400 bg |

### Status Colors

| Status | Background | Icon |
|--------|-----------|------|
| PENDING | Gray 50 | Gray clock |
| RUNNING | Blue 50 | Blue zap |
| COMPLETED | Green 50 | Green check |
| FAILED | Red 50 | Red alert |

## Responsive Design

### Desktop (1024px+)
- 3-column layout
- Full navigation
- Side-by-side content

### Tablet (768px - 1023px)
- 2-column form/list grid
- Stack on smaller tablets
- Full navigation

### Mobile (< 768px)
- Single column layout
- Full-width forms
- Hamburger menu (optional)
- Bottom CTA buttons

## Performance Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Lighthouse Performance | 90+ | ✅ |
| Lighthouse SEO | 90+ | ✅ |
| Lighthouse Best Practices | 90+ | ✅ |
| Lighthouse Accessibility | 90+ | ✅ |
| First Contentful Paint | < 1.5s | ✅ |
| Largest Contentful Paint | < 2.5s | ✅ |

## Accessibility

- ✅ WCAG 2.1 Level AA compliant
- ✅ Proper heading hierarchy
- ✅ Semantic HTML
- ✅ ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Color contrast meets standards
- ✅ Focus indicators visible

## SEO

### Meta Tags

```html
<title>dockGOAT - Molecular Docking</title>
<meta name="description" 
      content="Professional molecular docking with AutoDock Vina. Free. No credit card required." />
<meta name="keywords" 
      content="molecular docking, autodock vina, drug discovery, free" />
<meta name="og:title" content="dockGOAT - Molecular Docking" />
<meta name="og:description" content="Professional molecular docking..." />
<meta name="og:image" content="og-image.png" />
```

### Schema Markup

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "dockGOAT",
  "description": "Molecular docking SaaS",
  "applicationCategory": "Scientific",
  "offers": {
    "@type": "Offer",
    "price": "0"
  }
}
```

## Browser Testing Checklist

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Print view
- [ ] Dark mode (if applicable)

## Form Validation

### Job Name
- Required
- Min 3 characters
- Max 100 characters
- Error: "Enter a job name (3-100 chars)"

### File Uploads
- Required
- Ligand: .pdbqt, .sdf
- Target: .pdbqt
- Max: 50 MB each
- Error: "Invalid file format or size"

### Vina Parameters
- Center: -999 to 999 (float)
- Size: 1 to 100 (float)
- Exhaustiveness: 1 to 32 (int)
- Num Modes: 1 to 20 (int)
- Energy Range: 0.1 to 10 (float)

## Loading States

- Skeleton loaders on initial load
- Spinning icon during submission
- "Loading..." text in cards
- Disabled buttons during submission
- Progress indication for long operations

## Error Handling

- Toast notifications (top-right)
- Inline field validation
- Helpful error messages
- Retry buttons where applicable
- Server error page (500)

## Imagery

- No unnecessary images
- Icons from lucide-react
- Simple SVG illustrations
- Clean screenshots
- Code blocks with syntax highlighting

## Copy/Microcopy

- Clear and concise
- Action-oriented buttons
- Helpful tooltips
- Consistent terminology
- No jargon (explain tech terms)

## Call-to-Action Strategy

| Section | CTA | Destination |
|---------|-----|-------------|
| Hero | "Start Docking" | App login |
| Features | Implicit | Pricing |
| Pricing | "Get Started" | Sign up |
| Tech Stack | Implicit | Docs |
| Bottom | "Open App" | Dashboard |

## Analytics Setup

```javascript
// Google Analytics
gtag('config', 'GA_ID', {
  page_path: window.location.pathname,
});

// Track events
gtag('event', 'job_submitted', {
  job_id: jobId,
  job_name: jobName
});
```

## Future Enhancements

- [ ] Dark mode toggle
- [ ] Advanced filtering on job list
- [ ] Job templates
- [ ] Batch operations
- [ ] CSV export
- [ ] Email notifications
- [ ] API dashboard
- [ ] Usage analytics

---

**Design Principles:**
1. **Minimalist** - Only necessary elements
2. **Professional** - Enterprise appearance
3. **Fast** - Optimized performance
4. **Accessible** - Inclusive design
5. **Responsive** - All devices
6. **Usable** - Clear intent
7. **Scalable** - Handles growth

**Updated:** 2026-08-25
**Version:** 1.0
