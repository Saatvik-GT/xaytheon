---
name: Xaytheon
description: A spectroscope for neural networks. Light in, the model as a laminated prism, layers out as spectral lines you can read and cut.
colors:
  bg: "#000000"
  surface: "#0a0a0a"
  surface-2: "#111111"
  surface-3: "#191919"
  line: "#1f1f1f"
  line-2: "#2e2e2e"
  line-3: "#474747"
  fg: "#ededed"
  fg-2: "#a1a1a1"
  fg-3: "#8a8a8a"
  scrollbar-thumb: "#2b2b2b"
  scrollbar-thumb-hover: "#3a3a3a"
  beam-white: "#ffffff"
  spectrum-input-red: "#ff0000"
  spectrum-output-violet: "#7600ee"
typography:
  display:
    fontFamily: "Spectral, 'Iowan Old Style', Georgia, serif"
    fontSize: "clamp(60px, 8vw, 96px)"
    fontWeight: 300
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Spectral, 'Iowan Old Style', Georgia, serif"
    fontSize: "clamp(36px, 4.6vw, 56px)"
    fontWeight: 300
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "Spectral, 'Iowan Old Style', Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  brand-sm:
    fontFamily: "Spectral, 'Iowan Old Style', Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  card-title:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  lead-lg:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body-lead:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-lg:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  control-lg:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1
  body:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  data:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  micro:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  micro-sm:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  micro-xs:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  micro-caption:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "9.5px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
  micro-axis:
    fontFamily: "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  micro-1: "1px"
  micro-2: "2px"
  micro-3: "3px"
  xs: "4px"
  tile: "5px"
  sm: "6px"
  md: "8px"
  scrollbar: "10px"
  frame: "12px"
spacing:
  gutter: "clamp(16px, 3vw, 32px)"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "clamp(104px, 13vw, 168px)"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.surface-2}"
  button-primary:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.beam-white}"
  button-primary-lg:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.sm}"
    height: "36px"
  segmented:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.sm}"
    padding: "2px"
  segmented-selected:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xs}"
    height: "26px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  text-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  op-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.tile}"
    padding: "0 9px"
    height: "24px"
  layer-row-selected:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
---

# Design System: Xaytheon

## Overview

**Creative North Star: "The Spectroscope"**

Xaytheon is an optical instrument, not a dashboard. The ground is a true-black viewing chamber; the chrome is white, grey and 1px hairlines; and the only colour anywhere is the visible spectrum, which only ever encodes data. A layer's hue is where it falls in the network, red at the input and violet at the output. Activations are light: a unit that fires harder glows from black through its hue to white. Cut units are black absorption lines. You hold the light, the model is a laminated glass prism, and its layers leave as a spectrum of discrete emission lines.

The system has two surface modes in one world. The landing persuades: a full-bleed laminated glass prism (three.js, real dispersion) that you steer by hand carries the hero, a live optics readout runs along its foot, a Spectral serif speaks the section titles, and the same twelve emission lines land flat on the page as the spectral rule. The lab operates: a dense three-pane instrument (input/output, inspector, layers) under a spectrum strip that spans the top, set in Geist with every number in Geist Mono. Density is high in the lab and generous on the landing; the materials never change between them.

It refuses grey dashboard panels, node-graph diagrams and glass panels. Depth comes from tonal steps of near-black and a single hairline weight, never from frosted surfaces or decorative colour.

