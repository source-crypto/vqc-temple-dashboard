import { Topic, Subscription } from "encore.dev/pubsub";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import log from "encore.dev/log";

export interface TransactionConfirmationEvent {
  userId: string;
  type: 'buy' | 'sell' | 'swap' | 'liquidity_add' | 'liquidity_remove';
  status: 'completed' | 'failed';
  message: string;
  details: any;
}

// Topic for publishing transaction confirmation events.
export const transactionConfirmations = new Topic<TransactionConfirmationEvent>("tx-confirmations", {
  deliveryGuarantee: "at-least-once",
});

// Function to publish a transaction confirmation event.
export async function publishTransactionConfirmation(event: TransactionConfirmationEvent) {
  await transactionConfirmations.publish(event);
}

// Subscription to handle sending push notifications.
new Subscription(transactionConfirmations, "send-push-notification", {
  handler: async (event) => {
    log.info("Received transaction confirmation for user:", { userId: event.userId });

    const subscriptions = await blockchainDB.queryAll<{ device_token: string; platform: string }>`
      SELECT device_token, platform FROM push_notification_subscriptions WHERE user_id = ${event.userId}
    `;

    if (subscriptions.length === 0) {
      log.info("No push notification subscriptions found for user.", { userId: event.userId });
      return;
    }

    for (const sub of subscriptions) {
      // In a real application, this would integrate with a push notification service
      // like Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS).
      log.info("Simulating push notification send:", {
        deviceToken: sub.device_token,
        platform: sub.platform,
        title: `Transaction ${event.status}`,
        body: event.message,
      });
    }
  },
});
