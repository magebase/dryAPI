#!/usr/bin/env node

import { shouldEnableStripePortalEnsure } from "./stripe-portal-ensure";

const enabled = shouldEnableStripePortalEnsure(process.env);

process.stdout.write(enabled ? "true" : "false");