**Key Characteristics:**
- True-black ground (#000) with near-black tonal surfaces stepping up in 1–2% increments.
- The visible spectrum is the only colour, and it is always data: layer position, activation, sign.
- One hairline weight (1px) for every border and divider.
- Spectral serif (300) for the wordmark and section titles only; Geist for UI; Geist Mono for every number.
- White is the action colour: the primary button is the beam.
- Restrained, slow optical motion on one easing curve; everything collapses under reduced motion.

## Colors

A monochrome instrument chamber where the visible spectrum, computed from wavelength, is the only chromatic voice.

### Primary
- **Beam White** (fg, with Pure White on hover): the action colour. The primary button is a white slab with black text; selected states, the focus ring, the range thumb, probability bars and the selected spectrum band are all white. White means "the light itself".

### Secondary
- **The Visible Spectrum** (Input Red to Output Violet): not a fixed swatch but a function. A layer at position t along the network takes the wavelength 680nm − t × 265nm (680nm input, 415nm output), converted to sRGB with a gamma of 0.8 (`src/viz/spectrum.ts`). It appears as layer hue dots, op-chip lights, the Spectrum strip, heatmaps, and the prism's laminate planes. Positive activations follow the emission ramp black → hue → white (hue reached at 62% of the range); negatives follow a ramp from black to a grey shade of the same hue (82% grey, 18% hue) that never reaches white, so hue keeps meaning only "where in the network".

The landing's light is a fixed emission spectrum rather than a ramp: twelve lines at 668, 656, 615, 589, 570, 546, 518, 501, 486, 458, 434 and 416nm with set intensities (`EMISSION_LINES` in `src/viz/spectrum.ts`), each coloured by the same wavelength function. They are the light itself, so they appear only in the hero prism and the spectral rule, as discrete lines, never as a continuous rainbow gradient and never as accent colours.

### Neutral
- **Chamber Black** (bg): page ground, canvas and heatmap backgrounds, text-field fill, the black of absorption lines.
- **Soot** (surface): cards, menus, attention head tiles.
- **Graphite** (surface-2): hover fill, segmented-control track, chips, tooltips, toasts.
- **Lit Graphite** (surface-3): selected and pressed fills (selected segment, selected layer row, bar tracks).
- **Hairline** (line): the default 1px divider and tile border.
- **Hairline Strong** (line-2): button borders, field borders, menu and tip borders.
- **Hairline Lit** (line-3): hover borders, error-alert borders, the range track, the lab bar's breadcrumb slash.
- **Paper** (fg): primary text.
- **Ash** (fg-2): secondary text, leads, readouts.
- **Smoke** (fg-3): tertiary text, meta, axis labels, captions, placeholders, cut-tile dashed borders.
- **Scrollbar Thumb** (scrollbar-thumb, scrollbar-thumb-hover on hover): the thin themed scrollbar, sitting between Hairline Strong and Hairline Lit so it reads as part of the chamber.

There are no status colours. Errors use the neutral palette and carry an icon (see Components).

### Named Rules
**The Light Is Data Rule.** Spectral colour is never decoration. If a hue appears, it must answer "where in the network" or "how strongly did it fire". UI chrome stays black, white and grey.

**The Spectrum Only As Light Rule.** Fixed spectral colour appears only where the light itself is drawn: the twelve emission lines (hero prism and spectral rule) and the brand mark's three rays. Nothing else gets a hue that does not come from data.

**The One Hue Per Layer Rule.** A layer owns exactly one hue. Sign is shown by brightness and greying of that hue, never by borrowing a second colour (no red/blue diverging maps).

**The Absorption Line Rule.** A cut is shown as black: a black line in a spectrum, a heatmap dimmed to near-black (opacity 0.1–0.12) inside a dashed Smoke border, or a striped Smoke bar. Never a red "disabled" colour.

## Typography

**Display Font:** Spectral (with Iowan Old Style, Georgia, serif)
**Body Font:** Geist Variable (with ui-sans-serif, system-ui, Segoe UI)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace, SFMono-Regular, Menlo, Consolas)

**Character:** A light, high-contrast serif gives the instrument a scientific voice at large sizes; Geist and Geist Mono make the working surface precise and quiet. All three are self-hosted via @fontsource.

### Hierarchy
- **Display** (Spectral 300, clamp(60px, 8vw, 96px), 0.92): the Xaytheon wordmark in the hero only. Optically pulled left by −0.045em.
- **Headline** (Spectral 300, clamp(36px, 4.6vw, 56px), 1.04): landing section titles, balanced wrap. The brand name in nav (Spectral 400, 22px) and footer (18px) uses the same face.
- **Title** (Geist 500, 24px, 1.1, −0.03em): lab model title; verdicts run the same voice larger (30px). Large sans lines tighten tracking (−0.03 to −0.035em); the hero tagline is Geist 400 at clamp(28px, 3.1vw, 40px).
- **Body Lead** (Geist 400, 16–17px, 1.6): hero and section leads, held to 40–64ch, Ash on the landing.
- **Body** (Geist 400, 14px, 1.5): the base UI size.
- **Label** (Geist 500, 13px): pane titles, button labels at 14px, segmented labels at 12.5px. Sentence case, no tracking, never uppercase.
- **Data** (Geist Mono 400, 12–13px, tabular numerals): every number, shape, op name, percentage and token at reading size.

