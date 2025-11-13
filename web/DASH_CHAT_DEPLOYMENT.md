# 🚀 Dash Chat Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Database Check
- [ ] Verify `ai_conversations` table exists
- [ ] Check RLS policies are active
- [ ] Test insert/update/delete permissions
- [ ] Verify indexes are created

```sql
-- Run this to verify table exists
SELECT * FROM pg_tables WHERE tablename = 'ai_conversations';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'ai_conversations';

-- Test RLS policies
SELECT * FROM ai_conversations LIMIT 1;
```

### 2. Environment Variables
- [ ] `ANTHROPIC_API_KEY` is set in Supabase Edge Functions
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set

### 3. Build Verification
- [ ] Run `npm run build` - must succeed
- [ ] Check TypeScript compilation passes
- [ ] Verify all routes are generated:
  - `/dashboard/parent/dash-chat`
  - `/dashboard/teacher/dash-chat`

### 4. AI Proxy Check
- [ ] Edge function `ai-proxy` is deployed
- [ ] Test endpoint with curl/Postman
- [ ] Verify image support works
- [ ] Check conversation history parameter

```bash
# Test ai-proxy
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ai-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "parent",
    "service_type": "dash_conversation",
    "payload": {
      "prompt": "Hello Dash!"
    }
  }'
```

---

## 🧪 Testing Checklist

### Functional Tests

#### Chat Interface
- [ ] Send text message
- [ ] Receive AI response
- [ ] Typing indicator appears
- [ ] Message bubbles display correctly
- [ ] Timestamps show correctly
- [ ] Auto-scroll works

#### Image Upload
- [ ] Click paperclip button opens modal
- [ ] Camera capture works (mobile)
- [ ] Gallery picker works
- [ ] Select multiple images (up to 3)
- [ ] Image preview displays
- [ ] Remove image button works
- [ ] "Add to Message" confirms selection
- [ ] Images appear in chat
- [ ] AI can analyze images
- [ ] Close modal without selecting

#### Conversation History
- [ ] New conversation creates entry in database
- [ ] Messages save automatically
- [ ] Load previous conversation
- [ ] All messages load correctly
- [ ] Images load in old conversations
- [ ] Delete conversation works
- [ ] Deleted conversation removed from list
- [ ] Create new chat button works

#### Quick Replies
- [ ] "Continue" button sends message
- [ ] "Explain more" button sends message
- [ ] "Yes" button sends message
- [ ] "Can you see the image?" button sends message
- [ ] Buttons have hover effects
- [ ] Buttons appear after AI response

#### Conversation List
- [ ] Shows all user's conversations
- [ ] Click conversation loads it
- [ ] Active conversation highlighted
- [ ] Message count displays
- [ ] Last update time shows
- [ ] Delete icon appears
- [ ] Empty state shows when no conversations

#### Mobile Responsiveness
- [ ] Sidebar collapses on mobile
- [ ] Menu button toggles sidebar
- [ ] Chat full-width on mobile
- [ ] Image upload modal responsive
- [ ] Quick replies wrap properly
- [ ] Text input resizes
- [ ] Messages readable on small screen

### Cross-Browser Testing
- [ ] Chrome/Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)
- [ ] Samsung Internet (Android)

### User Role Testing
- [ ] Parent can access `/dashboard/parent/dash-chat`
- [ ] Teacher can access `/dashboard/teacher/dash-chat`
- [ ] Parent sees parent-specific messaging
- [ ] Teacher sees teacher-specific messaging
- [ ] Conversations isolated by user
- [ ] Can't see other users' conversations

### Error Handling
- [ ] Network error shows message
- [ ] AI error shows friendly message
- [ ] Image too large shows warning
- [ ] Upload fails gracefully
- [ ] Session expired redirects to login
- [ ] Missing preschool_id handled

---

## 🔒 Security Verification

### RLS Policies
- [ ] User can only see own conversations
- [ ] User can only insert own conversations
- [ ] User can only update own conversations
- [ ] User can only delete own conversations
- [ ] Cross-tenant isolation works
- [ ] Unauthenticated requests blocked

```sql
-- Test RLS as different users
SET ROLE authenticated;
SET request.jwt.claim.sub TO 'user-id-1';
SELECT * FROM ai_conversations; -- Should only see user-id-1's data

SET request.jwt.claim.sub TO 'user-id-2';
SELECT * FROM ai_conversations; -- Should only see user-id-2's data
```

### Data Validation
- [ ] Image size limits enforced
- [ ] Max images per message enforced
- [ ] Conversation ID format validated
- [ ] SQL injection prevented
- [ ] XSS attacks prevented

---

## 📊 Performance Testing

### Load Testing
- [ ] Test with 100 messages in conversation
- [ ] Test with 50 conversations in list
- [ ] Test large image upload (5MB)
- [ ] Test rapid message sending
- [ ] Monitor database query times
- [ ] Check Edge Function cold start time

### Optimization
- [ ] Images compressed before upload
- [ ] Lazy load conversation list
- [ ] Debounce text input
- [ ] Cache loaded conversations
- [ ] Minimize re-renders

---

## 📱 Mobile App Integration (Future)

If adding to React Native app:

- [ ] Test camera permissions
- [ ] Test gallery permissions
- [ ] Test file system access
- [ ] Push notifications for AI responses
- [ ] Offline message queue
- [ ] Background sync

---

## 🚀 Deployment Steps

