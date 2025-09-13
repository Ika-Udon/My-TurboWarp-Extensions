# Scratch Text Drawing Extension (Lightweight Version)

This extension adds powerful text drawing capabilities to Scratch sprites.  
It allows detailed control over fonts, colors, outlines, vertical writing, and more.  
Unlike anima text, it is not specialized for animation.
---

## Main Features

- **Text Display / Restore**
  - Display specified text strings as the sprite's appearance
  - Includes a function to revert to the original costume
- **Text Decoration**
  - Font (Default + Custom)
  - Size, Color, Opacity
  - Character Spacing, Line Spacing
  - Left Align / Center / Right Align
  - Weight (Stroke Thickness)
  - Outline color/thickness
  - Vertical writing (left/right padding)
  - Resolution (0.25x–4x)
  - Anti-aliasing ON/OFF
  - Auto-wrap (specify character count)
  - Text width (specify px)
- **Inline Tags**
  - Apply decorations to specific sections
  - Example:
    ```text
    Hello <color=“#ff0000”>red text
    <font=“Serif”>Serif font
    <f_size=40>Large text
    <alpha=50>Semi-transparent
    <edge c="#0000ff" t=2>Blue outline
    ```
- **Information Retrieval**
  - Can retrieve current font, size, color, transparency, alignment, stroke settings, vertical writing state, resolution, text content, etc.
- **Clone Compatibility**
  - Settings and text are preserved when creating clones
---
# Inline Tag Reference

This extension allows you to partially modify character decorations and layouts by embedding tags within text.  
Tags are written in the format `<tag-name=value>` and can be reversed with a closing tag `</tag-name>` if needed.

---

## 📑 Tag List

| Tag | Attribute | Description | Example |
|------|------|------|--------|
| `<color>` | `“#RRGGBB”` or color name | Change text color | `<color=“#ff0000”>Red text</color>` |
| `<font>` | `“font name”` | Change font (supported font names) | `<font=“Serif”>Serif font</font>` |
| `<f_size>` | Numeric value (px) | Change text size | `<f_size=40>Large text</f_size>` |
| `<space>` | Numeric value (px) | Change character spacing (negative values decrease spacing) | `<space=10>Wider spacing</space>` |
| `<alpha>` | 0–100 | Change transparency (%) | `<alpha=50>Semi-transparent</alpha>` |
| `<thickness>` | Numeric value (px) | Change text thickness (stroke weight) | `<thickness=3>Bold text</thickness>` |
| `<edge>` | `c=“#RRGGBB”` (color) / `t=number` (thickness) | Set border color and thickness | `<edge c="#0000ff" t=2>Blue border</edge>` |

---

## Notes
- Tags do not require closing tags and apply to subsequent text, but can be reverted with a closing tag if needed.
- Multiple attributes can be specified simultaneously (e.g., `<edge c="#ff0000" t=3>`).
- Tags can be nested.
---

## Installation
1. Load as a custom extension from TurboWarp, etc.
2. Use the block within your project
---
If you encounter bugs or issues, → https://scratch.mit.edu/users/Ika_Udon/

Translated with DeepL.com (free version)
