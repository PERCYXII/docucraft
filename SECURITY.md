# Security Policy

## Environment Variables

This application requires the following environment variables to be set:

### Server-Side (Vercel Environment Variables)
- `DEEPSEEK_API_KEY` - Your DeepSeek API key for AI document generation

### Client-Side (Must be prefixed with VITE_)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Setup Instructions

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual credentials in `.env.local`

3. **NEVER commit `.env` or `.env.local` files to version control**

4. For Vercel deployment, add environment variables in the Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add each variable for Production, Preview, and Development environments

## Security Headers

This application implements the following security headers via `vercel.json`:

- **Content-Security-Policy (CSP)**: Restricts resource loading to trusted sources
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME-sniffing attacks
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

## API Key Rotation

If you suspect your API keys have been compromised:

1. **DeepSeek API Key**:
   - Log in to https://platform.deepseek.com/
   - Generate a new API key
   - Update `DEEPSEEK_API_KEY` in Vercel environment variables
   - Redeploy the application

2. **Supabase Keys**:
   - Log in to your Supabase dashboard
   - Go to Project Settings → API
   - If needed, rotate your keys (note: this may require database migration)
   - Update environment variables in Vercel
   - Redeploy the application

## Reporting Security Issues

If you discover a security vulnerability, please email the project maintainer directly rather than opening a public issue.

## Best Practices

1. ✅ Always use environment variables for sensitive data
2. ✅ Never commit `.env` files to version control
3. ✅ Rotate API keys regularly
4. ✅ Use different API keys for development and production
5. ✅ Monitor API usage for unusual activity
6. ✅ Keep dependencies up to date
7. ✅ Review security headers periodically

## Supabase Security

- The application uses Supabase's Row Level Security (RLS)
- Ensure RLS policies are properly configured in your Supabase dashboard
- The anonymous key is safe to expose in client-side code (it's designed for this)
- Never expose your `service_role` key in client-side code

## Rate Limiting

The application implements client-side retry logic with exponential backoff for API rate limits. Monitor your DeepSeek API usage to avoid unexpected costs.
