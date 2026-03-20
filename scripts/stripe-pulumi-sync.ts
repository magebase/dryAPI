import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ENV_FILE = ".env.local";
const PULUMI_DIR = "cloudflare/clients/stripe/pulumi";

function updateEnv(updates: Record<string, string>) {
    if (!existsSync(ENV_FILE)) {
        writeFileSync(ENV_FILE, "");
    }
    let content = readFileSync(ENV_FILE, "utf-8");
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }
    }
    writeFileSync(ENV_FILE, content.trim() + "\n");
}

async function main() {
    process.chdir(PULUMI_DIR);
    
    // Ensure Pulumi is in local mode and passphrase is set to empty for automation if not provided
    process.env["PULUMI_CONFIG_PASSPHRASE"] = process.env["PULUMI_CONFIG_PASSPHRASE"] || "";
    
    console.log("Installing Pulumi dependencies...");
    execSync("pnpm install", { stdio: "inherit" });

    console.log("Running Pulumi up...");
    // Force local login and stack selection
    execSync("pulumi login --local", { stdio: "inherit" });
    
    try {
        execSync("pulumi stack select dev", { stdio: "inherit" });
    } catch {
        execSync("pulumi stack init dev", { stdio: "inherit" });
    }

    // Run the update
    execSync("pulumi up --yes --skip-preview", { stdio: "inherit" });

    // Capture outputs
    const output = execSync("pulumi stack output --json", { encoding: "utf-8" });
    const data = JSON.parse(output);

    // Map Pulumi outputs back to our .env.local expected keys
    // We export them from index.ts as productIds and priceIds
    const updates: Record<string, string> = {
        STRIPE_PORTAL_CONFIGURATION_ID: data.portalConfigId,
        STRIPE_SAAS_PRICE_STARTER: data.priceIds[0],
        STRIPE_SAAS_ANNUAL_PRICE_STARTER: data.priceIds[1],
        STRIPE_SAAS_PRICE_GROWTH: data.priceIds[2],
        STRIPE_SAAS_ANNUAL_PRICE_GROWTH: data.priceIds[3],
        STRIPE_SAAS_PRICE_SCALE: data.priceIds[4],
        STRIPE_SAAS_ANNUAL_PRICE_SCALE: data.priceIds[5],
    };

    process.chdir("../../../.."); // Back to root
    updateEnv(updates);
    console.log("Successfully synced Pulumi outputs to .env.local");
}

main().catch(console.error);
