# Admin Login Information

## 🔐 Admin Portal Access

### **Admin Account:**
- **Email:** `jak@scalewithjak.com`
- **Password:** `Admin123!`
- **Role:** Super Admin

### **Demo/Client Account:**
- **Email:** `demo@glowmedspa.com`
- **Password:** `Client123!`
- **Role:** Client/Business Owner

---

## 🌐 Access URLs

**Admin Portal:**
- http://localhost:3000/admin

**Login Page:**
- http://localhost:3000/login

**Dashboard (Client View):**
- http://localhost:3000/dashboard

**Homepage:**
- http://localhost:3000

---

## 📋 How to Login

1. **Open browser** and go to: http://localhost:3000/login

2. **Enter credentials:**
   - Email: `jak@scalewithjak.com`
   - Password: `Admin123!`

3. **Click "Sign in"**

4. You'll be redirected to:
   - `/admin` (if super_admin role)
   - `/dashboard` (if regular client)

---

## 🔧 Account Setup Script

The accounts were created using: `create_accounts.js`

**To recreate accounts if needed:**
```bash
cd "/Users/johnkraeger/Downloads/growth engine "
node create_accounts.js
```

---

## 🗄️ Database Info

**Supabase Project:**
- URL: `https://tsvuzkdrtquzuseaezjk.supabase.co`
- Service Role Key: (check .env.local for full key)

**Auth Configuration:**
- Email confirmation: Auto-confirmed for both accounts
- Role stored in: `app_metadata.role` and `user_metadata.role`

---

## 👥 Account Roles

**Super Admin (`jak@scalewithjak.com`):**
- Access to `/admin` portal
- Can manage all businesses
- Can view all clients across all businesses
- Full system access

**Client (`demo@glowmedspa.com`):**
- Access to `/dashboard`
- Can only see their own business data
- Limited to their business scope

---

## ⚠️ Security Notes

**For Production:**
- [ ] Change default passwords immediately
- [ ] Use strong, unique passwords
- [ ] Enable 2FA if available
- [ ] Rotate service keys regularly
- [ ] Don't commit credentials to git
- [ ] Use environment variables for all secrets

**Current Status:**
- ✅ Dev environment only
- ⚠️ Using default test passwords
- ⚠️ Service key exposed in code (ok for dev)

---

**Last Updated:** March 14, 2026
**Status:** Dev credentials active
