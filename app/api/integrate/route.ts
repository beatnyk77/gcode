import { NextRequest, NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { callGrok, RateLimitError } from '@/lib/clients/grok';
import FirecrawlApp from '@mendable/firecrawl-js';

export const dynamic = 'force-dynamic';

// Cost monitor stub
interface CostMonitor {
	apiCalls: number;
	limit: number;
	trackCall(service: string, cost?: number): void;
	checkLimit(): boolean;
}

class CostMonitorStub implements CostMonitor {
	apiCalls = 0;
	limit = 1000; // Default limit

	trackCall(service: string, cost?: number): void {
		this.apiCalls++;
		console.log(`[cost-monitor] ${service} call #${this.apiCalls}${cost ? ` (cost: ${cost})` : ''}`);
	}

	checkLimit(): boolean {
		if (this.apiCalls >= this.limit) {
			console.warn(`[cost-monitor] API call limit reached: ${this.apiCalls}/${this.limit}`);
			return false;
		}
		return true;
	}
}

const costMonitor = new CostMonitorStub();

// Service mapping: NL prompt → package, auth flow, tests
interface ServiceIntegration {
	package: string;
	authFlow?: string;
	testFramework?: string;
	description: string;
}

const SERVICE_MAP: Record<string, ServiceIntegration> = {
	stripe: {
		package: 'react-stripe-js',
		authFlow: 'stripe-checkout',
		testFramework: 'vitest',
		description: 'Stripe payment integration with checkout flow'
	},
	auth0: {
		package: '@auth0/auth0-react',
		authFlow: 'auth0-spa',
		testFramework: 'vitest',
		description: 'Auth0 authentication integration'
	},
	firebase: {
		package: 'firebase',
		authFlow: 'firebase-auth',
		testFramework: 'vitest',
		description: 'Firebase integration with authentication'
	},
	sendgrid: {
		package: '@sendgrid/mail',
		authFlow: 'api-key',
		testFramework: 'vitest',
		description: 'SendGrid email service integration'
	},
	twilio: {
		package: 'twilio',
		authFlow: 'api-key',
		testFramework: 'vitest',
		description: 'Twilio SMS/voice integration'
	}
};

// Parse NL to identify service and requirements
function parseIntegrationIntent(prompt: string): {
	service: string | null;
	integration: ServiceIntegration | null;
	needsAuth: boolean;
	needsTests: boolean;
} {
	const lower = prompt.toLowerCase();
	
	// Check for service mentions
	for (const [serviceName, integration] of Object.entries(SERVICE_MAP)) {
		if (lower.includes(serviceName)) {
			return {
				service: serviceName,
				integration,
				needsAuth: lower.includes('auth') || lower.includes('login') || lower.includes('sign'),
				needsTests: !lower.includes('no test') && !lower.includes('skip test')
			};
		}
	}
	
	// Generic payment detection
	if (lower.includes('payment') || lower.includes('checkout') || lower.includes('stripe')) {
		return {
			service: 'stripe',
			integration: SERVICE_MAP.stripe,
			needsAuth: false,
			needsTests: true
		};
	}
	
	return {
		service: null,
		integration: null,
		needsAuth: false,
		needsTests: true
	};
}

// Check if URL is a Figma design
function isFigmaUrl(url: string): boolean {
	return url.includes('figma.com') || url.includes('figma.io');
}

// Scrape Figma design and convert to JSX using Grok vision
async function processFigmaDesign(url: string): Promise<string> {
	costMonitor.trackCall('firecrawl');
	
	if (!costMonitor.checkLimit()) {
		throw new Error('API call limit exceeded');
	}
	
	const apiKey = process.env.FIRECRAWL_API_KEY;
	if (!apiKey) {
		throw new Error('FIRECRAWL_API_KEY not configured');
	}
	
	const app = new FirecrawlApp({ apiKey });
	
	// Scrape with screenshot for vision
	const scrapeResult = await app.scrape(url, {
		formats: ['markdown', 'screenshot'],
		waitFor: 3000,
		timeout: 30000,
		onlyMainContent: false
	});
	
	const result = scrapeResult as any;
	if (!result.success || !result.data) {
		throw new Error('Failed to scrape Figma design');
	}
	
	const screenshot = result.data.screenshot || result.data.actions?.screenshots?.[0];
	const markdown = result.data.markdown || '';
	
	if (!screenshot) {
		throw new Error('No screenshot available from Figma design');
	}
	
	// Use Grok vision to convert screenshot to JSX
	costMonitor.trackCall('grok-vision');
	
	const grokApiKey = process.env.XAI_API_KEY || process.env.XAI_TOKEN || process.env.GROK_API_KEY;
	if (!grokApiKey) {
		throw new Error('XAI_API_KEY not configured for vision');
	}
	
	// Prepare vision prompt for Grok
	const visionPrompt = `Convert this Figma design screenshot to React JSX code using Tailwind CSS. 
Generate a complete, production-ready component that matches the design exactly.

Design context from markdown:
${markdown.substring(0, 2000)}

Requirements:
- Use Tailwind CSS classes only (no inline styles)
- Make it responsive (mobile-first)
- Include proper semantic HTML
- Match colors, spacing, and typography from the design
- Output complete JSX code in <file> tags

Generate the component code now:`;
	
	// Call Grok with vision capability
	// Note: Grok vision API may require different endpoint/format
	// For now, we'll use the text API with image description
	const grokPrompt = `SYSTEM:
You are a design-to-code expert. Convert Figma designs to React JSX.

USER:
${visionPrompt}

Design screenshot URL: ${screenshot}
Markdown context: ${markdown.substring(0, 1000)}

Output the React component code in <file> tags.`;
	
	let jsxCode = '';
	try {
		for await (const chunk of callGrok('grok-4', grokPrompt)) {
			if (chunk.type === 'text' && chunk.text) {
				jsxCode += chunk.text;
			}
		}
	} catch (error) {
		if (error instanceof RateLimitError) {
			throw new Error('Grok rate limit exceeded. Please try again later.');
		}
		throw error;
	}
	
	return jsxCode;
}

// Dual router: Grok → Claude refinement
async function dualRouterGenerate(
	prompt: string,
	files: Record<string, string> = {}
): Promise<{ files: Array<{ path: string; content: string }>; explanation: string; tests: string }> {
	costMonitor.trackCall('grok');
	
	if (!costMonitor.checkLimit()) {
		throw new Error('API call limit exceeded');
	}
	
	// Step 1: Grok generates initial scaffold
	const grokSystem = `You are an expert React developer. Generate integration code for third-party services.
Current files in project:
${Object.keys(files).map(path => `- ${path}`).join('\n')}

Output format:
<file path="...">FULL FILE CONTENT</file>
<explanation>Brief explanation</explanation>
<tests>Vitest test suite</tests>`;
	
	const grokUser = `USER REQUEST:\n${prompt}\n\nGenerate the integration code with proper setup, configuration, and tests.`;
	const grokPrompt = `SYSTEM:\n${grokSystem}\n\n${grokUser}`;
	
	let grokText = '';
	try {
		for await (const chunk of callGrok('grok-4', grokPrompt)) {
			if (chunk.type === 'text' && chunk.text) {
				grokText += chunk.text;
			}
		}
	} catch (error) {
		if (error instanceof RateLimitError) {
			throw new Error('Grok rate limit exceeded. Please try again later.');
		}
		throw error;
	}
	
	// Step 2: Claude refines the output
	costMonitor.trackCall('claude');
	
	if (!costMonitor.checkLimit()) {
		// Fall back to Grok output if limit reached
		return parseOutput(grokText, 'grok');
	}
	
	const anthropic = createAnthropic({
		apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
		baseURL: process.env.AI_GATEWAY_API_KEY ? 'https://ai-gateway.vercel.sh/v1' : (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'),
	});
	
	const claudeSystem = grokSystem;
	const claudeUser = `The following is an initial integration scaffold produced by Grok. Refine, harden, and correct any issues, then output final <file>, <explanation>, and <tests> tags.

INITIAL SCAFFOLD:
${grokText}

ORIGINAL REQUEST:
${prompt}`;
	
	let finalText = '';
	try {
		const result = await generateText({
			model: anthropic(process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-20241022'),
			messages: [
				{ role: 'system', content: claudeSystem },
				{ role: 'user', content: claudeUser }
			],
			maxOutputTokens: 8192,
			temperature: 0.3
		});
		finalText = result.text || '';
	} catch (error) {
		console.error('[integrate] Claude refinement failed, using Grok output:', error);
		return parseOutput(grokText, 'grok');
	}
	
	// Prefer Claude's output, fall back to Grok if empty
	const parsedClaude = parseOutput(finalText, 'claude');
	if (parsedClaude.files.length > 0) {
		return parsedClaude;
	}
	
	return parseOutput(grokText, 'grok');
}

function parseOutput(raw: string, modelUsed: 'grok' | 'claude'): {
	files: Array<{ path: string; content: string }>;
	explanation: string;
	tests: string;
} {
	const files: Array<{ path: string; content: string }> = [];
	
	// Extract <file> blocks
	const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
	let match: RegExpExecArray | null;
	while ((match = fileRegex.exec(raw)) !== null) {
		files.push({
			path: match[1],
			content: match[2].trim()
		});
	}
	
	// Extract explanation and tests
	const explanation = (raw.match(/<explanation>([\s\S]*?)<\/explanation>/)?.[1] || '').trim();
	const tests = (raw.match(/<tests>([\s\S]*?)<\/tests>/)?.[1] || '').trim();
	
	return { files, explanation, tests };
}

export async function POST(request: NextRequest) {
	try {
		const { prompt, files = {} } = await request.json();
		
		if (!prompt || typeof prompt !== 'string') {
			return NextResponse.json(
				{ error: 'Prompt is required' },
				{ status: 400 }
			);
		}
		
		// Check if prompt contains a Figma URL
		const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
		const isFigma = urlMatch && isFigmaUrl(urlMatch[0]);
		
		let integrationPrompt = prompt;
		let figmaJsx = '';
		
		// Handle Figma URL: scrape + vision to JSX
		if (isFigma && urlMatch) {
			try {
				figmaJsx = await processFigmaDesign(urlMatch[0]);
				// Append the generated JSX context to the prompt
				integrationPrompt = `${prompt}\n\nGenerated JSX from Figma design:\n${figmaJsx}`;
			} catch (error: any) {
				console.error('[integrate] Figma processing error:', error);
				return NextResponse.json(
					{ error: `Figma processing failed: ${error.message}` },
					{ status: 500 }
				);
			}
		}
		
		// Parse integration intent
		const intent = parseIntegrationIntent(integrationPrompt);
		
		// Build enhanced prompt with service context
		let enhancedPrompt = integrationPrompt;
		if (intent.integration) {
			enhancedPrompt = `Integrate ${intent.service} service:
- Package: ${intent.integration.package}
- Auth flow: ${intent.integration.authFlow || 'none'}
- Tests: ${intent.needsTests ? 'Include Vitest tests' : 'Skip tests'}

User request: ${prompt}

Generate complete integration code with:
1. Package installation instructions
2. Configuration setup
3. Component/hook implementation
4. ${intent.needsAuth ? 'Authentication flow' : 'Basic integration'}
5. ${intent.needsTests ? 'Mock tests' : 'No tests'}`;
		}
		
		// Generate code using dual router
		const result = await dualRouterGenerate(enhancedPrompt, files);
		
		// Add package info if service detected
		if (intent.integration) {
			result.files.unshift({
				path: 'INTEGRATION_INFO.md',
				content: `# ${intent.service} Integration

Package: \`${intent.integration.package}\`
Description: ${intent.integration.description}

## Installation
\`\`\`bash
npm install ${intent.integration.package}
\`\`\`

## Configuration
See generated files for setup instructions.
`
			});
		}
		
		return NextResponse.json({
			success: true,
			files: result.files,
			explanation: result.explanation,
			tests: result.tests,
			service: intent.service,
			package: intent.integration?.package,
			costInfo: {
				apiCalls: costMonitor.apiCalls,
				limit: costMonitor.limit
			}
		});
		
	} catch (error: any) {
		console.error('[integrate] Error:', error);
		return NextResponse.json(
			{ 
				success: false,
				error: error?.message || 'Internal Server Error',
				costInfo: {
					apiCalls: costMonitor.apiCalls,
					limit: costMonitor.limit
				}
			},
			{ status: 500 }
		);
	}
}

