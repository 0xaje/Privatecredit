import { Router, Request, Response } from 'express';
import { database } from '../services/Database';
import { graphStore } from '../services/GraphStore';
import { eventStream } from '../services/EventStream';

export const auctionsRouter = Router();

// GET /api/auctions - list all auctions
auctionsRouter.get('/', (_req: Request, res: Response) => {
  const auctions = database.getAllAuctions();
  res.json({ auctions });
});

// POST /api/auctions - create / register an auction for a defaulted loan
auctionsRouter.post('/', (req: Request, res: Response) => {
  const { loanId, borrower, principal, collateralAmount, reservePrice, discountBps } = req.body;

  if (!loanId || !borrower || !principal) {
    res.status(400).json({ error: 'Missing required parameters (loanId, borrower, principal)' });
    return;
  }

  const auctionId = `auction_${loanId}_${Date.now()}`;
  const auction = {
    id: auctionId,
    loanId,
    borrower: borrower.toLowerCase(),
    principal,
    collateralAmount: collateralAmount || '0',
    reservePrice: reservePrice || principal,
    discountBps: discountBps || 2000, // 20% default discount for recovery buyers
    status: 'ACTIVE',
    createdAt: Math.floor(Date.now() / 1000),
    highestBid: null,
    highestBidder: null,
  };

  database.setAuction(auctionId, auction);

  // Add Auction Node to Graph
  const auctionNodeId = `auction_${auctionId}`;
  graphStore.addNode({
    id: auctionNodeId,
    type: 'AUCTION',
    data: {
      auctionId,
      loanId,
      borrower,
      principal,
      collateralAmount,
      discountBps: auction.discountBps,
      status: 'ACTIVE',
    },
    verified: true,
  });

  const loanNodeId = `loan_${loanId}`;
  if (graphStore.getNode(loanNodeId)) {
    graphStore.addEdge({
      id: `edge_auction_${auctionId}`,
      source: loanNodeId,
      target: auctionNodeId,
      type: 'AUCTIONED_FROM',
      verified: true,
    });
  }

  database.recordAuditEvent('AUCTION_CREATED', borrower, { auctionId, loanId, principal });
  eventStream.broadcast('AUCTION_UPDATED', auction);

  res.status(201).json({ success: true, auction });
});

// POST /api/auctions/:id/bid - place bid or settle auction
auctionsRouter.post('/:id/bid', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { bidder, amount } = req.body;

  const auction = database.getAuction(id);
  if (!auction) {
    res.status(404).json({ error: 'Auction not found' });
    return;
  }

  if (auction.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Auction is not active' });
    return;
  }

  auction.highestBid = amount;
  auction.highestBidder = bidder ? bidder.toLowerCase() : 'unknown';
  auction.status = 'SETTLED';
  auction.settledAt = Math.floor(Date.now() / 1000);

  database.setAuction(id, auction);

  const auctionNodeId = `auction_${id}`;
  if (graphStore.getNode(auctionNodeId)) {
    graphStore.updateNode(auctionNodeId, {
      data: {
        ...graphStore.getNode(auctionNodeId)!.data,
        status: 'SETTLED',
        highestBid: amount,
        highestBidder: bidder,
      },
    });
  }

  database.recordAuditEvent('AUCTION_SETTLED', bidder, { auctionId: id, bidAmount: amount });
  eventStream.broadcast('AUCTION_UPDATED', auction);

  res.json({ success: true, auction });
});
