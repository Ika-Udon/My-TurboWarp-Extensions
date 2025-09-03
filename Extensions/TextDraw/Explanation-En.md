# Scratch Text Drawing Extension (Lightweight Version)

A high‑function text rendering extension for Scratch sprites.  
Allows fine‑grained control over fonts, colors, outlines, vertical writing, and more.  
Unlike **anima text**, this extension is **not** animation‑focused.

---

## Features

- **Display / Restore Text**
  - Display a specified string as the sprite’s costume
  - Restore the original costume when needed
- **Text Styling**
  - Fonts (default + custom)
  - Size, color, opacity
  - Letter spacing, line spacing
  - Alignment: left / center / right
  - Thickness (fill weight)
  - Outline color & thickness
  - Vertical writing (add left / add right)
  - Resolution (0.25× to 4×)
  - Anti‑aliasing ON/OFF
  - Auto line break (by character count)
  - Text width (in px)
- **Inline Tags**
  - Apply styles to only part of the text
  - Example:
    ```text
    Hello <color="#ff0000">red text
    <font="Serif">Serif font
    <f_size=40>Large text
    <alpha=50>Semi‑transparent
    <edge c="#0000ff" t=2>Blue outline
    ```
- **Information Retrieval**
  - Get current font, size, color, opacity, alignment, outline settings, vertical writing state, resolution, text content, etc.
- **Clone Support**
  - Settings and text are preserved when creating clones

---

# Inline Tag Reference

This extension allows you to embed tags in text to change styling or layout for specific parts.  
Tags are written in the form `<tagName=value>`, and can be reset with a closing tag `</tagName>` if needed.

---

## 📑 Tag List

| Tag | Attribute | Description | Example |
|------|----------|-------------|---------|
| `<color>` | `"#RRGGBB"` or color name | Change text color | `<color="#ff0000">Red text</color>` |
| `<font>` | `"FontName"` | Change font (must be supported by the extension) | `<font="Serif">Serif font</font>` |
| `<f_size>` | Number (px) | Change font size | `<f_size=40>Large text</f_size>` |
| `<space>` | Number (px) | Change letter spacing (negative to tighten) | `<space=10>Wide spacing</space>` |
| `<line_space>` | Number (px) | Change line spacing (column spacing in vertical writing) | `<line_space=20>Wide line spacing</line_space>` |
| `<alpha>` | 0–100 | Change opacity (%) | `<alpha=50>Semi‑transparent</alpha>` |
| `<thickness>` | Number (px) | Change stroke thickness (fill weight) | `<thickness=3>Bold text</thickness>` |
| `<edge>` | `c="#RRGGBB"` (color) / `t=number` (thickness) | Set outline color and thickness | `<edge c="#0000ff" t=2>Blue outline</edge>` |
| `<align>` | `left` / `center` / `right` | Change text alignment | `<align=center>Centered</align>` |
| `<vertical>` | `left` / `right` | Set vertical writing direction | `<vertical=right>Vertical text</vertical>` |
| `<wrap>` | Number | Set auto line break character count (0 to disable) | `<wrap=10>Break every 10 chars</wrap>` |
| `<width>` | Number (px) | Set text width (used for auto line breaks) | `<width=200>Width 200px</width>` |
| `<res>` | 0.25–4 | Change resolution scale | `<res=2>High resolution</res>` |
| `<aa>` | `on` / `off` | Enable/disable anti‑aliasing | `<aa=off>Pixelated</aa>` |

---

## Notes
- Closing tags are optional; styles will persist until changed or reset.
- Multiple attributes can be set at once (e.g., `<edge c="#ff0000" t=3>`).
- Tags can be nested.

---

## Installation
1. Load as a custom extension in TurboWarp or similar.
2. Use the provided blocks in your project.

---

## Bugs / Issues
If you find a bug or issue, please report it here:  
https://scratch.mit.edu/users/Ika_Udon/
