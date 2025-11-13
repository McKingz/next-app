#!/usr/bin/env python3
"""
Make EduDashPro app icon round with proper masking
"""
from PIL import Image, ImageDraw
import os

def create_round_mask(size):
    """Create a circular mask"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    return mask

def make_icon_round(input_path, output_path, size=1024):
    """Make an icon perfectly round"""
    # Open the original icon
    icon = Image.open(input_path)
    
    # Resize to target size if needed
    if icon.size != (size, size):
        icon = icon.resize((size, size), Image.Resampling.LANCZOS)
    
    # Convert to RGBA if not already
    if icon.mode != 'RGBA':
        icon = icon.convert('RGBA')
    
    # Create circular mask
    mask = create_round_mask(size)
    
    # Apply mask to make it round
    round_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    round_icon.paste(icon, (0, 0))
    round_icon.putalpha(mask)
    
    # Save the round icon
    round_icon.save(output_path, 'PNG', quality=100)
    print(f"✅ Created round icon: {output_path}")
    
    return round_icon

def create_all_round_icons():
    """Create all app icons as round versions"""
    base_icon_path = '/home/king/Downloads/edp.png'
    
    if not os.path.exists(base_icon_path):
        print("❌ Original icon not found at /home/king/Downloads/edp.png")
        return
    
    # Create round versions for all required sizes
    icons_to_create = [
        ('assets/icon.png', 1024),
        ('assets/adaptive-icon.png', 1024),
        ('assets/splash-icon.png', 1024),
        ('assets/favicon.png', 32),
        ('assets/favicon-16x16.png', 16),
        ('assets/favicon-32x32.png', 32),
        ('assets/favicon-48x48.png', 48),
        ('assets/favicon-64x64.png', 64),
    ]
    
    for output_path, size in icons_to_create:
        make_icon_round(base_icon_path, output_path, size)
    
    # Create a special notification icon (should be simpler and white/transparent)
    create_round_notification_icon()

def create_round_notification_icon():
    """Create a simple round notification icon"""
    size = 256
    
    # Create transparent background
    notification_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(notification_icon)
    
    # Create a simple round white circle with a smaller inner circle
    margin = size // 6
    
    # Outer circle (white)
    draw.ellipse([margin, margin, size - margin, size - margin], fill='white')
    
    # Inner design - simple chart bars in the center
    center_x, center_y = size // 2, size // 2
    bar_width = size // 20
    bar_spacing = bar_width + 5
    
    # Three bars representing analytics/dashboard
    bars = [
        (center_x - bar_spacing, center_y + bar_width, bar_width, size // 8),  # Short bar
        (center_x, center_y - bar_width, bar_width, size // 6),  # Medium bar  
        (center_x + bar_spacing, center_y - size // 10, bar_width, size // 5),  # Tall bar
    ]
    
    for x, y, width, height in bars:
        draw.rectangle([x, y, x + width, y + height], fill='#00f5ff')
    
    # Make it round
    mask = create_round_mask(size)
    notification_icon.putalpha(mask)
    
    notification_icon.save('assets/notification-icon.png', 'PNG', quality=100)
    print("✅ Created round notification icon: assets/notification-icon.png")

if __name__ == "__main__":
    print("🔄 Making EduDashPro icons round...")
    create_all_round_icons()
    print("\n🎉 All icons are now perfectly round!")
    print("🔄 The new round icons will appear after you refresh your browser/app")