### 1. Code Deployment
```bash
# Commit changes
git add .
git commit -m "Add Dash Chat feature with image upload and conversation history"
git push origin main

# Deploy to Vercel (if using Vercel)
vercel --prod
```

### 2. Database Migration
```sql
-- Already exists, but verify:
SELECT * FROM ai_conversations LIMIT 1;
```

### 3. Edge Function Deployment
```bash
# If ai-proxy needs update
cd supabase/functions
supabase functions deploy ai-proxy
```

### 4. Environment Variables
```bash
# Verify in Supabase dashboard:
# Settings → Edge Functions → Secrets
# - ANTHROPIC_API_KEY
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

---

## 📈 Monitoring & Analytics

### Metrics to Track

#### Usage Metrics
- [ ] Daily active users
- [ ] Conversations created per day
- [ ] Messages sent per day
- [ ] Images uploaded per day
- [ ] Average messages per conversation
- [ ] Average conversation duration

#### Performance Metrics
- [ ] AI response time
- [ ] Database query time
- [ ] Image upload time
- [ ] Page load time
- [ ] Error rate

#### Business Metrics
- [ ] User engagement rate
- [ ] Feature adoption rate
- [ ] User satisfaction (feedback)
- [ ] Support ticket reduction

### Monitoring Queries

```sql
-- Daily conversations
SELECT DATE(created_at) as date, COUNT(*) as conversations
FROM ai_conversations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Average messages per conversation
SELECT AVG(jsonb_array_length(messages)) as avg_messages
FROM ai_conversations;

-- Most active users
SELECT user_id, COUNT(*) as conversation_count
FROM ai_conversations
GROUP BY user_id
ORDER BY conversation_count DESC
LIMIT 10;

-- Images uploaded today
SELECT COUNT(*) 
FROM ai_conversations,
     jsonb_array_elements(messages) as msg
WHERE msg->>'images' IS NOT NULL
  AND created_at::date = CURRENT_DATE;
```

---

## 🐛 Troubleshooting Guide

### Issue: AI not responding
**Check:**
1. ANTHROPIC_API_KEY is set
2. Edge function deployed
3. User authenticated
4. Network connectivity

**Fix:**
```bash
# Redeploy edge function
supabase functions deploy ai-proxy

# Check logs
supabase functions logs ai-proxy
```

### Issue: Images not uploading
**Check:**
1. File size < 10MB
2. File type is image/*
3. Browser permissions granted
4. Base64 encoding working

**Fix:**
- Add file size validation
- Check browser console for errors
- Test with different image formats

### Issue: Conversations not saving
**Check:**
1. User has preschool_id
2. RLS policies allow insert
3. Database connection working
4. JSONB format correct

**Fix:**
```sql
-- Check user profile
SELECT id, preschool_id FROM profiles WHERE id = 'user-id';

-- Test insert manually
INSERT INTO ai_conversations (user_id, preschool_id, conversation_id, title, messages)
VALUES ('user-id', 'school-id', 'test-conv', 'Test', '[]'::jsonb);
```

### Issue: Old conversations not loading
**Check:**
1. RLS policies allow select
2. Conversation belongs to user
3. JSONB parsing working
4. Network request succeeding

**Fix:**
- Check browser network tab
- Verify RLS policies
- Test query in Supabase dashboard

---

## 🎯 Success Criteria

### Feature is Ready When:
✅ All functional tests pass  
✅ All security tests pass  
✅ Mobile works smoothly  
✅ AI responds accurately  
✅ Images upload/display correctly  
✅ Conversations save/load properly  
✅ No console errors  
✅ Performance acceptable (<2s response)  
✅ Documentation complete  
✅ Team trained on feature  

---

## 📞 Support & Maintenance

### Regular Tasks
- [ ] Monitor AI usage (tokens)
- [ ] Review error logs weekly
- [ ] Check database size
- [ ] Optimize slow queries
- [ ] Update AI prompts as needed
- [ ] Collect user feedback

### Monthly Review
- [ ] Analyze usage metrics
- [ ] Review conversation quality
- [ ] Check cost vs budget
- [ ] Plan feature improvements
- [ ] Update documentation

---

## 🎉 Launch Announcement

### Internal Communication
```
🎉 New Feature Alert: Dash Chat!

We're excited to announce Dash Chat - a full conversational AI assistant 
that can help with homework, lesson planning, and more!

Key Features:
✅ Upload images for help
✅ Continuous conversations
✅ Full chat history
✅ Quick reply buttons
✅ Mobile-friendly

Try it now:
- Parents: Dashboard → Dash Chat
- Teachers: Dashboard → Dash Chat

Questions? Check the docs or ask in #support
```

### User Communication
```
📢 Introducing Dash Chat!

Your new AI-powered homework helper is here!

🤖 Chat naturally with Dash
📸 Upload photos of homework
💬 Get instant explanations
📚 Save your conversations

Get started: Dashboard → Dash Chat

Watch our quick tutorial: [link]
```

---

## ✅ Final Checklist

Before marking as complete:

- [ ] All code committed
- [ ] All tests passing
- [ ] Build successful
- [ ] Deployed to production
- [ ] Database verified
- [ ] Monitoring active
- [ ] Documentation complete
- [ ] Team trained
- [ ] Users notified
- [ ] Support ready

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 1.0.0  
**Status:** ⬜ Ready ⬜ In Progress ⬜ Complete

---

🎊 **Congratulations on launching Dash Chat!** 🎊
