import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gem, Store, Tag, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function NFTMarketplacePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = 'demo-user-123';

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['nft-listings'],
    queryFn: async () => {
      try {
        return await backend.blockchain.getNFTListings();
      } catch (err) {
        console.error('Failed to fetch NFT listings:', err);
        return { listings: [] };
      }
    },
  });

  const { data: userNfts, isLoading: nftsLoading } = useQuery({
    queryKey: ['user-nfts', userId],
    queryFn: async () => {
      try {
        return await backend.blockchain.getUserNFTs({ userId });
      } catch (err) {
        console.error('Failed to fetch user NFTs:', err);
        return { nfts: [] };
      }
    },
  });

  const buyNftMutation = useMutation({
    mutationFn: async (listingId: number) => {
      return await backend.blockchain.buyNFT({ listingId, buyerId: userId });
    },
    onSuccess: () => {
      toast({ title: "Purchase Successful", description: "NFT has been transferred to your wallet." });
      queryClient.invalidateQueries({ queryKey: ['nft-listings'] });
      queryClient.invalidateQueries({ queryKey: ['user-nfts', userId] });
    },
    onError: (err) => {
      console.error('Failed to buy NFT:', err);
      toast({ title: "Purchase Failed", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Store className="w-5 h-5 mr-2" />
            NFT Marketplace
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listingsLoading ? (
            <div>Loading listings...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings?.listings.map((listing) => (
                <div key={listing.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="font-bold text-white">Artifact NFT #{listing.nftId}</div>
                  <div className="text-sm text-slate-400">
                    Price: {(parseFloat(listing.price) / 1e18).toFixed(2)} {listing.currency}
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => buyNftMutation.mutate(listing.id)}
                    disabled={buyNftMutation.isPending}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy Now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Gem className="w-5 h-5 mr-2" />
            Your NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nftsLoading ? (
            <div>Loading your NFTs...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userNfts?.nfts.map((nft) => (
                <div key={nft.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="font-bold text-white">Artifact NFT #{nft.id}</div>
                  <div className="text-xs text-slate-400 break-all">
                    Mint TX: {nft.mintTxHash.substring(0, 16)}...
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-4">
                    <Tag className="w-4 h-4 mr-2" />
                    List for Sale
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
