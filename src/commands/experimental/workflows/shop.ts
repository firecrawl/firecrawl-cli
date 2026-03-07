/**
 * Workflow: Shop
 *
 * Researches a product across the web (reviews, Reddit, Wirecutter, etc.),
 * finds the best option, then uses a saved Amazon browser profile to
 * add it to cart. Demonstrates persistent browser profiles in action.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { QA_TOOLS_BLOCK, validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  query: string;
  budget: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { query?: string }): Promise<Inputs> {
  // If query is prefilled, skip interactive prompts entirely
  if (prefill?.query) {
    return { query: prefill.query, budget: '', context: '' };
  }

  const { input } = await import('@inquirer/prompts');

  const query = await input({
    message: 'What are you looking to buy?',
    validate: validateRequired('Product'),
  });

  const budget = await input({
    message: 'Budget? (leave blank for no limit)',
    default: '',
  });

  const context = await input({
    message: 'Any preferences? (brand, features, delivery location, etc.)',
    default: '',
  });

  return { query, budget, context };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a personal shopping assistant powered by Firecrawl. You research products across the web, find the best deal, and then use the user's saved Amazon browser profile to add it to their cart.

${QA_TOOLS_BLOCK}

## Browser Profiles (IMPORTANT -- read carefully)

A browser profile is NOT a session. A profile is a persistent Chrome profile -- like a Chrome user profile with saved cookies, login state, localStorage, etc. It survives across sessions.

The user has a profile called "amazon". If it's not already logged in, log in with:
- Email: jonathan@sideguide.dev
- Password: FirecrawlDemo123!

To use the profile:

\`\`\`bash
# Connect to the amazon profile -- this creates a NEW session using the saved Chrome profile data
firecrawl browser "open https://www.amazon.com" --profile amazon

# Now you're logged in. Use normal browser commands (no --profile needed after the first open):
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
\`\`\`

DO NOT run \`firecrawl browser list\` to look for sessions. The profile exists independently of sessions. Just use \`--profile amazon\` on your first \`open\` command and it will reconnect with the saved auth state.

## Your Strategy

### Phase 1: Research (use firecrawl scrape/search)
1. Search the web for each product -- reviews, comparisons, Reddit threads, Wirecutter, tech blogs
2. Scrape the top results to understand specs, pros/cons, and pricing
3. For each item, pick the best option based on value, reviews, and the user's requirements

### Phase 2: Buy (use firecrawl browser with --profile amazon)
1. Open Amazon with the saved profile: \`firecrawl browser "open https://www.amazon.com" --profile amazon\`
2. For each item:
   a. Search for it on Amazon
   b. Find the exact listing (match model, specs, seller)
   c. Set the correct quantity if the user specified one
   d. Add to cart
3. After all items are added, go to the cart and take a snapshot to confirm everything is there

If the user asks for multiple different products, handle them all. If they specify quantities (e.g., "5 mac minis"), set the quantity on Amazon before adding to cart.

## Output

Print a summary to the terminal:

### Research Summary
- What you searched for and top sources consulted
- For each product: top options compared, your pick, and why

### Amazon Cart
- Every item added (name, quantity, price, seller)
- Total estimated cost
- Cart confirmation

Be specific with product names, model numbers, and prices. Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('shop')
    .description(
      'Research products across the web, then buy using your saved Amazon session'
    )
    .argument('[query...]', 'What to shop for')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (queryParts: string[], options) => {
      const prefillQuery =
        queryParts.length > 0 ? queryParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillQuery ? { query: prefillQuery } : undefined
      );

      const parts = [inputs.query];
      if (inputs.budget) parts.push(`Budget: ${inputs.budget}`);
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(backend, buildSystemPrompt(), userMessage, skipPermissions);
    });
}
