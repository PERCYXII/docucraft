<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tOKB1BEj8Fw7drq-Dagxri5EuP2L50Mi

## Run Locally

**Prerequisites:**  Node.js (v18 or higher)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd docucraft
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` and add your credentials:
   - `DEEPSEEK_API_KEY` - Get from [DeepSeek Platform](https://platform.deepseek.com/)
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3000`

### Security Notes

⚠️ **IMPORTANT**: Never commit `.env` or `.env.local` files to version control!

- See [SECURITY.md](SECURITY.md) for detailed security guidelines
- API keys should be kept secret and rotated regularly
- Use different keys for development and production

### Deployment

This app is configured for Vercel deployment:

1. Push your code to GitHub (ensure `.env` files are not committed)
2. Import the project in Vercel
3. Add environment variables in Vercel Dashboard → Settings → Environment Variables
4. Deploy!

For more details, see the [Vercel documentation](https://vercel.com/docs)
