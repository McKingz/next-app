-- ============================================
-- SEED TEXTBOOKS DATABASE
-- ============================================
-- Free, open-source, CAPS-aligned textbooks
-- Sources: Siyavula, DBE Rainbow Workbooks

-- ============================================
-- Siyavula Mathematics & Science (Grades 10-12)
-- ============================================

-- Grade 10 Mathematics
INSERT INTO public.textbooks (
  title, grade, subject, language, publisher, publication_year,
  total_pages, description, caps_approved, is_free, is_active,
  license_type, caps_topics, cover_url, pdf_url
) VALUES (
  'Siyavula Mathematics Grade 10',
  '10',
  'Mathematics',
  'English',
  'Siyavula',
  2023,
  450,
  'Comprehensive CAPS-aligned Grade 10 Mathematics textbook covering algebraic expressions, equations, functions, trigonometry, analytical geometry, finance and more.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Algebraic Expressions', 'Equations and Inequalities', 'Exponents and Surds', 'Number Patterns', 'Functions', 'Trigonometry', 'Analytical Geometry', 'Finance and Growth', 'Statistics', 'Probability'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/mathematics/grade-10'
),
(
  'Siyavula Mathematics Grade 11',
  '11',
  'Mathematics',
  'English',
  'Siyavula',
  2023,
  480,
  'CAPS-aligned Grade 11 Mathematics covering functions, trigonometry, Euclidean geometry, measurement, statistics and more.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Exponents and Surds', 'Equations and Inequalities', 'Number Patterns', 'Analytical Geometry', 'Trigonometry', 'Functions', 'Euclidean Geometry', 'Measurement', 'Probability', 'Statistics'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/mathematics/grade-11'
),
(
  'Siyavula Mathematics Grade 12',
  '12',
  'Mathematics',
  'English',
  'Siyavula',
  2023,
  520,
  'Complete CAPS-aligned Grade 12 Mathematics textbook - exam preparation focused.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Sequences and Series', 'Functions', 'Finance', 'Trigonometry', 'Polynomials', 'Differential Calculus', 'Analytical Geometry', 'Euclidean Geometry', 'Statistics', 'Probability'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/mathematics/grade-12'
);

-- Grade 10-12 Physical Sciences
INSERT INTO public.textbooks (
  title, grade, subject, language, publisher, publication_year,
  total_pages, description, caps_approved, is_free, is_active,
  license_type, caps_topics, cover_url, pdf_url
) VALUES (
  'Siyavula Physical Sciences Grade 10',
  '10',
  'Physical Sciences',
  'English',
  'Siyavula',
  2023,
  520,
  'Complete CAPS-aligned Physical Sciences for Grade 10 covering Physics and Chemistry.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Skills for Science', 'Classification of Matter', 'States of Matter', 'The Atom', 'The Periodic Table', 'Chemical Bonding', 'Transverse Pulses', 'Transverse Waves', 'Geometrical Optics', 'Magnetism and Electromagnetism', 'Electrostatics', 'Electric Circuits', 'Motion in One Dimension', 'Mechanical Energy'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/physical-sciences/grade-10'
),
(
  'Siyavula Physical Sciences Grade 11',
  '11',
  'Physical Sciences',
  'English',
  'Siyavula',
  2023,
  580,
  'CAPS-aligned Grade 11 Physical Sciences with comprehensive Physics and Chemistry content.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Vectors', 'Newtons Laws', 'Atomic Combinations', 'Intermolecular Forces', 'Organic Molecules', 'Gases', 'Thermochemistry', 'Electrostatics', 'Electric Circuits', 'Energy and Chemical Change', 'Rates of Reaction', 'Chemical Equilibrium'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/physical-sciences/grade-11'
),
(
  'Siyavula Physical Sciences Grade 12',
  '12',
  'Physical Sciences',
  'English',
  'Siyavula',
  2023,
  620,
  'Complete Grade 12 Physical Sciences - exam preparation focus with worked examples.',
  true,
  true,
  true,
  'creative_commons',
  ARRAY['Momentum and Impulse', 'Vertical Projectile Motion', 'Organic Chemistry', 'Electrochemical Reactions', 'Chemical Industry', 'Doppler Effect', 'Rate and Extent of Reaction', 'Chemical Equilibrium', 'Acids and Bases', 'Electric Circuits', 'Optical Phenomena', 'Photoelectric Effect'],
  'https://intl.siyavula.com/assets/images/logo-siyavula.png',
  'https://www.siyavula.com/read/za/physical-sciences/grade-12'
);

-- ============================================
-- DBE Rainbow Workbooks (Foundation Phase)
-- ============================================

