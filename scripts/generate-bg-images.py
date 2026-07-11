"""
WARNING: This script is a DEPRECATED experimental generator.

It was used in an earlier iteration to replace assets/images/* with
procedurally generated backgrounds. The original assets have been
restored from git (commit 9cce001) and this script should NOT be
run again to overwrite those files unless Robin explicitly confirms.

See codex-tasks/claude-code-star-road-visual-fix-round-2.md for context.
---

Generate 3 star road background images for the personal homepage.

Usage: python scripts/generate-bg-images.py

Output (in assets/images/):
  - star-road-open.png          (deep space, ~30-80KB)
  - star-road-river.png         (nebula, ~80-200KB)
  - star-road-hero-composed.png (star field, ~200-450KB)
"""

import math
import random
import struct
import zlib
from io import BytesIO
from PIL import Image, ImageDraw, ImageFilter


WIDTH, HEIGHT = 2560, 1440


# ── Helpers ──────────────────────────────────────────────────────────

def _hex(c):
    """Return (R, G, B) tuple from hex string like '#02040b'."""
    return tuple(int(c[i:i+2], 16) for i in (1, 3, 5))


def _lerp(a, b, t):
    """Linear interpolate between two color tuples."""
    return tuple(int(ac + (bc - ac) * t) for ac, bc in zip(a, b))


C02040B = _hex("#02040b")
C050A18 = _hex("#050a18")
C0D1628 = _hex("#0d1628")
C0A1628 = _hex("#0a1628")
C1B2D45 = _hex("#1b2d45")
C1A1C2E = _hex("#1a1c2e")
CD8E6F0 = _hex("#d8e6f0")
CB88A8A = _hex("#b8a88a")


# ── 1. Deep Space ────────────────────────────────────────────────────

def generate_deep_space():
    """
    Nearly black with extremely subtle radial gradient.
    Like a velvet matte surface — no stars, no noise, no texture.
    """
    cx, cy = WIDTH // 2, HEIGHT // 2
    max_dist = math.sqrt(cx * cx + cy * cy)

    img = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = img.load()

    for y in range(HEIGHT):
        for x in range(WIDTH):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy) / max_dist  # 0 at center, 1 at corners
            # Center slightly brighter (#0a1628), corners pure black (#02040b)
            # Use power curve so the bright area is very tight around center
            t = dist ** 1.6
            color = _lerp(C0A1628, C02040B, t)
            pixels[x, y] = color

    # Tiny bit of Gaussian blur to ensure smoothness
    img = img.filter(ImageFilter.GaussianBlur(radius=4))
    return img


# ── 2. Nebula ────────────────────────────────────────────────────────

def generate_nebula():
    """
    Diffuse low-saturation cold nebula. Large soft patches that look like
    watercolor bleeding on wet paper. No stars, no hard edges.
    Colors: cold grey-blue (#1b2d45) with purple-gray (#1a1c2e) shifts.
    """
    # Start from a gradient base
    base = Image.new("RGB", (WIDTH, HEIGHT), C050A18)

    # Generate multiple large soft blobs using noise + blur
    # We'll work on a smaller canvas for performance, then scale up
    scale = 4
    sw, sh = WIDTH // scale, HEIGHT // scale

    nebula = Image.new("RGB", (sw, sh), C050A18)
    neb_pixels = nebula.load()

    # Generate random gradient fields at low resolution for the cloud shapes
    # Patch count: 3-5 large patches
    num_patches = random.randint(3, 5)
    patch_data = []
    for _ in range(num_patches):
        px = random.randint(0, sw)
        py = random.randint(0, sh)
        pr = random.randint(max(sw, sh) // 6, max(sw, sh) // 3)
        # Color: mix of cool blue and purple-gray
        color = random.choice([
            C1B2D45,  # cold grey-blue
            C1A1C2E,  # purple-gray
            _hex("#141e34"),  # deep blue-gray
            _hex("#0f1a2e"),  # dark navy
        ])
        opacity = random.uniform(0.3, 0.7)
        patch_data.append((px, py, pr, color, opacity))

    for y in range(sh):
        for x in range(sw):
            r_sum, g_sum, b_sum, total_w = 0.0, 0.0, 0.0, 0.0
            for px, py, pr, color, opacity in patch_data:
                dx, dy = x - px, y - py
                dist = math.sqrt(dx * dx + dy * dy)
                if dist < pr * 2:
                    # Soft falloff
                    weight = math.exp(-(dist * dist) / (2 * (pr / 2) ** 2)) * opacity
                    r_sum += color[0] * weight
                    g_sum += color[1] * weight
                    b_sum += color[2] * weight
                    total_w += weight

            if total_w > 0:
                r = r_sum / total_w
                g = g_sum / total_w
                b = b_sum / total_w
            else:
                r, g, b = C050A18

            # Blend with base
            t = min(1.0, total_w * 1.5)
            base_r, base_g, base_b = C050A18
            r = int(base_r + (r - base_r) * t)
            g = int(base_g + (g - base_g) * t)
            b = int(base_b + (b - base_b) * t)

            neb_pixels[x, y] = (min(255, max(0, r)),
                                min(255, max(0, g)),
                                min(255, max(0, b)))

    # Scale up
    nebula = nebula.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    # Heavy blur to eliminate all hard edges
    nebula = nebula.filter(ImageFilter.GaussianBlur(radius=60))

    # Very subtle vignette
    vignette = Image.new("RGB", (WIDTH, HEIGHT))
    v_pixels = vignette.load()
    cx, cy = WIDTH // 2, HEIGHT // 2
    max_dist = math.sqrt(cx * cx + cy * cy)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy) / max_dist
            t = dist ** 1.8 * 0.3
            v_pixels[x, y] = (int(2 * (1 - t)), int(4 * (1 - t)), int(11 * (1 - t)))

    nebula = Image.blend(nebula, vignette, 0.15)

    return nebula


