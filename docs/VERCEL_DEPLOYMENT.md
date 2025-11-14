# Vercel Deployment Setup Guide

This guide explains how to connect your GitHub fork to Vercel and configure secure environment variables.

## Prerequisites

1. A GitHub account with a fork of this repository
2. A Vercel account (sign up at [vercel.com](https://vercel.com))
3. Vercel CLI installed (optional, for local testing)

## Step 1: Connect GitHub Fork to Vercel

### Via Vercel Dashboard

1. **Import Project**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your GitHub fork from the list
   - Click "Import"

2. **Configure Project**
   - **Project Name**: Choose a name for your deployment
   - **Framework Preset**: Select "Next.js"
   - **Root Directory**: Leave as `./` (or specify if different)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

3. **Environment Variables** (see Step 2 below)

4. **Deploy**
   - Click "Deploy" to start the first deployment

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Deploy
vercel --prod
```

## Step 2: Configure Secure Environment Variables

### Required Environment Variables

Add these in Vercel Dashboard → Your Project → Settings → Environment Variables:

#### API Keys (Required for AI Features)
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# OR
AI_GATEWAY_API_KEY=your_ai_gateway_key_here
ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh/v1
```

#### Optional: Model Configuration
```
ANTHROPIC_SONNET_MODEL=claude-3-5-sonnet-20241022
```

#### Vercel Deployment (Required for Deploy Feature)
```
VERCEL_TOKEN=your_vercel_token_here
```

#### GitHub Integration (Optional, for GitHub repo push)
```
GITHUB_TOKEN=your_github_personal_access_token_here
```

#### Sandbox Provider (If using E2B)
```
E2B_API_KEY=your_e2b_api_key_here
```

#### Supabase (If using authentication)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### How to Get API Keys

1. **Anthropic API Key**
   - Sign up at [console.anthropic.com](https://console.anthropic.com)
   - Navigate to API Keys
   - Create a new key
   - Copy and paste into Vercel

2. **Vercel Token**
   - Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
   - Create a new token
   - Copy and paste into Vercel environment variables

3. **GitHub Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with `repo` scope
   - Copy and paste into Vercel

### Environment Variable Security Best Practices

1. **Never commit secrets to Git**
   - All secrets should be in Vercel environment variables
   - Use `.env.local` for local development (gitignored)

2. **Use different values for different environments**
   - Vercel supports: Production, Preview, Development
   - Set different API keys for each if needed

3. **Rotate keys regularly**
   - Update keys in Vercel dashboard
   - Old deployments will continue using old keys until redeployed

4. **Limit token scopes**
   - GitHub tokens should have minimal required scopes
   - Vercel tokens should be project-specific when possible

## Step 3: Configure GitHub Integration

### Automatic Deployments

Once connected, Vercel will automatically:
- Deploy on every push to `main` branch (Production)
- Deploy on every pull request (Preview)
- Create preview URLs for PRs

### Manual Deployment via API

The app includes a "Deploy to Vercel" button that:
1. Creates a ZIP of the current sandbox
2. Deploys to Vercel using the API
3. Optionally pushes to GitHub if `GITHUB_TOKEN` is set

## Step 4: Verify Deployment

1. **Check Build Logs**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on a deployment to see logs

2. **Test the Application**
   - Visit your deployment URL
   - Test the gen-flow: Prompt → Edit → Harden → Deploy

3. **Monitor Errors**
   - Check Vercel Function Logs for API errors
   - Check browser console for client errors

## Troubleshooting

### Build Fails

- Check that all environment variables are set
- Verify Node.js version (Vercel uses Node 18+ by default)
- Check build logs for specific errors

### API Calls Fail

- Verify API keys are correct
- Check CORS settings if calling external APIs
- Verify environment variables are set for the correct environment (Production vs Preview)

### GitHub Integration Not Working

- Verify `GITHUB_TOKEN` has `repo` scope
- Check that the token hasn't expired
- Verify repository permissions

## Security Checklist

- [ ] All API keys stored in Vercel environment variables (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] GitHub token has minimal required scopes
- [ ] Vercel token is project-specific (if possible)
- [ ] Regular key rotation schedule established
- [ ] Different keys for production vs development

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Environment Variables Best Practices](https://vercel.com/docs/concepts/projects/environment-variables)

