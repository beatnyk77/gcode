import { NextRequest, NextResponse } from 'next/server';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const { projectName, githubRepo, zipDataUrl } = await request.json();
    
    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      return NextResponse.json({
        success: false,
        error: 'VERCEL_TOKEN not configured in environment variables. Please add VERCEL_TOKEN to your .env file.'
      }, { status: 400 });
    }

    if (!zipDataUrl) {
      return NextResponse.json({
        success: false,
        error: 'ZIP file data is required'
      }, { status: 400 });
    }

    console.log('[deploy-vercel] Deploying to Vercel...');

    // Convert data URL to buffer
    const base64Data = zipDataUrl.split(',')[1];
    const zipBuffer = Buffer.from(base64Data, 'base64');

    // Create FormData for Vercel API
    // Note: In Node.js, we need to use a FormData implementation that works server-side
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', zipBuffer, {
      filename: 'project.zip',
      contentType: 'application/zip',
    });
    if (projectName) {
      formData.append('name', projectName);
    }

    const vercelResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    if (!vercelResponse.ok) {
      const error = await vercelResponse.text();
      throw new Error(`Vercel deployment failed: ${error}`);
    }

    const deployment = await vercelResponse.json();

    // If GitHub repo is provided, push to GitHub
    let githubUrl = null;
    if (githubRepo && process.env.GITHUB_TOKEN) {
      try {
        const { Octokit } = await import('@octokit/rest');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        const [owner, repo] = githubRepo.split('/');
        
        // Get files from sandbox
        const filesResponse = await fetch(`${request.nextUrl.origin}/api/get-sandbox-files`);
        let files: Record<string, string> = {};
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          files = filesData.files || {};
        }

        // Create or update repository
        try {
          await octokit.repos.get({ owner, repo });
        } catch {
          // Repo doesn't exist, create it
          await octokit.repos.createForAuthenticatedUser({
            name: repo,
            private: false,
          });
        }

        // Create or update files
        for (const [path, content] of Object.entries(files)) {
          if (!path.includes('node_modules') && !path.includes('.git') && !path.includes('.next') && !path.includes('dist') && !path.includes('build')) {
            try {
              const fileContent = Buffer.from(content).toString('base64');
              await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message: `Deploy from gcode.dev`,
                content: fileContent,
              });
            } catch (e) {
              console.warn(`[deploy-vercel] Could not push ${path} to GitHub:`, e);
            }
          }
        }
        
        githubUrl = `https://github.com/${owner}/${repo}`;
      } catch (githubError: any) {
        console.error('[deploy-vercel] GitHub push failed:', githubError);
        // Continue even if GitHub push fails
      }
    }

    return NextResponse.json({
      success: true,
      deployment: {
        url: deployment.url || deployment.alias?.[0] || `https://${deployment.name}.vercel.app`,
        id: deployment.id,
      },
      githubUrl,
    });

  } catch (error: any) {
    console.error('[deploy-vercel] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Deployment failed'
    }, { status: 500 });
  }
}

