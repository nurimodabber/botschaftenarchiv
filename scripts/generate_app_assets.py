import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(BASE_DIR, 'assets', 'icons')
os.makedirs(ICONS_DIR, exist_ok=True)

FONT_PATH = '/System/Library/Fonts/Palatino.ttc'
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/Library/Fonts/Palatino.ttc'

# Colors
COLOR_BG_DARK = (15, 23, 42)        # Deep slate / obsidian (#0F172A)
COLOR_BG_DARKER = (10, 15, 29)      # Night sapphire (#0A0F1D)
COLOR_GOLD_LIGHT = (235, 195, 120)  # Bright gold (#EBC378)
COLOR_GOLD_MID = (200, 157, 92)     # Classic warm gold (#C89D5C)
COLOR_GOLD_DEEP = (165, 122, 60)    # Deep bronze gold (#A57A3C)
COLOR_AURA = (212, 175, 55, 38)     # Soft golden ambient glow

def get_9point_star_polygon(center_x, center_y, r_outer, r_inner):
    points = []
    for i in range(18):
        angle = math.radians(i * 20 - 90) # Start pointing straight up
        r = r_outer if i % 2 == 0 else r_inner
        points.append((center_x + r * math.cos(angle), center_y + r * math.sin(angle)))
    return points

def draw_radial_gradient(img, center, radius, color_center, color_outer):
    draw = ImageDraw.Draw(img, 'RGBA')
    cx, cy = center
    steps = int(radius)
    for i in range(steps, 0, -2):
        factor = i / radius
        r = int(color_center[0] * (1 - factor) + color_outer[0] * factor)
        g = int(color_center[1] * (1 - factor) + color_outer[1] * factor)
        b = int(color_center[2] * (1 - factor) + color_outer[2] * factor)
        a = int(color_center[3] * (1 - factor) + color_outer[3] * factor)
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, a))

