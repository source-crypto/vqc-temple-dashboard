import { api, APIError } from "encore.dev/api";
import { monitoredBlockchainDB as blockchainDB } from "./db";
import { withPerformanceMonitoring } from "./health";

export interface NFT {
  id: number;
  artifactId: number;
  ownerId: string;
  tokenUri: string;
  mintTxHash: string;
  createdAt: Date;
}

export interface NFTListing {
  id: number;
  nftId: number;
  sellerId: string;
  price: string;
  currency: string;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date;
}

// Lists an NFT for sale on the marketplace.
export const listNFT = api<{ nftId: number; sellerId: string; price: string; currency: string }, { listing: NFTListing }>(
  { expose: true, method: "POST", path: "/marketplace/list" },
  async ({ nftId, sellerId, price, currency }) => {
    return withPerformanceMonitoring("/marketplace/list", "POST", async () => {
      const nft = await blockchainDB.queryRow<{ owner_id: string }>`
        SELECT owner_id FROM nfts WHERE id = ${nftId}
      `;
      if (!nft || nft.owner_id !== sellerId) {
        throw APIError.permissionDenied("Only the owner can list this NFT.");
      }

      const listing = await blockchainDB.queryRow<any>`
        INSERT INTO nft_listings (nft_id, seller_id, price, currency)
        VALUES (${nftId}, ${sellerId}, ${price}, ${currency})
        RETURNING *
      `;

      return {
        listing: {
          id: listing.id,
          nftId: listing.nft_id,
          sellerId: listing.seller_id,
          price: listing.price,
          currency: listing.currency,
          status: listing.status,
          createdAt: listing.created_at,
          expiresAt: listing.expires_at,
        }
      };
    });
  }
);

// Buys an NFT from the marketplace.
export const buyNFT = api<{ listingId: number; buyerId: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/marketplace/buy" },
  async ({ listingId, buyerId }) => {
    return withPerformanceMonitoring("/marketplace/buy", "POST", async () => {
      await using tx = await blockchainDB.begin();
      try {
        const listing = await tx.queryRow<{ nft_id: number; seller_id: string; price: string; currency: string; status: string }>`
          SELECT nft_id, seller_id, price, currency, status FROM nft_listings WHERE id = ${listingId} FOR UPDATE
        `;

        if (!listing || listing.status !== 'active') {
          throw APIError.failedPrecondition("Listing is not active.");
        }

        const price = BigInt(listing.price);
        const buyerBalance = await tx.queryRow<{ balance: string }>`
          SELECT balance FROM user_balances WHERE user_id = ${buyerId} AND currency = ${listing.currency}
        `;

        if (!buyerBalance || BigInt(buyerBalance.balance) < price) {
          throw APIError.failedPrecondition("Insufficient balance.");
        }

        // Transfer funds
        await tx.exec`
          UPDATE user_balances SET balance = balance - ${listing.price} WHERE user_id = ${buyerId} AND currency = ${listing.currency}
        `;
        await tx.exec`
          UPDATE user_balances SET balance = balance + ${listing.price} WHERE user_id = ${listing.seller_id} AND currency = ${listing.currency}
        `;

        // Transfer NFT ownership
        await tx.exec`
          UPDATE nfts SET owner_id = ${buyerId} WHERE id = ${listing.nft_id}
        `;

        // Update listing status
        await tx.exec`
          UPDATE nft_listings SET status = 'sold' WHERE id = ${listingId}
        `;

        await tx.commit();
        return { success: true };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });
  }
);

// Gets all active NFT listings.
export const getNFTListings = api<void, { listings: NFTListing[] }>(
  { expose: true, method: "GET", path: "/marketplace/listings" },
  async () => {
    const listings = await blockchainDB.queryAll<any>`
      SELECT * FROM nft_listings WHERE status = 'active' ORDER BY created_at DESC
    `;
    return {
      listings: listings.map(l => ({
        id: l.id,
        nftId: l.nft_id,
        sellerId: l.seller_id,
        price: l.price,
        currency: l.currency,
        status: l.status,
        createdAt: l.created_at,
        expiresAt: l.expires_at,
      }))
    };
  }
);

// Gets NFTs owned by a user.
export const getUserNFTs = api<{ userId: string }, { nfts: NFT[] }>(
  { expose: true, method: "GET", path: "/marketplace/nfts/:userId" },
  async ({ userId }) => {
    const nfts = await blockchainDB.queryAll<any>`
      SELECT * FROM nfts WHERE owner_id = ${userId}
    `;
    return {
      nfts: nfts.map(n => ({
        id: n.id,
        artifactId: n.artifact_id,
        ownerId: n.owner_id,
        tokenUri: n.token_uri,
        mintTxHash: n.mint_tx_hash,
        createdAt: n.created_at,
      }))
    };
  }
);
