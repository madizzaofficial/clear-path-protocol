import { createStart, createMiddleware } from "@tanstack/react-start";
import { serve } from "inngest/edge";

import { renderErrorPage } from "./lib/error-page";
import { inngest } from "./lib/inngest";
import { welcomeSequence, intakeConfirmation, routineNotification } from "./lib/inngest-functions";
import { handleStripeWebhook } from "./lib/stripe-webhook";

const inngestHandler = serve({
  client: inngest,
  functions: [welcomeSequence, intakeConfirmation, routineNotification],
  servePath: "/api/inngest",
});

const inngestMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/inngest") {
      return inngestHandler(request);
    }
    if (path === "/api/stripe/webhook") {
      return handleStripeWebhook(request);
    }
    return next();
  }
);

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [inngestMiddleware, errorMiddleware],
}));
