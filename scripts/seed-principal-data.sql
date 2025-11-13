-- Principal Hub Test Data Seeding Script
-- Run this in the Supabase SQL Editor to add test data for Principal Hub dashboard

-- Create a test preschool if it doesn't exist
INSERT INTO preschools (
  id,
  name,
  email,
  phone,
  address,
  capacity,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Sunshine Preschool',
  'admin@sunshinepreschool.com',
  '+27 11 123 4567',
  '123 Happy Street, Johannesburg, 2000',
  120,
  true
) ON CONFLICT (id) DO NOTHING;

-- Create test principal user if not exists
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  role,
  organization_id,
  is_active
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'principal@sunshinepreschool.com',
  'Jane',
  'Smith',
  'principal',
  '550e8400-e29b-41d4-a716-446655440000',
  true
) ON CONFLICT (id) DO NOTHING;

-- Create test teachers
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  role,
  organization_id,
  subject_specialization,
  hire_date,
  is_active
) VALUES 
(
  '770e8400-e29b-41d4-a716-446655440002',
  'alice.johnson@sunshinepreschool.com',
  'Alice',
  'Johnson',
  'teacher',
  '550e8400-e29b-41d4-a716-446655440000',
  'Early Childhood Development',
  '2023-01-15',
  true
),
(
  '880e8400-e29b-41d4-a716-446655440003',
  'bob.wilson@sunshinepreschool.com',
  'Bob',
  'Wilson',
  'teacher',
  '550e8400-e29b-41d4-a716-446655440000',
  'Art & Music',
  '2023-03-20',
  true
),
(
  '990e8400-e29b-41d4-a716-446655440004',
  'carol.davis@sunshinepreschool.com',
  'Carol',
  'Davis',
  'teacher',
  '550e8400-e29b-41d4-a716-446655440000',
  'Mathematics & Science',
  '2022-09-01',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Create test classes
INSERT INTO classes (
  id,
  name,
  description,
  teacher_id,
  preschool_id,
  age_group,
  max_capacity,
  is_active
) VALUES 
(
  'aa0e8400-e29b-41d4-a716-446655440010',
  'Little Explorers',
  'Ages 2-3 years developmental class',
  '770e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000',
  'toddler',
  15,
  true
),
(
  'bb0e8400-e29b-41d4-a716-446655440011',
  'Creative Artists',
  'Art and music for ages 3-4',
  '880e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440000',
  'preschool',
  18,
  true
),
(
  'cc0e8400-e29b-41d4-a716-446655440012',
  'Future Scientists',
  'STEM learning for ages 4-5',
  '990e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440000',
  'prekindergarten',
  20,
  true
),
(
  'dd0e8400-e29b-41d4-a716-446655440013',
  'Happy Toddlers',
  'Second toddler class',
  '770e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000',
  'toddler',
  12,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Create test students
INSERT INTO students (
  id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  preschool_id,
  status
) VALUES 
-- Toddlers (ages 2-3)
('s10e8400-e29b-41d4-a716-446655440020', 'Emma', 'Brown', '2022-03-15', 'female', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s20e8400-e29b-41d4-a716-446655440021', 'Liam', 'Taylor', '2022-01-20', 'male', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s30e8400-e29b-41d4-a716-446655440022', 'Olivia', 'Miller', '2022-05-10', 'female', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s40e8400-e29b-41d4-a716-446655440023', 'Noah', 'Anderson', '2022-02-28', 'male', '550e8400-e29b-41d4-a716-446655440000', 'active'),

-- Preschoolers (ages 3-4)
('s50e8400-e29b-41d4-a716-446655440024', 'Ava', 'Thomas', '2021-04-12', 'female', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s60e8400-e29b-41d4-a716-446655440025', 'William', 'Jackson', '2021-06-08', 'male', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s70e8400-e29b-41d4-a716-446655440026', 'Sophia', 'White', '2021-03-25', 'female', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('s80e8400-e29b-41d4-a716-446655440027', 'Benjamin', 'Harris', '2021-05-18', 'male', '550e8400-e29b-41d4-a716-446655440000', 'active'),

-- Pre-K (ages 4-5)
('s90e8400-e29b-41d4-a716-446655440028', 'Charlotte', 'Martin', '2020-02-14', 'female', '550e8400-e29b-41d4-a716-446655440000', 'active'),
('sa0e8400-e29b-41d4-a716-446655440029', 'James', 'Thompson', '2020-07-22', 'male', '550e8400-e29b-41d4-a716-446655440000', 'active')
ON CONFLICT (id) DO NOTHING;

-- Assign students to classes
INSERT INTO student_classes (
  student_id,
  class_id,
  enrolled_date,
  is_active
) VALUES 
-- Little Explorers class
('s10e8400-e29b-41d4-a716-446655440020', 'aa0e8400-e29b-41d4-a716-446655440010', '2024-01-15', true),
('s20e8400-e29b-41d4-a716-446655440021', 'aa0e8400-e29b-41d4-a716-446655440010', '2024-01-15', true),
('s30e8400-e29b-41d4-a716-446655440022', 'aa0e8400-e29b-41d4-a716-446655440010', '2024-01-15', true),

-- Happy Toddlers class
('s40e8400-e29b-41d4-a716-446655440023', 'dd0e8400-e29b-41d4-a716-446655440013', '2024-01-20', true),

-- Creative Artists class
('s50e8400-e29b-41d4-a716-446655440024', 'bb0e8400-e29b-41d4-a716-446655440011', '2024-02-01', true),
('s60e8400-e29b-41d4-a716-446655440025', 'bb0e8400-e29b-41d4-a716-446655440011', '2024-02-01', true),
('s70e8400-e29b-41d4-a716-446655440026', 'bb0e8400-e29b-41d4-a716-446655440011', '2024-02-01', true),
('s80e8400-e29b-41d4-a716-446655440027', 'bb0e8400-e29b-41d4-a716-446655440011', '2024-02-01', true),

-- Future Scientists class
('s90e8400-e29b-41d4-a716-446655440028', 'cc0e8400-e29b-41d4-a716-446655440012', '2024-02-10', true),
('sa0e8400-e29b-41d4-a716-446655440029', 'cc0e8400-e29b-41d4-a716-446655440012', '2024-02-10', true)
ON CONFLICT (student_id, class_id) DO NOTHING;

-- Create sample enrollment applications
INSERT INTO enrollment_applications (
  id,
  child_name,
  child_age,
  parent_email,
  parent_phone,
  preschool_id,
  status,
  preferred_start_date,
  notes
) VALUES 
(
  'app1-8400-e29b-41d4-a716-446655440030',
  'Michael Green',
  3,
  'parent1@email.com',
  '+27 82 123 4567',
  '550e8400-e29b-41d4-a716-446655440000',
  'pending',
  '2024-04-01',
  'Looking for morning classes'
),
(
  'app2-8400-e29b-41d4-a716-446655440031',
  'Sarah Wilson',
  4,
  'parent2@email.com',
  '+27 83 234 5678',
  '550e8400-e29b-41d4-a716-446655440000',
  'approved',
  '2024-03-15',
  'Approved for Creative Artists class'
),
(
  'app3-8400-e29b-41d4-a716-446655440032',
  'David Lee',
  2,
  'parent3@email.com',
  '+27 84 345 6789',
  '550e8400-e29b-41d4-a716-446655440000',
  'waitlisted',
  '2024-05-01',
  'On waitlist for toddler program'
)
ON CONFLICT (id) DO NOTHING;

-- Create sample payments
INSERT INTO payments (
  id,
  student_id,
  preschool_id,
  amount,
  payment_type,
  payment_method,
  status,
  description,
  due_date
) VALUES 
(
  'pay1-8400-e29b-41d4-a716-446655440040',
  's10e8400-e29b-41d4-a716-446655440020',
  '550e8400-e29b-41d4-a716-446655440000',
  1500.00,
  'monthly_fee',
  'bank_transfer',
  'completed',
  'Monthly tuition fee for March 2024',
  '2024-03-01'
),
(
  'pay2-8400-e29b-41d4-a716-446655440041',
  's50e8400-e29b-41d4-a716-446655440024',
  '550e8400-e29b-41d4-a716-446655440000',
  1650.00,
  'monthly_fee',
  'bank_transfer',
  'completed',
  'Monthly tuition fee for March 2024',
  '2024-03-01'
),
(
  'pay3-8400-e29b-41d4-a716-446655440042',
  's90e8400-e29b-41d4-a716-446655440028',
  '550e8400-e29b-41d4-a716-446655440000',
  1800.00,
  'monthly_fee',
  'card',
  'completed',
  'Monthly tuition fee for March 2024',
  '2024-03-01'
),
(
  'pay4-8400-e29b-41d4-a716-446655440043',
  's20e8400-e29b-41d4-a716-446655440021',
  '550e8400-e29b-41d4-a716-446655440000',
  1500.00,
  'monthly_fee',
  'bank_transfer',
  'pending',
  'Monthly tuition fee for April 2024',
  '2024-04-01'
)
ON CONFLICT (id) DO NOTHING;

-- Create sample attendance records
INSERT INTO attendance_records (
  id,
  student_id,
  class_id,
  preschool_id,
  date,
  status,
  notes
) VALUES 
-- Recent attendance records for testing
('att1-8400-e29b-41d4-a716-446655440050', 's10e8400-e29b-41d4-a716-446655440020', 'aa0e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '1 day', 'present', null),
('att2-8400-e29b-41d4-a716-446655440051', 's20e8400-e29b-41d4-a716-446655440021', 'aa0e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '1 day', 'present', null),
('att3-8400-e29b-41d4-a716-446655440052', 's50e8400-e29b-41d4-a716-446655440024', 'bb0e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '1 day', 'absent', 'Sick day'),
('att4-8400-e29b-41d4-a716-446655440053', 's90e8400-e29b-41d4-a716-446655440028', 'cc0e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '1 day', 'present', null),

-- More attendance records for better statistics
('att5-8400-e29b-41d4-a716-446655440054', 's10e8400-e29b-41d4-a716-446655440020', 'aa0e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '2 days', 'present', null),
('att6-8400-e29b-41d4-a716-446655440055', 's20e8400-e29b-41d4-a716-446655440021', 'aa0e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '2 days', 'present', null),
('att7-8400-e29b-41d4-a716-446655440056', 's50e8400-e29b-41d4-a716-446655440024', 'bb0e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '2 days', 'present', null),
('att8-8400-e29b-41d4-a716-446655440057', 's90e8400-e29b-41d4-a716-446655440028', 'cc0e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '2 days', 'present', null)
ON CONFLICT (id) DO NOTHING;

-- Create a sample announcement
INSERT INTO announcements (
  id,
  preschool_id,
  created_by,
  title,
  content,
  audience,
  priority,
  is_active
) VALUES (
  'ann1-8400-e29b-41d4-a716-446655440060',
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440001',
  'Welcome to the new term!',
  'We are excited to welcome everyone back for the new term. Please remember to update your emergency contact information.',
  ARRAY['teachers', 'parents'],
  'normal',
  true
) ON CONFLICT (id) DO NOTHING;

-- Summary message
SELECT 
  'Data seeding completed!' as message,
  (SELECT COUNT(*) FROM students WHERE preschool_id = '550e8400-e29b-41d4-a716-446655440000') as total_students,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000' AND role = 'teacher') as total_teachers,
  (SELECT COUNT(*) FROM classes WHERE preschool_id = '550e8400-e29b-41d4-a716-446655440000') as total_classes,
  (SELECT COUNT(*) FROM enrollment_applications WHERE preschool_id = '550e8400-e29b-41d4-a716-446655440000') as total_applications;
