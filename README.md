# Trackboard – Clean Supabase Version

## 1. Create Supabase project
https://supabase.com

## 2. Create table
```sql
create table logs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null,
  value jsonb,
  created_at timestamp default now()
);
```

## 3. Paste your keys
Open `supabase.js` and replace:
- SUPABASE_URL
- SUPABASE_ANON_KEY

## 4. Deploy
Upload files to GitHub Pages or open locally.