### Micro tier
The instrument's annotation layer: small labels that sit on or beside a visual and are read at a glance. Almost all in Geist Mono with tabular numerals, coloured Smoke or Ash (unit labels on heatmaps use 75–78% white with a black text-shadow).
- **Micro** (11px): spectral-rule caption, layer index, scope and meta lines, drift and delta readouts, token counts, model meta, How-it-works step numbers, spectrum axis ticks.
- **Micro Small** (10.5px): spectrum drift labels, histogram captions, class-bar column headers, camera size and live tags.
- **Micro XS** (10px): indices printed on map tiles and unit tiles, attention token rows.
- **Micro Caption** (9.5px): the drawpad's model-input preview caption.
- **Micro Axis** (9px): attention matrix row and column labels.

Above body size the sans steps through **Body Large** (Geist 400, 15px, 1.65; How-it-works step bodies), **Control Large** (Geist 500, 15px; large buttons, including the hero actions), **Lead Large** (Geist 400, 17px, 1.6; the hero lead at 40ch and landing section leads, 16px under 720px) and **Card Title** (Geist 500, 17px, 1.25, −0.015em; gallery model names). The brand name is Spectral 400 at 22px in the landing nav and 19px in the lab bar.

### Named Rules
**The Mono Numbers Rule.** Any value an engineer might trust (counts, shapes, percentages, drift, coordinates, wavelengths) is set in Geist Mono with tabular numerals. Minus signs are true minus (−).

**The Serif Speaks Twice Rule.** Spectral appears only as the wordmark and section-level titles (plus the How-it-works step list on the landing). It never sets UI labels, buttons or data.

## Layout

The landing is full-bleed black with a side gutter of clamp(16px, 3vw, 32px). The hero fills max(640px, 100svh): the prism canvas covers it edge to edge (masked to fade out over the bottom 22%), with a 620px left copy column (wordmark, tagline, lead, two actions) and an optics readout pinned across the foot of the hero above a faint 1px hairline. Sections are capped at 1180px, start with clamp(104px, 13vw, 168px) of top space, and vary their layouts: centred title + full-width demo card, a 5:7 copy/graph split, a split header over a four-column gallery whose featured card spans two, a 1:1 copy/spec-list split, and a centred close. Under 720px the hero copy drops to the bottom of the viewport over the prism and every grid collapses to one column.

The lab fills 100svh as a column: a 52px bar, a head row of title and facts, the Spectrum strip spanning the full width, then a three-column main grid (320px / fluid / 300px, narrowing to 300 / fluid / 260 under 1200px) of independently scrolling panes separated by 1px hairlines. Under 900px it becomes a single scrolling column with a sticky bar and a segmented control that shows one pane at a time (Input, Inspect, Layers).

Spacing runs on a small step scale (6, 8, 12, 16, 20px) inside panes and cards; panes pad 16px 20px, cards 16–20px.

## Elevation & Depth

Flat, tonal and hairline. Depth is near-black stepping up through Soot, Graphite and Lit Graphite, separated by 1px lines. Shadows exist only on things that genuinely float or lift off the chamber, and they are dark, not grey: on true black a shadow reads as falloff, so landing cards add a faint upward white bloom as if lit by the beam. No backdrop blur, no frosted glass.

### Shadow Vocabulary
- **Beam-lit card** (`box-shadow: 0 40px 80px -48px rgb(255 255 255 / 0.07), 0 24px 48px -24px rgb(0 0 0 / 0.9)`): landing demo and graph cards.
- **Floating menu** (`box-shadow: 0 20px 48px -16px rgb(0 0 0 / 0.95), 0 2px 6px rgb(0 0 0 / 0.5)`): dropdown menus.
- **Toast / tooltip** (`box-shadow: 0 16px 40px -16px rgb(0 0 0 / 0.9)`; tooltips `0 8px 24px -8px`): transient overlays.
- **Pressed-in segment** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.6), inset 0 0 0 1px var(--line-2)`): the selected segment.
- **Selected band glow** (`box-shadow: inset 0 0 0 1px #fff, 0 0 18px rgb(255 255 255 / 0.22)`): a selected band in the Spectrum; light, not shadow.

### Named Rules
**The No Glass Rule.** No frosted or blurred panels. A UI surface is opaque near-black; the only translucency is a black scrim laid over imagery or canvas.