INSERT INTO public.textbooks (
  title, grade, subject, language, publisher, publication_year,
  total_pages, description, caps_approved, is_free, is_active,
  license_type, caps_topics, cover_url
) VALUES (
  'DBE Rainbow Mathematics Workbook Grade 1',
  '1',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  120,
  'Official DBE Rainbow Workbook for Grade 1 Mathematics - free for all learners.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Numbers', 'Counting', 'Patterns', 'Shapes', 'Measurement', 'Data Handling'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG1_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 2',
  '2',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  140,
  'Official DBE Rainbow Workbook for Grade 2 Mathematics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Numbers', 'Addition', 'Subtraction', 'Multiplication', 'Patterns', 'Shapes', 'Measurement', 'Time', 'Money'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG2_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 3',
  '3',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  160,
  'Official DBE Rainbow Workbook for Grade 3 Mathematics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Numbers', 'Addition and Subtraction', 'Multiplication and Division', 'Fractions', 'Patterns', 'Shapes and Space', 'Measurement', 'Data Handling'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG3_Maths_Eng.png'
);

-- ============================================
-- DBE Rainbow Workbooks (Intermediate Phase)
-- ============================================

INSERT INTO public.textbooks (
  title, grade, subject, language, publisher, publication_year,
  total_pages, description, caps_approved, is_free, is_active,
  license_type, caps_topics, cover_url
) VALUES (
  'DBE Rainbow Mathematics Workbook Grade 4',
  '4',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  180,
  'Official DBE Rainbow Workbook for Grade 4 Mathematics covering all CAPS topics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Whole Numbers', 'Common Fractions', 'Decimal Fractions', 'Numeric Patterns', 'Geometric Patterns', 'Properties of 2D Shapes', 'Symmetry', 'Measurement', 'Area and Perimeter', 'Data Handling'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG4_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 5',
  '5',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  200,
  'Official DBE Rainbow Workbook for Grade 5 Mathematics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Whole Numbers', 'Common Fractions', 'Decimal Fractions', 'Percentages', 'Numeric Patterns', 'Geometric Patterns', 'Properties of 3D Objects', 'Transformation Geometry', 'Measurement', 'Volume and Capacity', 'Data Handling'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG5_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 6',
  '6',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  220,
  'Official DBE Rainbow Workbook for Grade 6 Mathematics - preparing for Senior Phase.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Whole Numbers', 'Integers', 'Common Fractions', 'Decimal Fractions', 'Percentages', 'Exponents', 'Numeric Patterns', 'Functions and Relationships', 'Geometric Patterns', 'Properties of 3D Objects', 'Transformation Geometry', 'Measurement', 'Data Handling', 'Probability'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG6_Maths_Eng.png'
);

-- ============================================
-- DBE Rainbow Workbooks (Senior Phase)
-- ============================================

INSERT INTO public.textbooks (
  title, grade, subject, language, publisher, publication_year,
  total_pages, description, caps_approved, is_free, is_active,
  license_type, caps_topics, cover_url
) VALUES (
  'DBE Rainbow Mathematics Workbook Grade 7',
  '7',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  240,
  'Official DBE Rainbow Workbook for Grade 7 Mathematics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Integers', 'Exponents', 'Numeric Patterns', 'Functions and Relationships', 'Algebraic Expressions', 'Algebraic Equations', 'Construction of Geometric Figures', 'Geometry of 2D Shapes', 'Geometry of 3D Objects', 'Measurement', 'Data Handling', 'Probability'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG7_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 8',
  '8',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  260,
  'Official DBE Rainbow Workbook for Grade 8 Mathematics.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Integers', 'Exponents', 'Numeric Patterns', 'Functions and Relationships', 'Algebraic Expressions', 'Algebraic Equations', 'Construction of Geometric Figures', 'Geometry of 2D Shapes', 'Theorem of Pythagoras', 'Measurement', 'Data Handling', 'Probability'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG8_Maths_Eng.png'
),
(
  'DBE Rainbow Mathematics Workbook Grade 9',
  '9',
  'Mathematics',
  'English',
  'Department of Basic Education',
  2024,
  280,
  'Official DBE Rainbow Workbook for Grade 9 Mathematics - preparing for FET phase.',
  true,
  true,
  true,
  'open_source',
  ARRAY['Integers', 'Exponents', 'Numeric Patterns', 'Functions and Relationships', 'Algebraic Expressions', 'Algebraic Equations', 'Construction of Geometric Figures', 'Geometry of 2D Shapes', 'Theorem of Pythagoras', 'Transformation Geometry', 'Measurement', 'Data Handling', 'Probability'],
  'https://www.education.gov.za/portals/0/Rainbow/RainbowG9_Maths_Eng.png'
);

-- ============================================
-- Verification
-- ============================================

DO $$
DECLARE
  book_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO book_count FROM public.textbooks WHERE is_free = true;
  RAISE NOTICE '✅ Seeded % free textbooks', book_count;
  RAISE NOTICE '📚 Siyavula: Grades 10-12 Mathematics & Physical Sciences';
  RAISE NOTICE '🌈 DBE Rainbow: Grades 1-9 Mathematics';
  RAISE NOTICE '🔓 All books are open-source and free for all users';
END $$;

-- Show summary
SELECT 
  grade,
  subject,
  COUNT(*) as book_count,
  STRING_AGG(title, ', ' ORDER BY title) as titles
FROM public.textbooks
WHERE is_free = true
GROUP BY grade, subject
ORDER BY grade::INTEGER, subject;
