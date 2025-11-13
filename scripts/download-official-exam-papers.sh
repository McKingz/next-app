#!/bin/bash

# Download Official DBE Past Exam Papers
# Source: Department of Basic Education (education.gov.za)

echo "🔽 Downloading Official DBE Past Exam Papers..."

mkdir -p exam-papers-official/{2024,2023,2022}/{mathematics,life-sciences,english,afrikaans}

# Note: The DBE website requires manual navigation to download papers
# Here are the direct links structure (example URLs - need to be verified)

# 2024 November Papers
echo "📥 Downloading 2024 November NSC Papers..."

# Mathematics Paper 1 & 2 (English)
# curl -L "https://www.education.gov.za/Portals/0/Documents/Exam%20Papers/2024/Grade12/Mathematics_P1_Nov2024_Eng.pdf" \
#   -o "exam-papers-official/2024/mathematics/Mathematics_P1_Nov2024_Eng.pdf"
# curl -L "https://www.education.gov.za/Portals/0/Documents/Exam%20Papers/2024/Grade12/Mathematics_P2_Nov2024_Eng.pdf" \
#   -o "exam-papers-official/2024/mathematics/Mathematics_P2_Nov2024_Eng.pdf"

# Life Sciences Paper 1 & 2
# curl -L "https://www.education.gov.za/Portals/0/Documents/Exam%20Papers/2024/Grade12/LifeSciences_P1_Nov2024_Eng.pdf" \
#   -o "exam-papers-official/2024/life-sciences/LifeSciences_P1_Nov2024_Eng.pdf"

# English Home Language Paper 1 & 2
# curl -L "https://www.education.gov.za/Portals/0/Documents/Exam%20Papers/2024/Grade12/English_HL_P1_Nov2024.pdf" \
#   -o "exam-papers-official/2024/english/English_HL_P1_Nov2024.pdf"

echo "⚠️  MANUAL DOWNLOAD REQUIRED"
echo ""
echo "Please manually download official papers from:"
echo "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationpapers.aspx"
echo ""
echo "Recommended papers to download:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Grade 12 Mathematics (2024, 2023, 2022)"
echo "   - Paper 1 (Algebra, Functions, Calculus)"
echo "   - Paper 2 (Statistics, Probability, Geometry)"
echo "   - Memorandum (Answers)"
echo ""
echo "📚 Grade 12 Life Sciences (2024, 2023, 2022)"
echo "   - Paper 1 (Cell Biology, Genetics)"
echo "   - Paper 2 (Human Systems, Evolution)"
echo "   - Memorandum (Answers)"
echo ""
echo "📚 Grade 12 English Home Language (2024, 2023)"
echo "   - Paper 1 (Comprehension, Summary)"
echo "   - Paper 2 (Literature)"
echo "   - Memorandum (Answers)"
echo ""
echo "📚 Grade 12 Afrikaans Huistaal (2024, 2023)"
echo "   - Vraestel 1"
echo "   - Vraestel 2"
echo "   - Memorandum"
echo ""
echo "Save them to: ./exam-papers-official/{year}/{subject}/"
echo ""
echo "After downloading, run: node scripts/process-exam-papers.js"
