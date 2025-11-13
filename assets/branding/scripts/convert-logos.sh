#!/usr/bin/env bash
set -euo pipefail

# EduDash Pro Logo Conversion Script
# Converts SVG logos to PNG at various sizes for app stores and web use

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANDING_DIR="$(dirname "$SCRIPT_DIR")"
SVG_DIR="$BRANDING_DIR/svg"
PNG_DIR="$BRANDING_DIR/png"

echo "🎨 EduDash Pro Logo Converter"
echo "================================"
echo "SVG source: $SVG_DIR"
echo "PNG output: $PNG_DIR"
echo ""

# Create PNG directory if it doesn't exist
mkdir -p "$PNG_DIR"

# Detect available conversion tool
CONVERTER=""
if command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
    echo "✓ Using Inkscape for conversion"
elif command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg-convert"
    echo "✓ Using rsvg-convert for conversion"
elif command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
    echo "✓ Using ImageMagick for conversion"
else
    echo "❌ ERROR: No SVG converter found!"
    echo "   Please install one of: inkscape, librsvg2-bin, or imagemagick"
    exit 1
fi

echo ""

# Function to convert SVG to PNG
convert_svg() {
    local input_file="$1"
    local output_file="$2"
    local width="$3"
    local height="${4:-$width}"  # Default height = width for square icons
    
    echo "  Converting: $(basename "$output_file") (${width}x${height})"
    
    case "$CONVERTER" in
        inkscape)
            inkscape "$input_file" \
                --export-filename="$output_file" \
                --export-width="$width" \
                --export-height="$height" \
                --export-background-opacity=0 \
                > /dev/null 2>&1
            ;;
        rsvg-convert)
            rsvg-convert "$input_file" \
                --width="$width" \
                --height="$height" \
                --background-color=transparent \
                --output="$output_file"
            ;;
        imagemagick)
            convert -background none \
                -resize "${width}x${height}" \
                "$input_file" \
                "$output_file"
            ;;
    esac
}

# Convert icon-only (square) at multiple sizes
echo "📱 Converting logo-icon-only.svg..."
for size in 1024 512 192; do
    convert_svg \
        "$SVG_DIR/logo-icon-only.svg" \
        "$PNG_DIR/icon-${size}.png" \
        "$size"
done

# Convert full logo (stacked)
echo ""
echo "📄 Converting logo-full.svg..."
convert_svg \
    "$SVG_DIR/logo-full.svg" \
    "$PNG_DIR/logo-full-1024w.png" \
    1024 \
    768

# Convert horizontal logo
echo ""
echo "🔤 Converting logo-horizontal.svg..."
convert_svg \
    "$SVG_DIR/logo-horizontal.svg" \
    "$PNG_DIR/logo-horizontal-1024w.png" \
    1024 \
    328

# Convert monochrome logo
echo ""
echo "⚫ Converting logo-monochrome.svg..."
convert_svg \
    "$SVG_DIR/logo-monochrome.svg" \
    "$PNG_DIR/logo-monochrome-1024w.png" \
    1024 \
    328

echo ""
echo "✅ Conversion complete!"
echo "📂 PNG files saved to: $PNG_DIR"
echo ""
echo "Generated files:"
ls -lh "$PNG_DIR"/*.png | awk '{print "   " $9 " (" $5 ")"}'
echo ""
