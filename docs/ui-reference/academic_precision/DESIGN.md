---
name: Academic Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#475e8c'
  primary: '#03224d'
  on-primary: '#ffffff'
  primary-container: '#1f3864'
  on-primary-container: '#8ba2d5'
  inverse-primary: '#afc6fb'
  secondary: '#006972'
  on-secondary: '#ffffff'
  secondary-container: '#96eef9'
  on-secondary-container: '#006d77'
  tertiary: '#1b2336'
  on-tertiary: '#ffffff'
  tertiary-container: '#30384d'
  on-tertiary-container: '#9aa2ba'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#afc6fb'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#2e4673'
  secondary-fixed: '#98f0fb'
  secondary-fixed-dim: '#7cd4df'
  on-secondary-fixed: '#001f23'
  on-secondary-fixed-variant: '#004f56'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-body:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-meta:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-tablet: 1rem
  margin: 2rem
  margin-tablet: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system serves an academic engineering environment, tailored specifically for collegiate computer science departments. It balances rigor, institutional credibility, and high-efficiency workflow management across dual personas: Students navigating algorithmic rigor and deadlines, and Instructors/TAs managing grading matrices, code verification, and plagiarism audits.

The aesthetic fuses **Corporate/Modern** precision with an **Academic Workbench** utility:
- **Atmosphere:** Calm, ordered, deeply structured, and distraction-free. It avoids trendy consumer micro-interactions in favor of high-throughput data legibility, low eye-fatigue under prolonged code reviews, and absolute clarity regarding submission states and grading outcomes.
- **Tone:** Methodical, objective, high-contrast, and authoritative.
- **Platform Focus:** Primarily calibrated for desktop workflows (1440px wide canvas with dense dual-pane views) with clean adaptive layouts down to tablet landscape/portrait (1024px and 768px).

## Colors
The color architecture relies on high-contrast, accessible token tiers designed to separate structural chrome (navigation, persistent shells) from dynamic workspace contexts (evaluation panes, code editors, and data tables).

### Core Roles
- **Primary Navy (`#1F3864`):** Used for primary system chrome (sidebar, app headers, modal header bars, institutional accents) to anchor the application with academic authority.
- **Accent Teal (`#0E7C86`):** The primary interactive driver. Used for active tabs, key CTAs, focus indicators, interactive links, and selection states.
- **Neutral & Surface Hierarchy:**
  - Canvas / Page Base: `#F8FAFC` (Off-white)
  - Card & Modal Surfaces: `#FFFFFF` (Crisp White)
  - Structural Borders: `#E2E8F0` (Light Slate Border)
  - Divider Lines & Sub-rules: `#CBD5E1` (Muted Slate Divider)
- **Typography Neutrals:**
  - Primary Content / Headings / Code Annotations: `#0F172A`
  - Secondary Labels / Metadata / Empty states: `#475569`
  - Inactive / Disabled Text: `#94A3B8`

### Semantic Status Architecture
Status colors must never be presented alone; always combine them with text labels and semantic icons:
- **Passed / Evaluated / Accepted:** Text `#15803D`, Background `#DCFCE7`, Border `#86EFAC`.
- **Submitted / In Queue:** Text `#1D4ED8`, Background `#DBEAFE`, Border `#93C5FD`.
- **Pending / Draft / Review Flag:** Text `#B45309`, Background `#FEF3C7`, Border `#FCD34D`.
- **Overdue / Failed / Compile Error:** Text `#B91C1C`, Background `#FEE2E2`, Border `#FCA5A5`.

### Specialized Code Surface
For the code workspace, the system shifts into a dedicated dark syntax theme:
- Surface: `#0F172A`
- Panel/Gutter Surface: `#1E293B`
- Border: `#334155`

## Typography
The system enforces `Inter` for all UI chrome, tabular figures, and administrative surfaces, combined with `JetBrains Mono` for algorithmic snippets, test cases, execution timings, and metadata tags.

- **Legibility Rules:** Tabular numbers (`font-variant-numeric: tabular-nums`) must be activated globally for table views, student roll lists, memory allocations, and execution runtime counters.
- **Micro-Copy & Headers:** Section headers leverage slight negative tracking (`-0.01em` to `-0.02em`) to maintain geometric cohesion against high-density layouts.
- **Code Hierarchies:** `code-body` handles source files and test case consoles, while `code-meta` handles memory flags, time complexity indices (e.g., $O(n \log n)$), and diff annotations.

## Layout & Spacing
The layout adheres strictly to an 8px base rhythmic grid. All paddings, margins, and dimension metrics are multiples of 4px or 8px.

### Structural Shell Layout
- **Persistent Left Navigation:** Fixed at `260px` width on desktop (`1440px+`), collapsing into a tight icon-with-flyout rail (`72px`) at tablet breakpoints (`1024px` and below).
- **Persistent Header:** Fixed height of `64px` bridging the space between the sidebar and the right viewport margin.
- **Workspace Canvas:** Uses a 12-column responsive fluid grid with strict max-bound limits for general admin screens, but unlocks to 100% fluid viewport distribution for the **Split-Pane Code Reviewer**.