def create_star_icon(size, padding_ratio=0.18, corner_radius_ratio=0.22, is_maskable=False):
    # 4x Supersampling for ultra-crisp edges
    SS = 4
    w = size * SS
    h = size * SS
    
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    corner_radius = int(w * corner_radius_ratio)
    
    # Background gradient: slight vertical gradient from dark sapphire to obsidian
    bg_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_img)
    for y in range(h):
        factor = y / h
        r = int(COLOR_BG_DARKER[0] * (1 - factor) + COLOR_BG_DARK[0] * factor)
        g = int(COLOR_BG_DARKER[1] * (1 - factor) + COLOR_BG_DARK[1] * factor)
        b = int(COLOR_BG_DARKER[2] * (1 - factor) + COLOR_BG_DARK[2] * factor)
        bg_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
        
    # Mask background
    mask = Image.new('L', (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    if is_maskable or corner_radius <= 0:
        mask_draw.rectangle([0, 0, w, h], fill=255)
    else:
        mask_draw.rounded_rectangle([0, 0, w, h], radius=corner_radius, fill=255)
        
    img.paste(bg_img, (0, 0), mask=mask)
    
    # Add subtle central golden radial aura
    aura_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    aura_radius = int(w * 0.45)
    draw_radial_gradient(aura_img, (w // 2, h // 2), aura_radius, (212, 175, 55, 60), (212, 175, 55, 0))
    img = Image.alpha_composite(img, aura_img)
    
    # Subtle inner border
    if not is_maskable:
        border_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        border_draw = ImageDraw.Draw(border_img)
        if corner_radius > SS * 2:
            border_draw.rounded_rectangle([SS*2, SS*2, w - SS*2, h - SS*2], radius=corner_radius - SS*2, outline=(200, 157, 92, 45), width=SS*2)
        else:
            border_draw.rectangle([SS*2, SS*2, w - SS*2, h - SS*2], outline=(200, 157, 92, 45), width=SS*2)
        img = Image.alpha_composite(img, border_img)

    # 9-pointed star
    actual_padding = padding_ratio if not is_maskable else padding_ratio * 1.6
    star_box_r = (w // 2) * (1.0 - actual_padding)
    r_outer = star_box_r
    r_inner = star_box_r * 0.5217
    
    cx, cy = w // 2, h // 2
    poly = get_9point_star_polygon(cx, cy, r_outer, r_inner)
    
    # Soft shadow under star
    shadow_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_img)
    shadow_draw.polygon(poly, fill=(0, 0, 0, 130))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=SS * 3))
    img = Image.alpha_composite(img, shadow_img)
    
    # Star gradient texture: Light gold at top to deep gold at bottom
    star_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    star_draw = ImageDraw.Draw(star_img)
    
    star_mask = Image.new('L', (w, h), 0)
    s_mask_draw = ImageDraw.Draw(star_mask)
    s_mask_draw.polygon(poly, fill=255)
    
    y_min = cy - r_outer
    y_max = cy + r_outer
    y_span = max(1, y_max - y_min)
    
    grad_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad_img)
    for y in range(int(y_min), int(y_max) + 1):
        f = (y - y_min) / y_span
        r = int(COLOR_GOLD_LIGHT[0] * (1 - f) + COLOR_GOLD_MID[0] * f)
        g = int(COLOR_GOLD_LIGHT[1] * (1 - f) + COLOR_GOLD_MID[1] * f)
        b = int(COLOR_GOLD_LIGHT[2] * (1 - f) + COLOR_GOLD_MID[2] * f)
        g_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
        
    star_img.paste(grad_img, (0, 0), mask=star_mask)
    
    # Add subtle facet lines from center to outer points
    facet_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(facet_img)
    for i in range(0, 18, 2):
        px, py = poly[i]
        f_draw.line([(cx, cy), (px, py)], fill=(255, 255, 255, 55), width=max(1, SS))
    for i in range(1, 18, 2):
        px, py = poly[i]
        f_draw.line([(cx, cy), (px, py)], fill=(0, 0, 0, 50), width=max(1, SS))
        
    star_faceted = Image.composite(Image.alpha_composite(star_img, facet_img), star_img, star_mask)
    img = Image.alpha_composite(img, star_faceted)
    
    # Downsample back to target size with high-quality Lanczos resampling
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def create_og_image():
    # Standard social preview banner: 1200 x 630 px
    w, h = 1200, 630
    img = Image.new('RGBA', (w, h), COLOR_BG_DARKER)
    draw = ImageDraw.Draw(img)
    
    # Deep celestial gradient
    for y in range(h):
        factor = y / h
        r = int(COLOR_BG_DARKER[0] * (1 - factor) + COLOR_BG_DARK[0] * factor)
        g = int(COLOR_BG_DARKER[1] * (1 - factor) + COLOR_BG_DARK[1] * factor)
        b = int(COLOR_BG_DARKER[2] * (1 - factor) + COLOR_BG_DARK[2] * factor)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
        
    # Large ambient glowing aura on the left
    cx_star = 240
    cy_star = 315
    aura_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw_radial_gradient(aura_img, (cx_star, cy_star), 280, (212, 175, 55, 75), (212, 175, 55, 0))
    img = Image.alpha_composite(img, aura_img)
    
    # Decorative subtle celestial border
    draw = ImageDraw.Draw(img)
    draw.rectangle([24, 24, w - 24, h - 24], outline=(200, 157, 92, 45), width=1)
    draw.rectangle([28, 28, w - 28, h - 28], outline=(200, 157, 92, 22), width=1)
    
    # Render star on left side
    star_r = 150
    poly = get_9point_star_polygon(cx_star, cy_star, star_r, star_r * 0.5217)
    
    star_mask = Image.new('L', (w, h), 0)
    s_draw = ImageDraw.Draw(star_mask)
    s_draw.polygon(poly, fill=255)
    
    star_grad = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sg_draw = ImageDraw.Draw(star_grad)
    for y in range(int(cy_star - star_r), int(cy_star + star_r) + 1):
        f = (y - (cy_star - star_r)) / (2 * star_r)
        r = int(COLOR_GOLD_LIGHT[0] * (1 - f) + COLOR_GOLD_MID[0] * f)
        g = int(COLOR_GOLD_LIGHT[1] * (1 - f) + COLOR_GOLD_MID[1] * f)
        b = int(COLOR_GOLD_LIGHT[2] * (1 - f) + COLOR_GOLD_MID[2] * f)
        sg_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
        
    img.paste(star_grad, (0, 0), mask=star_mask)
    
    # Add subtle facet lines on OG star
    for i in range(0, 18, 2):
        px, py = poly[i]
        draw.line([(cx_star, cy_star), (px, py)], fill=(255, 255, 255, 60), width=2)
    for i in range(1, 18, 2):
        px, py = poly[i]
        draw.line([(cx_star, cy_star), (px, py)], fill=(0, 0, 0, 60), width=2)
    
    # Typography on right side
    tx = 450
    
    font_eyebrow = ImageFont.truetype(FONT_PATH, 18, index=2) # Bold
    font_title_1 = ImageFont.truetype(FONT_PATH, 44, index=0) # Roman
    font_title_2 = ImageFont.truetype(FONT_PATH, 44, index=2) # Bold
    font_sub = ImageFont.truetype(FONT_PATH, 22, index=1)     # Italic
    font_badge = ImageFont.truetype(FONT_PATH, 16, index=0)   # Roman
    
    # Eyebrow
    draw.text((tx, 150), "OFFIZIELLE SAMMLUNG & FORSCHUNGSBIBLIOTHEK", fill=COLOR_GOLD_MID, font=font_eyebrow)
    
    # Title
    draw.text((tx, 195), "Bahá’í-Bibliothek", fill=(255, 255, 255), font=font_title_2)
    draw.text((tx, 250), "& Botschaften-Archiv", fill=COLOR_GOLD_LIGHT, font=font_title_1)
    
    # Divider line
    draw.line([(tx, 325), (tx + 660, 325)], fill=(200, 157, 92, 90), width=2)
    
    # Subtitle
    draw.text((tx, 350), "Universales Haus der Gerechtigkeit • Heilige Schriften • Ruhi", fill=(203, 213, 225), font=font_sub)
    
    # Badges row
    badges = [
        "918 Botschaften des Hauses",
        "Offizieller Satzspiegel",
        "Volltextsuche",
        "Web-App & PWA"
    ]
    
    bx = tx
    by = 415
    for b_text in badges:
        bbox = draw.textbbox((0, 0), b_text, font=font_badge)
        bw = bbox[2] - bbox[0] + 24
        bh = 34
        if bx + bw > w - 40:
            bx = tx
            by += 44
            
        draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=8, fill=(30, 41, 59, 210), outline=(200, 157, 92, 80), width=1)
        draw.text((bx + 12, by + 7), b_text, fill=(241, 245, 249), font=font_badge)
        bx += bw + 14
        
    return img

