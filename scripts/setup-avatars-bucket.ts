/**
 * Script to set up the avatars bucket via Supabase client
 * Run this with: npx tsx scripts/setup-avatars-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAvatarsBucket() {
  try {
    console.log('🔍 Checking if avatars bucket exists...');
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const avatarsBucket = buckets.find(bucket => bucket.id === 'avatars');
    
    if (avatarsBucket) {
      console.log('✅ Avatars bucket already exists');
      console.log('   - Public:', avatarsBucket.public);
      console.log('   - Created:', avatarsBucket.created_at);
    } else {
      console.log('📦 Creating avatars bucket...');
      
      // Create the bucket
      const { data: bucket, error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'],
        fileSizeLimit: 5242880, // 5MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        return;
      }
      
      console.log('✅ Avatars bucket created successfully');
    }
    
    // Test upload permissions
    console.log('🧪 Testing upload permissions...');
    const testFileName = 'test-upload.txt';
    const testContent = 'Test upload from setup script';
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError);
    } else {
      console.log('✅ Upload test successful');
      
      // Clean up test file
      await supabase.storage.from('avatars').remove([testFileName]);
    }
    
    // Check bucket configuration
    console.log('\n📋 Bucket Configuration:');
    const { data: bucketInfo } = await supabase.storage.getBucket('avatars');
    if (bucketInfo) {
      console.log('   - ID:', bucketInfo.id);
      console.log('   - Name:', bucketInfo.name);
      console.log('   - Public:', bucketInfo.public);
      console.log('   - File Size Limit:', bucketInfo.file_size_limit ? `${bucketInfo.file_size_limit / 1024 / 1024}MB` : 'Not set');
      console.log('   - Allowed MIME Types:', bucketInfo.allowed_mime_types || 'Not restricted');
    }
    
    console.log('\n🎉 Avatar storage setup complete!');
    console.log('📝 Next steps:');
    console.log('   1. Update your app to use ProfileImageService');
    console.log('   2. Test profile picture uploads in the app');
    console.log('   3. Verify images are stored in Supabase Storage');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupAvatarsBucket();