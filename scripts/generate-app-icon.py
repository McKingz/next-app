#!/usr/bin/env python3
"""
EduDashPro App Icon Generator
Creates custom app icons with educational theme
"""
import os
from PIL import Image, ImageDraw, ImageFont
import requests
from io import BytesIO

def create_educational_icon():
    """Create a custom educational app icon"""
    
    # Create a 1024x1024 canvas (required size for app icons)
    size = 1024
    img = Image.new('RGB', (size, size), color='#00f5ff')  # EduDashPro brand color
    draw = ImageDraw.Draw(img)
    
    # Create a gradient background
    for y in range(size):
        # Gradient from brand blue to darker blue
        r = int(0 + (10 * y / size))
        g = int(245 - (50 * y / size))
        b = int(255 - (100 * y / size))
        color = (r, g, b)
        draw.line([(0, y), (size, y)], fill=color)
    
    # Add a subtle rounded rectangle overlay
    margin = size // 8
    overlay = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    # Draw main icon shape (rounded rectangle)
    corner_radius = size // 6
    rect_coords = [margin, margin, size - margin, size - margin]
    
    # Create rounded rectangle manually (PIL doesn't have native rounded rectangles in all versions)
    overlay_draw.rounded_rectangle(rect_coords, radius=corner_radius, fill=(255, 255, 255, 40))
    
    # Composite the overlay
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)
    
    # Add educational elements
    center_x, center_y = size // 2, size // 2
    
    # Draw a stylized book/dashboard icon
    book_width = size // 3
    book_height = size // 4
    book_left = center_x - book_width // 2
    book_top = center_y - book_height // 2 - size // 12
    
    # Book base
    draw.rounded_rectangle(
        [book_left, book_top, book_left + book_width, book_top + book_height],
        radius=20, fill='white'
    )
    
    # Book spine
    spine_width = 8
    draw.rectangle(
        [book_left + book_width // 3, book_top, book_left + book_width // 3 + spine_width, book_top + book_height],
        fill='#0066cc'
    )
    
    # Add text/lines on the book
    line_color = '#333333'
    line_y_start = book_top + book_height // 4
    line_spacing = book_height // 6
    line_left = book_left + book_width // 6
    line_right = book_left + book_width - book_width // 6
    
    for i in range(3):
        y = line_y_start + (i * line_spacing)
        width = 3 if i == 0 else 2
        draw.rectangle([line_left, y, line_right - (i * 20), y + width], fill=line_color)
    
    # Add AI/dashboard elements (small dots/indicators)
    dot_size = 12
    dot_y = center_y + book_height // 2 + size // 10
    
    # Three dots representing AI intelligence
    for i in range(3):
        dot_x = center_x - 30 + (i * 30)
        color = ['#ff6b6b', '#4ecdc4', '#45b7d1'][i]  # Different colors for each dot
        draw.ellipse([dot_x - dot_size//2, dot_y - dot_size//2, 
                     dot_x + dot_size//2, dot_y + dot_size//2], fill=color)
    
    # Add subtle "Pro" indicator
    try:
        # Try to use a system font
        font_size = size // 20
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # Add "EDU" text at the bottom
    text = "EDU"
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = center_x - text_width // 2
    text_y = center_y + book_height // 2 + size // 6
    
    # Add text shadow
    draw.text((text_x + 2, text_y + 2), text, fill='rgba(0,0,0,100)', font=font)
    draw.text((text_x, text_y), text, fill='white', font=font)
    
    return img

def save_app_icons(base_image):
    """Save app icons in different sizes"""
    assets_dir = os.path.join(os.getcwd(), 'assets')
    
    # Create assets directory if it doesn't exist
    os.makedirs(assets_dir, exist_ok=True)
    
    # Standard app icon (1024x1024)
    icon_path = os.path.join(assets_dir, 'icon.png')
    base_image.save(icon_path, 'PNG', quality=100)
    print(f"✅ Created app icon: {icon_path}")
    
    # Adaptive icon (1024x1024 - Android)
    adaptive_icon_path = os.path.join(assets_dir, 'adaptive-icon.png')
    base_image.save(adaptive_icon_path, 'PNG', quality=100)
    print(f"✅ Created adaptive icon: {adaptive_icon_path}")
    
    # Splash screen icon (same as app icon for consistency)
    splash_icon_path = os.path.join(assets_dir, 'splash-icon.png')
    base_image.save(splash_icon_path, 'PNG', quality=100)
    print(f"✅ Created splash icon: {splash_icon_path}")
    
    # Notification icon (should be white/transparent, smaller)
    notification_icon = create_notification_icon()
    notification_icon_path = os.path.join(assets_dir, 'notification-icon.png')
    notification_icon.save(notification_icon_path, 'PNG', quality=100)
    print(f"✅ Created notification icon: {notification_icon_path}")
    
    # Favicon for web (smaller size)
    favicon = base_image.resize((32, 32), Image.Resampling.LANCZOS)
    favicon_path = os.path.join(assets_dir, 'favicon.png')
    favicon.save(favicon_path, 'PNG', quality=100)
    print(f"✅ Created favicon: {favicon_path}")

def create_notification_icon():
    """Create a notification icon (should be white/transparent)"""
    size = 256
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(img)
    
    # Simple white book icon for notifications
    center_x, center_y = size // 2, size // 2
    book_width = size // 2
    book_height = size // 3
    book_left = center_x - book_width // 2
    book_top = center_y - book_height // 2
    
    # White book shape
    draw.rounded_rectangle(
        [book_left, book_top, book_left + book_width, book_top + book_height],
        radius=size // 20, fill='white'
    )
    
    # Book spine
    spine_width = size // 32
    draw.rectangle(
        [book_left + book_width // 3, book_top, book_left + book_width // 3 + spine_width, book_top + book_height],
        fill='white'
    )
    
    return img

if __name__ == "__main__":
    print("🎨 Generating custom EduDashPro app icons...")
    
    # Create the main icon
    icon = create_educational_icon()
    
    # Save all required icon sizes
    save_app_icons(icon)
    
    print("\n🎉 Custom app icons generated successfully!")
    print("📱 Your app will now use a professional educational-themed icon")
    print("🔄 Run your build again to see the new icons")