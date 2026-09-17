/* ═══════════════════ STUDY OS — supabase-config.js ═══════════════════
   إعدادات الاتصال بمشروع Supabase (أُنشئت لدعم Google OAuth + مزامنة البيانات).
   ⚠️ هذه القيم عامة وآمنة للنشر (anon/public). لا تضع أبدًا service_role هنا.
*/
"use strict";
window.App = window.App || {};
App.SupabaseConfig = {
  supabaseUrl: "https://rzcmwqtwztvvqfgelqmy.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Y213cXR3enR2dnFmZ2VscW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODI5MzksImV4cCI6MjEwNTE1ODkzOX0._uxgweEaib7MWhUpqWSuLv3oTwWN8A4upfL8O6N7wEc",
  googleClientId: "619547611228-sqr9ec2ip0e1sli4uniir95v2v584us9.apps.googleusercontent.com",
  // مفتاح VAPID العام (عام آمن للنشر) — الصقه هنا بعد توليد المفاتيح.
  // التوليد: npx web-push generate-vapid-keys
  // العام = VAPID_PUBLIC_KEY، والخاص يبقى سريًّا في Edge Function فقط.
  vapidPublicKey: "BPaJHuJtBVh5NdkPGIXasT__xS5zhXXM2i3jDuy_oP5VpedNhKSnITBtAu-L7Fy9p1HZKuYjps7ZUe905lAhNjQ"
};
// اسم قديم للتوافق
App.AuthConfig = App.SupabaseConfig;
