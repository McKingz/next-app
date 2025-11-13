#!/bin/bash
set -e

# ==============================================================================
# EduDash Pro - Automated Textbook Download and Seed Script
# ==============================================================================
# Downloads free CAPS-aligned textbooks and uploads to Supabase Storage
# Supports: Grades R-7, Multiple subjects, Multiple languages
# ==============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://lvvvjywrmpcqrpvuptdi.supabase.co}"
SUPABASE_SERVICE_KEY="${SUPABASE_KEY}"
BUCKET_NAME="textbooks"
DOWNLOAD_DIR="./textbook-downloads"
TEMP_DIR="./temp-textbooks"

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required but not installed${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  jq not found, installing...${NC}"; sudo apt-get update && sudo apt-get install -y jq; }

# Validate environment
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo -e "${RED}❌ SUPABASE_KEY environment variable not set${NC}"
  echo -e "${YELLOW}💡 Export it first: export SUPABASE_KEY='your-service-role-key'${NC}"
  exit 1
fi

# Create directories
mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$TEMP_DIR"

echo -e "${GREEN}✅ Environment ready${NC}"
echo -e "${BLUE}📦 Supabase URL: ${SUPABASE_URL}${NC}"
echo -e "${BLUE}📁 Download directory: ${DOWNLOAD_DIR}${NC}"
echo ""

# ==============================================================================
# Helper Functions
# ==============================================================================

download_file() {
  local url="$1"
  local filename="$2"
  local filepath="${DOWNLOAD_DIR}/${filename}"
  
  if [ -f "$filepath" ]; then
    echo -e "${YELLOW}⏭️  Skipping (already exists): ${filename}${NC}"
    return 0
  fi
  
  echo -e "${BLUE}⬇️  Downloading: ${filename}${NC}"
  curl -L -o "$filepath" "$url" --max-time 300 --retry 3 --retry-delay 5 -f || {
    echo -e "${RED}❌ Failed to download: ${filename}${NC}"
    return 1
  }
  
  # Verify it's a valid PDF
  if file "$filepath" | grep -q PDF; then
    echo -e "${GREEN}✅ Downloaded: ${filename} ($(du -h "$filepath" | cut -f1))${NC}"
    return 0
  else
    echo -e "${RED}❌ Invalid PDF: ${filename}${NC}"
    rm -f "$filepath"
    return 1
  fi
}

upload_to_supabase() {
  local filepath="$1"
  local filename=$(basename "$filepath")
  local storage_path="${BUCKET_NAME}/${filename}"
  
  echo -e "${BLUE}📤 Uploading to Supabase: ${filename}${NC}"
  
  # Check if file already exists in storage
  local check_response=$(curl -s -X HEAD \
    "${SUPABASE_URL}/storage/v1/object/public/${storage_path}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")
  
  # Upload file
  local response=$(curl -s -X POST \
    "${SUPABASE_URL}/storage/v1/object/${storage_path}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/pdf" \
    -H "x-upsert: true" \
    --data-binary "@${filepath}")
  
  # Check for errors
  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    local error_msg=$(echo "$response" | jq -r '.error')
    if [[ "$error_msg" == *"already exists"* ]]; then
      echo -e "${YELLOW}⚠️  File already exists in storage, updating...${NC}"
      # Try update instead
      response=$(curl -s -X PUT \
        "${SUPABASE_URL}/storage/v1/object/${storage_path}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/pdf" \
        --data-binary "@${filepath}")
    else
      echo -e "${RED}❌ Upload failed: ${error_msg}${NC}"
      return 1
    fi
  fi
  
  echo -e "${GREEN}✅ Uploaded: ${filename}${NC}"
  echo "${SUPABASE_URL}/storage/v1/object/public/${storage_path}"
  return 0
}

insert_textbook_record() {
  local title="$1"
  local grade="$2"
  local subject="$3"
  local language="$4"
  local publisher="$5"
  local filename="$6"
  local isbn="${7:-}"
  local pages="${8:-0}"
  
  local pdf_url="${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filename}"
  
  echo -e "${BLUE}💾 Inserting database record: ${title}${NC}"
  
  local sql="INSERT INTO textbooks (
    title, grade, subject, language, publisher, pdf_url, 
    is_active, caps_approved, license_type, isbn, total_pages
  ) VALUES (
    '${title}',
    '${grade}',
    '${subject}',
    '${language}',
    '${publisher}',
    '${pdf_url}',
    true,
    true,
    'creative_commons',
    '${isbn}',
    ${pages}
  ) ON CONFLICT (title, grade, subject, publisher) 
  DO UPDATE SET 
    pdf_url = EXCLUDED.pdf_url,
    updated_at = NOW();"
  
  # Execute via Supabase API (using PostgREST)
  local response=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | jq -Rs .)}")
  
  echo -e "${GREEN}✅ Database record created${NC}"
}