## Shapes

Gently rounded, small radii: 8px for cards, menus, drawpad and image frames; 6px for buttons, fields, segmented tracks and layer rows; 5px for map tiles and op chips; 4px for segments, thumbnails, sample tiles and the spectrum canvas. A micro tier rounds tiny marks just enough to soften their pixels: 3px for probability-bar tracks, legend swatches and tokens; 2px for spectrum hit areas, sign-key swatches, the progress bar and range tracks; 1px for neuron bars and the tops of spectral-rule lines. Two larger radii are single-purpose: 10px for the scrollbar thumb and 12px for the full-page drop frame. Data tiles stay square (aspect-ratio 1) and heatmaps render pixelated, never smoothed. Every border is 1px; dashed 1px borders mean "cut" or "empty". The brand mark is a stroked triangle prism that splits a white line into three spectral rays.

## Components

### Buttons
Quiet, exact, and white when it matters.
- **Shape:** gently rounded (6px), heights 28 / 36 / 44px for sm / default / lg, 16px Lucide icon with an 8px gap.
- **Primary:** Beam White fill, black text, Geist 500. Hover goes to pure white; active dips to #d6d6d6. One per view: "Open the lab" in the hero, "Open <model>" and equivalents elsewhere.
- **Default:** transparent with a Hairline Strong border; hover fills Graphite and lifts the border to Hairline Lit; active Lit Graphite. Over the prism canvas it takes a black scrim backing (78% black) so the light lines do not show through.
- **Quiet:** no border, Ash text, Graphite fill on hover. Used for icon buttons and toolbars.
- **Focus:** 2px Paper outline at 2px offset on every interactive element.

### Segmented Control
- **Style:** Graphite track, 1px Hairline border, 2px inner padding; segments 26px tall, Ash text at 12.5px.
- **State:** the selected segment is Lit Graphite with Paper text, inset Hairline Strong and a 1px dark drop. Drives lab tabs on narrow screens and view switches in the inspector.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Soot on Chamber Black; hover lifts to #0d0d0d and Hairline Lit.
- **Shadow Strategy:** Beam-lit card on the landing only; lab panes are flat and divided by hairlines.
- **Border:** 1px Hairline; card header and footer bars are 44px with a hairline rule.
- **Internal Padding:** 16–20px.

### Inputs / Fields
- **Style:** Chamber Black fill, 1px Hairline Strong border, 6px radius, mono text at 13px.
- **Focus:** border brightens to Smoke; keyboard focus uses the Paper ring.
- **Error:** neutral, never a status colour. Inline alerts are Graphite with a 1px Hairline Lit border, Paper text and a 16px Lucide circle-alert icon; field errors are Paper text below the field. The icon and wording carry the meaning.
- **Toggles and ranges:** a 26×16 pill toggle that turns Paper with a black knob; a 2px Hairline Lit range track with a 14px Paper thumb.

### Navigation
- **Landing:** transparent 64px bar over the hero: prism mark and Spectral wordmark, no separator; Ash links that turn Paper on hover; links hide under 860px.
- **Lab:** 52px bar with the mark, a Hairline Lit "/" breadcrumb, the small Spectral wordmark, the model menu trigger (Graphite on hover/open) and a Soot dropdown of models with name and Smoke subtitle.

### Chips
- **Op chip:** 24px Graphite chip, 1px Hairline Strong border, mono op name, preceded by a 7px dot of the layer's hue with a soft glow of the same hue. The only place a hue lights UI chrome, because it is naming a layer.

### Spectrum Strip (signature)
The model rendered as an emission spectrum: one band per layer in that layer's hue, brightness from its activations, cut units drawn as black absorption lines, and per-layer drift printed underneath in mono. Hover outlines a band at 40% white; the selected band gets a white inset ring, a white glow and a 4px caret. It spans the full lab width under the head.

### Unit Tiles and Layer Rows
- **Unit tiles:** square, black, 1px Hairline border at 6px radius, mono index label bottom-left; hover Hairline Lit; press scales to 0.97; cut tiles go dashed Smoke with the map at 0.1 opacity and greyscale.
- **Layer rows:** 22px index, 36px thumbnail, op with hue dot, mono meta; hover Graphite; selected Lit Graphite with an inset Hairline Strong ring.