# ── 3. Star Field ────────────────────────────────────────────────────

def _gaussian_2d(x, y, sigma):
    """2D Gaussian value at (x,y) with given sigma (center at origin)."""
    return math.exp(-(x * x + y * y) / (2 * sigma * sigma))


def _star_clusters(count, width, height):
    """
    Generate star positions with clustering.
    Returns list of (x, y, brightness, size, warm).
    """
    # Define 4-7 cluster centers
    num_clusters = random.randint(4, 7)
    clusters = []
    for _ in range(num_clusters):
        cx = random.uniform(0.05, 0.95) * width
        cy = random.uniform(0.05, 0.95) * height
        cr = random.uniform(80, 250)  # cluster radius
        density = random.uniform(0.4, 1.0)
        clusters.append((cx, cy, cr, density))

    stars = []
    attempts = 0
    max_attempts = count * 20

    while len(stars) < count and attempts < max_attempts:
        attempts += 1
        x = random.uniform(0, width)
        y = random.uniform(0, height)

        # Check if position falls within any cluster
        in_cluster = False
        cluster_weight = 0
        for cx, cy, cr, density in clusters:
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist < cr:
                w = _gaussian_2d(dx, dy, cr / 2.5)
                cluster_weight += w * density
                in_cluster = True

        # Acceptance probability based on cluster weight for clustered areas,
        # or low base probability for empty areas
        if in_cluster:
            prob = min(1.0, cluster_weight)
        else:
            prob = 0.08  # low chance of placing stars outside clusters

        if random.random() < prob:
            # Size: most stars are small (1-3px), few are larger (4-7px)
            r = random.random()
            if r < 0.55:
                size = random.uniform(0.6, 1.5)
            elif r < 0.82:
                size = random.uniform(1.5, 3.0)
            elif r < 0.94:
                size = random.uniform(3.0, 5.0)
            else:
                size = random.uniform(5.0, 7.5)

            # Brightness: inversely correlated with size (bigger = brighter)
            brightness = random.uniform(0.15, 1.0) * (0.4 + 0.6 * min(1.0, size / 5))

            # Warm tint: very few warm stars (~8%)
            warm = random.random() < 0.08

            stars.append((x, y, brightness, size, warm))

    return stars