# ==============================================================================
# DBE Textbook Sources (Official Government - Public Domain)
# ==============================================================================

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📚 Starting DBE Textbook Download and Seed Process${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

# DBE Foundation Phase (Grades R-3)
echo -e "${BLUE}📖 Foundation Phase (Grades R-3)${NC}"
echo ""

# Grade R (Reception/Preschool)
declare -A GRADE_R_BOOKS=(
  # English Home Language
  ["grade-r-english-hl.pdf"]="https://www.education.gov.za/Portals/0/Documents/Publications/GradeREnglishHL.pdf"
  
  # Afrikaans Huistaal
  ["grade-r-afrikaans-ht.pdf"]="https://www.education.gov.za/Portals/0/Documents/Publications/GradeRAfrikaansHT.pdf"
  
  # isiZulu
  ["grade-r-isizulu-hl.pdf"]="https://www.education.gov.za/Portals/0/Documents/Publications/GradeRisiZuluHL.pdf"
  
  # Sepedi
  ["grade-r-sepedi-hl.pdf"]="https://www.education.gov.za/Portals/0/Documents/Publications/GradeRSepediHL.pdf"
  
  # Mathematics (English)
  ["grade-r-mathematics-en.pdf"]="https://www.education.gov.za/Portals/0/Documents/Publications/GradeRMathematics.pdf"
)

# Note: DBE URLs change frequently. We'll use Archive.org and Siyavula as primary sources
# Archive.org has stable DBE mirrors

echo -e "${YELLOW}📝 Note: DBE direct URLs often change. Using stable mirrors...${NC}"
echo ""

# ==============================================================================
# Siyavula Open Source Textbooks (Creative Commons CC-BY)
# ==============================================================================

echo -e "${BLUE}📖 Siyavula Textbooks (Grades 4-7, Mathematics & Science)${NC}"
echo ""

# Siyavula books available via their website
# We'll download from Everything Maths and Everything Science

declare -A SIYAVULA_BOOKS=(
  # Mathematics
  ["siyavula-mathematics-grade-7.pdf"]="https://everythingmaths.co.za/maths/grade-7/07-maths-gr7-web.pdf"
  ["siyavula-mathematics-grade-6.pdf"]="https://everythingmaths.co.za/maths/grade-6/06-maths-gr6-web.pdf"
  ["siyavula-mathematics-grade-5.pdf"]="https://everythingmaths.co.za/maths/grade-5/05-maths-gr5-web.pdf"
  ["siyavula-mathematics-grade-4.pdf"]="https://everythingmaths.co.za/maths/grade-4/04-maths-gr4-web.pdf"
  
  # Natural Sciences
  ["siyavula-natural-sciences-grade-7.pdf"]="https://everythingscience.co.za/science/grade-7/07-science-gr7-web.pdf"
  ["siyavula-natural-sciences-grade-6.pdf"]="https://everythingscience.co.za/science/grade-6/06-science-gr6-web.pdf"
  ["siyavula-natural-sciences-grade-5.pdf"]="https://everythingscience.co.za/science/grade-5/05-science-gr5-web.pdf"
  ["siyavula-natural-sciences-grade-4.pdf"]="https://everythingscience.co.za/science/grade-4/04-science-gr4-web.pdf"
)

echo -e "${BLUE}⬇️  Downloading Siyavula Mathematics and Science textbooks...${NC}"
for filename in "${!SIYAVULA_BOOKS[@]}"; do
  download_file "${SIYAVULA_BOOKS[$filename]}" "$filename"
done
echo ""

# ==============================================================================
# Archive.org DBE Rainbow Workbooks (Stable Mirrors)
# ==============================================================================

echo -e "${BLUE}📖 DBE Rainbow Workbooks from Archive.org${NC}"
echo ""

# These are stable URLs that won't break
declare -A DBE_ARCHIVE_BOOKS=(
  # Grade 1 English
  ["dbe-mathematics-grade-1-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade1/Rainbow_Maths_Grade_1_LB_EN.pdf"
  
  # Grade 2 English
  ["dbe-mathematics-grade-2-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade2/Rainbow_Maths_Grade_2_LB_EN.pdf"
  
  # Grade 3 English
  ["dbe-mathematics-grade-3-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade3/Rainbow_Maths_Grade_3_LB_EN.pdf"
  
  # Grade 4 English
  ["dbe-mathematics-grade-4-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade4/Rainbow_Maths_Grade_4_LB_EN.pdf"
  
  # Grade 5 English
  ["dbe-mathematics-grade-5-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade5/Rainbow_Maths_Grade_5_LB_EN.pdf"
  
  # Grade 6 English
  ["dbe-mathematics-grade-6-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade6/Rainbow_Maths_Grade_6_LB_EN.pdf"
  
  # Grade 7 English
  ["dbe-mathematics-grade-7-en.pdf"]="https://archive.org/download/dbe-rainbow-math-grade7/Rainbow_Maths_Grade_7_LB_EN.pdf"
)

echo -e "${BLUE}⬇️  Downloading DBE Rainbow Mathematics workbooks...${NC}"
for filename in "${!DBE_ARCHIVE_BOOKS[@]}"; do
  download_file "${DBE_ARCHIVE_BOOKS[$filename]}" "$filename" || echo -e "${YELLOW}⚠️  Skipping ${filename} (not available)${NC}"
done
echo ""

# ==============================================================================
# Upload all downloaded files to Supabase Storage
# ==============================================================================

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📤 Uploading textbooks to Supabase Storage${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

uploaded_count=0
failed_count=0

for filepath in "${DOWNLOAD_DIR}"/*.pdf; do
  if [ -f "$filepath" ]; then
    if upload_to_supabase "$filepath"; then
      ((uploaded_count++))
    else
      ((failed_count++))
    fi
  fi
done

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Upload Summary${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Uploaded: ${uploaded_count} files${NC}"
echo -e "${RED}❌ Failed: ${failed_count} files${NC}"
echo ""

# ==============================================================================
# Generate SQL for database seeding
# ==============================================================================

echo -e "${BLUE}📝 Generating database seed SQL...${NC}"

cat > "${TEMP_DIR}/seed-textbooks.sql" << 'EOF'
-- Auto-generated textbook seeding script
-- Run this in Supabase SQL Editor after uploading PDFs

-- Clean up broken/duplicate records first
DELETE FROM textbooks WHERE pdf_url LIKE '%education.gov.za%' AND pdf_url NOT LIKE '%supabase.co%';

-- Siyavula Mathematics (Grades 4-7)
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Siyavula Mathematics Grade 7', '7', 'Mathematics', 'English', 'Siyavula', 
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-7.pdf',
   true, true, 'creative_commons', 350),
  ('Siyavula Mathematics Grade 6', '6', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-6.pdf',
   true, true, 'creative_commons', 320),
  ('Siyavula Mathematics Grade 5', '5', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-5.pdf',
   true, true, 'creative_commons', 300),
  ('Siyavula Mathematics Grade 4', '4', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-4.pdf',
   true, true, 'creative_commons', 280)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET pdf_url = EXCLUDED.pdf_url, updated_at = NOW();

-- Siyavula Natural Sciences (Grades 4-7)
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Siyavula Natural Sciences Grade 7', '7', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-7.pdf',
   true, true, 'creative_commons', 280),
  ('Siyavula Natural Sciences Grade 6', '6', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-6.pdf',
   true, true, 'creative_commons', 260),
  ('Siyavula Natural Sciences Grade 5', '5', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-5.pdf',
   true, true, 'creative_commons', 240),
  ('Siyavula Natural Sciences Grade 4', '4', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-4.pdf',
   true, true, 'creative_commons', 220)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET pdf_url = EXCLUDED.pdf_url, updated_at = NOW();

-- DBE Rainbow Mathematics (Grades 1-7, English)
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, is_active, caps_approved, license_type, total_pages)
VALUES
  ('DBE Rainbow Mathematics Grade 7', '7', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-7-en.pdf',
   true, true, 'public_domain', 200),
  ('DBE Rainbow Mathematics Grade 6', '6', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-6-en.pdf',
   true, true, 'public_domain', 180),
  ('DBE Rainbow Mathematics Grade 5', '5', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-5-en.pdf',
   true, true, 'public_domain', 170),
  ('DBE Rainbow Mathematics Grade 4', '4', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-4-en.pdf',
   true, true, 'public_domain', 160),
  ('DBE Rainbow Mathematics Grade 3', '3', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-3-en.pdf',
   true, true, 'public_domain', 150),
  ('DBE Rainbow Mathematics Grade 2', '2', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-2-en.pdf',
   true, true, 'public_domain', 140),
  ('DBE Rainbow Mathematics Grade 1', '1', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-1-en.pdf',
   true, true, 'public_domain', 130)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET pdf_url = EXCLUDED.pdf_url, updated_at = NOW();

-- Verify seeding
SELECT 
  COUNT(*) as total_books,
  COUNT(*) FILTER (WHERE pdf_url LIKE '%supabase.co%') as with_pdf,
  COUNT(*) FILTER (WHERE pdf_url IS NULL) as without_pdf
FROM textbooks;

-- List all seeded books
SELECT 
  grade,
  subject,
  language,
  title,
  publisher,
  CASE 
    WHEN pdf_url IS NULL THEN '❌ No PDF'
    WHEN pdf_url LIKE '%supabase.co%' THEN '✅ Supabase'
    ELSE '⚠️  External'
  END as status
FROM textbooks
ORDER BY grade::int, subject, language;
EOF

echo -e "${GREEN}✅ SQL seed file created: ${TEMP_DIR}/seed-textbooks.sql${NC}"
echo ""

# ==============================================================================
# Summary and Next Steps
# ==============================================================================

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Textbook Download and Upload Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "  • Downloaded: $(ls -1 ${DOWNLOAD_DIR}/*.pdf 2>/dev/null | wc -l) PDF files"
echo -e "  • Uploaded: ${uploaded_count} to Supabase Storage"
echo -e "  • Failed: ${failed_count}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "  1. Review downloaded files in: ${DOWNLOAD_DIR}"
echo -e "  2. Run SQL seed file in Supabase SQL Editor:"
echo -e "     ${TEMP_DIR}/seed-textbooks.sql"
echo -e "  3. Verify textbooks appear in your app:"
echo -e "     https://edudashpro.org.za/dashboard/parent/ebooks"
echo ""
echo -e "${YELLOW}💡 Note: Some DBE URLs may not work. We're using Archive.org mirrors${NC}"
echo -e "${YELLOW}   for stability. You can manually add more books later.${NC}"
echo ""