### Prism Hero (signature, landing)
You steer the light. A glowing source rides a fixed arc beside the glass (incidence about 34–64°). The pointer's height alone picks its place on the arc (smoothstep over the vertical range), and horizontal position only sets how far out it sits. Angle and radius each move on critically damped springs (ω 5.5 while the pointer is active, 1.2 when idle), so the light glides and never snaps, even when the cursor jumps. After 4s without pointer movement it breathes ±0.07 rad around where it was left rather than drifting to a default spot. Its light is the twelve-line emission spectrum, so it leaves the glass as discrete crisp lines, not a rainbow. The glass is a bevelled, laminated block (depth 2.1) rendered in two passes, refracting per wavelength (Snell's law, Cauchy dispersion) with total internal reflection on the side faces. Every surface splits light by Fresnel reflectance, softened by averaging over ±0.05 rad of incidence so lines fade over a couple of degrees as total internal reflection takes over instead of blinking. Line strength follows the transmitted weight raised to the power 1.4, so ghost spectra from internal reflection and the faint externally reflected beam stay faint naturally. Beam geometry is preallocated and rewritten in place, so moving the light does not allocate. Nine laminate planes inside the glass glow in their layer hue (input red to output violet) where the beam crosses them. A forward-pass pulse runs source → glass → lines, red first and violet last, every 7s or on click/tap, flaring each laminate plane as it passes. The glass floats and sways (yaw ±0.09 rad, pitch ±0.035 rad, a small bob, pointer parallax). The canvas fades in over 1.4s; a static drawing stands in when WebGL is unavailable, rendering pauses off-screen, and reduced motion gets a calmer scene.

### Hero Readout (landing)
The instrument's own readout along the foot of the hero, above a faint 1px hairline: a sans hint ("Move the light. Click to send a pass."; on touch, "Tap to move the light and send a pass.") on the left and a mono list of live incidence, deviation and visible lines on the right, at 12px in Smoke and Ash.

### Spectral Rule (landing)
The hero's light landed on the page: the same twelve emission lines laid flat on a 1px Hairline Strong track, red (input) on the left and violet (output) on the right. Each is a 2px tick, 10px + intensity × 16px tall, in its own wavelength colour with a glow of the same colour. On entry they light up in order (0.9s each, staggered 70ms), like a forward pass, with a mono caption beneath; under reduced motion they show lit.

## Do's and Don'ts

### Do:
- **Do** keep the ground true black (#000) and build depth with Soot, Graphite and Lit Graphite plus 1px hairlines.
- **Do** derive every colour that carries meaning from wavelength via `src/viz/spectrum.ts`: red (680nm) at the input, violet (415nm) at the output.
- **Do** render activations as emission (black → hue → white) and negatives as a grey shade of the same hue.
- **Do** show cuts as black absorption: black lines, near-black dimmed maps, dashed Smoke borders.
- **Do** set every number in Geist Mono with tabular numerals.
- **Do** use Spectral 300 only for the wordmark and section titles, with negative tracking.
- **Do** make the primary action a Beam White button, one per view.
- **Do** animate on `cubic-bezier(0.16, 1, 0.3, 1)`, keep UI transitions at 0.15s, and honour reduced motion.
- **Do** use Lucide SVG icons at 13–18px, stroked, in currentColor.
- **Do** keep errors and live indicators neutral (Graphite, Hairline Lit, Paper) and let an icon or a pulse carry the signal.

### Don't:
- **Don't** use spectral hues for decoration, brand accents, status or links; colour is always data (the brand mark's three rays and the twelve emission lines are the light itself, not accents).
- **Don't** draw the light as a continuous rainbow gradient; it is always discrete emission lines.
- **Don't** use diverging two-hue colour maps; one hue per layer, sign by greying.
- **Don't** build grey dashboard panels or node-graph diagrams to explain a model; show it running.
- **Don't** use frosted glass panels or backdrop blur; translucent black scrims over imagery and canvases (overlays, captions, tag chips) are part of the chamber and allowed.
- **Don't** introduce a second border weight; every border and divider is 1px (the 2px focus ring and the 2px spectral-rule ticks are not borders).
- **Don't** set UI labels, buttons or numbers in the serif, or set numbers in proportional figures.
- **Don't** use uppercase tracked labels, kickers or eyebrows above titles.
- **Don't** smooth heatmaps; they render pixelated.