def create_svg_icon():
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0A0F1D"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <radialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EBC378"/>
      <stop offset="50%" stop-color="#C89D5C"/>
      <stop offset="100%" stop-color="#A57A3C"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#C89D5C" stroke-opacity="0.2" stroke-width="2"/>
  <circle cx="256" cy="256" r="220" fill="url(#auraGrad)"/>
  <path d="M256.0,46.0 L293.7,153.8 L392.0,95.4 L351.6,202.3 L464.4,220.7 L364.7,276.7 L439.3,363.3 L327.0,342.1 L328.4,456.3 L256.0,367.8 L183.6,456.3 L185.0,342.1 L72.7,363.3 L147.3,276.7 L47.6,220.7 L160.4,202.3 L120.0,95.4 L218.3,153.8 Z" fill="url(#starGrad)"/>
</svg>'''
    return svg

def main():
    print("Generating official webapp and preview assets...")
    
    # 1. 192x192 PWA Icon
    img_192 = create_star_icon(192)
    path_192 = os.path.join(ICONS_DIR, 'icon-192.png')
    img_192.save(path_192, 'PNG')
    print(f"Saved: {path_192}")
    
    # 2. 512x512 PWA Icon
    img_512 = create_star_icon(512)
    path_512 = os.path.join(ICONS_DIR, 'icon-512.png')
    img_512.save(path_512, 'PNG')
    print(f"Saved: {path_512}")
    
    # 3. 512x512 Maskable Icon
    img_512_mask = create_star_icon(512, is_maskable=True)
    path_512_mask = os.path.join(ICONS_DIR, 'icon-512-maskable.png')
    img_512_mask.save(path_512_mask, 'PNG')
    print(f"Saved: {path_512_mask}")
    
    # 4. Apple Touch Icon (180x180)
    img_apple = create_star_icon(180, corner_radius_ratio=0.0)
    path_apple = os.path.join(ICONS_DIR, 'apple-touch-icon.png')
    img_apple.save(path_apple, 'PNG')
    print(f"Saved: {path_apple}")
    
    # 5. Favicons
    img_32 = create_star_icon(32, corner_radius_ratio=0.15)
    path_32 = os.path.join(ICONS_DIR, 'favicon-32x32.png')
    img_32.save(path_32, 'PNG')
    
    img_16 = create_star_icon(16, corner_radius_ratio=0.15)
    path_16 = os.path.join(ICONS_DIR, 'favicon-16x16.png')
    img_16.save(path_16, 'PNG')
    
    # Multi-size ICO
    path_ico = os.path.join(BASE_DIR, 'favicon.ico')
    # Save as 32x32 png / ico
    img_32_rgb = Image.new('RGBA', (32, 32), (15, 23, 42, 255))
    img_32_rgb.paste(img_32, (0, 0), mask=img_32)
    img_32_rgb.save(path_ico, format='ICO')
    print(f"Saved: {path_ico}")
    
    # 6. SVG Icon
    path_svg = os.path.join(ICONS_DIR, 'favicon.svg')
    with open(path_svg, 'w', encoding='utf-8') as f:
        f.write(create_svg_icon())
    print(f"Saved: {path_svg}")
    
    # 7. Open Graph Preview Image (1200x630)
    og_img = create_og_image()
    path_og = os.path.join(ICONS_DIR, 'og-image.png')
    og_img.save(path_og, 'PNG', optimize=True)
    print(f"Saved: {path_og}")
    
    print("All webapp assets generated successfully!")

if __name__ == '__main__':
    main()