### Split-Pane Code View Matrix (Desktop)
- **Left Panel (Problem Statement / Rubric / Test Cases):** 35% minimum width, collapsible.
- **Right Panel (IDE / Execution Console / Diff Viewer):** 65% standard width with resizable splitter handle.
- At tablet viewport (`1024px`), this view reflows into a segmented vertical tab stack: `[Problem / Test Cases / Code]`.

## Elevation & Depth
Depth is produced primarily through crisp, 1px structural outlines (`#E2E8F0`) backed by low-diffusion, tinted ambient shadows. Heavy skeuomorphism or blurred multi-color glows are avoided to maintain focus during intensive academic grading.

- **Level 0 (Base Canvas):** Flat `#F8FAFC`, no shadow, zero elevation.
- **Level 1 (Cards, Metric Containers, Table Wrappers):** `#FFFFFF` surface, border `1px solid #E2E8F0`, shadow `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Dropdowns, Popovers, Active Splitter Handles):** `#FFFFFF` surface, border `1px solid #CBD5E1`, shadow `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modal Dialogs, Sticky Toast Notifications):** `#FFFFFF` surface, border `1px solid #94A3B8`, shadow `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`.
- **Backdrop Scrim:** Semi-opaque dark navy `rgba(15, 23, 42, 0.60)` with a subtle `2px` blur to minimize context switching distraction when dialogs appear.

## Shapes
A disciplined 8px (`0.5rem`) radius forms the default corner geometry across all core UI controls (buttons, input boxes, metric summary cards, and modals). 

- **Outer Enclosures:** Master cards and data table wrappers utilize `rounded-lg` (`1rem` / 16px) to cleanly group inner elements.
- **Interactive Controls & Inputs:** Anchored at `rounded` (`0.5rem` / 8px).
- **Inline Indicators & Pills:** Micro tags, role badges (e.g., `STUDENT`, `FACULTY`), and run indicators maintain a full-pill curvature (`rounded-full` / 9999px) to distinctly contrast against rectangular code blocks and tables.

## Components

### 1. Navigation & Structural Shell
- **Sidebar:** Navy base (`#1F3864`) with an upper department crest, followed by an explicit Role Badge (`FACULTY / ADMIN` in solid Teal `#0E7C86` with white text, or `STUDENT` in slate border tint). Menu links feature a 4px left-border indicator in teal when active.
- **Top Bar:** Off-white/white surface (`#FFFFFF`), 64px height. Contains the active Course/Section switcher (e.g., `CS301: Data Structures - Section B`), notification bell with pending submission indicator, and user profile avatar with role badge.

### 2. Buttons & Actions
- **Primary Button:** Background `#0E7C86`, text `#FFFFFF`, 8px radius, height 40px (padding: 0 16px). Hover: `#0A5F67`. Active focus ring: `2px solid #0E7C86` with a `2px` transparent offset.
- **Secondary Button:** Background `#FFFFFF`, border `1px solid #CBD5E1`, text `#1F3864`. Hover: `#F1F5F9`.
- **Destructive Button:** Background `#B91C1C`, text `#FFFFFF`. Hover: `#991B1B`.

### 3. Status Chips & Badges
- **Specification:** Height 24px, 12px pill-radius, padding 2px 10px. Always pairing an inline status icon (check, cross, alert, clock) alongside semantic text.
- **Tokens:** Evaluated (`#DCFCE7` / `#15803D`), Submitted (`#DBEAFE` / `#1D4ED8`), Pending Review (`#FEF3C7` / `#B45309`), Overdue (`#FEE2E2` / `#B91C1C`).

### 4. Code Review Split-Pane
- **Left Inspector:** Card surface (`#FFFFFF`), structural tab controls for `[Problem Description, Rubric, Automated Test Cases]`.
- **Right Editor Workspace:** Integrated `#0F172A` dark container. Gutter showing line numbers, compilation output panel docked at the base with tabs for `Standard Output`, `Compiler Warnings`, and `Execution Time/Memory Profiler`.
- **Inline Grading:** Code line selection reveals a floating comment button that anchors an evaluation thread directly beneath the code line.

### 5. Data Tables & Metric Cards
- **Data Tables:** Dense layout, `#FFFFFF` container with `#F8FAFC` table header. Cell height 48px, text aligned vertically center. Columns support sorting toggles, filter pills, and sticky column actions (e.g., `Evaluate Code`, `Download Archive`).
- **Metric Summary Cards:** 8px border-radius, 1px border `#E2E8F0`, padding 16px. Large quantitative indicator (32px bold Inter), descriptive caption (`#475569`), and delta chip (+3.4% submission rate).

### 6. Submission Stepper
- Horizontal progress bar connecting labeled node rings: `1. Code Upload -> 2. Build & Smoke Tests -> 3. Static Analysis -> 4. Final Confirmation`. Completed steps render solid `#0E7C86` with checkmarks; active step features a pulsating dual-ring teal focus.

### 7. Form Inputs & Modals
- **Inputs:** Standard height 40px, border `1px solid #CBD5E1`, background `#FFFFFF`, text `#0F172A`. On focus: border becomes `#0E7C86` with an immediate outer focus ring (`box-shadow: 0 0 0 3px rgba(14, 124, 134, 0.2)`).
- **Modals:** Centered dialog, max-width 640px (or 960px for test case configuration), crisp header with bottom divider `#E2E8F0`, sticky footer housing standard secondary/primary button groups.