def generate_star_field():
    """
    Sparse cold star field with 40-120 stars, sized 1-3px (most) / 5-8px (few).
    Stars are cold white (#d8e6f0) with very few warm-tinted (#b8a88a).
    Star distribution has clustering — some areas dense, some empty.
    Stars slightly soft-edged (atmospheric seeing effect).
    Natural vignette darker on bottom-right.
    """
    # Background gradient: #050a18 at top → #02040b at bottom
    bg = Image.new("RGB", (WIDTH, HEIGHT))
    bg_pixels = bg.load()
    for y in range(HEIGHT):
        t = y / HEIGHT
        color = _lerp(C050A18, C02040B, t ** 0.85)
        for x in range(WIDTH):
            bg_pixels[x, y] = color

    # Create star canvas (RGBA for smooth compositing)
    star_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    s_pixels = star_layer.load()

    star_count = random.randint(55, 100)
    stars = _star_clusters(star_count, WIDTH, HEIGHT)

    # Sort by brightness so faint stars go first, bright stars overlay
    stars.sort(key=lambda s: s[2])

    for x, y, brightness, size, warm in stars:
        if size < 0.8:
            # Sub-pixel star: just set a dim pixel with slight spread
            ix, iy = int(x), int(y)
            if 0 <= ix < WIDTH and 0 <= iy < HEIGHT:
                base = bg_pixels[ix, iy]
                if warm:
                    sc = CB88A8A
                else:
                    sc = CD8E6F0
                r = int(base[0] + (sc[0] - base[0]) * brightness * 0.3)
                g = int(base[1] + (sc[1] - base[1]) * brightness * 0.3)
                b = int(base[2] + (sc[2] - base[2]) * brightness * 0.3)
                bg_pixels[ix, iy] = (min(255, r), min(255, g), min(255, b))
            continue

        # For visible stars, draw a soft dot
        radius = int(math.ceil(size + 1))
        sigma = size / 2.5  # slightly soft edges
        if warm:
            star_color = CB88A8A
        else:
            star_color = CD8E6F0

        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                px, py = int(x) + dx, int(y) + dy
                if 0 <= px < WIDTH and 0 <= py < HEIGHT:
                    dist = math.sqrt(dx * dx + dy * dy)
                    # Gaussian falloff from center
                    falloff = _gaussian_2d(dx, dy, sigma)
                    alpha = int(min(255, falloff * brightness * 320))
                    if alpha <= 1:
                        continue
                    # Get current pixel
                    cur = s_pixels[px, py]
                    # Alpha blend — bright stars can accumulate
                    sr = int(star_color[0] * (alpha / 255.0) + cur[0] * (1 - alpha / 255.0))
                    sg = int(star_color[1] * (alpha / 255.0) + cur[1] * (1 - alpha / 255.0))
                    sb = int(star_color[2] * (alpha / 255.0) + cur[2] * (1 - alpha / 255.0))
                    sa = min(255, cur[3] + alpha)
                    s_pixels[px, py] = (min(255, sr), min(255, sg), min(255, sb), sa)

    # Composite star layer onto background
    result = Image.alpha_composite(bg.convert("RGBA"), star_layer).convert("RGB")

    # Add very subtle vignette: darker in bottom-right
    vg = Image.new("RGB", (WIDTH, HEIGHT))
    vg_pixels = vg.load()
    cx, cy = WIDTH * 0.35, HEIGHT * 0.35  # vignette center offset to top-left
    max_dist = math.sqrt((WIDTH - cx) ** 2 + (HEIGHT - cy) ** 2)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            dx, dy = x - cx, y - cy
            # Make bottom-right darker
            dist = math.sqrt(dx * dx + dy * dy) / max_dist
            # Stronger in bottom-right
            corner_factor = 1.0 + 0.5 * ((x / WIDTH) * 0.7 + (y / HEIGHT) * 0.3)
            t = min(1.0, (dist ** 2.2) * 0.35 * corner_factor)
            c = result.getpixel((x, y))
            vg_pixels[x, y] = (
                int(c[0] * (1 - t)),
                int(c[1] * (1 - t)),
                int(c[2] * (1 - t)),
            )

    return vg


# ── Save with size target ────────────────────────────────────────────

def save_optimized(img, path, max_size_kb=500, min_quality=65):
    """Save as PNG via PIL, check size, reduce colors if needed."""
    # First try: true color PNG
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    size = buf.tell() / 1024
    if size <= max_size_kb:
        with open(path, "wb") as f:
            f.write(buf.getvalue())
        print(f"  [OK] {path} ({size:.0f} KB)")
        return

    # Try quantizing to 256 colors
    img_q = img.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    buf = BytesIO()
    img_q.save(buf, format="PNG", optimize=True)
    size = buf.tell() / 1024
    if size <= max_size_kb:
        with open(path, "wb") as f:
            f.write(buf.getvalue())
        print(f"  [OK] {path} (256 colors, {size:.0f} KB)")
        return

    # Further reduction
    for colors in [128, 64, 48, 32]:
        img_q = img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT)
        buf = BytesIO()
        img_q.save(buf, format="PNG", optimize=True)
        size = buf.tell() / 1024
        if size <= max_size_kb:
            with open(path, "wb") as f:
                f.write(buf.getvalue())
            print(f"  [OK] {path} ({colors} colors, {size:.0f} KB)")
            return

    # Last resort: PNG with max compression
    img.save(path, format="PNG", optimize=True, compress_level=9)
    actual = os.path.getsize(path) / 1024
    print(f"  [WARN] {path} ({actual:.0f} KB, target was {max_size_kb} KB)")


# ── Main ─────────────────────────────────────────────────────────────

import os

def main():
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "images")
    os.makedirs(output_dir, exist_ok=True)

    print("Generating 01 — Deep Space...")
    img1 = generate_deep_space()
    save_optimized(img1, os.path.join(output_dir, "star-road-open.png"), max_size_kb=100)

    print("Generating 02 — Nebula...")
    img2 = generate_nebula()
    save_optimized(img2, os.path.join(output_dir, "star-road-river.png"), max_size_kb=200)

    print("Generating 03 — Star Field...")
    img3 = generate_star_field()
    save_optimized(img3, os.path.join(output_dir, "star-road-hero-composed.png"), max_size_kb=450)

    print("\nDone.")


if __name__ == "__main__":
    main()
